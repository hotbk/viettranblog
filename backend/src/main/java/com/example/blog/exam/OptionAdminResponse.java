package com.example.blog.exam;

public record OptionAdminResponse(Long id, String content, boolean correct, int orderIndex) {
    static OptionAdminResponse from(QuestionOption o) {
        return new OptionAdminResponse(o.getId(), o.getContent(), Boolean.TRUE.equals(o.getCorrect()), o.getOrderIndex());
    }
}
