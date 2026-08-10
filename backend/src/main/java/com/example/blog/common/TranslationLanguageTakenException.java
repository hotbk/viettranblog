package com.example.blog.common;

/**
 * Thrown when creating/linking would put two rows of the same
 * {@link ContentLanguage} in one translation group — the exact case
 * {@code UNIQUE(translation_group_id, language)} exists to prevent
 * (docs/10-multilingual-content.md §1.2, §3.2, R8). Mapped to
 * {@code 409 TRANSLATION_LANGUAGE_TAKEN} by GlobalExceptionHandler.
 */
public class TranslationLanguageTakenException extends RuntimeException {
    public TranslationLanguageTakenException() {
        super("A post/book with this language already exists in the translation group");
    }
}
