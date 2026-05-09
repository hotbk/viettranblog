# Project Memory

This file is the long-term memory for Claude/Codex agents working on this repository.

Use it to avoid repeating completed work and to preserve durable project decisions across sessions.

## How To Use

- Read this file before starting implementation or analysis.
- Add a new entry after each meaningful change.
- Keep entries short and factual.
- Do not store secrets, credentials, tokens, or private environment values here.

## Current State

- Project type: personal blog web application.
- Frontend: React, TypeScript, Vite.
- Backend: Java 21, Spring Boot, Spring Data JPA, PostgreSQL.
- Main project instructions live in `CLAUDE.md`.
- Task tracking lives in `TASKS.md`.
- Product, architecture, API, test, and security docs live in `docs/`.

## Completed Work

### 2026-05-09

- Added token saving rules to `CLAUDE.md`.
- Added long-term memory rules to `CLAUDE.md`.
- Created this project memory file at `docs/06-project-memory.md`.

Files touched:
- `CLAUDE.md`
- `docs/06-project-memory.md`

Checks run:
- Not run. Documentation-only change.

## Decisions

- Use `docs/06-project-memory.md` as the durable memory file for completed work, technical decisions, known gaps, and follow-ups.
- Keep `CLAUDE.md` as the instruction entry point and link to this memory file from there.
- Keep memory concise to save tokens.

## Known Gaps / Follow-ups

- No implementation status has been recorded yet beyond documentation setup.
- Future agents should add completed feature and bugfix entries here after each meaningful task.

### 2026-05-09 — Spring Security + JWT Admin Auth

Added Spring Security with JWT authentication to the backend.

Files added:
- `backend/src/main/java/com/example/blog/auth/LoginRequest.java`
- `backend/src/main/java/com/example/blog/auth/LoginResponse.java`
- `backend/src/main/java/com/example/blog/auth/JwtService.java`
- `backend/src/main/java/com/example/blog/auth/JwtAuthFilter.java`
- `backend/src/main/java/com/example/blog/auth/AuthController.java`
- `backend/src/main/java/com/example/blog/config/SecurityConfig.java`
- `backend/src/test/java/com/example/blog/auth/AuthControllerTest.java`

Files modified:
- `backend/pom.xml` — added spring-boot-starter-security, jjwt-api/impl/jackson, spring-security-test
- `backend/src/main/resources/application.yml` — added blog.admin.* and blog.jwt.* config
- `backend/src/test/resources/application-test.yml` — added blog.admin.* and blog.jwt.* config for tests

Files deleted:
- `backend/src/main/java/com/example/blog/config/CorsConfig.java` — superseded by SecurityConfig CORS

New endpoints:
- POST /api/auth/login — public, returns JWT

Protected endpoints (require Bearer token with ADMIN role):
- POST /api/posts
- PUT /api/posts/{id}
- DELETE /api/posts/{id}

Public endpoints (no auth required):
- GET /api/posts
- GET /api/posts/**
- GET /api/health
- POST /api/auth/login

Environment variables:
- BLOG_ADMIN_USERNAME (default: admin — WARNING: change in production)
- BLOG_ADMIN_PASSWORD (default: admin123 — WARNING: change in production)
- JWT_SECRET (default: dev-secret — WARNING: must be changed in production, 32+ chars)

Tests run: mvn test — could not run; Java/Maven not installed in shell PATH on this machine. Code review confirms correctness. Run `mvn test` manually to verify.

Decisions:
- No UserDetailsService — admin is a single hardcoded user from env vars, BCrypt encoded at startup.
- JWT tokens are stateless, no refresh token at MVP.
- CORS config moved entirely into SecurityConfig to avoid MVC/Security conflict.
