package com.example.blog.series;

import com.example.blog.post.PostStatus;
import jakarta.validation.constraints.NotBlank;

public record SeriesRequest(
    @NotBlank String title,
    @NotBlank String slug,
    String description,
    PostStatus status
) {}
