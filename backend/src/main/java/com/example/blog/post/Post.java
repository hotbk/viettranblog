package com.example.blog.post;

import com.example.blog.common.ContentLanguage;
import com.example.blog.common.TranslationOrigin;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "posts")
public class Post {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(length = 1000)
    private String excerpt;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    private String category;

    @Column(length = 1000)
    private String tags;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PostStatus status = PostStatus.DRAFT;

    // Access-control axis, independent of `status` above. Existing posts must
    // stay public after migration — default is PUBLIC.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(20) default 'PUBLIC'")
    private PostVisibility visibility = PostVisibility.PUBLIC;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(20) default 'PUBLIC_METADATA'")
    private PostMetadataVisibility privateMetadataVisibility = PostMetadataVisibility.PUBLIC_METADATA;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    private Instant publishedAt;

    @Column(name = "cover_image_data", columnDefinition = "bytea")
    private byte[] coverImageData;

    @Column(name = "cover_image_content_type", length = 100)
    private String coverImageContentType;

    @Column(name = "cover_image_original_filename", length = 255)
    private String coverImageOriginalFilename;

    @Column(name = "cover_image_size")
    private Long coverImageSize;

    @Column(nullable = false, columnDefinition = "bigint default 0")
    private long viewCount = 0;

    // --- Dual-language content (docs/10-multilingual-content.md §1) ---

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 5, columnDefinition = "varchar(5) default 'VI'")
    private ContentLanguage language = ContentLanguage.VI;

    // Correlation id for "which posts are the same article in another
    // language" — plain column, deliberately no FK (docs/10 §1.3). NOT NULL
    // in the DB (post-backfill), but a brand-new standalone row cannot know
    // its own id before the first INSERT (IDENTITY generation), so this
    // starts at the placeholder 0 and the service layer fixes it up to the
    // row's own id in the same transaction right after the first save —
    // never visible outside that transaction (MVCC). A row joining an
    // existing group at creation time sets this directly to the target's
    // group id and never needs the fixup.
    @Column(name = "translation_group_id", nullable = false)
    private long translationGroupId;

    // The row this was translated from; null = original. Deliberately not a
    // FK (docs/10 §1.3) — may dangle after the source is deleted, which the
    // service layer treats as "this row is now the original" (R9).
    @Column(name = "translated_from_id")
    private Long translatedFromId;

    // Source row's updatedAt when this translation was last reviewed; drives
    // `translationStale` (source.updatedAt > sourceUpdatedAt), computed on
    // read and never stored as a boolean. Set at creation/link time and by
    // the explicit "mark reviewed" action only — never as a side effect of a
    // plain save (docs/10 §3.3).
    @Column(name = "source_updated_at")
    private Instant sourceUpdatedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "translation_origin", nullable = false, length = 10,
            columnDefinition = "varchar(10) default 'HUMAN'")
    private TranslationOrigin translationOrigin = TranslationOrigin.HUMAN;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (status == PostStatus.PUBLISHED && publishedAt == null) {
            publishedAt = now;
        }
    }

    /**
     * Fixes up translation_group_id to this row's own id for a brand-new
     * standalone row (docs/10-multilingual-content.md §1.3) — the id cannot be
     * known before the first INSERT (IDENTITY generation), so callers that
     * don't explicitly join an existing group leave this at the default 0,
     * and it's fixed up here, in one place, for every creation path (not just
     * PostService.create). At this point the entity is managed with its
     * generated id already assigned; Hibernate's dirty checking picks up this
     * mutation and flushes it as one extra UPDATE, never visible outside the
     * current transaction (MVCC). A row joining an existing group at creation
     * time already has a non-zero translationGroupId set before persist and
     * is left untouched.
     */
    @PostPersist
    void assignTranslationGroupId() {
        if (translationGroupId == 0) {
            translationGroupId = id;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
        if (status == PostStatus.PUBLISHED && publishedAt == null) {
            publishedAt = updatedAt;
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getExcerpt() { return excerpt; }
    public void setExcerpt(String excerpt) { this.excerpt = excerpt; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }
    public PostStatus getStatus() { return status; }
    public void setStatus(PostStatus status) { this.status = status; }
    public PostVisibility getVisibility() { return visibility; }
    public void setVisibility(PostVisibility visibility) { this.visibility = visibility; }
    public PostMetadataVisibility getPrivateMetadataVisibility() { return privateMetadataVisibility; }
    public void setPrivateMetadataVisibility(PostMetadataVisibility v) { this.privateMetadataVisibility = v; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }
    public byte[] getCoverImageData() { return coverImageData; }
    public void setCoverImageData(byte[] coverImageData) { this.coverImageData = coverImageData; }
    public String getCoverImageContentType() { return coverImageContentType; }
    public void setCoverImageContentType(String coverImageContentType) { this.coverImageContentType = coverImageContentType; }
    public String getCoverImageOriginalFilename() { return coverImageOriginalFilename; }
    public void setCoverImageOriginalFilename(String coverImageOriginalFilename) { this.coverImageOriginalFilename = coverImageOriginalFilename; }
    public Long getCoverImageSize() { return coverImageSize; }
    public void setCoverImageSize(Long coverImageSize) { this.coverImageSize = coverImageSize; }
    public long getViewCount() { return viewCount; }
    public void setViewCount(long viewCount) { this.viewCount = viewCount; }
    public ContentLanguage getLanguage() { return language; }
    public void setLanguage(ContentLanguage language) { this.language = language; }
    public long getTranslationGroupId() { return translationGroupId; }
    public void setTranslationGroupId(long translationGroupId) { this.translationGroupId = translationGroupId; }
    public Long getTranslatedFromId() { return translatedFromId; }
    public void setTranslatedFromId(Long translatedFromId) { this.translatedFromId = translatedFromId; }
    public Instant getSourceUpdatedAt() { return sourceUpdatedAt; }
    public void setSourceUpdatedAt(Instant sourceUpdatedAt) { this.sourceUpdatedAt = sourceUpdatedAt; }
    public TranslationOrigin getTranslationOrigin() { return translationOrigin; }
    public void setTranslationOrigin(TranslationOrigin translationOrigin) { this.translationOrigin = translationOrigin; }
}
