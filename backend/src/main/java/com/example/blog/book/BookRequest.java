package com.example.blog.book;

import com.example.blog.common.ContentLanguage;
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
        boolean downloadable,
        // Dual-language content (docs/10-multilingual-content.md §3.2). Same
        // rules as PostRequest: defaults to VI when null; changing `language` on
        // update is rejected with 409 TRANSLATION_LANGUAGE_TAKEN if it collides
        // with a sibling; `translationOfBookId` is create-only (this is how a
        // translated PDF/TXT is added — a book variant always needs its own file
        // upload anyway, docs/10 §3.2).
        ContentLanguage language,
        Long translationOfBookId
) {
}
