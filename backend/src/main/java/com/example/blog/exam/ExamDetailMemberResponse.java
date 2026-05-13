package com.example.blog.exam;

import java.util.List;

public record ExamDetailMemberResponse(
        Long id,
        String title,
        String description,
        Integer timeLimit,
        Integer scoreScale,
        Double passScore,
        int questionCount,
        List<QuestionMemberResponse> questions
) {
    static ExamDetailMemberResponse from(Exam exam) {
        List<QuestionMemberResponse> qs = exam.getQuestions().stream()
                .map(QuestionMemberResponse::from).toList();
        return new ExamDetailMemberResponse(
                exam.getId(),
                exam.getTitle(),
                exam.getDescription(),
                exam.getTimeLimit(),
                exam.getScoreScale(),
                exam.getPassScore(),
                qs.size(),
                qs
        );
    }
}
