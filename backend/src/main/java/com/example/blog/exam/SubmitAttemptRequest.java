package com.example.blog.exam;

import java.util.List;

public record SubmitAttemptRequest(List<AnswerRequest> answers) {
    public record AnswerRequest(Long questionId, List<Long> selectedOptionIds, String textAnswer) {}
}
