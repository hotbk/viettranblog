package com.example.blog.tool;

import java.time.Instant;
import java.util.List;

/**
 * Deliberately excludes {@code htmlSource} — it can be up to the app-level
 * cap (see ToolService.MAX_HTML_SOURCE_SIZE) and is never needed by the list
 * or metadata views. The iframe on the detail page fetches it directly from
 * {@code GET /api/tools/{slug}/raw} instead of round-tripping it through this
 * JSON body.
 */
public record ToolResponse(
        Long id,
        String title,
        String slug,
        String category,
        List<String> tags,
        String excerpt,
        boolean hasCoverImage,
        String coverImageUrl,
        // Ready-to-use iframe src, same "backend hands back a relative URL,
        // frontend never hand-constructs API paths" convention as
        // PostAttachmentResponse.url.
        String rawUrl,
        ToolStatus status,
        ToolVisibility visibility,
        long viewCount,
        Instant createdAt,
        Instant updatedAt,
        Instant publishedAt
) {
    static ToolResponse from(Tool tool) {
        boolean hasCover = tool.getCoverImageData() != null && tool.getCoverImageData().length > 0;
        return new ToolResponse(
                tool.getId(),
                tool.getTitle(),
                tool.getSlug(),
                tool.getCategory(),
                Tags.toList(tool.getTags()),
                tool.getExcerpt(),
                hasCover,
                hasCover ? "/api/tools/" + tool.getId() + "/cover-image" : null,
                "/api/tools/" + tool.getSlug() + "/raw",
                tool.getStatus(),
                tool.getVisibility(),
                tool.getViewCount(),
                tool.getCreatedAt(),
                tool.getUpdatedAt(),
                tool.getPublishedAt()
        );
    }
}
