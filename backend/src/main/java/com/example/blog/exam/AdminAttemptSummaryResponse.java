package com.example.blog.exam;

import java.time.format.DateTimeFormatter;

public record AdminAttemptSummaryResponse(
        Long id,
        Long examId,
        String examTitle,
        Long userId,
        String username,
        Integer score,
        Integer totalPoints,
        Double scaledScore,
        Boolean passed,
        Integer scoreScale,
        Double passScore,
        String startedAt,
        String submittedAt,
        String status
) {
    private static final DateTimeFormatter FMT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    static AdminAttemptSummaryResponse from(ExamAttempt a) {
        Integer scoreScale = a.getExam().getScoreScale();
        Double passScore = a.getExam().getPassScore();
        Double scaledScore = AttemptDetailResponse.computeScaledScore(a.getScore(), a.getTotalPoints(), scoreScale);
        Boolean passed = (scaledScore != null && passScore != null) ? scaledScore >= passScore : null;
        return new AdminAttemptSummaryResponse(
                a.getId(),
                a.getExam().getId(),
                a.getExam().getTitle(),
                a.getUser().getId(),
                a.getUser().getUsername(),
                a.getScore(),
                a.getTotalPoints(),
                scaledScore,
                passed,
                scoreScale,
                passScore,
                a.getStartedAt() != null ? a.getStartedAt().format(FMT) : null,
                a.getSubmittedAt() != null ? a.getSubmittedAt().format(FMT) : null,
                a.getStatus().name()
        );
    }
}
