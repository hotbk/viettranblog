package com.example.blog.post;

import com.example.blog.common.NotFoundException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PostService {
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
    public PostResponse create(PostRequest request) {
        if (postRepository.existsBySlug(request.slug())) {
            throw new IllegalArgumentException("Slug already exists");
        }
        Post post = new Post();
        applyRequest(post, request);
        return PostResponse.from(postRepository.save(post));
    }

    @Transactional
    public PostResponse update(Long id, PostRequest request) {
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));
        applyRequest(post, request);
        return PostResponse.from(postRepository.save(post));
    }

    @Transactional
    public void delete(Long id) {
        if (!postRepository.existsById(id)) {
            throw new NotFoundException("POST_NOT_FOUND", "Post not found");
        }
        postRepository.deleteById(id);
    }

    private static void applyRequest(Post post, PostRequest request) {
        post.setTitle(request.title().trim());
        post.setSlug(request.slug().trim());
        post.setExcerpt(request.excerpt());
        post.setContent(request.content());
        post.setCategory(request.category());
        post.setTags(Tags.toStorage(request.tags()));
        post.setStatus(request.status());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
