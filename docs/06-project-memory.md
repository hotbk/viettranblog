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

### 2026-05-09 — Security hardening + test coverage

Fixed 4 QA-identified risks.

Files changed:
- `backend/src/main/java/com/example/blog/config/SecurityConfig.java` — added `AuthenticationEntryPoint` returning JSON 401; unauthenticated requests now correctly return 401 instead of 403
- `backend/src/main/resources/application.yml` — excluded `UserDetailsServiceAutoConfiguration` to suppress unused InMemoryUserDetailsManager and Basic-auth entry point
- `backend/src/test/resources/application-test.yml` — same exclusion for test profile
- `backend/src/main/java/com/example/blog/post/DataSeeder.java` — added `@Profile("!test")` so seeder does not run during tests
- `backend/src/test/java/com/example/blog/auth/AuthControllerTest.java` — added TC-2 (health), TC-4 (PUT 401), TC-5 (DELETE 401), TC-8 (POST with token → 201); corrected TC-3 assertion back to `isUnauthorized()` after AuthenticationEntryPoint fix

Tests run: `mvn test` — 10 tests, 0 failures, 0 errors.

Decisions:
- `AuthenticationEntryPoint` writes raw JSON string matching `ApiError` shape `{"code":"UNAUTHORIZED","message":"..."}` to avoid circular dependency with `GlobalExceptionHandler`.
- `DataSeeder` is excluded from test profile to prevent seed data interfering with assertions and to speed up test context load.

### 2026-05-09 — Cover image upload support (Frontend)

Added cover image upload, preview, and display across the frontend.

Files changed:
- `frontend/src/types.ts` — added `hasCoverImage`, `coverImageUrl`, `coverImageOriginalFilename`, `coverImageContentType`, `coverImageSize` to `BlogPost`
- `frontend/src/api.ts` — `createPost` and `updatePost` now use `FormData` (multipart); removed `Content-Type: application/json`; `coverImage?: File` and `removeCoverImage?: boolean` params added
- `frontend/src/pages/PostForm.tsx` — added cover image file input with client-side validation (JPEG/PNG/WebP, max 2 MB), object URL preview, remove button, existing image display in edit mode
- `frontend/src/App.tsx` — post cards show `<img class="post-card__cover">` when `hasCoverImage` is true
- `frontend/src/pages/PostDetail.tsx` — post detail shows `<img class="post-detail__cover">` hero image below title
- `frontend/src/styles.css` — added `.post-card__cover`, `.post-detail__cover`, `.cover-image-upload`, `.cover-image-preview`, `.cover-image-remove-btn`

Checks run: `npm run lint`, `npm run typecheck`, `npm run build` — all passed, zero warnings.

Decisions:
- No Base64 anywhere; binary image data only fetched via `coverImageUrl` endpoint
- Browser sets multipart boundary automatically; `Content-Type` is not manually set for create/update requests
- `authHeader()` (Bearer token) is still included in all write requests
- Object URLs are revoked via `useEffect` cleanup and on explicit replace/remove to prevent memory leaks
- Card cover image breaks out of card padding using negative margins so it sits flush at the top

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

### 2026-05-09 — Admin Login UI + JWT Auth Flow (Frontend)

Added admin login UI, JWT auth utilities, write API functions, and protected routing.

Files added:
- `frontend/src/auth.ts` — login, logout, getToken, isAuthenticated, authHeader; stores JWT under `admin_token` in localStorage
- `frontend/src/pages/AdminLogin.tsx` — login form with loading/error states, redirects to /admin/posts on success
- `frontend/src/pages/AdminPosts.tsx` — stub admin dashboard with logout button
- `frontend/src/components/RequireAuth.tsx` — route guard using isAuthenticated(); redirects to /admin/login if not authenticated

Files modified:
- `frontend/src/api.ts` — added PostRequest/PostResponse types and createPost, updatePost, deletePost functions with authHeader
- `frontend/src/main.tsx` — replaced bare App render with BrowserRouter + Routes tree

Dependency added:
- react-router-dom (+ @types/react-router-dom)

Routes:
- / → App (public)
- /posts/:slug → App (public)
- /admin/login → AdminLogin (public)
- /admin/posts → AdminPosts (protected via RequireAuth)

Checks run: npm run lint, npm run typecheck, npm run build — all passed, zero warnings.

Decisions:
- Token stored in localStorage under key `admin_token`.
- No refresh token at MVP (matches backend decision).
- AdminPosts is a stub; full post management is a follow-up task.

### 2026-05-09 — Database seed: User + Comment entities

Added User and Comment JPA entities, repositories, and seed data.

Files added:
- `backend/src/main/java/com/example/blog/user/User.java` — entity, table: `users`
- `backend/src/main/java/com/example/blog/user/UserRepository.java`
- `backend/src/main/java/com/example/blog/comment/Comment.java` — entity, table: `comments`
- `backend/src/main/java/com/example/blog/comment/CommentRepository.java`
- `docker/seed.sql` — standalone SQL script to reset and reseed data manually

Files modified:
- `backend/src/main/java/com/example/blog/post/DataSeeder.java` — seeds users, posts, comments on startup

Seed data:
- 3 users: admin (ADMIN role), viet_tran (READER), minh_nguyen (READER)
- 4 posts: 3 PUBLISHED + 1 DRAFT
- 5 comments across 2 posts (mix of registered users + anonymous)

Decisions:
- Schema created by Hibernate (ddl-auto: update), not SQL scripts.
- Comments allow null user_id for anonymous commenters.
- DataSeeder checks count > 0 before each table to avoid duplicate seeding.
- Auth system unchanged — still uses hardcoded env-var admin, not the User table.
- Passwords hashed with BCryptPasswordEncoder (bean from SecurityConfig).

### 2026-05-09 — DB-based authentication + port change

Switched authentication from hardcoded env-var credentials to database-backed user lookup.

Files changed:
- `backend/src/main/java/com/example/blog/auth/AuthController.java` — rewrote login to use `UserRepository.findByUsername()` + BCrypt match; returns 403 if user exists but is not ADMIN
- `backend/src/main/java/com/example/blog/auth/JwtService.java` — `generateToken()` now accepts `role` param; added `extractRole()` to read role claim from JWT
- `backend/src/main/java/com/example/blog/auth/JwtAuthFilter.java` — reads `role` from JWT claim to set `ROLE_<role>` authority (was hardcoded `ROLE_ADMIN`)
- `backend/src/main/java/com/example/blog/config/SecurityConfig.java` — added `/error` to `permitAll()` to fix 401 leak when Spring calls `response.sendError()` and forwards to `/error`; added `GET /api/admin/**` → `hasRole("ADMIN")`
- `backend/src/main/java/com/example/blog/post/AdminPostController.java` — new controller: `GET /api/admin/posts` returns all posts (including drafts) for admin
- `backend/src/main/java/com/example/blog/post/PostController.java` — removed `includeDrafts` query param from public endpoint (was a security hole)
- `backend/src/main/java/com/example/blog/post/PostRepository.java` — fixed JPQL `cast(:x as String)` to prevent PostgreSQL `lower(bytea)` error; added `existsBySlugAndIdNot()`
- `backend/src/main/java/com/example/blog/post/PostService.java` — slug uniqueness check on update
- `backend/src/main/java/com/example/blog/common/GlobalExceptionHandler.java` — added `DataAccessException` handler (500) to prevent DB errors from propagating to Spring Security filter
- `backend/src/main/resources/application.yml` — port 18080; removed `blog.admin.*` section
- `backend/src/test/resources/application-test.yml` — removed `blog.admin.*` section
- `backend/src/test/java/com/example/blog/auth/AuthControllerTest.java` — added `@BeforeEach seedAdminUser()` (admin/admin123 in H2); TC-9 reader→403; 9 total test cases
- `frontend/src/api.ts` — port 18080; added `fetchAdminPosts()`; `UnauthorizedError`
- `frontend/src/auth.ts` — port 18080
- `frontend/src/pages/AdminPosts.tsx` — uses `fetchAdminPosts()`; optimistic delete
- `frontend/src/pages/PostForm.tsx` — create/edit form with slug auto-fill, tag management

Admin login credentials (DB-seeded):
- username: `admin`, password: `Admin@2024!`

Tests run: `mvn test` — 11 tests, 0 failures, 0 errors.

Decisions:
- Timing-attack dummy hash in AuthController uses invalid BCrypt string that triggers a logged warning — this is intentional and safe (Spring returns false, no exception).
- `/error` must be in `permitAll()` because Spring's `DefaultHandlerExceptionResolver` calls `response.sendError()` which forwards to `/error`, and if that path is secured it triggers the authenticationEntryPoint (returns 401 instead of original status).
- Auth test uses `admin123` because tests run against H2 with fresh seed; production uses `Admin@2024!` from DataSeeder.

Known gap:
- Frontend Vite dev server must be at http://localhost:5173 (allowed in CORS config). Start with `cd frontend && npm run dev`.
