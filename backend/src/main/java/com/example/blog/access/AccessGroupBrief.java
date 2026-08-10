package com.example.blog.access;

/** Minimal group reference used in user-detail / post-detail composed responses. */
public record AccessGroupBrief(Long id, String name, String slug) {
    static AccessGroupBrief from(AccessGroup group) {
        return new AccessGroupBrief(group.getId(), group.getName(), group.getSlug());
    }
}
