package com.example.blog.book;

/**
 * The file formats this module accepts. MD, SH and SQL use the plaintext
 * reader; DOCX is rendered in the browser and is never executed by the server.
 */
public enum BookFileType {
    PDF,
    TXT,
    MD,
    SH,
    SQL,
    DOCX
}
