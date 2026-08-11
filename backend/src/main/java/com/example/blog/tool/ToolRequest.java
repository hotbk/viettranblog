package com.example.blog.tool;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record ToolRequest(
        @NotBlank String title,
        @NotBlank String slug,
        String category,
        List<String> tags,
        String excerpt,
        // The pasted, self-contained HTML/CSS/JS document. Stored verbatim in
        // ToolSource — see its javadoc for the trust model. Required on create;
        // on update, blank/absent leaves the existing source untouched (same
        // "empty means no change" convention as an omitted cover image).
        String htmlSource,
        @NotNull ToolStatus status,
        @NotNull ToolVisibility visibility
) {
}
