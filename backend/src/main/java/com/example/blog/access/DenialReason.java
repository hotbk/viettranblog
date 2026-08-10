package com.example.blog.access;

/** Why a private-post read was denied — drives the specific 401/403 UX (see spec §10). */
public enum DenialReason {
    NOT_AUTHENTICATED,
    ACCOUNT_PENDING,
    ACCOUNT_REJECTED,
    ACCOUNT_SUSPENDED,
    NO_ACCESS
}
