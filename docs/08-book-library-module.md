# Book Library Module — Architecture & Plan

Status: **design only, not implemented.** Author: architect agent, 2026-08-09.

Source request (translated): *"I need a module to upload book files (TXT, PDF).
Design that module to manage and read books professionally, and support access
control — either per individual user or public for everyone."*

This document is the plan of record for the module. It is intended to be handed
to `backend-agent` and `frontend-agent` as-is. It deliberately reuses the
access-control and file-viewer patterns already built in this repo (private
posts, exam visibility, post attachments) instead of inventing parallel
mechanisms.

Read alongside:
- `docs/03-architecture.md` — system boundaries
- `docs/04-api-contract.md` §8 (exam access control), §10 (post attachments)
- `docs/06-project-memory.md` — the bytea-storage tradeoff, the
  `PostService.delete()` FK-cleanup bug class, the absent-backup gap

---

## 0. Scope decision summary (read this first)

| Question | Decision |
|---|---|
| File formats | **PDF + TXT only.** No DOC/DOCX/EPUB. |
| File storage | Postgres `bytea`, but in a **separate `book_files` table**, not a column on `books`. |
| Access control code | **New `BookAccessService`, mirroring `PostAccessService`** — not a generic parameterized service. |
| Access groups | **Reuse the existing `AccessGroup` entity** (cross-feature). New `book_access_groups` + `book_user_permissions` join tables. |
| Reader UX | **Dedicated full-page route**, not the attachment modal. PDF via `pdf.js`, TXT via a styled reading column. Resume-where-you-left-off, server-side progress for logged-in users. |
| Upload role | **ADMIN only** (`/api/admin/**`), consistent with images/videos/attachments. |
| Access requests ("request access to this book") | **Deferred** — `AccessRequest` is hard-bound to `post_id`. |
| Full-text search inside books, annotations, EPUB reflow, TOC | **Deferred**, see §4.4. |

---

## 1. Data model

New package: `com.example.blog.book`.

### 1.1 `Book` — table `books`

```
id                        Long, identity
title                     String, NOT NULL
slug                      String, NOT NULL, UNIQUE          -- /library/{slug}
author                    String, NULL                      -- the book's author, not the uploader
description               String, NULL, length 4000          -- Markdown, rendered like About/Post content
category                  String, NULL                      -- loose string, same convention as Post.category
fileType                  enum BookFileType {PDF, TXT}, NOT NULL
contentType               String(100), NOT NULL              -- real MIME
originalFilename          String(255), NOT NULL
fileSize                  Long, NOT NULL
coverImageData            BYTEA, NULL                        -- mirrors Post's cover-image columns
coverImageContentType     String(100), NULL
coverImageSize            Long, NULL
status                    enum BookStatus {DRAFT, PUBLISHED}, NOT NULL, default DRAFT
visibility                enum BookVisibility {PUBLIC, PRIVATE}, NOT NULL, default PUBLIC
metadataVisibility        enum BookMetadataVisibility {PUBLIC_METADATA, AUTHORIZED_ONLY}, NULL
downloadable              boolean, NOT NULL, default true
createdAt / updatedAt     Instant, NOT NULL  (@PrePersist/@PreUpdate, same as Post)
publishedAt               Instant, NULL      (stamped on first publish, never cleared — same
                                              semantics as Post.publishedAt, see the 2026-08-07
                                              AdminPosts display-bug memory entry)
```

Field-by-field rationale for the non-obvious ones:

- **`status` (DRAFT/PUBLISHED)** — included. Without it, uploading a 40MB file
  makes it instantly live. Mirrors `Post.status`/`Exam.status`; costs one enum.
- **`visibility` + `metadataVisibility`** — deliberate 1:1 copy of
  `PostVisibility` / `PostMetadataVisibility` semantics, so a private book can
  either appear in the library as a locked card ("we have this, you can't open
  it") or be invisible. A library is exactly the case where the locked-teaser
  option is valuable. Note: **the Post admin form does not currently expose
  `privateMetadataVisibility`** even though the API accepts it (see
  `PostForm.tsx` payload at line ~134) — the Book admin form *should* expose it,
  which is a small deliberate inconsistency in the Book module's favour.
- **`downloadable`** — the user's ask included "downloadable". Enforced
  server-side by a separate download endpoint (§5.1). **Honest limitation: this
  is a UX control, not DRM.** The read endpoint must stream the same bytes to
  render the book, so any reader can save the file with devtools. Do not sell
  this as protection.
- **No `pageCount` column.** Page count is a property of how the file is
  rendered, is only knowable by a PDF parser, and adding one server-side means
  adding PDFBox as a dependency for one integer. The reader reports total units
  into the progress row instead (§1.3).
- **No tags at MVP.** `Post` stores tags as a comma-separated string
  (`Tags.java`) which is already documented as unqueryable (see the related-posts
  memory entry). Duplicating that into books adds a field nobody can filter on.
  `category` covers MVP filtering. Revisit only if the library grows past ~50 books.
- **No `viewCount`/`readCount` at MVP** — deferrable, and the progress table
  already tells you who opened what.

### 1.2 `BookFile` — table `book_files`

```
id           Long, identity
book_id      Long, NOT NULL, UNIQUE, FK -> books(id)
data         BYTEA, NOT NULL
```

**Why a separate table rather than a `data` column on `books` (which is what
`Post` does for its cover image):**

1. **Structural protection against accidental blob loading.** `GET /api/books`
   and `GET /api/admin/books` select `Book` entities in bulk. A `byte[]` column
   on the listed entity is fetched eagerly unless every query is written
   carefully forever. With a 40MB book × 30 books, one careless
   `findAll()` is a ~1.2GB heap allocation. `Post` gets away with this only
   because cover images are ≤2MB. Splitting the table makes the mistake
   impossible rather than merely discouraged.
2. **Cheap escape hatch.** If bytea-in-Postgres becomes untenable (see R1),
   migrating to disk or object storage means replacing one table and one
   repository — `books`, its DTOs, and the whole API surface stay unchanged.

This is a table split, **not** a `BookFileStorage` interface with one
implementation. A one-method interface with a single impl is the premature
abstraction the repo's architecture rule forbids; a separate table is a
structural fact with immediate benefits.

Cover image stays inline on `books` (≤2MB, mirrors `Post`, keeps the library
grid to one query).

**Required index:** unique index on `book_files.book_id`.

### 1.3 `BookReadingProgress` — table `book_reading_progress`

```
id            Long, identity
book_id       Long, NOT NULL, FK -> books(id)
user_id       Long, NOT NULL, FK -> users(id)
position      Integer, NOT NULL     -- PDF: page number (1-based). TXT: scroll percent 0-100.
total         Integer, NOT NULL     -- PDF: page count. TXT: 100.
unit          enum ProgressUnit {PAGE, PERCENT}, NOT NULL
percent       Integer, NOT NULL     -- denormalized 0-100, so the "continue reading" shelf
                                    -- and the library card need no per-row math
updatedAt     Instant, NOT NULL
UNIQUE (book_id, user_id)
```

- Progress exists **only for authenticated users**. Anonymous readers of public
  books get `localStorage` persistence in the browser, no server row. Rationale:
  an anonymous-writable endpoint keyed by nothing is an abuse surface, and the
  repo has no rate limiting.
- Conflict resolution is **last-write-wins**. No cross-device merge. Stated
  explicitly so nobody builds one.
- `unit` exists because PDF progress and TXT progress are genuinely different
  units — pretending otherwise produces a "page 47 of 100" for a TXT file.

### 1.4 Access join tables

```
book_access_groups     (id, book_id FK NOT NULL, access_group_id FK NOT NULL, UNIQUE(book_id, access_group_id))
book_user_permissions  (id, book_id FK NOT NULL, user_id FK NOT NULL, granted_by Long NULL, granted_at Instant,
                        UNIQUE(book_id, user_id))
```

Exact structural mirror of `PostAccessGroup`/`PostUserPermission` and
`ExamAccessGroup`/`ExamUserPermission`. See §2.2 for why per-entity join tables
rather than one polymorphic table.

### 1.5 Storage tradeoff — flagged, not silently repeated

The repo already accepted bytea-in-Postgres for `content_images` (≤5MB),
`content_videos` (≤200MB, flagged as "the biggest architectural risk of that
change"), and `post_attachments` (≤20MB). **Books are the worst case yet, and
the reason is different from the video case:**

- Videos are a handful of short clips. A *library* is, by definition, meant to
  grow — that's the feature.
- Technical/reference PDFs routinely run 20–80MB. 50 books at an average 25MB
  = **~1.25GB of bytea**, which lands inside *every* `pg_dump`. There is still
  **no scheduled backup at all** (`docs/06-project-memory.md`, 2026-08-07
  deployment entry, §5.3 follow-up) — so this feature simultaneously makes
  backups much more expensive and remains unbacked-up.

Recommendation (in priority order):

1. **Cap at 50MB per book** in `BookService` (the app-wide
   `spring.servlet.multipart.max-file-size` is already 200MB from the video
   feature, so no config change is needed — the cap must be enforced in code,
   like `PostAttachmentService.MAX_ATTACHMENT_SIZE`).
2. **Keep bytea for MVP** for consistency and zero new infrastructure, with the
   `book_files` table split (§1.2) as the pre-planned exit.
3. **Set up `pg_dump` on a schedule before this feature carries real content**,
   and re-measure DB size after the first ~10 books. This is a DevOps task and a
   hard prerequisite for calling the module production-ready.
4. Revisit disk storage (`ReadWritePaths=/opt/viettranblog` already exists on the
   systemd unit, so a `books/` directory is viable) if the library passes ~1GB.

Do not treat "we already do this for images" as a reason not to reconsider here;
the scaling profile is different.

---

## 2. Access control

### 2.1 Recommendation: a parallel `BookAccessService`, plus one small shared helper

**Recommended: mirror the existing shape (`BookAccessService`), do not build a
generic `AccessService<T>`.**

Justification:

1. **The codebase already made this call once, for exams.**
   `ExamAccessService` is a hand-written mirror of `PostAccessService`. Adding a
   *generic* Book implementation now leaves three different styles in one
   package (generic Book + bespoke Post + bespoke Exam), which is worse than
   three consistent mirrors. Making it uniform would require refactoring
   `PostAccessService` — the single most security-critical class in the app,
   with ~86 tests riding on its behaviour — for zero user-visible benefit.
2. **The obvious generalization does not actually generalize.** An
   `interface AccessControlled { Long getId(); boolean isPublic(); }` plus
   `AccessService<T>` still needs, per entity type: a different visibility enum
   (`PostVisibility` / `ExamVisibility` / `BookVisibility`), a different join
   entity and repository with *differently named* methods
   (`findByPostId` / `findByExamId` / `findByBookId`, each returning a different
   type), and a different denial UX (Post returns reason-coded 401/403; Exam
   returns a plain 404). You end up passing a per-type strategy object carrying
   four repository lambdas — more code and more indirection than the ~110-line
   mirror it replaces, and harder to audit line-by-line, which is the one thing
   you actually want from an authorization class.
3. **The duplicated core is small.** The real rule is a ~40-line default-deny
   ladder.

**But the drift risk is real and must be mitigated.** There is *already* a
divergence: `PostAccessService.evaluate` distinguishes
PENDING/REJECTED/SUSPENDED with reason codes, while `ExamAccessService` collapses
them to `status != ACTIVE`. A third copy makes a future policy change (new
`UserStatus`, or "EDITOR no longer bypasses") a three-file edit that is easy to
half-apply.

Cheap mitigation, **recommended**: extract the genuinely type-independent half
into a small shared component in the `access` package:

```java
@Service
class AccessSubjects {
    User currentUserOrNull();                 // today only on PostAccessService
    DenialReason ineligibility(User user);    // null = eligible; NOT_AUTHENTICATED /
                                             // ACCOUNT_PENDING / ACCOUNT_REJECTED /
                                             // ACCOUNT_SUSPENDED
    boolean hasBypassRole(User user);         // ADMIN or EDITOR
    Set<Long> groupIdsOf(Long userId);
}
```

`BookAccessService` uses it. `PostAccessService`/`ExamAccessService` may be
retrofitted later as a separate, test-covered refactor — **not** as part of this
feature. Side benefit: `PostAttachmentService` currently depends on
`PostAccessService` *only* to call `currentUserOrNull()`, which is an odd
coupling; the Book module should depend on `AccessSubjects` instead of repeating it.

`BookAccessService` public surface (mirroring Post, since a library needs the
richer denial UX, not Exam's plain 404):

```java
boolean canRead(User user, Book book);                        // plain allow/deny → 404 paths
void requireRead(User user, Book book);                       // throws BookAccessDeniedException(reason)
Set<Long> resolveAccessibleBookIds(User user, List<Book> candidates);  // batched, 3 queries max
```

Rule (identical ladder to posts):
`PUBLIC` → allow. `PRIVATE` → must be authenticated → account must not be
PENDING/REJECTED/SUSPENDED (checked **before** the role bypass, so a suspended
admin loses access, same as posts) → ADMIN/EDITOR bypass **or** direct
`book_user_permissions` grant **or** `book_access_groups` ∩ `user_access_groups`
overlap. Anything else denies.

`BookAccessDeniedException` + `DenialReason` reuse: add a second
`@ExceptionHandler` in `GlobalExceptionHandler` alongside
`handlePostAccessDenied` (same body shape: `{"code": "<DenialReason>",
"message": "Access denied"}`; `NOT_AUTHENTICATED` → 401, everything else → 403).
Do **not** reuse `PostAccessDeniedException` for books — the type name is part of
the module boundary, and the handler is two lines.

### 2.2 Access groups: reuse the same `AccessGroup`, add per-entity join tables

**Reuse the same `AccessGroup` entity.** It is already cross-feature by design —
`AccessGroupResponse` carries both `postCount` and `examCount`, and the API
contract §8 explicitly documents "one group can gate both posts and exams".
Admins reason in terms of *"Database Pro members"*, not *"Database Pro for
books"*. One group granting a mix of posts, exams, and books is the correct
model and requires no new entity.

**But the join tables must be per-entity** (`book_access_groups`, not a
polymorphic `resource_access_groups(resource_type, resource_id)`):

- A polymorphic `resource_id` cannot carry a real FK constraint, so orphan rows
  become possible. This repo has a **documented bug class of exactly that kind** —
  `PostService.delete()` blew up on `post_attachments`, and the memory entry
  notes the same latent bug likely exists for comments/access-groups/series links
  because *nothing* in the codebase uses `ON DELETE CASCADE`.
- JPA `@ManyToOne` cannot map a polymorphic id, so every query becomes a native
  query or a `@Any` mapping — a big abstraction for three tables.

Consequences to implement (easy to forget, both are acceptance criteria):

- `AccessGroupResponse` gains **`bookCount`** → API contract change (§5.2), plus
  `AccessGroupService.toResponse()` and the frontend `AccessGroup` type/admin
  table.
- `AccessGroupService.delete()` must also call
  `bookAccessGroupRepository.deleteByAccessGroupId(id)` — it already does this
  for user/post/exam links; missing the book one leaves orphans and an FK error.
- `AccessGroupService` grows `setBookAccessGroups` / `getBookAccessGroups` /
  `setBookDirectUsers` / `getBookDirectUsers`, following the existing exam
  methods exactly. Note this service is already 330 lines with 11 constructor
  dependencies and will pass 400 — flagged as a smell in §7, not split here.

### 2.3 Access requests: deferred, deliberately

`AccessRequest` has `post_id NOT NULL` with a `@ManyToOne Post`. Supporting
"request access to this book" requires either nullable `post_id` + nullable
`book_id` + a discriminator (and a check constraint no one will write), or a
second table. **Recommendation: defer.** The locked-book UI shows the same
reason-coded lock message as a locked post but no "Request access" button.
Record it as a follow-up: the eventual fix is to generalize `AccessRequest`
across posts/exams/books in one pass, not to bolt on a book-specific copy.

---

## 3. Frontend/backend/database boundaries

Unchanged from `docs/03-architecture.md` — `React → Spring Boot REST → PostgreSQL`,
no new tier, no queue, no worker, no object store.

| Concern | Owner |
|---|---|
| Who may read a book | **Backend only.** Every byte-serving endpoint re-checks. The frontend never decides. |
| PDF rendering / pagination | **Frontend only** (`pdf.js`). No server-side PDF parsing → no PDFBox dependency. |
| TXT decoding / charset | **Frontend** (see R10), bytes stored untouched. |
| Reading progress truth | **Backend** for logged-in users; `localStorage` for anonymous. |
| "Continue reading" ordering | **Backend** (`ORDER BY updatedAt DESC LIMIT n`). |
| File type validation | **Both** — client pre-check for UX, server-side allowlist + magic bytes as the real gate (R11). |

---

## 4. "Professional" reading experience

The user asked for this explicitly, so the existing attachment modal is not
sufficient — a modal is the wrong container for long-form reading (no deep link,
no browser-back, no room, nowhere to put progress).

### 4.1 In scope (buildable MVP)

1. **Dedicated full-page reader route** `/library/:slug/read` — its own page,
   own URL, own back button. Minimal chrome: a slim toolbar, then the content.
2. **PDF reader** (`pdf.js` via `react-pdf`, dynamically imported):
   single page rendered to canvas, prev/next buttons, `←`/`→` keys,
   "Page 12 of 340" with a jump-to-page input, fit-width sizing, and a real
   loading state per page. This is the piece that makes it feel like a reader
   rather than a file download.
3. **TXT reader**: rendered into a max-width (~70ch) reading column with reading
   typography and comfortable line-height — **not** the full-width `<pre>` used
   in the attachment modal. Font-size control (3 steps), light/dark via the
   existing CSS tokens.
4. **Reading progress**: PDF = current page; TXT = scroll percent. Shown as a
   thin progress bar in the toolbar + a percentage. Persisted (debounced ~2s, on
   page change, and on `visibilitychange`/unmount so closing the tab doesn't
   lose it).
5. **Resume**: on open, if saved progress exists, show a **non-blocking prompt**
   ("Continue from page 12" / "Start from the beginning") rather than silently
   jumping. Silent jumps are disorienting and are the most common complaint about
   real readers.
6. **"Continue reading" shelf** on the library page for logged-in users — the
   most recently-updated in-progress books, each with its percentage.
7. **Download button**, shown only when `downloadable` is true, hitting the
   separate download endpoint.
8. **Full state coverage** per repo rule #6: loading (including a byte-fetch
   progress indicator — a 40MB book on a slow connection must not be a blank
   screen), error, empty library, and the **locked** state with a
   reason-specific message reusing the copy already written for private posts.

### 4.2 Why `pdf.js` rather than the existing `<iframe>` blob trick

This is the pivotal technical decision, and it is forced:

The native-browser PDF viewer (what `PostAttachments.tsx` uses today) is a
browser-internal document. You **can** deep-link into it (`blob:...#page=12`),
but you **cannot read back** the user's current page, scroll offset, or page
count from JavaScript. So with the iframe approach, "continue where you left
off" is unimplementable for PDF — the format that matters most here. There is no
half-measure: either the app renders the PDF itself, or it has no idea what page
the reader is on.

Cost, stated honestly:
- `react-pdf`/`pdfjs-dist` is ~1MB+ minified. Mitigated the same way `mammoth`
  already is in this repo: `await import(...)` so it ships as a lazy chunk only
  to people who actually open a PDF. Precedent exists and is verified in the
  build output.
- `pdf.js` needs a worker script; wiring `GlobalWorkerOptions.workerSrc` under
  Vite is a known footgun (see R3).
- Canvas rendering means no browser-native find-in-page. Accepted (see §4.4).

**Cheaper fallback if the user rejects the dependency:** keep the iframe, drop
automatic PDF progress, and offer a manual "Save my place" control where the
reader sets the page number. TXT gets the full experience either way. This is
noticeably less "professional" and should be a conscious choice, not a default.

### 4.3 Not a modal — and not a rewrite of what exists

`PostAttachments.tsx` stays exactly as it is. It solves a different problem
(glance at a file attached to an article). The Book reader is a separate page.
What *is* reused: the authenticated-blob-fetch pattern (`fetchAttachmentBlob` →
`fetchBookFileBlob`) and the TXT `blob.text()` path.

### 4.4 Explicitly deferred (with reasons)

| Deferred | Why |
|---|---|
| **Full-text search inside a book** | Needs server-side text extraction (PDFBox), a text/index table, and re-extraction on replace. That is its own feature, larger than this whole module's read path. |
| **EPUB-style reflowable pagination of PDF text** | Requires extracting the text layer and re-laying it out; loses figures/tables/code formatting, which is exactly what technical PDFs are made of. Anti-feature here. |
| **EPUB / MOBI / DOC formats** | User said PDF + TXT. Each new format is a new renderer. |
| **Highlights, annotations, notes, multiple named bookmarks** | Needs an anchoring model (character offsets or PDF coordinates) that survives file replacement. Big. One resume position covers the actual ask. |
| **PDF outline / table-of-contents navigation** | `pdf.js` exposes it cheaply, so this is the most tempting first follow-up — but it needs its own sidebar UI. First follow-up candidate. |
| **Chapters / multi-file books / multiple editions** | Would change `Book` to 1:N `BookFile`. See the assumption challenge in §7. |
| **Offline reading / service-worker caching** | Caching 40MB blobs client-side, plus cache invalidation, for an MVP. No. |
| **Text-to-speech** | Unrelated feature. |
| **Any form of DRM / watermarking / download prevention** | Impossible in a browser that must render the file. `downloadable=false` is UX only — say so in the UI copy. |
| **Pagination of the library listing** | Consistent with the rest of this app, which paginates nothing (existing known gap). Revisit for the whole app, not just here. |

---

## 5. API contract

To be added to `docs/04-api-contract.md` as **§12. Book Library** (§11 is About).
Base path `/api`. All error bodies use the existing
`ApiError { code, message }` shape.

### 5.1 Public / reader endpoints

#### `GET /api/books`
Library listing. Public (`permitAll`), access-filtered in the service.

Query params: `q` (title/author/description contains, case-insensitive),
`category`, `fileType` (`PDF`|`TXT`). All optional.

Returns only `PUBLISHED` books. Access rules:
- `PUBLIC` books: always listed, full metadata.
- `PRIVATE` + accessible to the viewer: listed, full metadata, `locked: false`.
- `PRIVATE` + not accessible + `metadataVisibility = PUBLIC_METADATA`: listed as
  a **locked teaser** — `locked: true`, and `fileUrl` **omitted/null**.
- `PRIVATE` + not accessible + `metadataVisibility = AUTHORIZED_ONLY`: **omitted
  entirely**.

Must use `BookAccessService.resolveAccessibleBookIds` (batched) — no per-row
access query.

```json
[
  {
    "id": 3,
    "title": "PostgreSQL Internals",
    "slug": "postgresql-internals",
    "author": "Egor Rogov",
    "description": "Deep dive into the storage engine.",
    "category": "Database",
    "fileType": "PDF",
    "fileSize": 24117248,
    "hasCoverImage": true,
    "coverImageUrl": "/api/books/3/cover-image",
    "downloadable": true,
    "visibility": "PUBLIC",
    "locked": false,
    "fileUrl": "/api/books/3/file",
    "readProgressPercent": 34,
    "publishedAt": "2026-08-09T00:00:00Z"
  }
]
```

- `readProgressPercent`: `null` for anonymous viewers or books never opened.
- **Teaser shape** (`locked: true`): `title`, `author`, `description`,
  `category`, `fileType`, cover fields, `publishedAt` are present;
  `fileUrl` is `null`, `downloadable` is `false`, `fileSize` is `null`,
  `readProgressPercent` is `null`. The implementer must not leak `fileUrl` here.

#### `GET /api/books/{slug}`
Book detail. Public route, reason-coded denial (the richer UX, mirroring
`GET /api/posts/{slug}`):

- Not found or not `PUBLISHED` → `404 BOOK_NOT_FOUND`.
- `PRIVATE` and inaccessible → `BookAccessService.requireRead` throws;
  `401` with `code: "NOT_AUTHENTICATED"`, or `403` with
  `ACCOUNT_PENDING` / `ACCOUNT_REJECTED` / `ACCOUNT_SUSPENDED` / `NO_ACCESS`.
  (Exception: when `metadataVisibility = AUTHORIZED_ONLY`, return
  `404 BOOK_NOT_FOUND` instead, so the detail endpoint doesn't confirm existence
  that the listing deliberately hid.)

Body: the listing shape plus `createdAt`/`updatedAt`/`originalFilename` and the
full `readProgress` object `{ position, total, unit, percent, updatedAt }` or
`null`.

#### `GET /api/books/{id}/cover-image`
Public route, access-gated in the service with a **plain `404`** on denial
(oracle-avoidance, same as `GET /api/posts/{id}/cover-image`). Returns the image
bytes.

#### `GET /api/books/{id}/file`
**The read endpoint.** Public route, access-gated in the service with the same
plain-`404`-on-denial rule as `PostAttachmentService.getForView`. Returns the
raw bytes with `Content-Type: application/pdf` or `text/plain` and
`Content-Disposition: inline`.

Errors: `404 BOOK_NOT_FOUND` (unknown, unpublished, or inaccessible),
`404 BOOK_FILE_NOT_FOUND` (row exists, `book_files` row missing — data-integrity
case).

Not implemented at MVP: HTTP `Range` support. See R2 — this has a real
performance consequence and the reader UI must compensate with a byte-fetch
progress indicator.

#### `GET /api/books/{id}/download`
Same access gate, but `Content-Disposition: attachment; filename="..."`, and
returns `403 BOOK_NOT_DOWNLOADABLE` when `downloadable = false`. Kept as a
separate endpoint from `/file` so the flag has a single, checkable meaning.

#### `GET /api/books/{id}/progress` — authenticated
`200` with `{ position, total, unit, percent, updatedAt }`, or `204 No Content`
if there is no saved progress. `401` for anonymous. Access-gated (a book you
can't read has no progress).

#### `PUT /api/books/{id}/progress` — authenticated
Body: `{ "position": 12, "total": 340, "unit": "PAGE" }`. Upsert on
`(book_id, user_id)`, idempotent, last-write-wins. `200` with the stored row.
Validation: `position` in `[0, total]`, `total >= 1`, `unit` must match the
book's `fileType` (`PDF` → `PAGE`, `TXT` → `PERCENT`) else `400 BAD_REQUEST`.

#### `GET /api/me/reading?limit=6` — authenticated
The "continue reading" shelf. In-progress books (`percent` between 1 and 99),
newest-updated first, access-filtered (a revoked grant must drop the book off the
shelf). Returns the listing shape + `readProgressPercent`.

### 5.2 Admin endpoints (all `ADMIN` bearer token, under `/api/admin/**`)

| Method + path | Notes |
|---|---|
| `GET /api/admin/books` | All books incl. `DRAFT`/`PRIVATE`. Never includes bytes. |
| `GET /api/admin/books/{id}` | Detail + current access-group/user ids. |
| `POST /api/admin/books` | `multipart/form-data`: `title`, `slug`, `author?`, `description?`, `category?`, `status`, `visibility`, `metadataVisibility?`, `downloadable`, `file` (required), `coverImage?`. → `201`. |
| `PUT /api/admin/books/{id}` | Same fields; `file` optional (present ⇒ replace bytes + `fileType`/`fileSize`/`contentType`/`originalFilename`); `removeCoverImage` boolean. |
| `PUT /api/admin/books/{id}/status` | `?status=DRAFT|PUBLISHED`. Mirrors `PUT /api/posts/{id}/status`. |
| `DELETE /api/admin/books/{id}` | `204`. **Must delete `book_reading_progress`, `book_access_groups`, `book_user_permissions`, `book_files` rows first** — see R5. |
| `GET /api/admin/books/{id}/access-groups` | `[{id, name, slug}]` |
| `PUT /api/admin/books/{id}/access-groups` | Body `number[]`, replace-all. |
| `GET /api/admin/books/{id}/access-users` | `[{id, username, email}]` |
| `PUT /api/admin/books/{id}/access-users` | Body `number[]`, replace-all. |

Upload validation errors (all `400 BAD_REQUEST` unless noted):
empty file; `contentType` not in `{application/pdf, text/plain}`; magic-byte
check failed (`INVALID_BOOK_FILE`); over 50MB; `slug` already taken
(`409`, matching the post slug-conflict convention).

Also changed by this feature: `AccessGroupResponse` gains **`bookCount`**
(documented in §8 of the contract, where `examCount` is described).

### 5.3 `SecurityConfig` additions — **ordering matters**

```java
.requestMatchers(HttpMethod.GET,  "/api/books").permitAll()
.requestMatchers(HttpMethod.GET,  "/api/books/*/cover-image").permitAll()
.requestMatchers(HttpMethod.GET,  "/api/books/*/progress").authenticated()   // BEFORE the wildcard
.requestMatchers(HttpMethod.PUT,  "/api/books/*/progress").authenticated()
.requestMatchers(HttpMethod.GET,  "/api/books/**").permitAll()               // file, download, {slug}
.requestMatchers(HttpMethod.GET,  "/api/me/reading").authenticated()
```

Insert these **before** the existing `.requestMatchers("/api/admin/**")` line and
after the posts block. If `GET /api/books/**` is placed above the progress
matchers, Spring's first-match-wins ordering makes `GET .../progress` public and
the endpoint then reads `currentUserOrNull() == null` for everyone — a silent
bug that no happy-path test catches. Admin book routes need no new entry
(`/api/admin/**` → `hasRole("ADMIN")` already covers them).

Also note `POST /api/books` etc. do **not** exist — all writes are under
`/api/admin/`, so no `hasAnyRole("ADMIN","EDITOR")` line is needed and EDITOR
gets no book access, consistent with images/videos/attachments.

---

## 6. Frontend structure

### 6.1 New files

| File | Purpose |
|---|---|
| `pages/LibraryPage.tsx` | `/library`. Continue-reading row (auth only) + book grid (cover, title, author, type badge, lock badge, progress bar). Search + category filter. Loading / error / empty (`"No books in the library yet."`). |
| `pages/BookDetailPage.tsx` | `/library/:slug`. Cover, metadata, Markdown description, primary "Read" CTA, "Download" (when allowed), and the locked state with reason-specific copy. |
| `pages/BookReaderPage.tsx` | `/library/:slug/read`. Fetches metadata + gated bytes, owns the resume prompt, delegates rendering. |
| `components/ReaderToolbar.tsx` | Back link, title, progress bar/%, page controls (PDF), font-size controls (TXT), download. |
| `components/PdfReader.tsx` | Lazy-imported `react-pdf`; page canvas, prev/next, jump-to-page, keyboard nav. |
| `components/TxtReader.tsx` | Styled reading column, scroll-percent reporting, font-size, encoding fallback selector (R10). |
| `hooks/useReadingProgress.ts` | Debounced save, flush on unmount/`visibilitychange`, `localStorage` fallback for anonymous readers. |
| `pages/AdminBooks.tsx` | `/admin/books` — list, status toggle, delete (with confirm), empty state. |
| `pages/AdminBookForm.tsx` | `/admin/books/new`, `/admin/books/:id/edit` — metadata, file upload/replace, cover upload, visibility + metadataVisibility + downloadable, access pickers. |

Plus edits to: `types.ts`, `api.ts`, `main.tsx` (5 routes: 3 public, 2 inside
`RequireAuth`), `styles.css`, and the nav/footer link chore across the public
pages + admin topbars (same ~12-file chore already documented for the About
page; `MemberExams`/`MemberHistory` etc. are consistently excluded).

### 6.2 What is reused vs. new

| Existing asset | Reuse level |
|---|---|
| `fetchAttachmentBlob` (authenticated blob fetch via `publicAuthHeader()`) | **Direct** → `fetchBookFileBlob`. This is what keeps private books gated. |
| `AttachmentManager.tsx` upload panel | **~60%** → a single-file "replace" field instead of an append-to-list. Client-side type/size pre-check pattern copies over directly. |
| `PostForm.tsx` cover-image upload (object-URL preview, revoke on cleanup, remove button) | **Direct copy.** |
| `PostForm.tsx` visibility toggle + access-group/access-user checkbox pickers | Currently **inline** in `PostForm.tsx` (~80 lines, `PostForm.tsx:459+`). **Recommend extracting to `components/AccessControlPanel.tsx`** parameterized by fetch/save callbacks, then using it from both forms. This edits `PostForm.tsx`, so the private-post save flow needs re-verification after the extraction. If the frontend agent judges the extraction risky mid-feature, copy it and record the duplication as a follow-up — but extraction is preferred, since a third copy would arrive with the next gated feature. |
| `PostAttachments.tsx` modal viewer | **Not reused** as a viewer (wrong container, §4.3). Its TXT `blob.text()` path and error/loading state structure are reused. |
| `AdminPosts.tsx` list-page layout (topbar, table, status toggle, optimistic delete) | **Direct pattern copy** for `AdminBooks.tsx`. |
| `PostDetail.tsx` access-denied state + copy | **Direct** for the locked-book state. |
| `mammoth` lazy-import pattern | **Direct pattern** for `react-pdf`. |

### 6.3 New dependency

`react-pdf` (+ `pdfjs-dist`). MIT. Must be dynamically imported. See R3 for the
worker-config risk. This is the only new dependency in the module.

---

## 7. Challenges to weak assumptions — confirm before coding

These are the points where the request is under-specified enough that guessing
wrong means rework. **The first two should be answered before FE work starts.**

1. **"Professionally" is not a specification.** This plan reads it as: dedicated
   reader page + real page navigation + resume + progress + download. If the
   user actually means Kindle-like (reflowed text, adjustable margins,
   highlights, in-book search), that is 3–5× the frontend work and needs a
   different plan. **Confirm §4.1 vs §4.4 before FE-B3.**
2. **One book = exactly one file.** If books are multi-volume or per-chapter
   files, `Book` must become 1:N `BookFile` with an ordering column, which
   changes the schema, the reader, and the API. Cheap to decide now, expensive
   to retrofit. **Ask.**
3. **"Per individual user or public for everyone" skipped the middle option.**
   The reused mechanism gives three tiers: public, group, per-user. Groups come
   essentially free here (same `AccessGroup` entity) and are how you avoid
   granting 30 users one-by-one — but confirm the admin actually wants to manage
   groups, otherwise the group picker is dead UI.
4. **Only ADMIN uploads books.** This plan assumes the blog owner curates the
   library. If members should upload their own books, that adds ownership,
   quotas, moderation, and abuse handling — a different, much larger feature.
5. **TXT files are UTF-8.** Given the user writes Vietnamese, this assumption
   will break on at least one file (Windows-1258 / UTF-16 / legacy VNI). See R10
   — mitigated, but do not assume it away.
6. **`downloadable=false` protects nothing.** If the user's intent behind
   "access control" is "readers must not be able to keep a copy", that intent
   cannot be met by any browser-based reader. Say this out loud before building
   the toggle, so it isn't discovered later as a broken promise.
7. **Progress is last-write-wins across devices.** Reading on a phone then a
   laptop can move the bookmark backwards. Acceptable; stated so it isn't
   treated as a bug report later.
8. **`AccessGroupResponse` is accumulating a count-per-feature
   (`postCount`/`examCount`/`bookCount`).** This is a design smell — every future
   gated feature widens a shared DTO and adds a query to
   `AccessGroupService.toResponse()`. Not fixed here (the fix is a single grouped
   counts query or a `counts: {posts, exams, books}` sub-object, which is an API
   break). Recorded so the fourth feature triggers the refactor instead of a
   fourth field.
9. **`AccessGroupService` will exceed 400 lines and 12 constructor
   dependencies** after this feature. Still cohesive ("who can read what"), so
   not split here, but this is the last feature that should be added to it
   without splitting per resource type.

---

## 8. Implementation risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| **R1** | **bytea DB bloat.** ~1.25GB for 50 average books, inside every `pg_dump`, and **no backup schedule exists yet.** Different scaling profile from images/videos because a library is *meant* to grow. | **High** | 50MB cap in code; `book_files` table split as a pre-planned exit (§1.2); **schedule `pg_dump` before real content lands** (DevOps prerequisite); re-measure after ~10 books. |
| **R2** | **Whole file in JVM heap, no HTTP `Range`.** `ResponseEntity<byte[]>` means a 40MB book is fully materialized per concurrent reader, and `pdf.js` cannot fetch page-by-page — the reader waits for the entire file before page 1 renders. 5 concurrent readers ≈ 200MB+ heap churn. | **High** | 50MB cap; byte-fetch progress indicator in the reader (never a blank screen); disable `pdf.js` range/streaming so it doesn't issue partial requests the server ignores; if this bites, switch `/file` to `InputStreamResource` + `ResourceRegion` streaming — a contained change behind the same URL. |
| **R3** | **`pdf.js` worker setup under Vite.** `GlobalWorkerOptions.workerSrc` must point at a bundled asset; getting it wrong yields either a silent no-render or a CDN fetch that breaks offline/CSP. Also a ~1MB chunk. | Medium | Bundle the worker locally (never a CDN — the app is served from its own nginx); verify the lazy chunk in `npm run build` output, exactly as was done for `mammoth`; render one page at a time (not `<Document>` full-render) to bound memory. |
| **R4** | **`SecurityConfig` matcher ordering** — `GET /api/books/**` `permitAll()` placed above the progress matchers silently makes progress endpoints anonymous. | Medium | Explicit ordering in §5.3; add a test asserting `GET /api/books/{id}/progress` without a token returns `401`. |
| **R5** | **Delete-cleanup FK bug.** This repo has already shipped this bug twice (`post_attachments` 500 on post delete; `PostService.delete()` still lacks cleanup for comments/access-groups/series). `DELETE /api/admin/books/{id}` touches **four** dependent tables. | **High** (near-certain if not tested) | Explicit ordered cleanup in `BookService.delete()`; a regression test that creates a book **with** a file + a group grant + a user grant + a progress row, then deletes it. Non-negotiable acceptance criterion. |
| **R6** | **Third copy of the access rule → drift.** Post and Exam versions have *already* diverged on account-status handling. | Medium | Shared `AccessSubjects` helper for the drift-prone half (§2.1); test the account-status ladder for books explicitly rather than assuming parity. |
| **R7** | **`downloadable=false` reads as protection but isn't.** | Medium (expectation risk) | Say so in the admin form's helper text and in the contract. See §7.6. |
| **R8** | **`ddl-auto: update` creates the tables but no indexes/FK cascades.** Still no Flyway (standing gap). | Medium | Declare unique constraints via JPA annotations (`book_files.book_id`, `book_reading_progress(book_id,user_id)`) so `ddl-auto` emits them; record the exact DDL in the task note for the production host; do **not** rely on `ON DELETE CASCADE` (nothing in this codebase uses it) — R5's app-level cleanup is the mechanism. |
| **R9** | **Client-supplied MIME is trusted.** `file.getContentType()` comes from the browser; a renamed binary can claim `application/pdf`. Same weakness exists in `PostAttachmentService` today. | Low-Medium | 5-line magic-byte check: PDF must start with `%PDF-`; TXT must decode as text without control-byte garbage. Exposure is limited (ADMIN-only upload, and `pdf.js` renders in-page rather than handing the file to a plugin), but the check is nearly free. |
| **R10** | **TXT charset.** `blob.text()` assumes UTF-8. A Windows-1258/UTF-16/legacy-VNI Vietnamese book renders as mojibake — a likely scenario for this user. | Medium | Store bytes untouched. Reader: honour a BOM if present (UTF-8/UTF-16LE/BE); otherwise try UTF-8 and, if the decoded text exceeds a small threshold of U+FFFD replacement characters, surface an encoding selector in the toolbar (`UTF-8` / `UTF-16` / `Windows-1258`) using `TextDecoder`. Never silently show garbage. |
| **R11** | **Teaser leak.** A locked book's listing entry must not carry `fileUrl`/`fileSize`, and the `AUTHORIZED_ONLY` book must not be confirmable via the detail endpoint. | Medium | Build the teaser via a dedicated factory (`BookResponse.teaser(...)`) rather than nulling fields at the call site; test that a locked listing entry has `fileUrl == null` and that `AUTHORIZED_ONLY` yields `404` from `GET /api/books/{slug}`. |
| **R12** | **Replacing a book's file invalidates saved progress** (page 200 of a 340-page edition is meaningless in a new 120-page file). | Low | On file replace in `BookService.update()`, delete that book's `book_reading_progress` rows and warn in the admin form before saving. Cheap and prevents nonsense bookmarks. |
| **R13** | **No listing pagination** (app-wide gap). A 200-book library returns everything in one payload. | Low at MVP | Accepted, consistent with the rest of the app; noted as part of the existing pagination follow-up rather than solved here. |

---

## 9. Implementation plan

Backend first — every FE task depends on a live endpoint. Each step should be
independently committable and test-green.

### Phase 1 — Backend

**BE-B1 — Schema & entities.** `com.example.blog.book`: `Book`, `BookFile`,
`BookFileType`, `BookStatus`, `BookVisibility`, `BookMetadataVisibility`,
`BookReadingProgress`, `ProgressUnit`; `com.example.blog.access`:
`BookAccessGroup`, `BookUserPermission`. Repositories for each, with the batched
finders the access service needs (`findByBookIdIn`, `findByUserIdAndBookIdIn`,
`countByAccessGroupId`, `deleteByAccessGroupId`, `deleteByBookId`). Record the
resulting DDL in the task note (R8). *Done when:* app boots, tables + unique
indexes exist, no behaviour change.

**BE-B2 — Access layer.** `AccessSubjects` shared helper; `BookAccessService`
(`canRead`, `requireRead`, `resolveAccessibleBookIds`);
`BookAccessDeniedException`; `GlobalExceptionHandler` mapping. Do **not**
refactor `PostAccessService`/`ExamAccessService` in this step.
*Done when:* unit tests cover the full ladder — public, anonymous-on-private,
PENDING/REJECTED/SUSPENDED, ADMIN/EDITOR bypass, direct grant, group overlap,
no-access.

**BE-B3 — `BookService` + DTOs.** `BookResponse` (+ `teaser()` factory),
`BookDetailResponse`, `BookRequest`. `create`/`update` (multipart, 50MB cap,
MIME allowlist + magic bytes, slug uniqueness incl. the update case),
`updateStatus`, `delete` (**ordered four-table cleanup**), `list` (batched
access + teaser/omit logic), `findBySlug` (reason-coded + the
`AUTHORIZED_ONLY` → 404 exception), `getFileForView`, `getCoverForView`,
`getForDownload` (the `downloadable` gate).

**BE-B4 — Controllers, security, group wiring.** `PublicBookController`,
`AdminBookController`; `SecurityConfig` matchers **in the order given in
§5.3**; `AccessGroupService` gains the four book methods + `bookCount` in
`toResponse()` + `deleteByAccessGroupId` in `delete()`; `AccessGroupResponse`
gains `bookCount`.

**BE-B5 — Reading progress.** `BookProgressService` (upsert, access-gated,
unit/range validation), `GET`/`PUT /api/books/{id}/progress`,
`GET /api/me/reading`. Delete progress on file replace (R12).

**BE-B6 — Tests** (`mvn test`, add to the existing suite). Minimum matrix:
upload valid PDF → 201 and appears in admin list; upload valid TXT → 201;
reject `application/zip`; reject >50MB; reject PDF-claiming file failing the
magic-byte check; reject duplicate slug → 409; unauthenticated upload → 401;
`GET /api/books` hides `DRAFT`; hides `AUTHORIZED_ONLY` private book from a
non-granted MEMBER; shows the same book as a locked teaser when
`PUBLIC_METADATA`, **asserting `fileUrl == null`**; `GET /api/books/{slug}`
returns `NO_ACCESS` 403 for a non-granted MEMBER and 200 after a group grant;
`GET /api/books/{id}/file` → 404 for a non-granted MEMBER, 200 + `inline` for a
granted one; `/download` → 403 `BOOK_NOT_DOWNLOADABLE` when the flag is off;
`PUT /progress` without a token → 401 (**guards R4**); progress upsert twice
keeps one row; **delete a book that has a file + group grant + user grant +
progress row → 204** (guards R5); revoking a grant drops the book from
`/api/me/reading`.

### Phase 2 — Frontend

**FE-B1 — Types + API client.** `types.ts` (`Book`, `BookDetail`,
`BookFileType`, `BookVisibility`, `ReadingProgress`; add `bookCount` to
`AccessGroup`); `api.ts` (~14 functions incl. `fetchBookFileBlob`).

**FE-B2 — Library + detail.** `LibraryPage.tsx`, `BookDetailPage.tsx`, routes,
nav/footer links. All four states + the locked state. *Shippable slice on its
own — books are browsable and downloadable before the reader exists.*

**FE-B3a — TXT reader.** `BookReaderPage.tsx` + `ReaderToolbar.tsx` +
`TxtReader.tsx` + `useReadingProgress.ts`. No new dependency, so this proves the
reader shell, the progress round-trip, and the resume prompt end-to-end against
a seeded TXT book.

**FE-B3b — PDF reader.** Add `react-pdf`, lazy-imported; `PdfReader.tsx`;
verify the worker config and the lazy chunk in the build output (R3).

**FE-B4 — Continue-reading shelf** on `LibraryPage`, wired to `/api/me/reading`.

**FE-B5 — Admin.** Extract `AccessControlPanel.tsx` out of `PostForm.tsx`
(re-verify the private-post save flow afterwards), then `AdminBooks.tsx` +
`AdminBookForm.tsx`; admin topbar link.

**FE-B6 — Checks.** `npm run lint && npm run typecheck && npm run build`, plus a
manual/Playwright pass: upload a PDF and a TXT, read both, close mid-book,
reopen and confirm resume, verify a locked book from a MEMBER account.

### Phase 3 — Docs & ops

**DOC-B1** — `docs/04-api-contract.md` §12 + the `bookCount` note in §8;
`docs/03-architecture.md` data-model section; `TASKS.md` task entries;
`docs/06-project-memory.md` entry on completion.

**OPS-B1** — **Prerequisite for production use, not optional:** schedule
`pg_dump` for `personal-blog-postgres` (R1). Also confirm DB disk headroom on
the production host before the first real upload.

### Sizing

Roughly 2–2.5× the post-attachments feature: ~9 new backend classes + 6
repositories + 2 controllers + ~18 tests, and ~9 new frontend files plus one new
dependency. Materially larger than any single feature in this repo so far —
worth landing in the phase order above (each phase independently green) rather
than as one branch.
