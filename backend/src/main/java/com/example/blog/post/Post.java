package com.example.blog.post;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
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

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    private Instant publishedAt;

    @Lob
    @Column(name = "cover_image_data", columnDefinition = "bytea")
    private byte[] coverImageData;

    @Column(name = "cover_image_content_type", length = 100)
    private String coverImageContentType;

    @Column(name = "cover_image_original_filename", length = 255)
    private String coverImageOriginalFilename;

    @Column(name = "cover_image_size")
    private Long coverImageSize;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (status == PostStatus.PUBLISHED && publishedAt == null) {
            publishedAt = now;
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
}
