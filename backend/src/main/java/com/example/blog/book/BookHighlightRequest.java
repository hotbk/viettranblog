package com.example.blog.book;

import java.util.List;

public record BookHighlightRequest(
        HighlightAnchorType anchorType,
        Integer startOffset,
        Integer endOffset,
        Integer pageNumber,
        List<Rect> rects,
        HighlightColor color,
        String text,
        String note
) {
    public record Rect(double x, double y, double w, double h) {}
}
