package com.example.blog.book;

import java.time.Instant;

public record BookProgressResponse(int position, int total, ProgressUnit unit, int percent, Instant updatedAt) {
    static BookProgressResponse from(BookReadingProgress p) {
        return new BookProgressResponse(p.getPosition(), p.getTotal(), p.getUnit(), p.getPercent(), p.getUpdatedAt());
    }
}
