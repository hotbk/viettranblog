package com.example.blog.series;

import com.example.blog.access.PostAccessService;
import com.example.blog.common.NotFoundException;
import com.example.blog.post.Post;
import com.example.blog.post.PostMetadataVisibility;
import com.example.blog.post.PostRepository;
import com.example.blog.post.PostStatus;
import com.example.blog.user.User;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SeriesService {

    private final SeriesRepository seriesRepository;
    private final SeriesPostRepository seriesPostRepository;
    private final PostRepository postRepository;
    private final PostAccessService postAccessService;

    public SeriesService(SeriesRepository seriesRepository,
                         SeriesPostRepository seriesPostRepository,
                         PostRepository postRepository,
                         PostAccessService postAccessService) {
        this.seriesRepository = seriesRepository;
        this.seriesPostRepository = seriesPostRepository;
        this.postRepository = postRepository;
        this.postAccessService = postAccessService;
    }

    @Transactional(readOnly = true)
    public List<SeriesSummaryResponse> listPublished() {
        return seriesRepository.findByStatus(PostStatus.PUBLISHED).stream()
                .map(s -> toSummary(s, seriesPostRepository.findBySeriesIdOrderByPositionAsc(s.getId()).size()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SeriesSummaryResponse> listAll() {
        return seriesRepository.findAll().stream()
                .map(s -> toSummary(s, seriesPostRepository.findBySeriesIdOrderByPositionAsc(s.getId()).size()))
                .toList();
    }

    /**
     * Public path — the only one that must filter private posts out of the
     * response (title/slug/excerpt would otherwise leak via this endpoint
     * regardless of the linked post's own visibility; see plan §A leak #2).
     * Deliberately NOT applied inside {@link #toDetail} itself, which is
     * shared with the admin paths below that need to see everything to
     * manage series order.
     *
     * Mirrors PostService.search's accessible/teaser/omit split (not a plain
     * filter) — an inaccessible PUBLIC_METADATA post still shows as a locked
     * teaser (title/excerpt, accessible=false) instead of vanishing, so a
     * series that links private posts the viewer can't read yet doesn't read
     * as broken/empty. AUTHORIZED_ONLY + inaccessible is omitted entirely.
     */
    @Transactional(readOnly = true)
    public SeriesDetailResponse getBySlug(String slug) {
        Series series = seriesRepository.findBySlug(slug)
                .orElseThrow(() -> new NotFoundException("SERIES_NOT_FOUND", "Series not found"));
        User currentUser = postAccessService.currentUserOrNull();
        List<SeriesPost> seriesPosts = seriesPostRepository.findBySeriesIdOrderByPositionAsc(series.getId());
        Set<Long> accessibleIds = postAccessService.resolveAccessiblePostIds(
                currentUser, seriesPosts.stream().map(SeriesPost::getPost).toList());

        List<SeriesPostItem> items = seriesPosts.stream()
                .<SeriesPostItem>mapMulti((sp, consumer) -> {
                    Post post = sp.getPost();
                    if (accessibleIds.contains(post.getId())) {
                        consumer.accept(toItem(sp, true));
                    } else if (post.getPrivateMetadataVisibility() == PostMetadataVisibility.PUBLIC_METADATA) {
                        consumer.accept(toItem(sp, false));
                    }
                    // else: AUTHORIZED_ONLY and inaccessible -> omit entirely, never sent to the client
                })
                .toList();
        return new SeriesDetailResponse(
                series.getId(), series.getTitle(), series.getSlug(), series.getDescription(),
                series.getStatus(), items.size(), series.getCreatedAt(), series.getUpdatedAt(), items);
    }

    @Transactional(readOnly = true)
    public SeriesDetailResponse getById(Long id) {
        Series series = seriesRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("SERIES_NOT_FOUND", "Series not found"));
        return toDetail(series);
    }

    @Transactional
    public SeriesDetailResponse create(SeriesRequest req) {
        if (seriesRepository.existsBySlug(req.slug().trim())) {
            throw new IllegalArgumentException("Slug already exists");
        }
        Series series = new Series();
        apply(series, req);
        return toDetail(seriesRepository.save(series));
    }

    @Transactional
    public SeriesDetailResponse update(Long id, SeriesRequest req) {
        Series series = seriesRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("SERIES_NOT_FOUND", "Series not found"));
        String newSlug = req.slug().trim();
        if (!series.getSlug().equals(newSlug) && seriesRepository.existsBySlugAndIdNot(newSlug, id)) {
            throw new IllegalArgumentException("Slug already exists");
        }
        apply(series, req);
        return toDetail(seriesRepository.save(series));
    }

    @Transactional
    public void delete(Long id) {
        if (!seriesRepository.existsById(id)) {
            throw new NotFoundException("SERIES_NOT_FOUND", "Series not found");
        }
        seriesPostRepository.deleteBySeriesId(id);
        seriesRepository.deleteById(id);
    }

    @Transactional
    public SeriesDetailResponse setPostOrder(Long id, SeriesPostsRequest req) {
        Series series = seriesRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("SERIES_NOT_FOUND", "Series not found"));

        List<Long> postIds = req.postIds() == null ? List.of() : req.postIds();
        List<Post> requestedPosts = postIds.stream()
                .map(postId -> postRepository.findById(postId)
                        .orElseThrow(() -> new IllegalArgumentException("Post not found: " + postId)))
                .toList();
        // A series is single-language, enforced at write time rather than by a
        // schema change (docs/10-multilingual-content.md §7.4) — a mixed-language
        // series would produce a prev/next link that jumps language mid-read.
        long distinctLanguages = requestedPosts.stream().map(Post::getLanguage).distinct().count();
        if (distinctLanguages > 1) {
            throw new IllegalArgumentException("SERIES_LANGUAGE_MISMATCH");
        }

        seriesPostRepository.deleteBySeriesId(id);
        seriesPostRepository.flush();

        int position = 1;
        for (Long postId : postIds) {
            Post post = postRepository.getReferenceById(postId);
            SeriesPost sp = new SeriesPost();
            sp.setSeries(series);
            sp.setPost(post);
            sp.setPosition(position++);
            seriesPostRepository.save(sp);
        }

        return toDetail(series);
    }

    // --- helpers ---

    private static void apply(Series series, SeriesRequest req) {
        series.setTitle(req.title().trim());
        series.setSlug(req.slug().trim());
        series.setDescription(req.description());
        if (req.status() != null) {
            series.setStatus(req.status());
        }
    }

    private SeriesSummaryResponse toSummary(Series s, int postCount) {
        return new SeriesSummaryResponse(
                s.getId(), s.getTitle(), s.getSlug(), s.getDescription(),
                s.getStatus(), postCount, s.getCreatedAt(), s.getUpdatedAt());
    }

    /** Unfiltered — admin paths only (sees every linked post regardless of its own visibility/grants). */
    SeriesDetailResponse toDetail(Series series) {
        List<SeriesPostItem> items = seriesPostRepository.findBySeriesIdOrderByPositionAsc(series.getId()).stream()
                .map(sp -> toItem(sp, true))
                .toList();
        return new SeriesDetailResponse(
                series.getId(), series.getTitle(), series.getSlug(), series.getDescription(),
                series.getStatus(), items.size(), series.getCreatedAt(), series.getUpdatedAt(), items);
    }

    private SeriesPostItem toItem(SeriesPost sp, boolean accessible) {
        Post post = sp.getPost();
        return new SeriesPostItem(
                sp.getPosition(),
                post.getId(),
                post.getTitle(),
                post.getSlug(),
                post.getExcerpt(),
                post.getStatus(),
                post.getPublishedAt(),
                post.getVisibility(),
                accessible);
    }
}
