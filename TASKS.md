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
