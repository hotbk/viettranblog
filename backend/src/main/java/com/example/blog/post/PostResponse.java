package com.example.blog.post;

import com.example.blog.common.ContentLanguage;
import com.example.blog.common.TranslationOrigin;
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
        PostVisibility visibility,
        PostMetadataVisibility privateMetadataVisibility,
        // False only for a locked teaser row in a list response (private post,
        // PUBLIC_METADATA, current viewer not authorized) — content/coverImage
        // are stripped whenever this is false. Always true for the detail
        // endpoint: an inaccessible post never reaches this record there, it
        // throws PostAccessDeniedException instead.
        boolean accessible,
        Instant createdAt,
        Instant updatedAt,
        Instant publishedAt,
        boolean hasCoverImage,
        String coverImageUrl,
        String coverImageOriginalFilename,
        String coverImageContentType,
        Long coverImageSize,
        SeriesInfo seriesInfo,
        long viewCount,
        // Admin-only convenience (e.g. "3 access groups" badge); null unless the
        // caller explicitly asked for it (admin listing), never sent for public reads.
        Integer accessGroupCount,
        // Populated on the detail endpoint and the admin listing only — list/teaser
        // cards don't need the attachment list, so it's an empty list there rather
        // than an extra query per row. See PostService.findBySlug / search(includeDrafts=true).
        List<PostAttachmentResponse> attachments,
        // --- Dual-language content (docs/10-multilingual-content.md §3) ---
        ContentLanguage language,
        TranslationOrigin translationOrigin,
        // Admin-only convenience, same null-unless-asked-for convention as
        // accessGroupCount above. Computed as source.updatedAt > sourceUpdatedAt;
        // never stored (docs/10 §1.2, §8 R1).
        Boolean translationStale,
        // Sibling language variants in this post's translation group,
        // excluding this row itself. Empty on a teaser and on public listing
        // rows (never on listings, only detail — docs/10 §3.1). Public callers
        // only ever see PUBLISHED siblings; admin callers see every sibling
        // including DRAFT ones.
        List<TranslationRef> translations
) {
    public record SeriesInfo(
            String seriesSlug,
            String seriesTitle,
            int position,
            int totalPosts,
            String prevPostSlug,
            String nextPostSlug
    ) {}

    /**
     * A sibling language variant. Deliberately flat (not a nested
     * PostResponse) — a switcher/panel needs a label, a URL, and enough
     * editorial state to flag drift (docs/10 §2.5, §3.1), not the full post.
     */
    public record TranslationRef(
            Long id,
            ContentLanguage language,
            String slug,
            String title,
            PostStatus status,
            PostVisibility visibility
    ) {
        static TranslationRef from(Post post) {
            return new TranslationRef(post.getId(), post.getLanguage(), post.getSlug(), post.getTitle(),
                    post.getStatus(), post.getVisibility());
        }
    }

    static PostResponse from(Post post) {
        return from(post, null, true, null, List.of(), List.of(), null);
    }

    static PostResponse from(Post post, SeriesInfo seriesInfo) {
        return from(post, seriesInfo, true, null, List.of(), List.of(), null);
    }

    /** Full response for a post the current viewer is allowed to read. */
    static PostResponse from(Post post, SeriesInfo seriesInfo, Integer accessGroupCount) {
        return from(post, seriesInfo, true, accessGroupCount, List.of(), List.of(), null);
    }

    /** Detail/admin-listing response, with the real attachment list populated. */
    static PostResponse withAttachments(Post post, SeriesInfo seriesInfo, Integer accessGroupCount,
                                         List<PostAttachmentResponse> attachments) {
        return from(post, seriesInfo, true, accessGroupCount, attachments, List.of(), null);
    }

    /** Detail/admin-listing response with the translation group siblings and staleness populated. */
    static PostResponse withAttachments(Post post, SeriesInfo seriesInfo, Integer accessGroupCount,
                                         List<PostAttachmentResponse> attachments,
                                         List<TranslationRef> translations, Boolean translationStale) {
        return from(post, seriesInfo, true, accessGroupCount, attachments, translations, translationStale);
    }

    /**
     * Locked teaser for a private post the current viewer is NOT allowed to
     * read (only ever called when privateMetadataVisibility == PUBLIC_METADATA
     * — the caller decides whether to include the post at all). Content and
     * cover image are never populated here. `translations` is always empty on
     * a teaser (docs/10 §3.1) — adding sibling info to a row the viewer can't
     * read is extra surface for zero benefit.
     */
    static PostResponse teaser(Post post) {
        return new PostResponse(
                post.getId(),
                post.getTitle(),
                post.getSlug(),
                post.getExcerpt(),
                null,
                post.getCategory(),
                Tags.toList(post.getTags()),
                post.getStatus(),
                post.getVisibility(),
                post.getPrivateMetadataVisibility(),
                false,
                post.getCreatedAt(),
                post.getUpdatedAt(),
                post.getPublishedAt(),
                false,
                null,
                null,
                null,
                null,
                null,
                post.getViewCount(),
                null,
                List.of(),
                post.getLanguage(),
                post.getTranslationOrigin(),
                null,
                List.of()
        );
    }

    private static PostResponse from(Post post, SeriesInfo seriesInfo, boolean accessible, Integer accessGroupCount,
                                      List<PostAttachmentResponse> attachments, List<TranslationRef> translations,
                                      Boolean translationStale) {
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
                post.getVisibility(),
                post.getPrivateMetadataVisibility(),
                accessible,
                post.getCreatedAt(),
                post.getUpdatedAt(),
                post.getPublishedAt(),
                hasImage,
                hasImage ? "/api/posts/" + post.getId() + "/cover-image" : null,
                post.getCoverImageOriginalFilename(),
                post.getCoverImageContentType(),
                post.getCoverImageSize(),
                seriesInfo,
                post.getViewCount(),
                accessGroupCount,
                attachments,
                post.getLanguage(),
                post.getTranslationOrigin(),
                translationStale,
                translations
        );
    }
}
