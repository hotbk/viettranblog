package com.example.blog.book;

import java.time.Instant;
import java.util.List;

public record BookHighlightResponse(
        Long id,
        Long bookId,
        HighlightAnchorType anchorType,
        Integer startOffset,
        Integer endOffset,
        Integer pageNumber,
        List<BookHighlightRequest.Rect> rects,
        HighlightColor color,
        String text,
        String note,
        // Computed from (highlight.fileVersion != book.fileVersion), never stored —
        // one source of truth. True means the book's file was replaced since this
        // highlight was created, so its anchor may no longer point at the right place.
        boolean stale,
        Instant createdAt,
        Instant updatedAt
) {
    static BookHighlightResponse from(BookHighlight h, List<BookHighlightRequest.Rect> rects) {
        boolean stale = h.getFileVersion() != h.getBook().getFileVersion();
        return new BookHighlightResponse(
                h.getId(),
                h.getBook().getId(),
                h.getAnchorType(),
                h.getStartOffset(),
                h.getEndOffset(),
                h.getPageNumber(),
                rects,
                h.getColor(),
                h.getText(),
                h.getNote(),
                stale,
                h.getCreatedAt(),
                h.getUpdatedAt()
        );
    }
}
