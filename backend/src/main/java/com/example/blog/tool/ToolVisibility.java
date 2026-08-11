package com.example.blog.tool;

/**
 * Deliberately simpler than {@code PostVisibility}/{@code BookVisibility}: no
 * access-group system for tools (not requested — every gated content type in
 * this app otherwise shares the group/direct-grant model in
 * docs/03-architecture.md §4.2). PRIVATE here just means "staff only"
 * (ADMIN/EDITOR), checked directly in {@link ToolService} — not a full
 * per-user/per-group grant model. If per-user tool sharing is ever needed,
 * that's a real feature addition, not a bug in this enum.
 */
public enum ToolVisibility {
    PUBLIC,
    PRIVATE
}
