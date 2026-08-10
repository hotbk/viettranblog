package com.example.blog.exam;

/**
 * Access-control axis for exams, independent of {@link ExamStatus} (editorial
 * workflow) — mirrors {@code post.PostVisibility}. PUBLIC preserves today's
 * behavior (any PUBLISHED exam is open to every member, and listed publicly
 * via /api/exams). PRIVATE restricts a PUBLISHED exam to members granted
 * access via an access group or a direct per-user grant (see
 * access.ExamAccessService).
 */
public enum ExamVisibility {
    PUBLIC,
    PRIVATE
}
