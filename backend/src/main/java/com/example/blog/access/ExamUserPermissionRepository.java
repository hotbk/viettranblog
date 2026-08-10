package com.example.blog.access;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExamUserPermissionRepository extends JpaRepository<ExamUserPermission, Long> {
    List<ExamUserPermission> findByExamId(Long examId);
    boolean existsByExamIdAndUserId(Long examId, Long userId);
    List<ExamUserPermission> findByUserIdAndExamIdIn(Long userId, List<Long> examIds);
    List<ExamUserPermission> findByUserId(Long userId);
    void deleteByExamId(Long examId);
}
