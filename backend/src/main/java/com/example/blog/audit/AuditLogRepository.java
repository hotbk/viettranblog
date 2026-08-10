package com.example.blog.audit;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    // No pagination pattern exists elsewhere in this codebase yet — a bounded
    // "latest N" derived query keeps this consistent with the rest of the app
    // instead of introducing Pageable as a one-off.
    List<AuditLog> findTop200ByOrderByCreatedAtDesc();
}
