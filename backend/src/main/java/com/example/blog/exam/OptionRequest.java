package com.example.blog.exam;

public record OptionRequest(
        String content,
        boolean correct,
        int orderIndex
) {}
