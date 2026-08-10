package com.example.blog.book;

import com.example.blog.common.ContentLanguage;
import com.example.blog.common.TranslationOrigin;
import java.time.Instant;
import java.util.List;

public record BookResponse(
        Long id,
        String title,
        String slug,
        String author,
        String description,
        String category,
        BookFileType fileType,
        String contentType,
        String originalFilename,
        Long fileSize,
        boolean hasCoverImage,
        String coverImageUrl,
        Long coverImageSize,
        boolean downloadable,
        BookStatus status,
        BookVisibility visibility,
        BookMetadataVisibility metadataVisibility,
        // True for a locked teaser row (private book, PUBLIC_METADATA, current
        // viewer not authorized) — fileUrl/contentType/originalFilename/fileSize
        // are stripped whenever this is true. Always false for the detail
        // endpoint: an inaccessible book never reaches this record there, it
        // throws BookAccessDeniedException instead.
        boolean locked,
        String fileUrl,
        ReadProgress readProgress,
        Instant createdAt,
        Instant updatedAt,
        Instant publishedAt,
        // Admin-only convenience; null unless the caller explicitly asked for it
        // (admin listing), never sent for public reads.
        Integer accessGroupCount,
        // --- Dual-language content (docs/10-multilingual-content.md §3) ---
        ContentLanguage language,
        TranslationOrigin translationOrigin,
        // Admin-only convenience, same null-unless-asked-for convention as
        // accessGroupCount. Computed as source.updatedAt > sourceUpdatedAt; never
        // stored (docs/10 §1.2, §8 R1).
        Boolean translationStale,
        // Sibling language variants, excluding this row. Empty on a teaser and
        // on listing rows (detail only — docs/10 §3.1). Public callers only
        // ever see PUBLISHED siblings; admin detail sees every sibling.
        List<TranslationRef> translations
) {
    public record ReadProgress(int position, int total, ProgressUnit unit, int percent, Instant updatedAt) {
        static ReadProgress from(BookReadingProgress p) {
            return new ReadProgress(p.getPosition(), p.getTotal(), p.getUnit(), p.getPercent(), p.getUpdatedAt());
        }
    }

    /** A sibling language variant — flat, mirrors PostResponse.TranslationRef. */
    public record TranslationRef(
            Long id,
            ContentLanguage language,
            String slug,
            String title,
            BookStatus status,
            BookVisibility visibility
    ) {
        static TranslationRef from(Book book) {
            return new TranslationRef(book.getId(), book.getLanguage(), book.getSlug(), book.getTitle(),
                    book.getStatus(), book.getVisibility());
        }
    }

    static BookResponse from(Book book, ReadProgress progress) {
        return from(book, progress, null, List.of(), null);
    }

    static BookResponse from(Book book, ReadProgress progress, Integer accessGroupCount) {
        return from(book, progress, accessGroupCount, List.of(), null);
    }

    static BookResponse from(Book book, ReadProgress progress, Integer accessGroupCount,
                              List<TranslationRef> translations, Boolean translationStale) {
        boolean hasImage = book.getCoverImageData() != null && book.getCoverImageData().length > 0;
        return new BookResponse(
                book.getId(),
                book.getTitle(),
                book.getSlug(),
                book.getAuthor(),
                book.getDescription(),
                book.getCategory(),
                book.getFileType(),
                book.getContentType(),
                book.getOriginalFilename(),
                book.getFileSize(),
                hasImage,
                hasImage ? "/api/books/" + book.getId() + "/cover-image" : null,
                book.getCoverImageSize(),
                book.isDownloadable(),
                book.getStatus(),
                book.getVisibility(),
                book.getMetadataVisibility(),
                false,
                "/api/books/" + book.getId() + "/file",
                progress,
                book.getCreatedAt(),
                book.getUpdatedAt(),
                book.getPublishedAt(),
                accessGroupCount,
                book.getLanguage(),
                book.getTranslationOrigin(),
                translationStale,
                translations
        );
    }

    /**
     * Locked teaser for a private book the current viewer is NOT allowed to
     * read (only ever called when metadataVisibility == PUBLIC_METADATA — the
     * caller decides whether to include the book at all). File access fields
     * are never populated here — see R11 in docs/08-book-library-module.md.
     */
    static BookResponse teaser(Book book) {
        boolean hasImage = book.getCoverImageData() != null && book.getCoverImageData().length > 0;
        return new BookResponse(
                book.getId(),
                book.getTitle(),
                book.getSlug(),
                book.getAuthor(),
                book.getDescription(),
                book.getCategory(),
                book.getFileType(),
                null,
                null,
                null,
                hasImage,
                hasImage ? "/api/books/" + book.getId() + "/cover-image" : null,
                null,
                false,
                book.getStatus(),
                book.getVisibility(),
                book.getMetadataVisibility(),
                true,
                null,
                null,
                book.getCreatedAt(),
                book.getUpdatedAt(),
                book.getPublishedAt(),
                null,
                book.getLanguage(),
                book.getTranslationOrigin(),
                null,
                List.of()
        );
    }
}
