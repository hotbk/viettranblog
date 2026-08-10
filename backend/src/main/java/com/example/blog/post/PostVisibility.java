package com.example.blog.post;

/**
 * Access-control axis for a post — orthogonal to {@link PostStatus} (editorial
 * workflow: draft vs published). A post can be PUBLISHED and PRIVATE at the
 * same time; visibility decides *who* may read it, not whether it's finished.
 * Deliberately a plain enum so it's cheap to extend later (MEMBERS_ONLY,
 * ADMIN_ONLY, UNLISTED) without a schema rework — each new case just needs a
 * branch in PostAccessService.
 */
public enum PostVisibility {
    PUBLIC,
    PRIVATE
}
