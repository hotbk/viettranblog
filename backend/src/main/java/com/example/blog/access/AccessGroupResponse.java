package com.example.blog.access;

import java.time.Instant;

public record AccessGroupResponse(
        Long id,
        String name,
        String slug,
        String description,
        boolean enabled,
        long userCount,
        long postCount,
        long examCount,
        long bookCount,
        Instant createdAt,
        Instant updatedAt
) {
    static AccessGroupResponse from(AccessGroup group, long userCount, long postCount, long examCount, long bookCount) {
        return new AccessGroupResponse(
                group.getId(), group.getName(), group.getSlug(), group.getDescription(),
                group.isEnabled(), userCount, postCount, examCount, bookCount,
                group.getCreatedAt(), group.getUpdatedAt());
    }
}
