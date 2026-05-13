package com.example.blog.exam;

import java.time.format.DateTimeFormatter;
import java.util.List;

public record ExamDetailAdminResponse(
        Long id,
        String title,
        String description,
        Integer timeLimit,
        Integer scoreScale,
        Double passScore,
        String status,
        int questionCount,
        String createdAt,
        String updatedAt,
        List<QuestionAdminResponse> questions
) {
    private static final DateTimeFormatter FMT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    static ExamDetailAdminResponse from(Exam exam) {
        List<QuestionAdminResponse> qs = exam.getQuestions().stream()
                .map(QuestionAdminResponse::from).toList();
        return new ExamDetailAdminResponse(
                exam.getId(),
                exam.getTitle(),
                exam.getDescription(),
                exam.getTimeLimit(),
                exam.getScoreScale(),
                exam.getPassScore(),
                exam.getStatus().name(),
                qs.size(),
                exam.getCreatedAt() != null ? exam.getCreatedAt().format(FMT) : null,
                exam.getUpdatedAt() != null ? exam.getUpdatedAt().format(FMT) : null,
                qs
        );
    }
}
