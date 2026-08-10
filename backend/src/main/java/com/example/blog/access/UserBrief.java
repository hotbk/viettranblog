package com.example.blog.access;

import com.example.blog.user.User;

/** Minimal user reference used in group-detail / post-detail composed responses. */
public record UserBrief(Long id, String username, String email) {
    static UserBrief from(User user) {
        return new UserBrief(user.getId(), user.getUsername(), user.getEmail());
    }
}
