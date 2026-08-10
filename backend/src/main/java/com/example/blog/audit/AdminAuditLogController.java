package com.example.blog.audit;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Admin-only (guarded by SecurityConfig's `/api/admin/**` -> hasRole("ADMIN") matcher). Read-only. */
@RestController
@RequestMapping("/api/admin/audit-logs")
public class AdminAuditLogController {

    private final AuditLogService auditLogService;

    public AdminAuditLogController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public List<AuditLogResponse> list() {
        return auditLogService.listRecent().stream().map(AuditLogResponse::from).toList();
    }
}
