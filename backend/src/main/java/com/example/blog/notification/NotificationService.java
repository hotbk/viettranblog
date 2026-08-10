package com.example.blog.notification;

/**
 * Placeholder for account/access notifications (approved, rejected, suspended,
 * access request approved/rejected). No notification/email infrastructure
 * exists in this project yet, so this is intentionally just an interface with
 * a log-only implementation ({@link NoopNotificationService}) — callers
 * (approval/access-request flows) are already wired to it, so a real email/
 * in-app implementation can be swapped in later without touching call sites.
 */
public interface NotificationService {
    void notifyAccountApproved(Long userId);
    void notifyAccountRejected(Long userId);
    void notifyAccountSuspended(Long userId);
    void notifyAccessRequestApproved(Long userId, Long postId);
    void notifyAccessRequestRejected(Long userId, Long postId);
}
