package com.example.blog.access;

/**
 * Thrown by {@link BookAccessService#requireRead} — mapped to 401/403 by
 * GlobalExceptionHandler. A distinct type from {@link PostAccessDeniedException}
 * deliberately — the type name is part of the module boundary, and the handler is two lines.
 */
public class BookAccessDeniedException extends RuntimeException {
    private final DenialReason reason;

    public BookAccessDeniedException(DenialReason reason) {
        super("Book access denied: " + reason);
        this.reason = reason;
    }

    public DenialReason getReason() {
        return reason;
    }
}
