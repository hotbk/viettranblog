package com.example.blog.exam;

import java.util.List;

public record ExamRequest(
        String title,
        String description,
        Integer timeLimit,
        Integer scoreScale,
        Double passScore,
        String status
) {}
