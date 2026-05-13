package com.example.blog.exam;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ExamAttemptRepository extends JpaRepository<ExamAttempt, Long> {
    List<ExamAttempt> findByUserIdOrderByStartedAtDesc(Long userId);
    List<ExamAttempt> findByExamIdAndUserIdOrderByStartedAtDesc(Long examId, Long userId);
    List<ExamAttempt> findAllByOrderByStartedAtDesc();
    List<ExamAttempt> findByExamIdOrderByStartedAtDesc(Long examId);
}
