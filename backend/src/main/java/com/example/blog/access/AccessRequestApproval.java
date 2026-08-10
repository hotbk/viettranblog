package com.example.blog.access;

import jakarta.validation.constraints.NotNull;

/** Admin's choice of how to grant an approved access request — a direct one-off permission, or by adding the user to an existing group. */
public record AccessRequestApproval(@NotNull GrantVia grantVia, Long accessGroupId) {
    public enum GrantVia { DIRECT, GROUP }
}
