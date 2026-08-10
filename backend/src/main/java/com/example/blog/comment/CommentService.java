package com.example.blog.comment;

import com.example.blog.access.PostAccessService;
import com.example.blog.common.NotFoundException;
import com.example.blog.post.Post;
import com.example.blog.post.PostRepository;
import com.example.blog.user.User;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class CommentService {

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final PostAccessService postAccessService;

    public CommentService(CommentRepository commentRepository, PostRepository postRepository,
                           PostAccessService postAccessService) {
        this.commentRepository = commentRepository;
        this.postRepository = postRepository;
        this.postAccessService = postAccessService;
    }

    public List<CommentResponse> getByPostSlug(String slug) {
        Post post = findReadablePost(slug);
        return commentRepository.findByPostIdOrderByCreatedAtAsc(post.getId())
                .stream()
                .map(CommentResponse::from)
                .toList();
    }

    public CommentResponse create(String slug, CommentRequest request) {
        if (request.authorName() == null || request.authorName().isBlank()) {
            throw new IllegalArgumentException("Author name is required");
        }
        if (request.content() == null || request.content().isBlank()) {
            throw new IllegalArgumentException("Comment content is required");
        }

        Post post = findReadablePost(slug);

        Comment comment = new Comment();
        comment.setPost(post);
        comment.setAuthorName(request.authorName().trim());
        comment.setAuthorEmail(
                request.authorEmail() != null && !request.authorEmail().isBlank()
                        ? request.authorEmail().trim() : null);
        comment.setContent(request.content().trim());

        return CommentResponse.from(commentRepository.save(comment));
    }

    public void delete(Long id) {
        if (!commentRepository.existsById(id)) {
            throw new NotFoundException("COMMENT_NOT_FOUND", "Comment not found");
        }
        commentRepository.deleteById(id);
    }

    /**
     * Resolves a post by slug for the comment endpoints, treating "exists but
     * not readable" the same as "doesn't exist" (plain 404, no reason code) —
     * without this, a private post's slug could be probed/confirmed just by
     * hitting its comments endpoint, and its comments would be readable by
     * anyone who guessed the slug.
     */
    private Post findReadablePost(String slug) {
        Post post = postRepository.findBySlug(slug)
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));
        if (!postAccessService.canRead(postAccessService.currentUserOrNull(), post)) {
            throw new NotFoundException("POST_NOT_FOUND", "Post not found");
        }
        return post;
    }
}
