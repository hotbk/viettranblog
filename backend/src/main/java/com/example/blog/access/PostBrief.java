package com.example.blog.access;

import com.example.blog.post.Post;

/** Minimal post reference used in user-detail / group-detail composed responses. */
public record PostBrief(Long id, String title, String slug) {
    static PostBrief from(Post post) {
        return new PostBrief(post.getId(), post.getTitle(), post.getSlug());
    }
}
