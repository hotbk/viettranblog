package com.example.blog.access;

import jakarta.validation.constraints.NotBlank;

/**
 * Identifies the post by slug, not id — the client only ever knows a private
 * post's slug (from the URL it's already on), never its numeric id, since
 * that id is never sent back on a denied read. Resolved to a Post server-side.
 */
public record AccessRequestRequest(@NotBlank String postSlug, String message) {
}
