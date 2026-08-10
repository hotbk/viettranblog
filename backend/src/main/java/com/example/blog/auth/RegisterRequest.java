package com.example.blog.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Public self-registration payload. Deliberately has NO role/status fields —
 * unlike the admin-only UserRequest (POST /api/admin/users), which does carry
 * a role. Binding this directly instead of reusing UserRequest is what keeps
 * a self-registering caller from smuggling `"role":"ADMIN"` into the request
 * body; the service layer hardcodes role=MEMBER, status=PENDING regardless of
 * what's sent here.
 */
public record RegisterRequest(
        @NotBlank @Size(min = 3, max = 50) String username,
        @NotBlank @Email @Size(max = 100) String email,
        @NotBlank @Size(min = 8, max = 100) String password
) {
}
