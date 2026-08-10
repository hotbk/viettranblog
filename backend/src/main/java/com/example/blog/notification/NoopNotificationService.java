package com.example.blog.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** Default {@link NotificationService}: logs only, sends nothing. See interface javadoc. */
@Service
public class NoopNotificationService implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NoopNotificationService.class);

    @Override
    public void notifyAccountApproved(Long userId) {
        log.info("[notification-noop] account approved userId={}", userId);
    }

    @Override
    public void notifyAccountRejected(Long userId) {
        log.info("[notification-noop] account rejected userId={}", userId);
    }

    @Override
    public void notifyAccountSuspended(Long userId) {
        log.info("[notification-noop] account suspended userId={}", userId);
    }

    @Override
    public void notifyAccessRequestApproved(Long userId, Long postId) {
        log.info("[notification-noop] access request approved userId={} postId={}", userId, postId);
    }

    @Override
    public void notifyAccessRequestRejected(Long userId, Long postId) {
        log.info("[notification-noop] access request rejected userId={} postId={}", userId, postId);
    }
}
