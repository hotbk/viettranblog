package com.example.blog.exam;

import java.time.format.DateTimeFormatter;

public record ExamSummaryResponse(
        Long id,
        String title,
        String description,
        Integer timeLimit,
        Integer scoreScale,
        Double passScore,
        String status,
        int questionCount,
        String createdAt,
        String updatedAt
) {
    private static final DateTimeFormatter FMT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    static ExamSummaryResponse from(Exam exam) {
        return new ExamSummaryResponse(
                exam.getId(),
                exam.getTitle(),
                exam.getDescription(),
                exam.getTimeLimit(),
                exam.getScoreScale(),
                exam.getPassScore(),
                exam.getStatus().name(),
                exam.getQuestions().size(),
                exam.getCreatedAt() != null ? exam.getCreatedAt().format(FMT) : null,
                exam.getUpdatedAt() != null ? exam.getUpdatedAt().format(FMT) : null
        );
    }
}
