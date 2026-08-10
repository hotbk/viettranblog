package com.example.blog.post;

/**
 * Only meaningful when {@link Post#getVisibility()} is PRIVATE. Controls
 * whether an unauthorized viewer sees a locked teaser (title/excerpt/lock
 * badge) in listings, or nothing at all. Full content/attachments are NEVER
 * exposed to an unauthorized viewer regardless of this setting — this only
 * controls the teaser, not the content.
 */
public enum PostMetadataVisibility {
    PUBLIC_METADATA,
    AUTHORIZED_ONLY
}
