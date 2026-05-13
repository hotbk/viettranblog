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
        Long coverImageSize,
        SeriesInfo seriesInfo,
        long viewCount
) {
    public record SeriesInfo(
            String seriesSlug,
            String seriesTitle,
            int position,
            int totalPosts,
            String prevPostSlug,
            String nextPostSlug
    ) {}

    static PostResponse from(Post post) {
        return from(post, null);
    }

    static PostResponse from(Post post, SeriesInfo seriesInfo) {
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
                post.getCoverImageSize(),
                seriesInfo,
                post.getViewCount()
        );
    }
}
