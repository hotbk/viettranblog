package com.example.blog.tool;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A self-contained HTML/CSS/JS artifact's metadata. The actual markup lives
 * in {@link ToolSource} (a separate table, not a column here) so a bulk
 * listing query never risks loading a ~1 MB blob per row — same split as
 * {@code Book}/{@code BookFile}, see docs/03-architecture.md §4.3.
 */
@Entity
@Table(name = "tools")
public class Tool {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, unique = true)
    private String slug;

    private String category;

    @Column(length = 1000)
    private String tags;

    @Column(length = 1000)
    private String excerpt;

    @Column(name = "cover_image_data", columnDefinition = "bytea")
    private byte[] coverImageData;

    @Column(name = "cover_image_content_type", length = 100)
    private String coverImageContentType;

    @Column(name = "cover_image_original_filename", length = 255)
    private String coverImageOriginalFilename;

    @Column(name = "cover_image_size")
    private Long coverImageSize;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(20) default 'DRAFT'")
    private ToolStatus status = ToolStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(20) default 'PUBLIC'")
    private ToolVisibility visibility = ToolVisibility.PUBLIC;

    @Column(nullable = false, columnDefinition = "bigint default 0")
    private long viewCount = 0;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    private Instant publishedAt;

    @Column(name = "created_by")
    private Long createdBy;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (status == ToolStatus.PUBLISHED && publishedAt == null) {
            publishedAt = now;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
        if (status == ToolStatus.PUBLISHED && publishedAt == null) {
            publishedAt = updatedAt;
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }
    public String getExcerpt() { return excerpt; }
    public void setExcerpt(String excerpt) { this.excerpt = excerpt; }
    public byte[] getCoverImageData() { return coverImageData; }
    public void setCoverImageData(byte[] coverImageData) { this.coverImageData = coverImageData; }
    public String getCoverImageContentType() { return coverImageContentType; }
    public void setCoverImageContentType(String coverImageContentType) { this.coverImageContentType = coverImageContentType; }
    public String getCoverImageOriginalFilename() { return coverImageOriginalFilename; }
    public void setCoverImageOriginalFilename(String coverImageOriginalFilename) { this.coverImageOriginalFilename = coverImageOriginalFilename; }
    public Long getCoverImageSize() { return coverImageSize; }
    public void setCoverImageSize(Long coverImageSize) { this.coverImageSize = coverImageSize; }
    public ToolStatus getStatus() { return status; }
    public void setStatus(ToolStatus status) { this.status = status; }
    public ToolVisibility getVisibility() { return visibility; }
    public void setVisibility(ToolVisibility visibility) { this.visibility = visibility; }
    public long getViewCount() { return viewCount; }
    public void setViewCount(long viewCount) { this.viewCount = viewCount; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
}
