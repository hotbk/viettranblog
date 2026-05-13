package com.example.blog.exam;

import java.util.List;

public record QuestionAdminResponse(Long id, String content, int orderIndex, int points, String questionType, List<OptionAdminResponse> options) {
    static QuestionAdminResponse from(Question q) {
        List<OptionAdminResponse> opts = q.getOptions().stream()
                .map(OptionAdminResponse::from).toList();
        return new QuestionAdminResponse(
                q.getId(), q.getContent(), q.getOrderIndex(), q.getPoints(),
                q.getQuestionType().name(), opts);
    }
}
