package com.example.blog.exam;

import java.time.format.DateTimeFormatter;
import java.util.List;

public record AdminAttemptDetailResponse(
        Long id,
        Long examId,
        String examTitle,
        Long userId,
        String username,
        Integer score,
        Integer totalPoints,
        String startedAt,
        String submittedAt,
        String status,
        List<AttemptDetailResponse.AnswerResultResponse> answers
) {
    private static final DateTimeFormatter FMT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    static AdminAttemptDetailResponse from(ExamAttempt a) {
        AttemptDetailResponse base = AttemptDetailResponse.from(a);
        return new AdminAttemptDetailResponse(
                base.id(),
                base.examId(),
                base.examTitle(),
                a.getUser().getId(),
                a.getUser().getUsername(),
                base.score(),
                base.totalPoints(),
                base.startedAt(),
                base.submittedAt(),
                base.status(),
                base.answers()
        );
    }
}
