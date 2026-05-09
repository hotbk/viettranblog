package com.example.blog.post;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record PostRequest(
        @NotBlank String title,
        @NotBlank String slug,
        String excerpt,
        @NotBlank String content,
        String category,
        List<String> tags,
        @NotNull PostStatus status
) {
}
