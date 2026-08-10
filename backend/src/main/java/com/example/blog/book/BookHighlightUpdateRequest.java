package com.example.blog.book;

/** Only the note is editable — the anchor and snippet are immutable (see BookHighlightService). */
public record BookHighlightUpdateRequest(String note) {
}
