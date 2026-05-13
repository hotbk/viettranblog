package com.example.blog.exam;

import java.util.List;

public record QuestionMemberResponse(Long id, String content, int orderIndex, int points, String questionType, List<OptionMemberResponse> options) {
    static QuestionMemberResponse from(Question q) {
        List<OptionMemberResponse> opts = q.getOptions().stream()
                .map(OptionMemberResponse::from).toList();
        return new QuestionMemberResponse(
                q.getId(), q.getContent(), q.getOrderIndex(), q.getPoints(),
                q.getQuestionType().name(), opts);
    }
}
