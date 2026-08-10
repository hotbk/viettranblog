package com.example.blog.post;

import java.time.Instant;

/**
 * Lightweight card payload for the "related posts" sidebar widget — deliberately
 * narrower than {@link PostResponse} (no content, tags, visibility flags) since
 * it's a teaser link list, not a full post read.
 */
public record RelatedPostResponse(
        Long id,
        String title,
        String slug,
        String excerpt,
        String category,
        boolean hasCoverImage,
        String coverImageUrl,
        Instant publishedAt
) {
    static RelatedPostResponse from(Post post) {
        boolean hasImage = post.getCoverImageData() != null && post.getCoverImageData().length > 0;
        return new RelatedPostResponse(
                post.getId(),
                post.getTitle(),
                post.getSlug(),
                post.getExcerpt(),
                post.getCategory(),
                hasImage,
                hasImage ? "/api/posts/" + post.getId() + "/cover-image" : null,
                post.getPublishedAt()
        );
    }
}
