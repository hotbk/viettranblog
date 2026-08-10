package com.example.blog.audit;

import java.time.Instant;

public record AuditLogResponse(
        Long id,
        Long actorUserId,
        String action,
        String targetType,
        String targetId,
        String metadata,
        Instant createdAt
) {
    static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(log.getId(), log.getActorUserId(), log.getAction(),
                log.getTargetType(), log.getTargetId(), log.getMetadata(), log.getCreatedAt());
    }
}
