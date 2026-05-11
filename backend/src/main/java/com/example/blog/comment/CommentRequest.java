package com.example.blog.comment;

public record CommentRequest(
        String authorName,
        String authorEmail,
        String content
) {}
