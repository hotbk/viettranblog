package com.example.blog.access;

import jakarta.validation.constraints.NotBlank;

public record AccessGroupRequest(
        @NotBlank String name,
        @NotBlank String slug,
        String description,
        boolean enabled
) {
}
