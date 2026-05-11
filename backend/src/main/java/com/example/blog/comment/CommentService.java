package com.example.blog.comment;

import com.example.blog.common.NotFoundException;
import com.example.blog.post.Post;
import com.example.blog.post.PostRepository;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class CommentService {

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;

    public CommentService(CommentRepository commentRepository, PostRepository postRepository) {
        this.commentRepository = commentRepository;
        this.postRepository = postRepository;
    }

    public List<CommentResponse> getByPostSlug(String slug) {
        Post post = postRepository.findBySlug(slug)
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));
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

        Post post = postRepository.findBySlug(slug)
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));

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
}
