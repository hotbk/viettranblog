package com.example.blog.book;

import com.example.blog.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A reader's private highlight (optionally with a note) in a book. Anchor
 * shape depends on {@link #anchorType}: TXT_OFFSET uses startOffset/endOffset
 * into the decoded text; PDF_RECTS uses pageNumber + a JSON array of
 * normalized rects. See
 * docs/09-book-highlights-phase2.md §2/§3 for the full rationale — one table
 * with nullable typed columns rather than two tables or an opaque JSON blob.
 */
@Entity
@Table(
    name = "book_highlights",
    indexes = {
        @Index(name = "idx_book_highlights_book_user", columnList = "book_id, user_id"),
        @Index(name = "idx_book_highlights_user_updated", columnList = "user_id, updated_at")
    }
)
public class BookHighlight {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // Snapshot of Book.fileVersion at creation — a mismatch means "stale", see BookHighlightResponse.
    @Column(name = "file_version", nullable = false)
    private int fileVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "anchor_type", nullable = false, length = 16)
    private HighlightAnchorType anchorType;

    // TXT_OFFSET only
    @Column(name = "start_offset")
    private Integer startOffset;

    @Column(name = "end_offset")
    private Integer endOffset;

    // PDF_RECTS only
    @Column(name = "page_number")
    private Integer pageNumber;

    // PDF_RECTS only — JSON array of {x,y,w,h}, normalized 0-1. Pure geometry,
    // never queried, so a serialized TEXT column (not a new precedent here —
    // Post.tags is already a serialized string column).
    @Column(name = "rects", columnDefinition = "TEXT")
    private String rects;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private HighlightColor color = HighlightColor.YELLOW;

    // Denormalized snippet — non-negotiable, see design doc §3.3: without it,
    // a cross-book highlights list would mean re-fetching/decoding every book.
    @Column(nullable = false, length = 2000)
    private String text;

    @Column(length = 2000)
    private String note;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Book getBook() { return book; }
    public void setBook(Book book) { this.book = book; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public int getFileVersion() { return fileVersion; }
    public void setFileVersion(int fileVersion) { this.fileVersion = fileVersion; }
    public HighlightAnchorType getAnchorType() { return anchorType; }
    public void setAnchorType(HighlightAnchorType anchorType) { this.anchorType = anchorType; }
    public Integer getStartOffset() { return startOffset; }
    public void setStartOffset(Integer startOffset) { this.startOffset = startOffset; }
    public Integer getEndOffset() { return endOffset; }
    public void setEndOffset(Integer endOffset) { this.endOffset = endOffset; }
    public Integer getPageNumber() { return pageNumber; }
    public void setPageNumber(Integer pageNumber) { this.pageNumber = pageNumber; }
    public String getRects() { return rects; }
    public void setRects(String rects) { this.rects = rects; }
    public HighlightColor getColor() { return color; }
    public void setColor(HighlightColor color) { this.color = color; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
