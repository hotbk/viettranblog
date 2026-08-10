package com.example.blog.user;

import com.example.blog.access.AccessGroupBrief;
import com.example.blog.access.PostBrief;
import java.time.Instant;
import java.util.List;

public record UserDetailResponse(
        Long id,
        String username,
        String email,
        UserRole role,
        UserStatus status,
        Instant approvedAt,
        Instant createdAt,
        List<AccessGroupBrief> accessGroups,
        List<PostBrief> directPostAccess
) {
    public static UserDetailResponse from(UserResponse base, List<AccessGroupBrief> groups, List<PostBrief> posts) {
        return new UserDetailResponse(base.id(), base.username(), base.email(), base.role(), base.status(),
                base.approvedAt(), base.createdAt(), groups, posts);
    }
}
