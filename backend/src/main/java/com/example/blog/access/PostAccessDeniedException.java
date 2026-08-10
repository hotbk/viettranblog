package com.example.blog.access;

/** Thrown by {@link PostAccessService#requireRead} — mapped to 401/403 by GlobalExceptionHandler. */
public class PostAccessDeniedException extends RuntimeException {
    private final DenialReason reason;

    public PostAccessDeniedException(DenialReason reason) {
        super("Post access denied: " + reason);
        this.reason = reason;
    }

    public DenialReason getReason() {
        return reason;
    }
}
