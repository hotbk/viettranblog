package com.example.blog.about;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Singleton row (always id=1) holding the public "About this blog" page content.
 * A single fixed-id row is deliberately simpler than a real settings table —
 * this page has exactly one instance, never a list.
 */
@Entity
@Table(name = "about_content")
public class AboutContent {

    public static final long SINGLETON_ID = 1L;

    @Id
    private Long id = SINGLETON_ID;

    @Column(nullable = false, length = 200)
    private String title = "";

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content = "";

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void onSave() {
        id = SINGLETON_ID;
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Instant getUpdatedAt() { return updatedAt; }
}
