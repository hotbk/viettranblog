package com.example.blog.common;

/**
 * Body for {@code PUT .../translation-link}. {@code targetId == null} means
 * "unlink this row into a fresh group of its own" (docs/10-multilingual-content.md
 * §3.2). Shared between Post and Book admin controllers — the shape is
 * identical and has no domain-specific fields.
 */
public record TranslationLinkRequest(Long targetId) {
}
