package com.example.blog.book;

/**
 * Access-control axis for a book — orthogonal to {@link BookStatus}, exact
 * mirror of {@code PostVisibility}. See {@code BookAccessService}.
 */
public enum BookVisibility {
    PUBLIC,
    PRIVATE
}
