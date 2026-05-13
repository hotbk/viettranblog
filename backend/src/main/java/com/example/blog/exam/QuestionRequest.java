package com.example.blog.exam;

import java.util.List;

public record QuestionRequest(
        String content,
        int orderIndex,
        int points,
        String questionType,
        List<OptionRequest> options
) {}
