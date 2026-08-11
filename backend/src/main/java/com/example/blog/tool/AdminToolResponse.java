package com.example.blog.tool;

import java.time.Instant;
import java.util.List;

/**
 * {@link ToolResponse} plus {@code htmlSource} — used only by the admin
 * edit-form load ({@code GET /api/admin/tools/{id}}), the one place the raw
 * source is ever sent as JSON rather than through the dedicated
 * {@code /raw} endpoint.
 */
public record AdminToolResponse(
        Long id,
        String title,
        String slug,
        String category,
        List<String> tags,
        String excerpt,
        boolean hasCoverImage,
        String coverImageUrl,
        String rawUrl,
        String htmlSource,
        ToolStatus status,
        ToolVisibility visibility,
        long viewCount,
        Instant createdAt,
        Instant updatedAt,
        Instant publishedAt
) {
    static AdminToolResponse from(Tool tool, String htmlSource) {
        boolean hasCover = tool.getCoverImageData() != null && tool.getCoverImageData().length > 0;
        return new AdminToolResponse(
                tool.getId(),
                tool.getTitle(),
                tool.getSlug(),
                tool.getCategory(),
                Tags.toList(tool.getTags()),
                tool.getExcerpt(),
                hasCover,
                hasCover ? "/api/tools/" + tool.getId() + "/cover-image" : null,
                "/api/tools/" + tool.getSlug() + "/raw",
                htmlSource,
                tool.getStatus(),
                tool.getVisibility(),
                tool.getViewCount(),
                tool.getCreatedAt(),
                tool.getUpdatedAt(),
                tool.getPublishedAt()
        );
    }
}
