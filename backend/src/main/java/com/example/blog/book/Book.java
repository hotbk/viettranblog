package com.example.blog.book;

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

/**
 * A book's metadata. The file bytes live in {@link BookFile} (a separate
 * table, not a column here) so a bulk {@code findAll()} for the library
 * listing never risks loading a 40MB blob per row — see
 * docs/08-book-library-module.md §1.2.
 */
@Entity
@Table(name = "books")
public class Book {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, unique = true)
    private String slug;

    private String author;

    @Column(length = 4000)
    private String description;

    private String category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private BookFileType fileType;

    @Column(nullable = false, length = 100)
    private String contentType;

    @Column(nullable = false, length = 255)
    private String originalFilename;

    @Column(nullable = false)
    private Long fileSize;

    // Bumped every time the file bytes are replaced (BookService.update()).
    // Highlights snapshot this at creation; a mismatch means their anchor may
    // no longer point at the right place in the new file — see
    // docs/09-book-highlights-phase2.md §2.3. Deliberately NOT used to
    // invalidate reading progress (that's still deleted outright, R12) —
    // a highlight's note is user-authored content and is flagged instead.
    @Column(nullable = false, columnDefinition = "integer default 1")
    private int fileVersion = 1;

    @Column(name = "cover_image_data", columnDefinition = "bytea")
    private byte[] coverImageData;

    @Column(name = "cover_image_content_type", length = 100)
    private String coverImageContentType;

    @Column(name = "cover_image_size")
    private Long coverImageSize;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(20) default 'DRAFT'")
    private BookStatus status = BookStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(20) default 'PUBLIC'")
    private BookVisibility visibility = BookVisibility.PUBLIC;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(20) default 'PUBLIC_METADATA'")
    private BookMetadataVisibility metadataVisibility = BookMetadataVisibility.PUBLIC_METADATA;

    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean downloadable = true;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    private Instant publishedAt;

    // --- Dual-language content (docs/10-multilingual-content.md §1) ---
    // Identical shape/rationale to the Post fields of the same name.

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 5, columnDefinition = "varchar(5) default 'VI'")
    private ContentLanguage language = ContentLanguage.VI;

    @Column(name = "translation_group_id", nullable = false)
    private long translationGroupId;

    @Column(name = "translated_from_id")
    private Long translatedFromId;

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
        if (status == BookStatus.PUBLISHED && publishedAt == null) {
            publishedAt = now;
        }
    }

    /** Mirrors Post.assignTranslationGroupId exactly — see its javadoc for the full reasoning. */
    @PostPersist
    void assignTranslationGroupId() {
        if (translationGroupId == 0) {
            translationGroupId = id;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
        if (status == BookStatus.PUBLISHED && publishedAt == null) {
            publishedAt = updatedAt;
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public BookFileType getFileType() { return fileType; }
    public void setFileType(BookFileType fileType) { this.fileType = fileType; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public int getFileVersion() { return fileVersion; }
    public void setFileVersion(int fileVersion) { this.fileVersion = fileVersion; }
    public byte[] getCoverImageData() { return coverImageData; }
    public void setCoverImageData(byte[] coverImageData) { this.coverImageData = coverImageData; }
    public String getCoverImageContentType() { return coverImageContentType; }
    public void setCoverImageContentType(String coverImageContentType) { this.coverImageContentType = coverImageContentType; }
    public Long getCoverImageSize() { return coverImageSize; }
    public void setCoverImageSize(Long coverImageSize) { this.coverImageSize = coverImageSize; }
    public BookStatus getStatus() { return status; }
    public void setStatus(BookStatus status) { this.status = status; }
    public BookVisibility getVisibility() { return visibility; }
    public void setVisibility(BookVisibility visibility) { this.visibility = visibility; }
    public BookMetadataVisibility getMetadataVisibility() { return metadataVisibility; }
    public void setMetadataVisibility(BookMetadataVisibility metadataVisibility) { this.metadataVisibility = metadataVisibility; }
    public boolean isDownloadable() { return downloadable; }
    public void setDownloadable(boolean downloadable) { this.downloadable = downloadable; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }
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
