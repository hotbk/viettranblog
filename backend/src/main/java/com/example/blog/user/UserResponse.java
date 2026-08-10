package com.example.blog.user;

import java.time.Instant;

public record UserResponse(
        Long id,
        String username,
        String email,
        UserRole role,
        UserStatus status,
        Instant approvedAt,
        Instant createdAt
) {
    static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole(),
                user.getStatus(),
                user.getApprovedAt(),
                user.getCreatedAt()
        );
    }
}
