package com.example.blog.series;

import com.example.blog.post.PostStatus;
import java.time.Instant;
import java.util.List;

public record SeriesDetailResponse(
    Long id,
    String title,
    String slug,
    String description,
    PostStatus status,
    int postCount,
    Instant createdAt,
    Instant updatedAt,
    List<SeriesPostItem> posts
) {}
