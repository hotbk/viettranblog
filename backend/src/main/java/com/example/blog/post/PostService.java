package com.example.blog.post;

import com.example.blog.access.PostAccessGroupRepository;
import com.example.blog.access.PostAccessService;
import com.example.blog.common.NotFoundException;
import com.example.blog.series.SeriesPost;
import com.example.blog.series.SeriesPostRepository;
import com.example.blog.user.User;
import java.io.IOException;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PostService {

    private static final long MAX_IMAGE_SIZE = 2L * 1024 * 1024; // 2 MB
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp"
    );

    // Related-posts widget: how many recent published posts to score against,
    // and the default/max number of results returned.
    private static final int RELATED_CANDIDATE_POOL = 50;
    private static final int RELATED_DEFAULT_LIMIT = 5;
    private static final int RELATED_MAX_LIMIT = 10;

    private final PostRepository postRepository;
    private final SeriesPostRepository seriesPostRepository;
    private final PostAccessService postAccessService;
    private final PostAccessGroupRepository postAccessGroupRepository;
    private final PostAttachmentRepository postAttachmentRepository;

    public PostService(PostRepository postRepository, SeriesPostRepository seriesPostRepository,
                        PostAccessService postAccessService, PostAccessGroupRepository postAccessGroupRepository,
                        PostAttachmentRepository postAttachmentRepository) {
        this.postRepository = postRepository;
        this.seriesPostRepository = seriesPostRepository;
        this.postAccessService = postAccessService;
        this.postAccessGroupRepository = postAccessGroupRepository;
        this.postAttachmentRepository = postAttachmentRepository;
    }

    /**
     * Public/listing search. When includeDrafts is true this is the admin
     * "all posts" listing (already ADMIN-gated by SecurityConfig) and must
     * show everything unfiltered — an admin managing content needs to see
     * every private post regardless of their own group memberships. Only the
     * public path (includeDrafts=false) applies visibility filtering.
     */
    @Transactional(readOnly = true)
    public List<PostResponse> search(String q, String category, boolean includeDrafts) {
        String normalizedQuery = blankToNull(q);
        String normalizedCategory = blankToNull(category);
        List<Post> results = postRepository.search(normalizedQuery, normalizedCategory, includeDrafts);

        if (includeDrafts) {
            Map<Long, Integer> groupCounts = accessGroupCounts(results);
            Map<Long, List<PostAttachmentResponse>> attachmentsByPost = attachmentsByPostId(results);
            return results.stream()
                    .map(p -> PostResponse.withAttachments(p, null, groupCounts.get(p.getId()),
                            attachmentsByPost.getOrDefault(p.getId(), List.of())))
                    .toList();
        }

        User currentUser = postAccessService.currentUserOrNull();
        Set<Long> accessibleIds = postAccessService.resolveAccessiblePostIds(currentUser, results);
        return results.stream()
                .<PostResponse>mapMulti((post, consumer) -> {
                    if (accessibleIds.contains(post.getId())) {
                        consumer.accept(PostResponse.from(post));
                    } else if (post.getPrivateMetadataVisibility() == PostMetadataVisibility.PUBLIC_METADATA) {
                        consumer.accept(PostResponse.teaser(post));
                    }
                    // else: AUTHORIZED_ONLY and inaccessible -> omit entirely, never sent to the client
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public PostResponse findBySlug(String slug) {
        Post post = postRepository.findBySlug(slug)
                .filter(p -> p.getStatus() == PostStatus.PUBLISHED)
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));
        User currentUser = postAccessService.currentUserOrNull();
        postAccessService.requireRead(currentUser, post);
        List<PostAttachmentResponse> attachments = postAttachmentRepository
                .findByPostIdOrderByUploadedAtAsc(post.getId()).stream()
                .map(PostAttachmentResponse::from)
                .toList();
        return PostResponse.withAttachments(post, buildSeriesInfo(post, currentUser), null, attachments);
    }

    /**
     * "Related posts" sidebar widget on the post-detail page. Scores recent
     * published posts by category match (+2) and shared-tag count (+1 each),
     * drops non-matches (score 0) and anything the current viewer can't read
     * (private posts are simply omitted here, not teased — this is a link
     * list, not a listing page), then returns the top-scoring results.
     */
    @Transactional(readOnly = true)
    public List<RelatedPostResponse> findRelated(String slug, Integer limit) {
        Post post = postRepository.findBySlug(slug)
                .filter(p -> p.getStatus() == PostStatus.PUBLISHED)
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));
        User currentUser = postAccessService.currentUserOrNull();
        postAccessService.requireRead(currentUser, post);

        int effectiveLimit = clampRelatedLimit(limit);
        List<String> sourceTags = Tags.toList(post.getTags());
        List<Post> candidates = postRepository.findRecentPublishedExcluding(
                post.getId(), PageRequest.of(0, RELATED_CANDIDATE_POOL));

        return candidates.stream()
                .filter(candidate -> postAccessService.canRead(currentUser, candidate))
                .map(candidate -> Map.entry(candidate, relatedScore(post, sourceTags, candidate)))
                .filter(scored -> scored.getValue() > 0)
                .sorted(Comparator
                        .<Map.Entry<Post, Integer>>comparingInt(Map.Entry::getValue).reversed()
                        .thenComparing(scored -> publishedOrCreated(scored.getKey()), Comparator.reverseOrder()))
                .limit(effectiveLimit)
                .map(scored -> RelatedPostResponse.from(scored.getKey()))
                .toList();
    }

    private static int relatedScore(Post source, List<String> sourceTags, Post candidate) {
        int score = 0;
        if (source.getCategory() != null && source.getCategory().equalsIgnoreCase(candidate.getCategory())) {
            score += 2;
        }
        if (!sourceTags.isEmpty()) {
            Set<String> candidateTags = Tags.toList(candidate.getTags()).stream()
                    .map(String::toLowerCase)
                    .collect(Collectors.toCollection(HashSet::new));
            for (String tag : sourceTags) {
                if (candidateTags.contains(tag.toLowerCase())) {
                    score++;
                }
            }
        }
        return score;
    }

    private static Instant publishedOrCreated(Post post) {
        return post.getPublishedAt() != null ? post.getPublishedAt() : post.getCreatedAt();
    }

    private static int clampRelatedLimit(Integer requested) {
        if (requested == null) {
            return RELATED_DEFAULT_LIMIT;
        }
        return Math.max(1, Math.min(requested, RELATED_MAX_LIMIT));
    }

    @Transactional
    public PostResponse create(PostRequest request, MultipartFile coverImage) {
        if (postRepository.existsBySlug(request.slug())) {
            throw new IllegalArgumentException("Slug already exists");
        }
        Post post = new Post();
        applyRequest(post, request);
        if (coverImage != null && !coverImage.isEmpty()) {
            applyImage(post, coverImage);
        }
        return PostResponse.from(postRepository.save(post));
    }

    @Transactional
    public PostResponse updateStatus(Long id, PostStatus status) {
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));
        post.setStatus(status);
        // saveAndFlush forces the @PreUpdate callback (which stamps publishedAt) to run
        // before we read the entity back, so the response reflects it immediately.
        return PostResponse.from(postRepository.saveAndFlush(post));
    }

    @Transactional
    public PostResponse update(Long id, PostRequest request, MultipartFile coverImage, boolean removeCoverImage) {
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));
        String newSlug = request.slug().trim();
        if (!post.getSlug().equals(newSlug) && postRepository.existsBySlugAndIdNot(newSlug, id)) {
            throw new IllegalArgumentException("Slug already exists");
        }
        applyRequest(post, request);
        if (removeCoverImage) {
            clearImage(post);
        } else if (coverImage != null && !coverImage.isEmpty()) {
            applyImage(post, coverImage);
        }
        // saveAndFlush forces the @PreUpdate callback (which stamps publishedAt) to run
        // before we read the entity back, so the response reflects it immediately.
        return PostResponse.from(postRepository.saveAndFlush(post));
    }

    @Transactional
    public void recordView(String slug) {
        // Soft/non-critical endpoint: silently no-op (not an error) when the
        // post doesn't exist or the current viewer can't read it, same as it
        // silently no-op'd before this feature for non-PUBLISHED posts.
        postRepository.findBySlug(slug).ifPresent(post -> {
            if (post.getStatus() == PostStatus.PUBLISHED
                    && postAccessService.canRead(postAccessService.currentUserOrNull(), post)) {
                postRepository.incrementViewCount(slug);
            }
        });
    }

    @Transactional
    public void delete(Long id) {
        if (!postRepository.existsById(id)) {
            throw new NotFoundException("POST_NOT_FOUND", "Post not found");
        }
        // post_attachments has a required post_id FK with no DB-level cascade (same as
        // comments/access-groups/series links — a pre-existing gap, see docs/06-project-memory.md),
        // so it must be cleared first or this throws a FK constraint violation. Scoped to just
        // the table this feature added; the broader cleanup gap is not fixed here.
        postAttachmentRepository.deleteByPostId(id);
        postRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public Post getCoverImagePost(Long id) {
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));
        if (post.getCoverImageData() == null || post.getCoverImageData().length == 0) {
            throw new NotFoundException("COVER_IMAGE_NOT_FOUND", "Cover image not found");
        }
        // Plain 404 (not a reason-coded 403) on denial — this isn't the surface
        // that should explain *why*, and a distinct code would just become a
        // second oracle for probing private post/image existence.
        if (!postAccessService.canRead(postAccessService.currentUserOrNull(), post)) {
            throw new NotFoundException("COVER_IMAGE_NOT_FOUND", "Cover image not found");
        }
        return post;
    }

    // --- helpers ---

    private static void applyRequest(Post post, PostRequest request) {
        post.setTitle(request.title().trim());
        post.setSlug(request.slug().trim());
        post.setExcerpt(request.excerpt());
        post.setContent(request.content());
        post.setCategory(request.category());
        post.setTags(Tags.toStorage(request.tags()));
        post.setStatus(request.status());
        post.setVisibility(request.visibility() != null ? request.visibility() : PostVisibility.PUBLIC);
        post.setPrivateMetadataVisibility(
                request.privateMetadataVisibility() != null
                        ? request.privateMetadataVisibility()
                        : PostMetadataVisibility.PUBLIC_METADATA);
    }

    private static void applyImage(Post post, MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new IllegalArgumentException(
                    "Invalid image type. Allowed types: image/jpeg, image/png, image/webp");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new IllegalArgumentException("Image file exceeds maximum allowed size of 2 MB");
        }
        String sanitized = sanitizeFilename(file.getOriginalFilename());
        try {
            post.setCoverImageData(file.getBytes());
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to read image file: " + e.getMessage());
        }
        post.setCoverImageContentType(contentType);
        post.setCoverImageOriginalFilename(sanitized);
        post.setCoverImageSize(file.getSize());
    }

    private static void clearImage(Post post) {
        post.setCoverImageData(null);
        post.setCoverImageContentType(null);
        post.setCoverImageOriginalFilename(null);
        post.setCoverImageSize(null);
    }

    private static String sanitizeFilename(String filename) {
        if (filename == null) {
            return null;
        }
        // Strip path separators
        String sanitized = filename.replaceAll("[/\\\\]", "_");
        // Limit to 255 chars
        if (sanitized.length() > 255) {
            sanitized = sanitized.substring(sanitized.length() - 255);
        }
        return sanitized;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private Map<Long, Integer> accessGroupCounts(List<Post> posts) {
        List<Long> privateIds = posts.stream()
                .filter(p -> p.getVisibility() == PostVisibility.PRIVATE)
                .map(Post::getId)
                .toList();
        if (privateIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Integer> counts = new HashMap<>();
        postAccessGroupRepository.findByPostIdIn(privateIds).forEach(pag ->
                counts.merge(pag.getPost().getId(), 1, Integer::sum));
        return counts;
    }

    /** Batched attachment lookup for the admin listing — one query for all rows, not one per post. */
    private Map<Long, List<PostAttachmentResponse>> attachmentsByPostId(List<Post> posts) {
        if (posts.isEmpty()) {
            return Map.of();
        }
        List<Long> postIds = posts.stream().map(Post::getId).toList();
        return postAttachmentRepository.findByPostIdIn(postIds).stream()
                .collect(Collectors.groupingBy(
                        a -> a.getPost().getId(),
                        Collectors.mapping(PostAttachmentResponse::from, Collectors.toList())));
    }

    /**
     * Prev/next links in a series must respect the same access rules as
     * everything else — a public post sitting next to a private one in a
     * series must not leak the private post's title/slug to an unauthorized
     * viewer just because it's adjacent (see plan §A, leak vector #3).
     */
    private PostResponse.SeriesInfo buildSeriesInfo(Post post, User currentUser) {
        return seriesPostRepository.findByPostId(post.getId())
                .map(sp -> {
                    List<SeriesPost> all = seriesPostRepository
                            .findBySeriesIdOrderByPositionAsc(sp.getSeries().getId());
                    int pos = sp.getPosition();
                    int total = all.size();
                    String prev = all.stream()
                            .filter(p -> p.getPosition() == pos - 1)
                            .findFirst()
                            .map(SeriesPost::getPost)
                            .filter(p -> postAccessService.canRead(currentUser, p))
                            .map(Post::getSlug)
                            .orElse(null);
                    String next = all.stream()
                            .filter(p -> p.getPosition() == pos + 1)
                            .findFirst()
                            .map(SeriesPost::getPost)
                            .filter(p -> postAccessService.canRead(currentUser, p))
                            .map(Post::getSlug)
                            .orElse(null);
                    return new PostResponse.SeriesInfo(
                            sp.getSeries().getSlug(),
                            sp.getSeries().getTitle(),
                            pos, total, prev, next);
                })
                .orElse(null);
    }
}
