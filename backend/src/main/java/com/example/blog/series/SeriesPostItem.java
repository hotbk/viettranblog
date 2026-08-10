package com.example.blog.series;

import com.example.blog.post.PostStatus;
import com.example.blog.post.PostVisibility;
import java.time.Instant;

public record SeriesPostItem(
    int position,
    long postId,
    String title,
    String slug,
    String excerpt,
    PostStatus status,
    Instant publishedAt,
    PostVisibility visibility,
    // False only for a locked teaser row (private post, PUBLIC_METADATA, current
    // viewer not authorized) — mirrors PostResponse.accessible. Title/excerpt still
    // shown so the series doesn't read as broken/empty; the link still navigates to
    // /posts/{slug}, which then shows the normal reason-coded denial state.
    boolean accessible
) {}
