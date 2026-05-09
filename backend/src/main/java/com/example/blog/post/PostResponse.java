package com.example.blog.post;

import java.time.Instant;
import java.util.List;

public record PostResponse(
        Long id,
        String title,
        String slug,
        String excerpt,
        String content,
        String category,
        List<String> tags,
        PostStatus status,
        Instant createdAt,
        Instant updatedAt,
        Instant publishedAt,
        boolean hasCoverImage,
        String coverImageUrl,
        String coverImageOriginalFilename,
        String coverImageContentType,
        Long coverImageSize
) {
    static PostResponse from(Post post) {
        boolean hasImage = post.getCoverImageData() != null && post.getCoverImageData().length > 0;
        return new PostResponse(
                post.getId(),
                post.getTitle(),
                post.getSlug(),
                post.getExcerpt(),
                post.getContent(),
                post.getCategory(),
                Tags.toList(post.getTags()),
                post.getStatus(),
                post.getCreatedAt(),
                post.getUpdatedAt(),
                post.getPublishedAt(),
                hasImage,
                hasImage ? "/api/posts/" + post.getId() + "/cover-image" : null,
                post.getCoverImageOriginalFilename(),
                post.getCoverImageContentType(),
                post.getCoverImageSize()
        );
    }
}
