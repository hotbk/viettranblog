package com.example.blog.comment;

import java.time.Instant;

public record CommentResponse(
        Long id,
        Long postId,
        String authorName,
        String authorEmail,
        String content,
        Instant createdAt
) {
    static CommentResponse from(Comment c) {
        return new CommentResponse(
                c.getId(),
                c.getPost().getId(),
                c.getAuthorName(),
                c.getAuthorEmail(),
                c.getContent(),
                c.getCreatedAt()
        );
    }
}
