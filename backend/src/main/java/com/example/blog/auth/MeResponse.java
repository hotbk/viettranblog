package com.example.blog.auth;

import com.example.blog.user.UserRole;
import com.example.blog.user.UserStatus;

/**
 * Freshly loaded from the DB on every call (never decoded from the JWT) since
 * approval status can change while a session is still valid — the frontend
 * uses this only for informational banners (e.g. "your account is pending
 * approval"), never as the source of truth for whether a request is allowed.
 */
public record MeResponse(String username, UserRole role, UserStatus status) {
}
