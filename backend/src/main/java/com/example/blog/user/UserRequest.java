package com.example.blog.user;

public record UserRequest(
        String username,
        String email,
        String password,
        UserRole role
) {}
