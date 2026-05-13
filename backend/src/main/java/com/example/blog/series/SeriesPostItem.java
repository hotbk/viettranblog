package com.example.blog.series;

import com.example.blog.post.PostStatus;
import java.time.Instant;

public record SeriesPostItem(
    int position,
    long postId,
    String title,
    String slug,
    String excerpt,
    PostStatus status,
    Instant publishedAt
) {}
