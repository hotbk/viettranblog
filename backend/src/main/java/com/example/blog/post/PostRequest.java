package com.example.blog.post;

import com.example.blog.common.ContentLanguage;
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
        @NotNull PostStatus status,
        @NotNull PostVisibility visibility,
        PostMetadataVisibility privateMetadataVisibility,
        // Dual-language content (docs/10-multilingual-content.md §3.2). Defaults
        // to VI when null. On update, changing `language` is allowed only if it
        // doesn't collide with an existing sibling's language in the same group
        // (else 409 TRANSLATION_LANGUAGE_TAKEN). `translationOfPostId` is
        // create-only: when present, the new post joins that post's translation
        // group, records the translation direction, and copies its access
        // config; ignored on update.
        ContentLanguage language,
        Long translationOfPostId
) {
}
