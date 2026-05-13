package com.example.blog.series;

import com.example.blog.post.PostStatus;
import java.time.Instant;

public record SeriesSummaryResponse(
    Long id,
    String title,
    String slug,
    String description,
    PostStatus status,
    int postCount,
    Instant createdAt,
    Instant updatedAt
) {}
