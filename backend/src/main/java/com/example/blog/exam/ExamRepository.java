package com.example.blog.exam;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ExamRepository extends JpaRepository<Exam, Long> {
    List<Exam> findByStatusOrderByCreatedAtDesc(ExamStatus status);
    List<Exam> findAllByOrderByCreatedAtDesc();
}
