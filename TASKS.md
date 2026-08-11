# TASKS.md

## Phase 1 — MVP Blog

### TASK-PD-001 — Product requirement baseline

Owner agent: `product-agent`

Output:
- `docs/01-prd.md`

Acceptance criteria:
- Defines target user
- Defines blog use cases
- Defines MVP and out of scope
- Defines acceptance criteria

---

### TASK-UX-001 — UI flow baseline

Owner agent: `ux-agent`

Output:
- `docs/02-ui-flow.md`

Acceptance criteria:
- Defines public home page
- Defines post detail page
- Defines search/filter behavior
- Defines empty/loading/error states

---

### TASK-ARCH-001 — Technical architecture baseline

Owner agent: `architect-agent`

Output:
- `docs/03-architecture.md`
- `docs/04-api-contract.md`

Acceptance criteria:
- Defines frontend/backend boundaries
- Defines Post data model
- Defines API contract
- Defines error handling

---

### TASK-BE-001 — Implement post CRUD API

Owner agent: `backend-agent`

Files likely affected:
- `backend/src/main/java/com/example/blog/post/*`
- `backend/src/main/resources/application.yml`

Acceptance criteria:
- `GET /api/posts` returns published posts by default
- `GET /api/posts/{slug}` returns one published post
- `POST /api/posts` creates a post
- `PUT /api/posts/{id}` updates a post
- `DELETE /api/posts/{id}` deletes a post
- API returns clear error responses

Test command:

```bash
cd backend && mvn test
```

---

### TASK-FE-001 — Implement public blog UI

Owner agent: `frontend-agent`

Files likely affected:
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `frontend/src/components/*`
- `frontend/src/styles.css`

Acceptance criteria:
- Home page displays post list
- Search input filters posts through API query
- Category filter works
- Post detail page opens by slug
- UI handles loading, empty, and error states

Test command:

```bash
cd frontend && npm run lint && npm run typecheck && npm run build
```

---

### TASK-QA-001 — MVP verification

Owner agent: `qa-agent`

Output:
- `docs/05-test-plan.md`

Acceptance criteria:
- Test plan maps to PRD acceptance criteria
- API test cases listed
- Frontend test cases listed
- Known gaps listed

---

### TASK-SEC-001 — Security review

Owner agent: `security-agent`

Output:
- `docs/security-review.md`

Acceptance criteria:
- Checks CORS
- Checks mass assignment risk
- Checks unauthenticated write APIs and flags as MVP limitation
- Checks secret handling
- Checks input validation

---

## Phase 2 — Post-MVP features (partial; see docs/06-project-memory.md for the full shipped list)

### TASK-BE-010 — Video upload (transcode) + YouTube embed support

Owner agent: `backend-agent` + `frontend-agent`

Files affected:
- `backend/src/main/java/com/example/blog/video/*` (new package)
- `backend/src/main/java/com/example/blog/config/SecurityConfig.java`
- `backend/src/main/java/com/example/blog/common/GlobalExceptionHandler.java`
- `backend/src/main/resources/application.yml`, `backend/src/test/resources/application-test.yml`
- `frontend/src/api.ts`, `frontend/src/components/VideoUploadButton.tsx`,
  `frontend/src/components/YoutubeEmbedButton.tsx`, `frontend/src/pages/PostForm.tsx`,
  `frontend/src/styles.css`

Acceptance criteria:
- Admin can upload a video (≤200MB raw, ≤10min) from the post editor; backend transcodes
  to H.264/AAC MP4 via ffmpeg and stores it; player supports seeking (HTTP Range).
- Admin can paste a YouTube URL to embed a responsive player in post content.
- `docs/04-api-contract.md` §9 documents both.

Test command:

```bash
cd backend && mvn test
cd frontend && npm run lint && npm run typecheck && npm run build
```

Known gaps (see `docs/06-project-memory.md`):
- `ffmpeg`/`ffprobe` must be installed on every host that runs the backend (dev + prod +
  CI) — not yet added to `.github/workflows/ci.yml` or the deployment guide.
- Videos stored as Postgres bytea (matches the existing image pattern) — same DB-bloat
  risk as images, magnified by file size; revisit if usage grows.
- `GET /api/videos/**` is unauthenticated, same known gap as `GET /api/images/**`.

---

### TASK-FE-006 — Related posts sidebar on post detail page

Owner agent: `backend-agent` + `frontend-agent`

Files affected:
- `backend/src/main/java/com/example/blog/post/PostRepository.java`,
  `PostService.java`, `PostController.java`, `RelatedPostResponse.java` (new)
- `frontend/src/api.ts`, `frontend/src/types.ts`,
  `frontend/src/components/RelatedPosts.tsx` (new), `frontend/src/pages/PostDetail.tsx`,
  `frontend/src/styles.css`

Acceptance criteria:
- `GET /api/posts/{slug}/related` returns up to `limit` (default 5) published
  posts related by category match / shared tags, excluding the post itself and
  any post the current viewer can't read; documented in `docs/04-api-contract.md` §2b.
- Post detail page shows a "Related Posts" panel in a right-hand sidebar column.
- Widget has its own loading, error, and empty ("No related posts yet.") states.

Test command:

```bash
cd backend && mvn test
cd frontend && npm run lint && npm run typecheck && npm run build
```

---

### TASK-BE-012 — Post attachments (PDF/DOC/DOCX/TXT) with inline viewer

Owner agent: `backend-agent` + `frontend-agent`

Files affected:
- `backend/src/main/java/com/example/blog/post/PostAttachment.java`, `AttachmentType.java`,
  `PostAttachmentRepository.java`, `PostAttachmentResponse.java`, `PostAttachmentService.java` (all new)
- `backend/src/main/java/com/example/blog/post/PostResponse.java`, `PostService.java`,
  `PostController.java`, `AdminPostController.java`
- `frontend/src/api.ts`, `frontend/src/types.ts`,
  `frontend/src/components/AttachmentManager.tsx`, `PostAttachments.tsx` (both new),
  `frontend/src/pages/PostForm.tsx`, `PostDetail.tsx`, `frontend/src/styles.css`
- `frontend/package.json` — added `mammoth` (DOCX → HTML, lazy-loaded)

Acceptance criteria:
- Admin can upload PDF/DOC/DOCX/TXT attachments (≤20MB each) to a post from the edit form,
  and remove them; multiple files per post.
- Post detail page lists attachments; clicking one opens an inline viewer (PDF via native
  browser rendering, TXT as plain text, DOCX converted client-side via mammoth) instead of
  just downloading. DOC (legacy binary format) has no safe in-browser renderer — download only.
- Attachment access follows the parent post's visibility — a private post's attachments are
  gated the same as its content (unlike `content_images`/`content_videos`, which have no
  per-post access check; see known gaps in `docs/06-project-memory.md`).
- `docs/04-api-contract.md` §10 documents upload/list/delete/view.

Test command:

```bash
cd backend && mvn test
cd frontend && npm run lint && npm run typecheck && npm run build
```

Known gaps (see `docs/06-project-memory.md`):
- Upload is ADMIN-only (`/api/admin/**`), not EDITOR — matches the existing
  image/video upload convention, but differs from plain post CRUD which is ADMIN+EDITOR.
- Attachments stored as Postgres bytea — same DB-bloat-at-scale caution already flagged
  for images/videos, at a smaller (20MB) per-file cap.

---

### TASK-FE-007 — About page (admin-editable)

Owner agent: `backend-agent` + `frontend-agent`

Files affected:
- `backend/src/main/java/com/example/blog/about/*` (new package: `AboutContent.java`,
  `AboutContentRepository.java`, `AboutResponse.java`, `AboutRequest.java`, `AboutService.java`,
  `AboutController.java`, `AdminAboutController.java`)
- `backend/src/main/java/com/example/blog/config/SecurityConfig.java`
- `frontend/src/api.ts`, `frontend/src/types.ts`,
  `frontend/src/pages/AboutPage.tsx`, `AdminAbout.tsx` (both new), `frontend/src/main.tsx`
- Nav/footer links added across `App.tsx`, `PostDetail.tsx`, `SeriesList.tsx`,
  `SeriesDetail.tsx`, and the 8 admin list-page topbars

Acceptance criteria:
- Public `/about` page shows admin-edited title + Markdown content; before any
  admin save, shows a "still being written" empty state instead of a blank page.
- Admin can edit About content at `/admin/about` (ADMIN role, same convention
  as other `/api/admin/**` routes); success/loading/error states on save.
- `docs/04-api-contract.md` §11 documents the 3 endpoints.

Test command:

```bash
cd backend && mvn test
cd frontend && npm run lint && npm run typecheck && npm run build
```

Known gaps (see `docs/06-project-memory.md`):
- Nav "About" link added to the 4 core public pages + 8 admin list pages, not
  the member/exam-flow pages (`MemberExams`, `MemberHistory`, etc.) — different
  feature area, left out to bound scope.

---

### TASK-BE-013 — Book Library, Phase 1: core module (DONE)

Owner agent: `architect-agent` (design) + `backend-agent` + `frontend-agent`

Design doc: `docs/08-book-library-module.md` (data model, access-control
rationale, reader-UX decisions, API contract, risk list R1–R13, full
implementation plan). Full API contract: `docs/04-api-contract.md` §12.

Files affected (summary — see the design doc / API contract for the full list):
- Backend: `backend/.../book/*` (new package — `Book`, `BookFile`,
  `BookReadingProgress` entities; `BookService`, `BookProgressService`;
  `PublicBookController`, `AdminBookController`), `backend/.../access/BookAccessGroup.java`,
  `BookUserPermission.java`, `BookAccessService.java`, `BookAccessDeniedException.java`,
  `AccessSubjects.java` (new shared helper); `AccessGroupService.java`/`AccessGroupResponse.java`
  (+`bookCount`); `GlobalExceptionHandler.java`; `SecurityConfig.java`
- Frontend: `frontend/.../pages/LibraryPage.tsx`, `BookDetailPage.tsx`,
  `BookReaderPage.tsx`, `AdminBooks.tsx`, `AdminBookForm.tsx` (all new);
  `components/PdfReader.tsx`, `TxtReader.tsx`, `ReaderToolbar.tsx` (all new);
  `hooks/useReadingProgress.ts` (new); `api.ts`, `types.ts`, `main.tsx`, `styles.css`;
  nav/footer links across the same page set as the About-page chore
- `frontend/package.json` — added `react-pdf` (+`pdfjs-dist`), lazy-loaded

Acceptance criteria (Phase 1 scope only — see Phase 2/3 below for what's deliberately deferred):
- Admin uploads a PDF or TXT book (≤50MB) with metadata, cover image,
  visibility (PUBLIC/PRIVATE + access groups + direct users, reusing the
  existing `AccessGroup` entity), and a downloadable toggle.
- `/library` lists books (search/category filter, locked teasers for private
  books, "continue reading" shelf for logged-in users).
- `/library/:slug` shows book detail with a "Start/Continue reading" CTA.
- `/library/:slug/read` is a dedicated full-page reader: PDF rendered via
  `pdf.js` (page navigation, jump-to-page), TXT in a styled reading column
  (font-size control, BOM/encoding detection); both report reading position,
  a non-blocking resume prompt on reopen, and a progress bar.
- Reading progress persists server-side for logged-in users
  (`GET/PUT /api/books/{id}/progress`), `localStorage` for anonymous readers.
- Private book access follows the exact same PUBLIC/PRIVATE + access-group +
  direct-grant + reason-coded-401/403 model as posts — verified by dedicated
  tests, not just copied by inspection.

Test command:

```bash
cd backend && mvn test
cd frontend && npm run lint && npm run typecheck && npm run build
```

Result: `mvn test` → 102/102 passing (16 new in `BookControllerTest`, covering
upload validation, the access ladder, teaser/omit rules, file/download gates,
progress CRUD + auth guard, and the delete-cascade regression). Frontend
lint/typecheck/build all clean; `react-pdf`+`pdfjs-dist` confirmed code-split
into a separate lazy chunk in the build output, not part of the main bundle.

Known gaps (see `docs/08-book-library-module.md` §8 for the full list):
- No HTTP Range support on `/api/books/{id}/file` — the whole file loads into
  JVM heap per request; capped at 50MB to bound this, but a real fix (`ResourceRegion`
  streaming) is deferred until it's actually a problem.
- No scheduled `pg_dump` yet (pre-existing gap) — this feature is the largest
  bytea-storage risk added to the app so far, since a library is meant to grow.
- Upload is ADMIN-only, not ADMIN+EDITOR — matches the existing image/video/
  attachment convention, differs from plain post CRUD.
- `AccessControlPanel` was **not** extracted out of `PostForm.tsx` as the design
  doc recommended — `AdminBookForm.tsx` copies the access-group/user picker
  instead (the design doc explicitly allowed this fallback). Follow-up: extract
  when a third form needs the same picker.

---

### TASK-BE-014 — Book Library, Phase 2: highlights & annotations (DONE)

Owner agent: `backend-agent` + `frontend-agent`

Scope: let a reader select text in a book and save a highlight (with an
optional note, one of a fixed set of colors), tied to their account;
view/manage their own highlights across every book. Design in
`docs/09-book-highlights-phase2.md`.

- `GET/POST /api/books/{id}/highlights`, `PUT/DELETE
  /api/books/{id}/highlights/{highlightId}`, `GET /api/me/highlights`
  (cross-book, paginated via `limit`) — all in `PublicBookController`,
  backed by `BookHighlightService`/`BookHighlightRepository`.
- Anchoring: `HighlightAnchorType` (TXT: `startOffset`/`endOffset` into the
  decoded string, plus the snippet text as a re-anchor key; PDF: page number
  + normalized rect quads, no character offsets). Resolves the `pdf.js`
  text-layer tradeoff flagged as a risk here by enabling the text layer only
  on the single currently-rendered PDF page, not globally — see
  `docs/09-book-highlights-phase2.md` §1–2 for the full reasoning.
- Frontend: `HighlightPopup.tsx` (select-to-highlight), `HighlightNoteEditor.tsx`,
  `BookHighlightsPanel.tsx` (per-book list), `useBookHighlights.ts`.
- Access: a highlight is only visible/editable by the user who created it;
  reading a book's highlights still requires the same book-visibility check
  as reading the book.

---

### TASK-BE-015 — Book Library, Phase 3: in-book search (DONE)

Owner agent: `frontend-agent`

100% client-side, no backend/API change. Search is scoped to the
currently-open book, not cross-library full-text search (that idea stays
deferred per the design doc §4.4 — it would need server-side extraction and
an index).

- **TXT** (`TxtReader.tsx`): search runs against the already-decoded text in
  memory. All case-insensitive matches highlighted inline (`<mark>`), current
  match gets a distinct highlight and auto-scrolls into view, Up/Down cycle
  matches (wraps around), "`X of Y`" counter, `Enter`/`Shift+Enter` to
  cycle from the search input, `Escape` to close.
- **PDF** (`PdfReader.tsx`): on search submit, extracts text per page via
  `pdf.js`'s `page.getTextContent()` (the text *layer* stays disabled for
  memory, per the Phase 1 decision — extraction and rendering are separate
  pdf.js operations). Finds which pages contain the term and lets the reader
  jump Prev/Next between those pages. **Does not highlight the exact position
  on the page** (no text layer to anchor a highlight to) — the UI says "Page N
  — X of Y pages" rather than pretending to point at the match, an honest
  scope call rather than reopening the text-layer memory tradeoff.
- Files: `frontend/src/components/TxtReader.tsx`, `PdfReader.tsx`,
  `frontend/src/styles.css` (`.reader-search-*` classes).

Checks: `npm run lint`/`typecheck`/`build` — all clean. Build confirms the
`pdfjs-dist` type-only import used for search's typing did not pull the
package into the eager bundle (the `react-pdf` lazy chunk stayed the same
~423KB it was before this task).

---

### TASK-BE-016 — Dual-language content (VI/EN), backend (DONE)

Owner agent: `backend-agent`

Full design: `docs/10-multilingual-content.md`. Reverses the "Multilingual
content" out-of-scope line in `docs/01-prd.md` §6 (2026-08-10 decision).

Scope: each language is a full separate `Post`/`Book` row, linked by a bare
`translation_group_id` correlation column (no new table, no self-FK — see
docs/10 §1.3). Existing content back-fills to `VI` (all current posts/books
are Vietnamese, per product decision). Six new columns on `Post` and `Book`;
access-group/direct-grant writes become group-aware so one config covers
every language variant (docs/10 §2); sitemap gains `hreflang` alternates;
related posts, series, book highlights/reading-progress, and `DataSeeder`
each get a small language-aware adjustment (docs/10 §7).

Sub-tasks (docs/10 §9, BE-L1 through BE-L7): migration `V4__add_content_language.sql`
+ entities; read-side DTOs/filtering; access-group propagation (acceptance
gate: PRIVATE + group grant on the VI row denies a non-granted MEMBER on the
EN slug — R2 in docs/10 §8); admin translation-link/unlink + mark-reviewed
endpoints; sitemap hreflang; feature-interaction touches; full test matrix.

Test command:

```bash
cd backend && mvn test
```

Result: `mvn test` → 142/142 passing (23 new — see
`backend/src/test/java/.../PostServiceMultilingualTest.java`,
`PostTranslationAccessControllerTest.java` (the R2 acceptance test),
`BookServiceMultilingualTest.java`, `SeriesLanguageGuardTest.java`, and 3 new
cases in `SitemapControllerTest.java`). `V4` applied cleanly against the real
dev Postgres (`ddl-auto: validate` passed on boot) and was smoke-tested live:
language filter, detail `translations`, and reciprocal sitemap hreflang
alternates all confirmed against a real VI/EN post pair.

Two implementation notes not in the design doc:
- `translation_group_id`'s own-id fixup (needed because the id isn't known
  before the first INSERT under `IDENTITY` generation) is done once, in
  `Post`/`Book`'s `@PostPersist` callback — not duplicated in every service
  method that creates a row. This also transparently fixed a latent test-data
  hazard: several pre-existing tests construct `Post`/`Book` via `new Post()`
  directly (bypassing the service layer), and without this fix they would all
  default to `translationGroupId = 0` and be silently treated as one giant
  translation group by the sitemap/admin-listing grouping logic.
- `POST/PUT /api/posts` (not `/api/admin/posts`) gained the `language`/
  `translationOfPostId` params — plain post CRUD lives at `/api/posts`
  (ADMIN+EDITOR) in this codebase, unlike Book's `/api/admin/books`
  convention the design doc assumed for both. `PUT
  /api/admin/posts/{id}/translation-link` and `.../translation-reviewed` do
  live under `/api/admin/posts` as designed (ADMIN-only, matching §11
  assumption 7).

Known gap going in (see docs/10 §11): which language existing content is has
been answered (VI) — the `V4` back-fill can proceed without a manual per-row
list.

Not implemented here (separate tickets, per task boundary): `TASK-FE-008`
(frontend — no `frontend/src/api.ts` changes), `TASK-BE-017`/`TASK-FE-009`
(machine translation, Phase 2).

---

### TASK-FE-008 — Dual-language content (VI/EN), frontend (DONE)

Owner agent: `frontend-agent`

Progress (uncommitted working tree, 2026-08-10): FE-L1 through FE-L6 all
verified/completed against a live dev backend + browser walkthrough — see
`docs/06-project-memory.md` 2026-08-10 entries for the full checklist and
results. Not yet committed to a branch/PR.

Depends on `TASK-BE-016` (needs live endpoints). Full design:
`docs/10-multilingual-content.md` §4, §9 (FE-L1 through FE-L6).

Scope: language types + API client; a `contentLanguage.ts` preference
(`localStorage`, one-time `navigator.language` seed, VI/EN/ALL) with a header
control, wired into the home list and `LibraryPage`'s filtering + empty
state; a real `<Link>`-based language switcher on `PostDetail`/`BookDetailPage`
(explicitly not in `BookReaderPage`'s toolbar); `useSeo` gains `lang` +
`alternates` (`<link rel="alternate" hreflang>`, `document.documentElement.lang`,
`og:locale`) — must remove previously-appended alternate tags before adding
new ones on each navigation (R6 in docs/10 §8, a real bug already present in
`useSeo.ts`'s single-element upsert pattern); a Translations panel in
`PostForm.tsx`/`AdminBookForm.tsx` plus language/stale badges on the admin
list pages.

Test command:

```bash
cd frontend && npm run lint && npm run typecheck && npm run build
```

Known gap accepted going in (see docs/10 §4.6, §11): UI chrome (nav, buttons,
empty-state copy) is not translated in Phase 1 — a VI reader on a VI article
still sees English UI text. Full UI i18n is a separately-sized task, not
bundled here.

---

### TASK-BE-017 — Machine-assisted translation, backend (NOT STARTED)

Owner agent: `backend-agent`

Depends on `TASK-BE-016`. Full design: `docs/10-multilingual-content.md` §6,
§9 (BE-T1 through BE-T3). Phase 2 — deferred until Phase 1 ships.

Scope: `MachineTranslationService` (one class, no provider interface) calling
the Anthropic Messages API by default (named choice, docs/10 §6.1 — Google
Cloud Translation v3 as the documented fallback); `POST
/api/admin/posts/{id}/machine-translate`, output is always a DRAFT with
`translation_origin = MACHINE`, never auto-published; input size cap; PDF
books explicitly return `400 TRANSLATION_NOT_SUPPORTED_FOR_FILE_TYPE` (TXT
books are supported but capped — docs/10 §6.5 frames this honestly as "a Post
feature more than a Book one"). Blank API key → `503
TRANSLATION_NOT_CONFIGURED`, not a crash.

Test command:

```bash
cd backend && mvn test
```

---

### TASK-FE-009 — Machine-assisted translation, frontend (NOT STARTED)

Owner agent: `frontend-agent`

Depends on `TASK-BE-017`. Full design: `docs/10-multilingual-content.md` §6,
§9 (FE-T1).

Scope: "Machine translate" action in the Translations panel with a
confirmation dialog stating the output is an unreviewed draft; distinct
error states for not-configured (button hidden)/too-long/provider-failed;
on success, navigates to the new draft's edit form for review.

Test command:

```bash
cd frontend && npm run lint && npm run typecheck && npm run build
```

Known open product decision (docs/10 §11, not yet answered): should a
machine-translated article visibly disclose that origin to readers? Data
model already captures `translation_origin` either way — this only affects
whether it's ever rendered.

---

### TASK-DEVOPS-001 — CI and local dev flow

Owner agent: `devops-agent`

Files likely affected:
- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `README.md`

Acceptance criteria:
- PostgreSQL starts locally
- Frontend CI command documented
- Backend CI command documented
- No secrets committed

---

### TASK-BE-018 — Tools module: self-contained HTML/CSS/JS artifacts, backend (DONE)

Owner agent: `backend-agent`

Full design: `docs/04-api-contract.md` §14, `docs/03-architecture.md` §4.6.
New module, independent of Post/Book: Post's Markdown renderer strips
`<script>` tags (verified via live test — the original reason this module
exists), Book only accepts PDF/TXT.

Files affected (all new unless noted):
- `backend/src/main/resources/db/migration/V5__add_tools.sql` — `tools` +
  `tool_sources` (separate table for `html_source`, mirrors `book_files`)
- `backend/src/main/java/com/example/blog/tool/` — `Tool`, `ToolSource`,
  `ToolStatus`, `ToolVisibility`, `Tags`, `ToolRepository`,
  `ToolSourceRepository`, `ToolRequest`, `ToolResponse`,
  `AdminToolResponse`, `ToolService`, `PublicToolController`,
  `AdminToolController`
- `backend/src/main/java/com/example/blog/config/SecurityConfig.java` —
  `/api/tools/**` GET + `/api/tools/*/view` POST permitAll matchers;
  site-wide `frameOptions(sameOrigin())` (see gap below)
- `backend/src/test/java/com/example/blog/tool/ToolControllerTest.java`

Acceptance criteria:
- Admin (ADMIN only, no EDITOR) can create/edit/delete a tool via
  `/api/admin/tools`, pasting a complete HTML document into one field.
- `GET /api/tools` lists only PUBLISHED+PUBLIC tools; a draft/private tool
  is absent, not a locked teaser (no access-group system for tools).
- `GET /api/tools/{slug}/raw` serves the stored HTML byte-for-byte as
  `text/html`, with per-route `X-Frame-Options`/CSP headers; 404s (not
  403s) for a draft/private/unknown slug.
- `mvn test` — full suite green (145 pre-existing + 8 new = 153).

Test command:

```bash
cd backend && mvn test
```

Known gaps:
- Deviated from the task-definition's literal `GET /tools/{slug}/raw` (no
  `/api` prefix) to `GET /api/tools/{slug}/raw` — the literal path isn't
  reachable through either the Vite dev proxy or the nginx production
  proxy (both only forward `/api/**`), which would have silently 404'd
  the whole feature outside local `mvn spring-boot:run`. Same reasoning
  for `/api/admin/tools` vs. the literal `/admin/api/tools`.
- Spring Security's default `X-Frame-Options: DENY` (written on every
  response) overrode the raw endpoint's own SAMEORIGIN header before this
  was caught by actually running the test — fixed by setting the
  site-wide default to `sameOrigin()` instead. Worth remembering as a
  general trap: a controller-level security header can be silently
  clobbered by a framework default unless that default is checked.
- No magic-byte/content-sniffing on cover-image upload — same as every
  other upload in this app, not a regression.

---

### TASK-FE-010 — Tools module: self-contained HTML/CSS/JS artifacts, frontend (DONE)

Owner agent: `frontend-agent`

Depends on `TASK-BE-018`. Full design: `docs/04-api-contract.md` §14.

Files affected:
- `frontend/src/types.ts`, `frontend/src/api.ts` — `Tool`/`AdminTool`
  types, `fetchTools`/`fetchToolBySlug`/`recordToolView`/`fetchAdminTools`/
  `fetchAdminTool`/`createTool`/`updateTool`/`deleteTool`
- `frontend/src/pages/ToolsList.tsx`, `ToolDetail.tsx`, `AdminTools.tsx`,
  `AdminToolForm.tsx` (all new)
- `frontend/src/main.tsx` — `/tools`, `/tools/:slug`, `/admin/tools`(+`/new`,
  `/:id/edit`) routes
- `frontend/src/components/SiteNav.tsx` — added `'tools'` to the shared
  navbar (the single-source-of-truth component from the 2026-08-11 navbar
  fix — adding one page here, unlike the old per-page-hand-copy pattern,
  is exactly the point of that refactor)
- 8 existing `Admin*.tsx` pages — added a "Tools" link to their topbar
  (pre-existing duplication, not newly introduced or newly fixed — see
  known gap)
- `frontend/src/styles.css` — `.tool-detail__excerpt`, `.tool-detail__frame`,
  `.tool-form__html-source`, `.tool-form__preview-frame`

Acceptance criteria:
- `/tools` lists tools with search/category filter, same grid as Library.
- `/tools/:slug` shows breadcrumb/title/excerpt, then
  `<iframe sandbox="allow-scripts">` (no `allow-same-origin`) loading
  `tool.rawUrl` — verified with a real headless-browser render that inline
  `<script>` execution, click handlers, and `postMessage`-based auto-resize
  all work under this sandbox.
- Admin form has a client-only "Preview" (blob URL, same sandbox, nothing
  saved) so a paste can be sanity-checked before publishing.
- `npm run lint && npm run typecheck && npm run build` — all clean.

Test command:

```bash
cd frontend && npm run lint && npm run typecheck && npm run build
```

Known gaps:
- The admin topbar link list is hand-copied per page (same
  drift-prone pattern the public navbar had before the 2026-08-11 fix) —
  confirmed already inconsistent across pages before this task touched
  it. Added "Tools" to the 8 pages that already list sibling sections;
  did not refactor this into a shared component (out of scope for this
  task, flagged for a future pass).
- No frontend test suite exists yet (project-wide gap, not introduced
  here) — the sandboxed-iframe interactivity was verified manually with a
  headless-browser script during development, not as a checked-in test.
