package com.example.blog.tool;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/** Comma-separated-string &lt;-&gt; List&lt;String&gt; helper — exact mirror of post.Tags
 * (package-private there, so not reusable across packages; same convention
 * as Post.tags, see docs/03-architecture.md §4.1). */
final class Tags {
    private Tags() {}

    static String toStorage(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return "";
        }
        return tags.stream()
                .map(String::trim)
                .filter(tag -> !tag.isBlank())
                .distinct()
                .collect(Collectors.joining(","));
    }

    static List<String> toList(String tags) {
        if (tags == null || tags.isBlank()) {
            return List.of();
        }
        return Arrays.stream(tags.split(","))
                .map(String::trim)
                .filter(tag -> !tag.isBlank())
                .toList();
    }
}
