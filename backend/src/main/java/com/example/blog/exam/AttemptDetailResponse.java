package com.example.blog.exam;

import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public record AttemptDetailResponse(
        Long id,
        Long examId,
        String examTitle,
        Integer score,
        Integer totalPoints,
        Double scaledScore,
        Boolean passed,
        Integer scoreScale,
        Double passScore,
        String startedAt,
        String submittedAt,
        String status,
        Long durationSeconds,
        List<AnswerResultResponse> answers
) {
    private static final DateTimeFormatter FMT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    public record AnswerResultResponse(
            Long questionId,
            String questionContent,
            String questionType,
            List<Long> selectedOptionIds,
            List<String> selectedOptionContents,
            boolean correct,
            List<Long> correctOptionIds,
            List<String> correctOptionContents,
            String textAnswer,
            String correctTextAnswer
    ) {}

    static Double computeScaledScore(Integer score, Integer total, Integer scale) {
        if (score == null || total == null || total == 0 || scale == null) return null;
        return Math.round(((double) score / total * scale) * 10.0) / 10.0;
    }

    static AttemptDetailResponse from(ExamAttempt a) {
        List<AnswerResultResponse> answers = a.getAnswers().stream().map(ans -> {
            Question q = ans.getQuestion();

            List<QuestionOption> correctOpts = q.getOptions().stream()
                    .filter(o -> Boolean.TRUE.equals(o.getCorrect()))
                    .toList();

            List<Long> selectedIds = ans.getSelectedOptions().stream()
                    .map(QuestionOption::getId).toList();
            List<String> selectedContents = ans.getSelectedOptions().stream()
                    .map(QuestionOption::getContent).toList();

            return new AnswerResultResponse(
                    q.getId(),
                    q.getContent(),
                    q.getQuestionType().name(),
                    selectedIds,
                    selectedContents,
                    Boolean.TRUE.equals(ans.getCorrect()),
                    correctOpts.stream().map(QuestionOption::getId).toList(),
                    correctOpts.stream().map(QuestionOption::getContent).toList(),
                    ans.getTextAnswer(),
                    q.getCorrectTextAnswer()
            );
        }).toList();

        Integer scoreScale = a.getExam().getScoreScale();
        Double passScore = a.getExam().getPassScore();
        Double scaledScore = computeScaledScore(a.getScore(), a.getTotalPoints(), scoreScale);
        Boolean passed = (scaledScore != null && passScore != null) ? scaledScore >= passScore : null;
        Long durationSeconds = (a.getStartedAt() != null && a.getSubmittedAt() != null)
                ? Duration.between(a.getStartedAt(), a.getSubmittedAt()).getSeconds()
                : null;

        return new AttemptDetailResponse(
                a.getId(),
                a.getExam().getId(),
                a.getExam().getTitle(),
                a.getScore(),
                a.getTotalPoints(),
                scaledScore,
                passed,
                scoreScale,
                passScore,
                a.getStartedAt() != null ? a.getStartedAt().format(FMT) : null,
                a.getSubmittedAt() != null ? a.getSubmittedAt().format(FMT) : null,
                a.getStatus().name(),
                durationSeconds,
                answers
        );
    }
}
