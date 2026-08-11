# Architecture — Personal Blog

## 1. Overview

The system is a classic three-tier web application:

```text
React Frontend → Spring Boot REST API → PostgreSQL
```

The frontend renders public pages, the member area, and the admin panel. The backend owns
persistence, authorization, validation, binary file serving, and API error handling. There is no
queue, worker, cache tier, object store, or second service — deliberately.

The product has grown past the original "blog posts only" MVP. It now covers posts (with cover
images, inline images, videos, attachments, comments, series, related posts), an exam/quiz module
with member attempts, a book library with an in-browser reader and highlights, an About page, a
sitemap, and a full authenticated access-control system with ADMIN/EDITOR/MEMBER/READER roles.

## 2. Frontend

Technology:
- React
- TypeScript
- Vite (dev server on `5173`, HTTPS via `@vitejs/plugin-basic-ssl`, `/api` and `/sitemap.xml`
  proxied to the backend — see `frontend/vite.config.ts`)

Shared modules:
- `api.ts` — the single API client; every backend call lives here
- `types.ts` — shared response/request types
- `auth.ts` / `memberAuth.ts` / `jwt.ts` — token storage and header helpers (§2.3)
- `theme.ts`, `useSeo.ts` — light/dark theme, per-page document metadata
- `components/`, `pages/`, `hooks/`

### 2.1 Routing map

Routes are declared in `frontend/src/main.tsx` (not `App.tsx` — `App.tsx` is the home page
component). Guarded groups use `RequireAuth` (admin token) and `RequireMember` (member token).

Public:

| Route | Page |
|---|---|
| `/` | `App.tsx` — post list, search, category filter |
| `/posts/:slug` | `PostDetail` — content, attachments, comments, related-posts sidebar |
| `/series` | `SeriesList` |
| `/series/:slug` | `SeriesDetail` |
| `/about` | `AboutPage` |
| `/library` | `LibraryPage` — book grid + continue-reading shelf |
| `/library/:slug` | `BookDetailPage` |
| `/library/:slug/read` | `BookReaderPage` — full-page PDF/TXT reader |
| `/admin/login`, `/member/login`, `/member/register` | login/registration forms |

Admin (inside `RequireAuth`): `/admin/posts`, `/admin/users`, `/admin/users/:id`,
`/admin/access-groups`, `/admin/access-requests`, `/admin/audit-logs`, `/admin/series`(+`/new`,
`/:id/edit`), `/admin/exams`(+`/new`, `/:id/edit`), `/admin/attempts`, `/admin/attempts/:id`,
`/admin/about`, `/admin/books`(+`/new`, `/:id/edit`).

Member (inside `RequireMember`): `/member/exams`, `/member/exams/:id`,
`/member/attempts/:attemptId`, `/member/history`.

### 2.2 Lazy-loaded chunks

Two heavy libraries are loaded with a runtime `await import(...)` rather than a static import,
purely to keep them out of the eager main bundle:

- `mammoth` (~500KB with `jszip`/`xmldom`/`underscore`) — imported inside
  `components/PostAttachments.tsx` only when a viewer actually opens a DOCX attachment.
- `react-pdf` / `pdfjs-dist` (~423KB chunk + a separately fetched `pdf.worker.min.mjs` of ~1MB) —
  imported inside `components/PdfReader.tsx` only when a PDF book is opened. The `pdfjs-dist`
  import at the top of that file is `import type` only, which is erased at compile time and does
  not pull the library into the eager bundle.

There is no route-level `React.lazy` — page components are all statically imported. The main
bundle already trips Vite's 500kB chunk-size warning; splitting it further is an open
optimization, not a shipped one.

### 2.3 Auth token storage

- Two independent tokens in `localStorage`: `admin_token` (`auth.ts`) and `member_token`
  (`memberAuth.ts`). Both are raw JWTs returned by `POST /api/auth/login`.
- `authHeader()` sends the admin token; `memberAuthHeader()` the member token.
- `publicAuthHeader()` (in `auth.ts`) tries the admin token, then the member token, and is used by
  *public* read calls (post list/detail, comments, series, books, attachment/book blobs). Without
  it the backend would see every private-content read as anonymous and the whole access-control
  model in §4.2 would be a no-op in the browser.
- `jwt.ts::decodeJwtPayload()` base64-decodes the payload *without* signature verification, to read
  `sub`/`role` for UI purposes only. The backend re-verifies on every request; nothing in the
  frontend is a security boundary.
- No refresh-token flow. Tokens expire after 24h (`blog.jwt.expiration-ms`) and the user logs in
  again.

## 3. Backend

Technology:
- Java 21
- Spring Boot
- Spring Web
- Spring Data JPA
- Spring Security (JWT)
- Flyway
- PostgreSQL

Layering is the same in every package: controller → service → repository, with records as DTOs.
Controllers handle HTTP only; services hold business and authorization rules; entities never leave
the service layer.

### 3.1 Module structure

```text
com.example.blog
├── BlogApplication        Spring Boot entry point
├── about                  AboutContent (singleton row, id=1) — AboutController (public GET), AdminAboutController (GET/PUT)
├── access                 Shared authorization core (§4.2): AccessGroup + per-entity join tables and direct grants,
│                          PostAccessService / ExamAccessService / BookAccessService, AccessSubjects, DenialReason,
│                          AccessRequest workflow — AccessRequestController, AdminAccessRequestController, AdminAccessGroupController
├── audit                  AuditLog + AuditAction (permission grants/revokes, status changes) — AdminAuditLogController
├── auth                   No entity. JwtService (issue/parse), JwtAuthFilter, AuthController (/api/auth/login, /register, /me)
├── book                   Book, BookFile (separate table, holds the bytea), BookReadingProgress, BookHighlight
│                          — PublicBookController (/api/books/**, /api/me/reading, /api/me/highlights), AdminBookController
├── comment                Comment — CommentController (GET/POST /api/posts/{slug}/comments, DELETE /api/admin/comments/{id})
├── common                 ApiError record, NotFoundException, GlobalExceptionHandler (§7)
├── config                 SecurityConfig only — filter chain, matcher ladder, CORS, BCrypt encoder (§8)
├── exam                   Exam, Question, QuestionOption, ExamAttempt, ExamAnswer — PublicExamController (/api/exams),
│                          MemberExamController (/api/member/**), AdminExamController, AdminAttemptController
├── health                 HealthController (/api/health)
├── image                  ContentImage (UUID id, bytea) — ContentImageController (POST /api/admin/images, GET /api/images/{id})
├── notification           NotificationService interface + NoopNotificationService (log-only stub; no email infra exists)
├── post                   Post, PostAttachment — PostController (/api/posts), AdminPostController (/api/admin/posts),
│                          PostService, PostAttachmentService, Tags helper, DataSeeder (@Profile("dev"))
├── seo                    No entity. SitemapController (GET /api/sitemap.xml, generated from PUBLISHED + PUBLIC content)
├── series                 Series, SeriesPost (ordered join) — SeriesController, AdminSeriesController
├── user                   User (UserRole, UserStatus) — UserController (/api/admin/users), UserService
└── video                  ContentVideo (bytea) — ContentVideoController (POST /api/admin/videos, GET /api/videos/{id},
                           HTTP Range aware), VideoTranscoder (ffmpeg/ffprobe, §6)
```

Naming convention worth keeping: a `XxxController` is public/reader-facing, `AdminXxxController` is
`/api/admin/**` (ADMIN only), `MemberXxxController` is `/api/member/**` (MEMBER only).

## 4. Data Model

### 4.1 Post

Fields:

- id: Long
- title: String
- slug: String, unique
- excerpt: String
- content: String (Markdown; raw HTML allowed and rendered via `rehype-raw` — video/YouTube embeds
  live here as raw tags, so there is no separate video field on Post)
- category: String
- tags: String internally (comma-separated persistence) but exposed by the API as an array
- status: enum DRAFT/PUBLISHED — editorial state
- visibility: enum PUBLIC/PRIVATE — access-control state (§4.2), independent of `status`
- privateMetadataVisibility: enum PUBLIC_METADATA/AUTHORIZED_ONLY — whether a private post appears
  as a locked teaser or is omitted entirely from listings
- viewCount: long (incremented by an atomic `UPDATE`, not read-modify-write)
- coverImageData/ContentType/OriginalFilename/Size — inline bytea cover image (§4.3)
- createdAt / updatedAt / publishedAt: Instant
- language: enum `ContentLanguage` (VI/EN), translationGroupId: long, translatedFromId: Long
  (nullable), sourceUpdatedAt: Instant (nullable), translationOrigin: enum (HUMAN/MACHINE) — §4.5

Public listings expose `tags` as an array and hide drafts unless `includeDrafts=true` is requested
by an authenticated admin caller.

`Book` and `Exam` repeat the same shape deliberately: `status` (DRAFT/PUBLISHED) and `visibility`
(PUBLIC/PRIVATE) are always two independent axes, and pre-existing rows default to PUBLIC so that
adding access control never silently locks existing content. `Book` repeats the dual-language
columns too (§4.5); `Exam` does not (out of scope, `docs/10-multilingual-content.md` §7.8).

### 4.2 Shared access-control model

This is the most reused design in the codebase. Four domains (post, exam, book, and indirectly
series/comments/attachments) share it.

Building blocks:

- `AccessGroup` — one admin-managed group entity, reused across all gated domains. Membership is
  `user_access_groups`. The same group can gate posts, exams, and books at once.
- Per-entity join tables, never polymorphic: `post_access_groups`, `exam_access_groups`,
  `book_access_groups`. A polymorphic table was rejected because it cannot carry a real FK.
- Per-entity direct grants: `post_user_permissions`, `exam_user_permissions`,
  `book_user_permissions` — "this one user can read this one item", no group needed.
- `User.status` (PENDING/ACTIVE/REJECTED/SUSPENDED), separate from `User.role`. Self-registration
  always lands in PENDING; an admin approves. A non-ACTIVE account can still log in (by design) but
  is denied at the authorization layer.
- `AccessRequest` — member-facing "request access to this post" workflow, admin approves/rejects.
  Posts only; exams and books have no equivalent (deliberate scope call).
- `AuditLog` — records permission grants/revokes and account status changes.

The ladder, evaluated in `PostAccessService.evaluate` (default-deny; every branch that is not an
explicit ALLOW falls through to DENY):

```text
visibility == PUBLIC                → ALLOW
no authenticated user               → DENY  NOT_AUTHENTICATED   (401)
status != ACTIVE                    → DENY  ACCOUNT_PENDING|ACCOUNT_REJECTED|ACCOUNT_SUSPENDED (403)
role in {ADMIN, EDITOR}             → ALLOW (bypass)
direct user grant exists            → ALLOW
user's groups ∩ item's groups ≠ ∅   → ALLOW
otherwise                           → DENY  NO_ACCESS           (403)
```

Note the status check sits *above* the role bypass, so a suspended admin also loses read access.

Implementation rules that must not drift:

- `ExamAccessService` and `BookAccessService` are hand-written parallels, not a generic
  `AccessService<T>`. The genuinely type-independent half (current-user resolution, account-status
  eligibility, group-membership lookup) lives in `access/AccessSubjects`. `PostAccessService` and
  `ExamAccessService` predate `AccessSubjects` and were not retrofitted onto it — that is a known,
  separate refactor.
- Every service exposes both a single-item check and a **batched** `resolveAccessibleIds(...)` used
  by list/search paths. Lists must never loop `canRead` per row (N+1).
- `DenialReason` codes are returned only by the *post detail* and *book detail* endpoints. Every
  other gated surface (comments, cover images, view counts, attachments, book `/file`, all exam
  endpoints) denies with a plain `404` and no reason code, so it cannot be used as an oracle to
  probe for the existence of private content.
- Listing behaviour for a private item the viewer cannot read: `PUBLIC_METADATA` → return a teaser
  (title/excerpt, `accessible:false`, content and cover stripped); `AUTHORIZED_ONLY` → omit the row
  entirely. Post search, series detail, and the library listing all follow this; the related-posts
  sidebar omits unconditionally (a "you might like" widget is not a place to tease locked content).
- There is no DB-level `ON DELETE CASCADE` anywhere in this schema. Deleting a gated entity must
  explicitly clean its join/grant/child tables first, in FK order. This bug class has already
  shipped twice (post attachments, exam access grants); `BookService.delete` does a four-table
  ordered cleanup and is regression-tested. `PostService.delete` is still incomplete for
  comments/access-groups/series links.

Known gap: `ContentImage` and `ContentVideo` have no FK back to a post, so images and videos
embedded in a *private* post's body are served unauthenticated by id. Closing this needs a schema
change (add `post_id`), not just a matcher change.

Dual-language content (§4.5) adds one more rule here: **`visibility`,
`privateMetadataVisibility`/`metadataVisibility`, and the access-group/direct-user grant sets are
group-level, not row-level.** The five `AccessGroupService` write methods (`setPostAccessGroups`,
`setPostDirectUsers`, `setPostDirectUsersAdd`, `setBookAccessGroups`, `setBookDirectUsers`) apply to
every row sharing a `translationGroupId`, and `PostService`/`BookService` `update()` propagate a
visibility change to every sibling after save. The **read path is unchanged** — `PostAccessService`/
`BookAccessService` still evaluate one row at a time; uniformity is enforced entirely at write time.
See `docs/10-multilingual-content.md` §2 for the full reasoning, including why read-path enforcement
was rejected.

### 4.3 Binary storage

All binary content lives in PostgreSQL `bytea` columns. There is no object store and no filesystem
upload directory.

| Content | Table / column | App-level cap |
|---|---|---|
| Post cover image | `posts.cover_image_data` (inline) | 2 MB |
| Inline content image | `content_images.data` | 5 MB |
| Post attachment (PDF/DOC/DOCX/TXT/MD/ZIP) | `post_attachments.data`, FK to `posts` | 20 MB |
| Transcoded video | `content_videos.data` | 200 MB raw upload / 10 min source |
| Book cover image | `books.cover_image_data` (inline) | 2 MB |
| Book file (PDF/TXT) | `book_files.data` (**separate table**) | 50 MB |

Spring's own limits are `max-file-size: 200MB` / `max-request-size: 205MB`; the per-feature caps
above are enforced in code, not config.

Why bytea rather than S3/MinIO:

- Zero new infrastructure, zero new credentials, one backup artifact. The deployment is a single
  JAR plus one Postgres container on a shared host.
- Transactional consistency: an upload either commits with its row or does not exist. No orphaned
  objects, no reconciliation job.
- Access control stays in one place. Every byte is served through a controller that re-runs §4.2;
  a signed-URL scheme would put a second, weaker gate outside the application.

`book_files` is a separate table from `books` specifically so that a bulk
`GET /api/admin/books` never risks loading a 40 MB blob per row. Any future large-blob feature
should copy that split rather than the inline-cover-image pattern.

Exit condition — move to S3/MinIO or to disk under the existing systemd
`ReadWritePaths=/opt/viettranblog` when **total book-file bytea passes ~1 GB**
(`docs/08-book-library-module.md` §1.5 — roughly 40 books at an average 25 MB). That is the
concrete trigger, because the library is the only content type designed to grow without bound. A
second, independent trigger: `GET /api/books/{id}/file` has **no HTTP Range support** and reads the
whole file into JVM heap per request (`GET /api/videos/{id}` does support Range). If concurrent
readers make that heap pressure measurable before the 1 GB line is crossed, add `ResourceRegion`
streaming first — it is the smaller, contained fix.

Backed up daily via `scripts/backup-postgres.sh` (cron, 02:15, 14-day retention — §9, `docs/07-deployment-guide.md` §5.3). Every cap in the table above lands inside that dump, which is why it exists.

### 4.4 Book highlights anchoring

`book_highlights` is one table with nullable typed columns plus an `anchor_type` discriminator
(`TXT_OFFSET` / `PDF_RECTS`), not two tables and not an opaque JSON blob:

- TXT: `start_offset`/`end_offset` character offsets into the decoded file.
- PDF: `page_number` plus `rects`, a serialized-JSON TEXT column of normalized rectangles. Pure
  geometry, never queried — the same precedent as `Post.tags` being a comma-separated string.
- `text` (the selected snippet, ≤2000 chars) is **denormalized onto the row** and is not optional:
  rendering the cross-book "my highlights" list otherwise means re-fetching and re-decoding every
  source file (up to 50 MB each, no Range) just to slice a string.
- `books.file_version` is snapshotted onto each highlight. Replacing a book's file bumps the
  version and flags older highlights as possibly-stale rather than deleting them — the denormalized
  snippet still reads correctly even when the anchor no longer resolves.
- Quota: 500 highlights per (book, user) → `409 HIGHLIGHT_LIMIT_REACHED`. This app has no rate
  limiting, so authenticated write endpoints get explicit caps.

Highlights are private to their creator. Anonymous readers get nothing server-side; anonymous
*reading progress* falls back to `localStorage` (there is deliberately no anonymous-writable
progress endpoint).

### 4.5 Dual-language content (VI/EN)

Full design: `docs/10-multilingual-content.md`. Each language is a **full separate `Post`/`Book`
row**, linked by a bare `translationGroupId` correlation column — not per-field `title_vi`/`title_en`
columns, not a `translation_groups` table, and deliberately **not a foreign key**. Consequences:

- `translationGroupId` is `NOT NULL` and, for a standalone row, equals the row's own id — every row
  is always in a group, size 1 by default. Fixed up by `Post.assignTranslationGroupId`/
  `Book.assignTranslationGroupId` (`@PostPersist`, since the id isn't known before the first INSERT
  under `IDENTITY` generation), not duplicated per call site.
- `translatedFromId` (nullable) records direction: `null` = original. **Not a FK** — deleting the
  source leaves it dangling, and every reader of the field treats a dangling id as `null` ("this row
  is now the original"). Deleting one language variant therefore needs **no new cleanup path** at
  all, unlike every other gated child table in §4.2.
- `UNIQUE(translationGroupId, language)` is the load-bearing constraint: it is structurally
  impossible to have two Vietnamese rows in one group, so "the VI variant" is always unambiguous.
- `sourceUpdatedAt` drives a computed (never stored) `translationStale = source.updatedAt >
  sourceUpdatedAt`, cleared only by an explicit "mark reviewed" admin action, never as a side effect
  of an ordinary save.
- `status` (editorial) is per-row and **not** propagated; `visibility`/access grants are group-level
  and **are** propagated (§4.2). This asymmetry — not an oversight — is the whole model.
- Slugs stay globally unique across languages (`/posts/toi-uu-postgres`, `/posts/optimizing-postgres`)
  — no `/en/` path prefix, no composite-unique slug, no routing change.

## 5. Schema Management

Schema is owned by **Flyway migrations under `backend/src/main/resources/db/migration/`**,
baselined against the existing production schema (`spring.flyway.baseline-on-migrate: true`,
`baseline-version: 1`). Hibernate runs in `ddl-auto: validate` — it verifies that entities match the
migrated schema and will fail startup on drift, but never alters the database itself.

Consequences for every schema-touching change:

1. Add a new versioned migration file. Never edit an applied one.
2. Update the JPA entity, the DTOs, and the API contract in the same change.
3. Because the baseline was taken from a live schema, `V1` describes what already existed; do not
   assume it can recreate the database from empty and be byte-identical to production.
4. `validate` mode means an entity change without a migration is a **startup failure**, not a silent
   column add. That is the point.

This replaces the earlier `ddl-auto: update` convention referenced throughout
`docs/06-project-memory.md` and the design docs; those entries describe how the columns originally
arrived, not how they are managed now.

## 6. External Process Dependency

`video/VideoTranscoder` shells out via `ProcessBuilder` to two binaries that must exist on the
host running the backend:

- `ffprobe` — duration probe, 30 s timeout
- `ffmpeg` — transcode to H.264/AAC MP4, max 1280px wide, `-maxrate 1500k -crf 26`, `+faststart`,
  300 s timeout

This is a hard runtime dependency of the video-upload feature on **every** environment: dev, CI, and
production.

Known gap, stated plainly: `ffmpeg`/`ffprobe` are **not** installed by `.github/workflows/ci.yml`,
and their presence on the production host has never been confirmed. `ContentVideoControllerTest`'s
transcode happy path is gated behind `Assumptions.assumeTrue(ffmpegAvailable())`, so on a runner
without ffmpeg those tests report as *skipped*, not failed — a real regression in the transcode path
can pass CI today. Installing ffmpeg on the CI runner and on the production host is an open DevOps
task, not something the application handles for itself.

Transcoding is also synchronous on the request thread — no job queue. A concurrent upload or a slow
transcode holds a Tomcat thread for up to 300 s. Accepted at single-admin-uploader scale.

## 7. Error Handling

All errors flow through `common/GlobalExceptionHandler` and return the `ApiError` record:

```json
{
  "code": "POST_NOT_FOUND",
  "message": "Post not found"
}
```

Mappings: `NotFoundException` → 404 with its own code; `PostAccessDeniedException` /
`BookAccessDeniedException` → 401 for `NOT_AUTHENTICATED`, 403 otherwise, with the `DenialReason`
name as the code; `BookNotDownloadableException` → 403; validation failures → 400
`VALIDATION_ERROR`; `MaxUploadSizeExceededException` → 400; `VideoProcessingException` → 500
`VIDEO_PROCESSING_ERROR`; `DataAccessException` → 500 `DATABASE_ERROR` (never the raw SQL message).

Unauthenticated requests to a protected route are answered by `SecurityConfig`'s
`AuthenticationEntryPoint`, which writes the same JSON shape (`{"code":"UNAUTHORIZED", ...}`)
directly rather than routing through the handler — that would be a circular dependency.

## 8. Security

Authentication is JWT bearer-token based and stateless
(`SessionCreationPolicy.STATELESS`, CSRF disabled, no server-side session).

- `POST /api/auth/login` returns an HMAC-signed JWT with `sub` = username and a `role` claim, 24h
  expiry (`blog.jwt.*`). The secret comes from `JWT_SECRET`; startup fails fast if the well-known
  development default is still in use outside the `dev`/`test` profiles.
- `auth/JwtAuthFilter` runs before `UsernamePasswordAuthenticationFilter`, parses the token, and
  populates the `SecurityContext`. Passwords are BCrypt.
- Roles (`user/UserRole`): **ADMIN** (everything under `/api/admin/**`), **EDITOR** (post
  create/update/delete only — explicitly *not* `/api/admin/**`, so no access to binary-upload,
  user, or access-group endpoints), **MEMBER** (`/api/member/**`, exams and attempts), **READER**
  (legacy, no elevated route).
- `POST /api/auth/register` is public and always creates a PENDING MEMBER; client-supplied
  `role`/`status` in the body are ignored server-side.

### 8.1 The matcher ladder

`config/SecurityConfig` is the single place URL-level authorization is expressed, and it is
**first-match-wins**. The ordering is load-bearing, not cosmetic:

1. Explicitly public, method-scoped: `/error`, `POST /api/auth/login`, `POST /api/auth/register`,
   `GET /api/health`, `GET /api/sitemap.xml`, `GET /api/about`.
2. Public post surface: `GET /api/posts`, `GET /api/posts/*/cover-image`,
   `GET /api/posts/*/comments`, `POST /api/posts/*/view`, `POST /api/posts/*/comments`, then the
   `GET /api/posts/**` wildcard.
3. Public read wildcards for series, `GET /api/exams`, `/api/images/**`, `/api/videos/**`,
   `GET /api/books`, `GET /api/books/*/cover-image`.
4. **Authenticated book sub-resources placed *before* the `GET /api/books/**` wildcard**:
   `/api/books/*/progress` (GET/PUT), `/api/me/reading`, `/api/books/*/highlights` (GET/POST),
   `/api/books/*/highlights/*` (PUT/DELETE), `/api/me/highlights`. Moving the wildcard above these
   would silently make a reader's private notes and progress anonymous. This is risk R4 in
   `docs/08-book-library-module.md` §5.3 and `docs/09-book-highlights-phase2.md` §5.4, and it has a
   dedicated regression test. Do not reorder this block.
5. `GET /api/books/**` wildcard (book detail, `/file`, `/download` — all access-checked in the
   service layer).
6. Write roles: `POST/PUT/DELETE /api/posts/**` → `ADMIN` or `EDITOR`; `/api/admin/**` → `ADMIN`;
   `/api/member/**` → exactly `MEMBER` (an ADMIN token gets 403 there, by design).
7. `anyRequest().authenticated()` — default-deny for anything not listed.

URL-level rules are coarse on purpose. **Row-level authorization is never done here**; it is done
in the service layer through §4.2. A `permitAll` on `GET /api/books/**` does not mean the bytes are
public — it means "the access decision happens deeper, where the entity is known".

### 8.2 CORS and other notes

- CORS is configured in `SecurityConfig` (the old `CorsConfig` was removed) for `/api/**`, with an
  explicit allowed-origin pattern list covering localhost dev ports and the production domains, and
  `allowCredentials(true)`.
- Trust boundary for rendered HTML: post content, About content, and DOCX preview output are
  rendered with `rehype-raw`/`dangerouslySetInnerHTML`. This is acceptable *only* because writes to
  all three are restricted to ADMIN (posts additionally to EDITOR). Widening any of those write
  paths reopens an XSS question.
- No rate limiting exists anywhere. Authenticated write endpoints therefore carry explicit quotas
  (e.g. 500 highlights per book/user) instead.
- Open gaps: no admin bootstrap or password-reset flow (the first admin is a manual SQL insert); no
  frontend test suite; unauthenticated blob fetch by id for `/api/images/**` and `/api/videos/**`
  (§4.2).

## 9. Deployment Direction

Local development:

```text
Docker PostgreSQL + local backend (18080) + Vite dev server (5173, HTTPS, /api proxied)
```

Production today (`blog.datxesocson.vn` / `tech2blogs.com`), deployed manually:

```text
nginx  → static frontend build in /var/www/viettranblog/dist, SPA fallback, TLS via certbot
       → /api/ proxied to 127.0.0.1:18080
backend → single JAR at /opt/viettranblog/backend.jar, systemd unit viettranblog-backend,
          runs as unprivileged user `blog`, ProtectSystem=strict,
          ReadWritePaths=/opt/viettranblog, secrets in /etc/viettranblog/backend.env (mode 600)
database → Docker container personal-blog-postgres (postgres:16-alpine),
           bound to 127.0.0.1:5432, named volume
```

Open deployment items, in priority order:

1. `ffmpeg`/`ffprobe` on the CI runner and the production host (§6).
2. An automated deploy path — today it is a manual build, copy, and `systemctl restart`.
3. Backups (`scripts/backup-postgres.sh`, daily cron) are same-host only — no offsite copy yet. If
   the server is lost entirely, the backups go with it (`docs/07-deployment-guide.md` §5.3).

See `docs/07-deployment-guide.md` for the step-by-step procedure.
