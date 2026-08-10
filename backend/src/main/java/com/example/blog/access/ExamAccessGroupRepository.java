package com.example.blog.access;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExamAccessGroupRepository extends JpaRepository<ExamAccessGroup, Long> {
    List<ExamAccessGroup> findByExamId(Long examId);
    List<ExamAccessGroup> findByExamIdIn(List<Long> examIds);
    void deleteByExamId(Long examId);
    void deleteByAccessGroupId(Long accessGroupId);
    long countByAccessGroupId(Long accessGroupId);
}
