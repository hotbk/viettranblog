package com.example.blog.exam;

public record OptionMemberResponse(Long id, String content, int orderIndex) {
    static OptionMemberResponse from(QuestionOption o) {
        return new OptionMemberResponse(o.getId(), o.getContent(), o.getOrderIndex());
    }
}
