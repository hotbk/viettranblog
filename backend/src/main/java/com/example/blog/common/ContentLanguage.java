package com.example.blog.common;

/**
 * Shared across every gated domain (Post, Book) — deliberately NOT duplicated
 * per-domain the way PostVisibility/BookVisibility are. Language has zero
 * per-domain behavioural difference, and the API query parameter, the
 * sitemap's hreflang attribute, and (later) the frontend's localStorage
 * preference must all use identical string values. See
 * docs/10-multilingual-content.md §1.4.
 */
public enum ContentLanguage {
    VI("vi", "Tiếng Việt"),
    EN("en", "English");

    private final String bcp47;
    private final String displayName;

    ContentLanguage(String bcp47, String displayName) {
        this.bcp47 = bcp47;
        this.displayName = displayName;
    }

    /** Lowercase BCP-47 code for hreflang / <html lang> / og:locale — never the enum name. */
    public String bcp47() {
        return bcp47;
    }

    public String displayName() {
        return displayName;
    }
}
