package com.example.blog.access;

import com.example.blog.exam.Exam;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/** Join entity: which access groups may take a given (private) exam. Mirrors PostAccessGroup. */
@Entity
@Table(
    name = "exam_access_groups",
    uniqueConstraints = @UniqueConstraint(columnNames = {"exam_id", "access_group_id"})
)
public class ExamAccessGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "access_group_id", nullable = false)
    private AccessGroup accessGroup;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Exam getExam() { return exam; }
    public void setExam(Exam exam) { this.exam = exam; }
    public AccessGroup getAccessGroup() { return accessGroup; }
    public void setAccessGroup(AccessGroup accessGroup) { this.accessGroup = accessGroup; }
}
