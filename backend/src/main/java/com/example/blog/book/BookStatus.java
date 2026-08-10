package com.example.blog.book;

/** Editorial workflow, mirrors {@code PostStatus}. Without this, uploading a book makes it instantly live. */
public enum BookStatus {
    DRAFT,
    PUBLISHED
}
