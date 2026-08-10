package com.example.blog.access;

import java.time.Instant;

public record AccessRequestResponse(
        Long id,
        Long userId,
        String username,
        Long postId,
        String postTitle,
        String message,
        AccessRequestStatus status,
        Instant createdAt,
        Instant reviewedAt,
        Long reviewedBy
) {
    static AccessRequestResponse from(AccessRequest r) {
        return new AccessRequestResponse(
                r.getId(), r.getUser().getId(), r.getUser().getUsername(),
                r.getPost().getId(), r.getPost().getTitle(),
                r.getMessage(), r.getStatus(), r.getCreatedAt(), r.getReviewedAt(), r.getReviewedBy());
    }
}
