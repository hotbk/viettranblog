package com.example.blog.book;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record BookRequest(
        @NotBlank String title,
        @NotBlank String slug,
        String author,
        String description,
        String category,
        @NotNull BookStatus status,
        @NotNull BookVisibility visibility,
        BookMetadataVisibility metadataVisibility,
        boolean downloadable
) {
}
