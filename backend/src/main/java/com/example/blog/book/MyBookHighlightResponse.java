package com.example.blog.book;

import com.example.blog.common.ContentLanguage;

/**
 * The cross-book "my highlights" row — wraps the same shape as
 * {@link BookHighlightResponse} plus the book fields the list needs to
 * render and deep-link without an N+1 book fetch per row. Deliberately not a
 * nested {@code BookResponse} — that would drag cover/access/progress fields
 * into a list payload that has no use for them.
 *
 * {@code bookLanguage} lets a reader who highlighted both language editions
 * tell them apart (e.g. "PostgreSQL Internals (EN)") — the Book is already
 * loaded to populate the other three fields, so this costs no extra query
 * (docs/10-multilingual-content.md §7.5).
 */
public record MyBookHighlightResponse(
        BookHighlightResponse highlight,
        String bookTitle,
        String bookSlug,
        BookFileType bookFileType,
        ContentLanguage bookLanguage
) {
}
