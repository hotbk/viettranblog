package com.example.blog.about;

import java.time.Instant;

public record AboutResponse(
        String title,
        String content,
        // Null until an admin saves it for the first time — the public page
        // uses this to tell "not configured yet" apart from "empty on purpose".
        Instant updatedAt
) {
    static AboutResponse from(AboutContent about) {
        return new AboutResponse(about.getTitle(), about.getContent(), about.getUpdatedAt());
    }

    /** Default shown before an admin has ever saved About content. */
    static AboutResponse empty() {
        return new AboutResponse("", "", null);
    }
}
