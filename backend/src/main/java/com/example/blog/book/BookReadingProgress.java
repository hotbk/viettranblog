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
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/**
 * Per-user reading position, one row per (book, user) — upserted, last-write-wins,
 * no cross-device merge. Only for authenticated users; anonymous readers get
 * localStorage persistence client-side instead (see docs/08-book-library-module.md §1.3).
 */
@Entity
@Table(
    name = "book_reading_progress",
    uniqueConstraints = @UniqueConstraint(columnNames = {"book_id", "user_id"})
)
public class BookReadingProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // PDF: 1-based page number. TXT: scroll percent 0-100.
    @Column(nullable = false)
    private int position;

    // PDF: page count. TXT: always 100.
    @Column(nullable = false)
    private int total;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ProgressUnit unit;

    // Denormalized 0-100 so the "continue reading" shelf needs no per-row math.
    @Column(nullable = false)
    private int percent;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void onSave() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Book getBook() { return book; }
    public void setBook(Book book) { this.book = book; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public int getTotal() { return total; }
    public void setTotal(int total) { this.total = total; }
    public ProgressUnit getUnit() { return unit; }
    public void setUnit(ProgressUnit unit) { this.unit = unit; }
    public int getPercent() { return percent; }
    public void setPercent(int percent) { this.percent = percent; }
    public Instant getUpdatedAt() { return updatedAt; }
}
