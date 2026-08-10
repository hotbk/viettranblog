package com.example.blog.user;

/**
 * Account approval status — separate from {@link UserRole} (what you can do)
 * and separate from authentication (whether your credentials are valid).
 * Only ACTIVE accounts can be granted private-post access; PENDING/REJECTED/
 * SUSPENDED accounts can still authenticate (unchanged login behavior) but
 * are denied at the authorization layer for anything gated by approval.
 */
public enum UserStatus {
    PENDING,
    ACTIVE,
    REJECTED,
    SUSPENDED
}
