package com.example.blog.book;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record BookProgressRequest(
        @Min(0) int position,
        @Min(1) int total,
        @NotNull ProgressUnit unit
) {
}
