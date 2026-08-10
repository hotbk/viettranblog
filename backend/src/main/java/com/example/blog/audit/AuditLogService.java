package com.example.blog.audit;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional
    public void record(Long actorUserId, AuditAction action, String targetType, String targetId, String metadata) {
        AuditLog log = new AuditLog();
        log.setActorUserId(actorUserId);
        log.setAction(action.name());
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setMetadata(metadata);
        auditLogRepository.save(log);
    }

    @Transactional(readOnly = true)
    public List<AuditLog> listRecent() {
        return auditLogRepository.findTop200ByOrderByCreatedAtDesc();
    }
}
