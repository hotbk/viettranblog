# API Contract — Personal Blog

Base URL:

```text
http://localhost:8080/api
```

## 1. Health

### GET `/health`

Response:

```json
{
  "status": "ok"
}
```

## 2. List Posts

### GET `/posts`

Query parameters:

| Name | Type | Required | Description |
|---|---|---:|---|
| q | string | no | Search keyword |
| category | string | no | Filter by category |
| includeDrafts | boolean | no | Include draft posts; default false. Public clients should omit this parameter.

Response:

```json
[
  {
    "id": 1,
    "title": "First Post",
    "slug": "first-post",
    "excerpt": "Short intro",
    "content": "Full content",
    "category": "Technology",
    "tags": ["react", "spring"],
    "status": "PUBLISHED",
    "createdAt": "2026-05-09T00:00:00Z",
    "updatedAt": "2026-05-09T00:00:00Z",
    "publishedAt": "2026-05-09T00:00:00Z"
  }
]

> Notes:
> - The API exposes `tags` as an array.
> - By default, `/posts` returns only published posts.
> - `includeDrafts=true` is intended for internal/test tooling, not public UI.
```

## 2b. Related Posts

### GET `/posts/{slug}/related`

Sidebar widget on the post-detail page. Public endpoint, no auth required (same
visibility rules as [Get Post By Slug](#3-get-post-by-slug) apply to the source
post: a 404/401/403 on the source post also fails this call the same way).

Query parameters:

| Name | Type | Required | Description |
|---|---|---:|---|
| limit | integer | no | Max results, default 5, clamped to 1–10 |

Candidates are the most recently published posts, scored by category match
(+2) and shared-tag count (+1 each); posts scoring 0 (no category or tag
overlap) are dropped, so the list can legitimately be empty. Private posts the
current viewer cannot read are omitted entirely (no teaser row here). Results
are ordered by score desc, then `publishedAt` desc.

Response:

```json
[
  {
    "id": 2,
    "title": "Second Post",
    "slug": "second-post",
    "excerpt": "Short intro",
    "category": "Technology",
    "hasCoverImage": true,
    "coverImageUrl": "/api/posts/2/cover-image",
    "publishedAt": "2026-05-10T00:00:00Z"
  }
]
```

Errors: `404 POST_NOT_FOUND` if the source post doesn't exist or isn't
published; same reason-coded `401`/`403` as the detail endpoint if the source
post is private and the current viewer can't read it.

## 3. Get Post By Slug

### GET `/posts/{slug}`

Response:

```json
{
  "id": 1,
  "title": "First Post",
  "slug": "first-post",
  "excerpt": "Short intro",
  "content": "Full content",
  "category": "Technology",
  "tags": ["react", "spring"],
  "status": "PUBLISHED",
  "createdAt": "2026-05-09T00:00:00Z",
  "updatedAt": "2026-05-09T00:00:00Z",
  "publishedAt": "2026-05-09T00:00:00Z"
}
```

## 4. Create Post

### POST `/posts`

Request:

```json
{
  "title": "First Post",
  "slug": "first-post",
  "excerpt": "Short intro",
  "content": "Full content",
  "category": "Technology",
  "tags": ["react", "spring"],
  "status": "PUBLISHED"
}
```

## 5. Update Post

### PUT `/posts/{id}`

Same request body as create.

## 6. Update Post Status

### PUT `/posts/{id}/status`

Query parameters:

| Name | Type | Required | Description |
|---|---|---:|---|
| status | string (`DRAFT` \| `PUBLISHED`) | yes | New status for the post |

Used by admin tooling to toggle a post between draft and published without resubmitting the full post form.

Response: updated post, same shape as [Get Post By Slug](#3-get-post-by-slug).

> Note: This endpoint is part of internal/dev tooling. The MVP public frontend should not call it and the API should be secured before any public deployment.

## 7. Delete Post

### DELETE `/posts/{id}`

Response status:

```text
204 No Content
```

## 8. Exam Access Control

> Note: this section documents only the exam-assignment feature below. The
> exam module itself (questions, attempts, scoring) predates this doc section
> and is not otherwise described here — see `docs/06-project-memory.md` for
> its history.

Exams gained a `visibility` axis, independent of `status` (DRAFT/PUBLISHED
editorial workflow) — same shape as `Post.visibility`:

- `PUBLIC` (default): unchanged pre-existing behavior — any PUBLISHED exam is
  listed at `GET /api/exams` (anonymous) and `GET /api/member/exams` (any
  MEMBER), and can be opened/attempted by any authenticated MEMBER.
- `PRIVATE`: hidden from the anonymous `/api/exams` listing entirely, and
  visible/attemptable only to a MEMBER who is either (a) directly granted
  access, or (b) a member of an access group granted access to the exam
  (reuses the same Access Groups as private posts — one group can gate both
  posts and exams). A member without access gets `404 EXAM_NOT_FOUND` on
  `GET /api/member/exams/{id}` and `POST /api/member/exams/{id}/attempts` —
  same not-found response as a nonexistent exam id, so existence isn't leaked.

`ExamRequest` (create/update, `POST /api/admin/exams`, `PUT /api/admin/exams/{id}`)
gained a `visibility` field (`"PUBLIC"` | `"PRIVATE"`, defaults to `PUBLIC` if
omitted/invalid). `ExamSummaryResponse`/`ExamDetailAdminResponse` echo it back;
the member-facing `ExamDetailMemberResponse` does not expose it (a member
either can or can't see the exam at all).

### Admin: exam access-group / direct-user management (mirrors `/api/admin/posts/{id}/access-groups`)

All require an ADMIN-role bearer token.

- `GET /api/admin/exams/{id}/access-groups` — list of `{id, name, slug}` groups granted access
- `PUT /api/admin/exams/{id}/access-groups` — body: `number[]` (group ids), replace-all
- `GET /api/admin/exams/{id}/access-users` — list of `{id, username, email}` directly-granted users
- `PUT /api/admin/exams/{id}/access-users` — body: `number[]` (user ids), replace-all

`AccessGroupResponse` (`GET/POST/PUT /api/admin/access-groups`) gained an
`examCount` field alongside the existing `userCount`/`postCount`.

## 9. Video Upload & YouTube Embeds

Post content is Markdown rendered with `rehype-raw` (admin/editor-authored,
trusted — same trust boundary as inline code blocks), so video is embedded as
raw HTML inside the content string. No `Post` schema change; no new field.

### Upload a video

### POST `/api/admin/videos`

Requires `ADMIN` bearer token (falls under `/api/admin/**`). `multipart/form-data`,
field name `file`.

- Allowed raw content types: `video/mp4`, `video/quicktime`, `video/webm`,
  `video/x-matroska`, `video/x-msvideo`.
- Raw upload cap: 200 MB. Duration cap: 10 minutes (probed via `ffprobe`; rejected
  before transcoding starts).
- Server transcodes to H.264/AAC MP4, max width 1280px, video bitrate capped
  ~1.5 Mbps, stored as the `content_videos.data` bytea column (same pattern as
  `content_images` for existing inline images).
- Requires `ffmpeg`/`ffprobe` installed on the host running the backend.

Response (`201`):

```json
{
  "id": "b6c1...-uuid",
  "url": "/api/videos/b6c1...-uuid",
  "durationSeconds": 42,
  "size": 8123456
}
```

Errors: `400 BAD_REQUEST` (invalid type, empty file, over 200 MB, over 10 min),
`500 VIDEO_PROCESSING_ERROR` (ffmpeg/ffprobe missing or failed on the input).

### Fetch a video

### GET `/api/videos/{id}`

Public (`permitAll`, same known limitation as `/api/images/**` — no per-post
access check on the blob itself; see `docs/06-project-memory.md`). Supports
HTTP `Range` requests (single range only) for player seeking:

- No `Range` header → `200`, full body, `Accept-Ranges: bytes`.
- `Range: bytes=start-end` → `206 Partial Content`, `Content-Range: bytes start-end/total`.
- Out-of-bounds range → `416 Requested Range Not Satisfiable`.
- Unknown id → `404 VIDEO_NOT_FOUND`.

The editor inserts uploaded videos into post content as:

```html
<video class="post-video" controls preload="metadata" src="/api/videos/{id}"></video>
```

### YouTube embed

No backend endpoint — the editor parses a pasted YouTube URL (watch/shorts/
`youtu.be`/embed forms) into an 11-char video id client-side and inserts:

```html
<div class="post-video-embed">
  <iframe src="https://www.youtube-nocookie.com/embed/{id}" title="YouTube video"
          loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media;
          gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
</div>
```

## 10. Post Attachments (PDF/DOC/DOCX/TXT)

Downloadable/viewable files attached to a post (distinct from inline content
images/videos pasted into Markdown — attachments are a structural list on the
post itself). Unlike `content_images`/`content_videos`, attachments carry a
required `post_id` FK from the start, so access is gated by the parent post's
visibility, same as the cover image — a private post's attachments are exactly
as protected as its content.

Allowed types: `application/pdf`, `application/msword` (DOC),
`application/vnd.openxmlformats-officedocument.wordprocessingml.document`
(DOCX), `text/plain` (TXT). Max 20 MB per file. Stored as the
`post_attachments.data` bytea column.

The post's `attachments` array (see [Get Post By Slug](#3-get-post-by-slug))
is `[]` on list/search responses and populated only on the detail endpoint and
the admin listing.

### Upload an attachment

### POST `/api/admin/posts/{id}/attachments`

Requires `ADMIN` bearer token (falls under `/api/admin/**` — same role
restriction as `/api/admin/images` and `/api/admin/videos`, i.e. no EDITOR
access even though EDITOR can save a post's cover image via the main
create/update endpoint). `multipart/form-data`, field name `file`.

Response (`201`):

```json
{
  "id": 7,
  "originalFilename": "spec.pdf",
  "contentType": "application/pdf",
  "attachmentType": "PDF",
  "fileSize": 182304,
  "uploadedAt": "2026-08-09T00:00:00Z",
  "url": "/api/posts/12/attachments/7"
}
```

Errors: `400 BAD_REQUEST` (disallowed type, empty file, over 20 MB),
`404 POST_NOT_FOUND` (unknown post id).

### List attachments (admin)

### GET `/api/admin/posts/{id}/attachments`

Requires `ADMIN`. Returns the array shape above — used by the post edit form,
though in practice the admin listing (`GET /api/admin/posts`) already embeds
the same array per post.

### Delete an attachment

### DELETE `/api/admin/posts/{id}/attachments/{attachmentId}`

Requires `ADMIN`. `204 No Content`. `404 ATTACHMENT_NOT_FOUND` if unknown.

### View/download an attachment

### GET `/api/posts/{id}/attachments/{attachmentId}`

Public route (`permitAll`), but access-checked against the parent post's
visibility (unlike `/api/images/**`/`/api/videos/**`, which are unauthenticated
by design — see known gaps in `docs/06-project-memory.md`): a private post's
attachment 404s for a viewer who can't read the post, same oracle-safe
plain-404 pattern as the cover image endpoint. Response has
`Content-Disposition: inline` (PDF/DOCX/TXT — the frontend renders these in an
in-page viewer) or `attachment` (DOC — no safe in-browser renderer, so the
response forces a download instead).

Errors: `404 ATTACHMENT_NOT_FOUND` (unknown id, or post not accessible to the
current viewer).

## 11. About Page

Singleton content (always one row) shown on the public `/about` page.

### GET `/api/about`

Public, no auth. Before an admin has ever saved content, returns empty
defaults with `updatedAt: null` — the frontend uses that to show "This page is
still being written." instead of a blank page.

Response:

```json
{
  "title": "About TECH2BLOGS",
  "content": "We write about **software**.",
  "updatedAt": "2026-08-09T00:00:00Z"
}
```

### GET `/api/admin/about`

Same shape, requires `ADMIN` bearer token — used by the admin edit form so it
doesn't depend on the public endpoint staying unauthenticated.

### PUT `/api/admin/about`

Requires `ADMIN`. Body: `{ "title": string, "content": string }` (Markdown,
rendered with `rehype-raw` same as post content — admin-authored, same trust
boundary). Upserts the single row; always returns `200` with the saved
content, same shape as the GET responses above.

## 12. Book Library (Phase 1 — see docs/08-book-library-module.md)

Books are a separate content type from posts — PDF or TXT files, read online
via a dedicated reader (`/library/:slug/read`), with the same PUBLIC/PRIVATE
access-control shape already used for posts (access groups + direct per-user
grants + reason-coded 401/403). Full design/rationale:
`docs/08-book-library-module.md`. This section covers what Phase 1 shipped.
Phase 2 (highlights/annotations, `docs/09-book-highlights-phase2.md`) and
Phase 3 (in-book search, client-side only, no new endpoints) are also
shipped — see `TASKS.md`. Phase 2's endpoints are not yet added to this
contract file (follow-up).

### GET `/api/books`

Public (`permitAll`), access-filtered. Query params: `q` (title/author/description
contains), `category`, `fileType` (`PDF`|`TXT`), all optional. Only `PUBLISHED`
books. Same teaser rules as posts: `PRIVATE` + accessible → full row; `PRIVATE`
+ inaccessible + `metadataVisibility=PUBLIC_METADATA` → locked teaser
(`locked:true`, `fileUrl`/`contentType`/`originalFilename`/`fileSize` null,
`downloadable:false`); `PRIVATE` + inaccessible + `AUTHORIZED_ONLY` → omitted
entirely.

```json
[
  {
    "id": 3, "title": "PostgreSQL Internals", "slug": "postgresql-internals",
    "author": "Egor Rogov", "description": "Deep dive...", "category": "Database",
    "fileType": "PDF", "contentType": "application/pdf", "originalFilename": "pg-internals.pdf",
    "fileSize": 24117248, "hasCoverImage": true, "coverImageUrl": "/api/books/3/cover-image",
    "coverImageSize": 190213, "downloadable": true, "status": "PUBLISHED",
    "visibility": "PUBLIC", "metadataVisibility": "PUBLIC_METADATA",
    "locked": false, "fileUrl": "/api/books/3/file",
    "readProgress": { "position": 34, "total": 340, "unit": "PAGE", "percent": 10, "updatedAt": "..." },
    "createdAt": "...", "updatedAt": "...", "publishedAt": "...", "accessGroupCount": null
  }
]
```

`readProgress` is `null` for anonymous viewers or books never opened.

### GET `/api/books/{slug}`

Detail. Public route, reason-coded denial exactly like `GET /api/posts/{slug}`:
`404 BOOK_NOT_FOUND` if unknown/not published, or if `PRIVATE` +
`AUTHORIZED_ONLY` + inaccessible (doesn't confirm existence the listing hid);
otherwise `401 NOT_AUTHENTICATED` / `403 {ACCOUNT_PENDING|ACCOUNT_REJECTED|
ACCOUNT_SUSPENDED|NO_ACCESS}` on denial. Same body shape as a listing row.

### GET `/api/books/{id}/cover-image`

Public, access-gated with a plain `404` on denial (oracle-avoidance, same as
the post cover-image endpoint).

### GET `/api/books/{id}/file`

The read endpoint — the reader fetches this (authenticated fetch, not a bare
`<iframe>` URL) and renders it client-side (`pdf.js` for PDF, decoded text for
TXT). Public route, access-gated with a plain `404` on denial, same rule as
`PostAttachmentService.getForView`. `Content-Disposition: inline`. No HTTP
`Range` support at Phase 1 (whole file per request — see the known gaps below).

### GET `/api/books/{id}/download`

Same access gate as `/file`, plus the `downloadable` flag:
`403 BOOK_NOT_DOWNLOADABLE` if false. `Content-Disposition: attachment`.
**Not DRM** — `/file` still streams the same bytes to render the book, so
`downloadable=false` only hides the download button; it doesn't prevent a
reader from saving the file via devtools.

### GET `/api/books/{id}/progress` — authenticated

`200` with `{ position, total, unit, percent, updatedAt }`, or `204` if no
saved progress. `401` if anonymous. Access-gated (no progress for a book you
can't read).

### PUT `/api/books/{id}/progress` — authenticated

Body: `{ "position": number, "total": number, "unit": "PAGE"|"PERCENT" }`.
Upsert on `(book_id, user_id)`, last-write-wins, no cross-device merge.
`unit` must match the book's `fileType` (PDF→PAGE, TXT→PERCENT) or `400`.
`position` must be in `[0, total]`.

Anonymous readers get `localStorage` progress client-side instead — there is
no anonymous-writable version of this endpoint, on purpose.

### GET `/api/me/reading?limit=6` — authenticated

The "continue reading" shelf: in-progress books (`readProgress.percent` 1-99),
newest-updated first, access-filtered (a revoked grant drops the book off the
shelf). Same row shape as the listing.

### Admin endpoints (all `ADMIN` bearer token, under `/api/admin/**` — no
EDITOR access, same convention as `/api/admin/images`/`/videos`/post attachments)

| Method + path | Notes |
|---|---|
| `GET /api/admin/books` | All books incl. `DRAFT`/`PRIVATE`. |
| `GET /api/admin/books/{id}` | Detail, with `accessGroupCount`. |
| `POST /api/admin/books` | `multipart/form-data`: `title`, `slug`, `author?`, `description?`, `category?`, `status`, `visibility`, `metadataVisibility?`, `downloadable`, `file` (required, PDF or TXT, ≤50MB), `coverImage?`. → `201`. |
| `PUT /api/admin/books/{id}` | Same fields; `file` optional (present ⇒ replace bytes **and clears any saved reading progress for the book** — an old page number is meaningless against a new file); `removeCoverImage` boolean. |
| `PUT /api/admin/books/{id}/status` | `?status=DRAFT\|PUBLISHED`. |
| `DELETE /api/admin/books/{id}` | `204`. Cleans up `book_reading_progress`, `book_access_groups`, `book_user_permissions`, `book_files` before deleting the book row. |
| `GET/PUT /api/admin/books/{id}/access-groups` | Mirrors `/api/admin/posts/{id}/access-groups`. |
| `GET/PUT /api/admin/books/{id}/access-users` | Mirrors `/api/admin/posts/{id}/access-users`. |

Upload errors (`400 BAD_REQUEST` unless noted): empty file; content-type not
`application/pdf`/`text/plain`; PDF failing the `%PDF-` magic-byte check; TXT
containing a NUL byte in the first 8KB; over 50MB; duplicate slug.

Also changed by this feature: `AccessGroupResponse` (§8) gains **`bookCount`**
alongside `postCount`/`examCount`.

Known Phase-1 gaps (see `docs/08-book-library-module.md` §8 for the full risk
list): no HTTP Range support on `/file` (whole file loaded into JVM heap per
request — capped at 50MB to bound this); no scheduled `pg_dump` yet, and this
feature is the largest bytea-storage risk added so far.
