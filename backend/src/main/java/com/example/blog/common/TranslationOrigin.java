package com.example.blog.common;

/**
 * Provenance of a translation row's text. Recorded permanently — cheap to
 * capture now, impossible to reconstruct later. See
 * docs/10-multilingual-content.md §1.2, §6.3.
 */
public enum TranslationOrigin {
    HUMAN,
    MACHINE
}
