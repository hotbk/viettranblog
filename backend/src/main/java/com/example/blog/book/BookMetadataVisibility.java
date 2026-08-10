package com.example.blog.book;

/**
 * Only meaningful when {@link Book#getVisibility()} is PRIVATE — mirrors
 * {@code PostMetadataVisibility}. Controls whether an unauthorized viewer sees
 * a locked teaser card in the library listing, or nothing at all. The file
 * itself is never exposed to an unauthorized viewer regardless of this setting.
 */
public enum BookMetadataVisibility {
    PUBLIC_METADATA,
    AUTHORIZED_ONLY
}
