package com.example.blog.post;

import com.example.blog.common.NotFoundException;
import java.io.IOException;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PostService {

    private static final long MAX_IMAGE_SIZE = 2L * 1024 * 1024; // 2 MB
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp"
    );

    private final PostRepository postRepository;

    public PostService(PostRepository postRepository) {
        this.postRepository = postRepository;
    }

    @Transactional(readOnly = true)
    public List<PostResponse> search(String q, String category, boolean includeDrafts) {
        String normalizedQuery = blankToNull(q);
        String normalizedCategory = blankToNull(category);
        return postRepository.search(normalizedQuery, normalizedCategory, includeDrafts).stream()
                .map(PostResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PostResponse findBySlug(String slug) {
        return postRepository.findBySlug(slug)
                .filter(post -> post.getStatus() == PostStatus.PUBLISHED)
                .map(PostResponse::from)
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));
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
        return PostResponse.from(postRepository.save(post));
    }

    @Transactional
    public void delete(Long id) {
        if (!postRepository.existsById(id)) {
            throw new NotFoundException("POST_NOT_FOUND", "Post not found");
        }
        postRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public Post getCoverImagePost(Long id) {
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));
        if (post.getCoverImageData() == null || post.getCoverImageData().length == 0) {
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
}
