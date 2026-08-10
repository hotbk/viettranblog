package com.example.blog.book;

/**
 * The cross-book "my highlights" row — wraps the same shape as
 * {@link BookHighlightResponse} plus the 3 book fields the list needs to
 * render and deep-link without an N+1 book fetch per row. Deliberately not a
 * nested {@code BookResponse} — that would drag cover/access/progress fields
 * into a list payload that has no use for them.
 */
public record MyBookHighlightResponse(
        BookHighlightResponse highlight,
        String bookTitle,
        String bookSlug,
        BookFileType bookFileType
) {
}
