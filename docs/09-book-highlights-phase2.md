# Book Library, Phase 2 — Highlights & Annotations

Status: **implemented.** Author: architect agent, 2026-08-09.
Tracked as `TASK-BE-014` in `TASKS.md`.

Source ask: *let a reader select text in a book (TXT or PDF) and save a
highlight, optionally with a short note, tied to their account; view and manage
their own highlights.*

Read alongside:
- `docs/08-book-library-module.md` — Phase 1 plan of record (§1 data model,
  §2 access control, **§4.2 the PDF-rendering call**, §4.4 deferred items,
  §8 risks R1–R13, §9 implementation plan). This doc extends it; it does not
  supersede it.
- `docs/04-api-contract.md` §12 — Book Library as shipped.
- `docs/06-project-memory.md` — the three Book Library entries (Phase 1 core,
  Phase 1 post-implementation fixes, Phase 3 in-book search), and the
  `post_attachments` FK-cleanup entry.

---

## 0. Scope decision summary (read this first)

| Question | Decision |
|---|---|
| PDF text selection | **Enable `pdf.js`'s text layer on the single currently-rendered page only.** Not globally. See §1. |
| Sequencing | **Two sub-phases: 2a = TXT (full vertical slice), 2b = PDF.** Mirrors Phase 1's FE-B3a/FE-B3b split. |
| TXT anchor | `startOffset`/`endOffset` into the decoded string **plus the snippet text as a verification/re-anchor key**. |
| PDF anchor | `pageNumber` + **normalized rect quads** (0–1, page-relative). No character offsets. |
| Data model | **One new table `book_highlights`**, nullable typed columns + an `anchorType` discriminator. Not two tables, not a JSON blob. |
| Snippet text | **Denormalized onto the row.** Non-negotiable — see §3.3. |
| Visibility | **Private to the creator, always.** No sharing, no admin viewer. See §4. |
| File replace | **Do not delete highlights. Flag them stale** via a new `books.file_version` counter. Differs deliberately from the progress precedent (R12) — see §2.3. **Needs user confirmation.** |
| Anonymous readers | **No highlights at all.** No `localStorage` fallback (unlike progress). See §4.3. |
| Colors, tags on highlights, export, sharing | **Deferred**, §9. |
| New dependency | **None.** |

**One prerequisite bug must be fixed first** — `fetchBookProgress` /
`putBookProgress` in `frontend/src/api.ts` use `authHeader()` (admin token only)
instead of `publicAuthHeader()`, so MEMBER readers send no `Authorization`
header and their server-side reading progress silently never persists. See §7.4.

---

## 1. The pivotal technical question: selectable text in a PDF

Phase 1 §4.2 forced the `pdf.js`-over-`<iframe>` call because an iframe can't
report the current page. Phase 2 has an equally forced call in the opposite
direction: **Phase 1 deliberately shipped `renderTextLayer={false}`, and there
is no way to select text in a canvas.** Phase 3 worked around this for search
(extract text with `getTextContent()`, jump between matching pages, no
on-page highlight — an honest scope line, recorded in the memory entry). Phase 2
cannot use the same escape hatch: a highlight *is* an on-page mark.

### 1.1 The options, honestly

**Option A — text layer on the current page only. (Recommended.)**

The Phase 1 memory entry describes the constraint precisely: *"renders one
`<Page>` at a time (not full-`<Document>`), text/annotation layers disabled
(bounds memory)"*. The memory concern was about rendering N pages, and the
one-page-at-a-time architecture already solves that. Turning the text layer on
for the **one** page that is on screen is a materially smaller commitment than
what §4.2 rejected:

- Cost: ~500–3,000 absolutely-positioned `<span>`s for a dense technical page,
  torn down on every page turn. That is the same order of magnitude as one long
  rendered blog post in this app, and it does not accumulate.
- Cost: +20–80 ms per page turn on dense pages (text-item layout), on top of a
  canvas render the reader is already waiting for.
- Cost: `react-pdf` v10's text layer needs its stylesheet
  (`react-pdf/dist/Page/TextLayer.css`). **Omitting it renders the text layer as
  visible duplicated garbage over the canvas** — this is the single most common
  react-pdf integration bug and it will look catastrophic in a screenshot. It is
  also a 1-line fix once known.
- Cost/limitation: text-layer span geometry is approximate for some embedded
  fonts, so a selection rectangle can sit a pixel or two off the glyphs. Every
  browser PDF viewer has this. Acceptable.
- Hard limitation: **scanned, image-only PDFs have no text at all.** No text
  layer, no selection, no highlight. This must be stated in the UI, not
  discovered ("No selectable text on this page" — §6.3), because a scanned book
  is a realistic thing to find in this library.
- Bonus, free: it also restores in-page text selection and copy for PDFs, which
  Phase 1 gave up.

**Option B — rectangle "marker" selection without a text layer.** The reader
drags a box over the canvas; store the normalized rect. Works on scanned PDFs
and needs no text layer.
Rejected as the primary mechanism: it cannot capture the *text*, so a "my
highlights" list has nothing to show but a page number — which destroys §3.3's
entire reason for existing. Recovering the text means running `getTextContent()`
and intersecting item transforms with the drag rect, i.e. re-implementing the
text layer worse. It also isn't the ask: "select text" is.
Keep as the eventual answer for scanned PDFs (§9), not as Phase 2.

**Option C — defer PDF highlighting; ship TXT only.** Smallest scope, zero new
risk. Rejected as the *end state*: this library's real content is technical
PDFs, and a highlight feature that silently does nothing on PDFs will be
reported as broken, not perceived as scoped.

**Option D — sequence A behind C.** Ship TXT highlighting first as a complete
vertical slice (entity, API, popup UX, list view, cascade cleanup), then add the
PDF renderer half.

### 1.2 Recommendation

**Option A, delivered with Option D's sequencing.**

Phase 2a proves the expensive, shared parts (data model, anchoring, API, access
gate, popup UX, list view, delete-cascade) against the format where selection is
free. Phase 2b then only has to answer "where on the page", which is the one
genuinely new problem. Each sub-phase is independently shippable and
test-green, exactly as Phase 1's FE-B3a/FE-B3b were.

This is consistent with how §4.2 reasoned: name the forced constraint, price the
cost out loud, take the option that makes the feature actually work, and write
down what it costs. Here the cost is a bounded per-page DOM increase and a CSS
footgun — much cheaper than §4.2's ~1MB dependency, which was accepted.

**Measurement gate before 2b is called done:** open the largest real PDF in the
library, page through 20 dense pages with the text layer on, and confirm no
visible page-turn regression and no monotonic memory growth in devtools. If it
regresses, the fallback is *not* Option B — it is "text layer on, mounted only
while a selection gesture is active" (`onPointerDown` toggles it on). That
fallback is worse UX (no copy/paste, a beat of latency before selection starts)
and should only be reached with a measurement in hand.

---

## 2. Anchoring model

### 2.1 TXT — character offsets, verified by the snippet

Anchor: `startOffset`, `endOffset` (half-open, into the decoded string), plus the
selected `text`.

The offsets alone are not enough, for a reason specific to this codebase:
`TxtReader.tsx` has an **encoding selector** (R10). The same bytes decoded as
UTF-8 vs UTF-16LE produce strings of different length, so offsets are only
meaningful relative to a particular decode. Rather than store an encoding
discriminator nobody would maintain, store the snippet and **verify on load**:

1. If `text.slice(startOffset, endOffset) === highlight.text` → render inline at
   those offsets. This is the fast path and will be true ~always.
2. Else search for `highlight.text` in the decoded string. Exactly one match →
   re-anchor to it for this render (do **not** silently write the corrected
   offsets back; a write triggered by a read is a surprise, and the next load
   re-derives it for free).
3. Else → **orphaned.** Not rendered inline; still listed in "my highlights"
   with a clear badge. Never dropped.

This is the W3C Web Annotation model's TextPositionSelector + TextQuoteSelector
pairing, implemented in ~20 lines with no dependency. It also covers the case
where the admin uploads a corrected copy of the same text (typo fix, appended
chapter) — most highlights survive by snippet match.

Do **not** normalize whitespace or Unicode when storing the snippet.
`.reader-body__txt` is `white-space: pre-wrap` (verified, `styles.css:3647`), so
the rendered text is byte-for-byte the decoded string and offsets line up with
what the reader sees, including `\r\n`.

### 2.2 PDF — page number + normalized rect quads

Anchor: `pageNumber` (1-based) + `rects`, an array of
`{ x, y, w, h }` with each value in `[0, 1]`, relative to the rendered page box.

Why rects and not per-page character offsets:

- Rects are **what you need to draw**. Offsets are not — turning offsets back
  into geometry requires `getTextContent()` plus transform math on every open,
  which is both slower and more fragile across `pdf.js` versions than the
  normalized rects we captured at selection time.
- Rects come free from the browser: `range.getClientRects()` minus the page
  container's `getBoundingClientRect()`, divided by container width/height.
- Normalized to the page box, they are **resolution- and zoom-independent** —
  the reader renders at `width={containerWidth}` which varies with the window,
  and normalized rects re-project correctly at any width.

Caveats to record:

- Rects are captured at the *rendered* rotation. The reader exposes no rotate
  control today. **If one is ever added, the anchor must also record rotation**,
  or existing highlights land in the wrong place.
- One line of selected text usually yields several rects (one per text-layer
  span). Merge rects that share a baseline and are horizontally adjacent, round
  to 4 decimals, and cap the count (§5.3) so the JSON stays small.
- The snippet text for PDF is `range.toString()`. `pdf.js` joins text items with
  spaces, so expect slightly-odd internal spacing; store it as-is and do not
  try to reconstruct the original layout.

### 2.3 What happens when the admin replaces the book file

Phase 1 deletes reading progress on file replace (R12, implemented at
`BookService.update()` line ~160): a page-200 bookmark is meaningless against a
new 120-page edition. The same logic applies to a highlight's anchor — a
page-42 rect in a different edition points at random text.

**But highlights are not progress, and the same remedy is wrong.**

- Reading progress is machine-derived and worth ~nothing individually. Deleting
  it costs the reader one scroll.
- A highlight with a note is **user-authored content**. Deleting fifty of them
  because an *admin* re-uploaded a file is unrecoverable data loss caused by
  someone else's action, in an app with **no backups scheduled** (still an open
  gap, R1 / project memory). "It was stale anyway" does not justify destroying
  the note text, which is still perfectly meaningful even when the anchor isn't.

**Recommendation: invalidate, don't delete.**

- Add `books.file_version INTEGER NOT NULL DEFAULT 1`, incremented in
  `BookService.update()` on every file replace (one line, next to the existing
  `progressRepository.deleteByBookId(id)`).
- `book_highlights.file_version` snapshots the book's value at creation.
- A highlight with `fileVersion != book.fileVersion` is returned with
  `stale: true`. The reader does not render it inline (except for TXT, where
  §2.1's snippet re-anchor is attempted first and, if it succeeds, the highlight
  renders normally and stops being a problem). "My highlights" lists it with
  "The book file was updated — this highlight may no longer match its place in
  the text."
- The only deletion of a highlight is by its own author, or by the book being
  deleted (§7).
- `AdminBookForm.tsx`'s existing replace-file warning gains: "…and will flag
  existing reader highlights as possibly out of date." A count is *not* worth an
  extra admin DTO field (see §8/H9 on the `AccessGroupResponse` count smell).

This is a genuine divergence from the Phase 1 precedent, taken deliberately.
It is **question 1 in §10** because it is the user's data policy to set, not the
architect's.

---

## 3. Data model

New entity in the existing `com.example.blog.book` package. No new package.

### 3.1 `BookHighlight` — table `book_highlights`

```
id             Long, identity
book_id        Long NOT NULL, FK -> books(id)
user_id        Long NOT NULL, FK -> users(id)
file_version   int NOT NULL                    -- snapshot of books.file_version at creation (§2.3)
anchor_type    enum HighlightAnchorType {TXT_OFFSET, PDF_RECTS} NOT NULL, length 16
start_offset   Integer NULL                    -- TXT_OFFSET only, inclusive
end_offset     Integer NULL                    -- TXT_OFFSET only, exclusive
page_number    Integer NULL                    -- PDF_RECTS only, 1-based
rects          TEXT NULL                       -- PDF_RECTS only, JSON: [{"x":..,"y":..,"w":..,"h":..}]
text           String(2000) NOT NULL           -- denormalized snippet (§3.3)
note           String(2000) NULL
created_at     Instant NOT NULL
updated_at     Instant NOT NULL                -- @PrePersist/@PreUpdate, same as every other entity here

INDEX (book_id, user_id)          -- the load-on-open query
INDEX (user_id, updated_at DESC)  -- the cross-book "my highlights" query
```

And on the existing `Book`:

```
file_version   int NOT NULL, default 1         -- new, §2.3
```

`ddl-auto: update` adds both without a migration (standing Flyway gap, R8).
**Record the exact DDL in the task note**, including `UPDATE books SET
file_version = 1 WHERE file_version IS NULL;` for existing rows — Hibernate's
`update` mode adds a NOT NULL column to a populated table, which fails or
back-fills to 0 depending on dialect. Verify against the dev DB (which has real
book rows, including the known leftover book id=1) before touching production.

### 3.2 Why one table with nullable typed columns

- **Two tables** (`book_txt_highlights` / `book_pdf_highlights`) doubles the
  repositories, DTOs, and cleanup paths, and turns the cross-book list into a
  union query — for two variants of one concept.
- **One opaque JSON `anchor` column** is fewer columns but untyped and
  unqueryable, and this repo uses no JSONB anywhere; adding a Hibernate JSON
  type mapping for one column is exactly the abstraction the architecture rule
  forbids.
- **Nullable typed columns + a discriminator** keeps `start_offset` sortable
  (useful for rendering TXT highlights in document order) and readable in
  `psql`. `rects` stays a serialized TEXT payload because it is pure geometry
  that is never queried — and a serialized-string column is not a new precedent
  here (`Post` stores tags as a comma-separated string).
- `ddl-auto` will not emit a CHECK constraint, so **the service validates the
  type/field combination** (§5.3). Write that validation as a single guard
  method, not scattered `if`s.

### 3.3 The snippet text must be denormalized — this is not optional

Without `text` on the row, rendering a cross-book "my highlights" list means, per
distinct book: fetch the file (up to 50MB, no HTTP `Range` — R2), decode it, and
slice. For 20 books that is hundreds of megabytes of transfer to render a list.
The server-side alternative is text extraction — i.e. PDFBox, explicitly
rejected in §4.4 and again in the Phase 3 entry.

Consequences to accept:
- The snippet is a **copy**. If the file is replaced, the snippet still reads
  correctly even when the anchor is stale — which is precisely what makes §2.3's
  "flag, don't delete" behaviour useful rather than merely lenient.
- Cap selection length at **2000 characters** and **reject** longer selections
  (`400 HIGHLIGHT_TEXT_TOO_LONG`) rather than truncating. Truncating would break
  the `slice(start,end) === text` invariant that §2.1 depends on.
- Storage is trivial: 500 highlights × 2KB ≈ 1MB. Irrelevant next to R1.

### 3.4 Quota

One count query on create, capped at **500 highlights per (book, user)** →
`409 HIGHLIGHT_LIMIT_REACHED`. Same reasoning Phase 1 used to refuse an
anonymous-writable progress endpoint: this app has no rate limiting, and an
authenticated MEMBER can otherwise insert unbounded rows. 500 is far above real
use and cheap to raise.

---

## 4. Access control

### 4.1 The gate: reuse, don't reinvent

Every highlight endpoint resolves the book and calls
`BookAccessService.requireRead(user, book)` — the exact pattern
`BookProgressService.requireReadableBook()` already uses. No new access service,
no new exception type, no new `DenialReason` values. The reason-coded 401/403
mapping in `GlobalExceptionHandler` already handles `BookAccessDeniedException`.

Consequences worth stating because they're easy to get wrong:

- **Revoking a grant must hide the highlights.** Per-book endpoints deny via the
  gate. The cross-book `GET /api/me/highlights` must be **access-filtered the
  same way `BookProgressService.continueReading()` is** (`filter(p ->
  bookAccessService.canRead(...))`), or a revoked private book leaks its title
  and the reader's own snippets through the list. Rows are kept, so a re-grant
  restores everything.
- A `DRAFT` book: the reader can't open it (Phase 1 confirmed live), so no new
  highlights. Existing ones stay in the DB and should be filtered out of
  `/api/me/highlights` alongside the access check — filter on
  `status == PUBLISHED` explicitly, don't assume the access check covers it (it
  doesn't; `BookAccessService` only looks at visibility).

### 4.2 Private to the creator — recommended, and the ambiguity is low

**Every query filters on `user_id = currentUser.id`, including for ADMIN.**

- This is the e-reader default (Kindle, Apple Books, Zotero, Hypothesis' private
  mode). A note is a thought, not a publication.
- Sharing would need: a per-highlight visibility flag, an "show others'
  highlights" toggle, an author label, and **moderation** — notes are free-text
  user content, which is a new abuse surface with no rate limiting.
- ADMIN/EDITOR's bypass role grants read access to the *book*; it says nothing
  about other people's notes. There is deliberately **no admin "all highlights"
  screen** in Phase 2. If one is ever wanted for moderation, it should be a
  conscious, separately-designed decision.
- A highlight that exists but belongs to another user returns
  **`404 HIGHLIGHT_NOT_FOUND`, not 403** — the same oracle-avoidance rule Phase 1
  applied to `/cover-image` and `/file`.

Low enough ambiguity that it does not need to block coding, but it is cheap to
confirm in the same batch as §10's other questions, because "shared highlights"
would add a column to the table.

### 4.3 Anonymous readers get nothing, and that is on purpose

Anonymous readers of public books get `localStorage` progress (Phase 1 §1.3). Do
**not** extend that to highlights:

- Progress is one disposable integer. A highlight with a note is content the
  reader believes they saved. Storing it only in `localStorage` promises
  durability the app cannot deliver — it dies on a cache clear, never syncs, and
  can never be migrated into an account (there is no anonymous identity to
  migrate *from*).
- The honest UI is the selection popup showing **"Sign in to save highlights"**
  with a link to the member login, instead of a Highlight button that silently
  discards work.

### 4.4 Prerequisite: the member-token bug in the progress client

Found while reviewing Phase 1 for this design, and it will be inherited verbatim
by any new highlight API function that is copy-pasted from its neighbours:

```ts
// frontend/src/api.ts:1155 and :1167
const res = await fetch(`${API_BASE_URL}/books/${bookId}/progress`, { headers: authHeader() });
```

`authHeader()` reads **only** the admin token (`auth.ts:37`), whereas
`publicAuthHeader()` falls back to the member token (`auth.ts:58`). Members log
in through a separate `member_token` key (`memberAuth.ts:3`). So for a MEMBER
reader — the entire audience for private books — both progress calls go out with
no `Authorization` header, hit `.authenticated()`, and 401. Both failures are
swallowed (`catch { setInitialProgress(null) }` in `useReadingProgress.ts:36`,
and `.catch(() => {})` at line 62), so **server-side reading progress silently
does not work for members today**, while the admin account it was tested with
works fine.

Fix as a 2-line prerequisite at the start of Phase 2a (`authHeader()` →
`publicAuthHeader()` in both functions), and use `publicAuthHeader()` in every
new highlight function. Add one backend test asserting a MEMBER token is
accepted on `PUT /api/books/{id}/progress`, so the class of bug is pinned.

---

## 5. API contract additions

To be added to `docs/04-api-contract.md` §12 as a **"Phase 2 — Highlights"**
subsection. Error bodies use the existing `ApiError { code, message }`.

### 5.1 Endpoints

All authenticated. Path shape nests highlights under the book, matching the
existing `/api/posts/{id}/attachments/{attachmentId}` precedent (§10) rather
than inventing a flat `/api/highlights/{id}` namespace.

| Method + path | Purpose |
|---|---|
| `GET /api/books/{bookId}/highlights` | This reader's highlights for one book. Loaded once when the reader opens. |
| `POST /api/books/{bookId}/highlights` | Create. → `201` |
| `PUT /api/books/{bookId}/highlights/{highlightId}` | **Note text only.** The anchor and snippet are immutable. |
| `DELETE /api/books/{bookId}/highlights/{highlightId}` | → `204` |
| `GET /api/me/highlights?limit=100` | Cross-book list, newest-updated first, access-filtered + `PUBLISHED`-filtered. |

`GET /api/books/{bookId}/highlights` returns highlights in document order
(TXT: `startOffset` asc; PDF: `pageNumber` asc then first rect's `y`) so the
frontend never has to sort. `GET /api/me/highlights` returns `updatedAt` desc,
`limit` clamped to `[1, 200]` the same way `/api/me/reading` clamps to 20.

Why `PUT` carries only the note: allowing the anchor to be edited creates
`(text, offsets)` pairs that can disagree, which breaks §2.1's verification.
"Move a highlight" = delete + create. Simpler, and nobody asked for it.

### 5.2 Bodies

Create (TXT):
```json
{
  "anchorType": "TXT_OFFSET",
  "startOffset": 10432,
  "endOffset": 10498,
  "text": "the query planner has no idea how many rows will come back",
  "note": "compare with the chapter on statistics"
}
```

Create (PDF):
```json
{
  "anchorType": "PDF_RECTS",
  "pageNumber": 42,
  "rects": [
    { "x": 0.1204, "y": 0.3388, "w": 0.5312, "h": 0.0178 },
    { "x": 0.1204, "y": 0.3601, "w": 0.2140, "h": 0.0178 }
  ],
  "text": "the query planner has no idea how many rows will come back",
  "note": null
}
```

Response (both shapes; the unused anchor fields are `null`):
```json
{
  "id": 17,
  "bookId": 3,
  "anchorType": "PDF_RECTS",
  "startOffset": null,
  "endOffset": null,
  "pageNumber": 42,
  "rects": [{ "x": 0.1204, "y": 0.3388, "w": 0.5312, "h": 0.0178 }],
  "text": "the query planner has no idea...",
  "note": null,
  "stale": false,
  "createdAt": "2026-08-09T10:11:12Z",
  "updatedAt": "2026-08-09T10:11:12Z"
}
```

`stale` is computed (`fileVersion != book.fileVersion`), never stored as a
boolean — one source of truth (§2.3).

`GET /api/me/highlights` rows additionally carry `bookTitle`, `bookSlug`,
`bookFileType` so the list can render and deep-link without N+1 book fetches.
Deliberately **not** a nested `book` object — the list needs three fields, and a
nested `BookResponse` would drag cover/access/progress fields into a list
payload that has no use for them.

Update body: `{ "note": "..." }`. `null` or `""` clears the note (the highlight
survives without one — highlighting with no note is the common case).

### 5.3 Validation and errors

| Condition | Response |
|---|---|
| Unknown/unpublished book | `404 BOOK_NOT_FOUND` |
| No read access to the book | `401 NOT_AUTHENTICATED` / `403 ACCOUNT_* \| NO_ACCESS` (existing handler) |
| Highlight missing, or belongs to another user, or to another book | `404 HIGHLIGHT_NOT_FOUND` |
| `anchorType` doesn't match the book's `fileType` (TXT book ⇒ `TXT_OFFSET`, PDF ⇒ `PDF_RECTS`) | `400 INVALID_HIGHLIGHT_ANCHOR` |
| `TXT_OFFSET` with a null offset, negative offset, `endOffset <= startOffset`, or a non-null `pageNumber`/`rects` | `400 INVALID_HIGHLIGHT_ANCHOR` |
| `PDF_RECTS` with `pageNumber < 1`, empty `rects`, >100 rects, or any coordinate outside `[0,1]` | `400 INVALID_HIGHLIGHT_ANCHOR` |
| `text` blank, or longer than 2000 chars | `400 HIGHLIGHT_TEXT_TOO_LONG` (blank ⇒ `400 BAD_REQUEST`) |
| `note` longer than 2000 chars | `400 HIGHLIGHT_NOTE_TOO_LONG` |
| 500 highlights already exist for this (book, user) | `409 HIGHLIGHT_LIMIT_REACHED` |

The `anchorType`-matches-`fileType` rule is the exact analogue of the existing
`unit` must match `fileType` rule on `PUT /progress` — copy that code shape.

Note the `@Valid`-on-a-manually-built-DTO trap from the Phase 1 fixes: these are
JSON bodies, not multipart, so `@Valid @RequestBody` **does** fire here (unlike
`AdminBookController`'s multipart params). Still validate in the service, since
the service is the only chokepoint.

### 5.4 `SecurityConfig` — ordering matters again (this is R4 verbatim)

Insert **before** the existing `GET /api/books/**` `permitAll()` line
(`SecurityConfig.java:62`), next to the progress matchers:

```java
.requestMatchers(HttpMethod.GET,    "/api/books/*/highlights").authenticated()
.requestMatchers(HttpMethod.POST,   "/api/books/*/highlights").authenticated()
.requestMatchers(HttpMethod.PUT,    "/api/books/*/highlights/*").authenticated()
.requestMatchers(HttpMethod.DELETE, "/api/books/*/highlights/*").authenticated()
.requestMatchers(HttpMethod.GET,    "/api/me/highlights").authenticated()
```

The **GET** line is the load-bearing one: placed after the wildcard, first-match
-wins makes it `permitAll()`, `currentUserOrNull()` returns `null` for everyone,
and a reader's private notes become an anonymous read of… well, of a
`NullPointerException` at best and someone else's rows at worst. POST/PUT/DELETE
are already covered by `.anyRequest().authenticated()`, but list them anyway so
the block reads as one unit. Guard with a test asserting
`GET /api/books/{id}/highlights` without a token → `401`, mirroring the existing
progress test.

---

## 6. Frontend

### 6.1 New files

| File | Purpose |
|---|---|
| `hooks/useBookHighlights.ts` | Load on open, optimistic create/update-note/delete, exposes `{ highlights, create, updateNote, remove, error }`. Uses `publicAuthHeader()` (§4.4). No-ops for anonymous readers. |
| `components/HighlightPopup.tsx` | The floating selection toolbar. Positioned at the selection's bounding rect, flipped above/below to stay in the viewport. Buttons: **Highlight**, **Highlight + note**. Anonymous: **Sign in to save highlights**. |
| `components/HighlightNoteEditor.tsx` | Small textarea popover for adding/editing a note (create-with-note and edit-existing share it). |
| `components/BookHighlightsPanel.tsx` | Slide-over panel inside the reader listing *this book's* highlights; click to jump. |
| `pages/MyHighlightsPage.tsx` | `/library/highlights` — cross-book list grouped by book, with note edit + delete + "Open in book". All four states + the `stale` badge. |

Edits to: `types.ts`, `api.ts` (5 functions), `TxtReader.tsx`, `PdfReader.tsx`,
`BookReaderPage.tsx`, `ReaderToolbar.tsx` (a highlights-panel toggle),
`main.tsx` (1 route), `styles.css`.

**Nav scope control:** link `/library/highlights` from `ReaderToolbar` and from
`LibraryPage` (logged-in only). Do **not** repeat the ~12-file nav/footer chore
that the About and Library pages each paid for — this is a personal, logged-in
view, not a top-level destination.

### 6.2 TXT — the one real refactor

`TxtReader.tsx`'s `renderHighlighted()` (lines 57–83) is a **single-pass
splitter** that assumes one non-overlapping set of ranges (search matches). Phase
2 needs **two overlapping sets** — a saved highlight and a search match can
cover the same characters, and a segment can be both.

Required change: replace it with a boundary-sweep renderer.
1. Collect all boundary offsets from both sets (`start`s and `end`s), plus 0 and
   `text.length`. Sort, dedupe.
2. Emit one node per consecutive boundary pair, with classes derived from which
   ranges cover that segment (`reader-highlight`, `reader-search-mark`,
   `reader-search-mark--current`, and combinations).
3. Every emitted segment span carries `data-offset={segmentStart}` and
   `data-highlight-id` where applicable.

**This is a modification of shipped Phase 3 behaviour, not an addition** — the
search regression risk is real. Re-verify Phase 3's manual checks
(single-occurrence term, 150-occurrence term with `1 of 150` → `2 of 150`,
"No results", auto-scroll-into-view) after the refactor. Treat that as an
acceptance criterion, not a nice-to-have.

**Selection → offsets** uses the `data-offset` attributes rather than a
TreeWalker length accumulation:
`absoluteOffset = Number(node.parentElement.closest('[data-offset]').dataset.offset) + range.startOffset`.
O(1), explicit, and immune to being broken by a future change in how the text is
chunked. It also correctly handles selections that begin or end inside an
existing `<mark>`. Keep `white-space: pre-wrap` on `.reader-body__txt` — offsets
depend on it.

### 6.3 PDF

- `renderTextLayer={true}` on the single `<Page>` (line 250), and
  `renderAnnotationLayer` stays `false` (nothing needs it, and it pulls in more
  DOM plus link handling).
- Import the text-layer CSS **inside the existing lazy `import('react-pdf')`
  step** (`await import('react-pdf/dist/Page/TextLayer.css')`), not as a
  top-level import. `PdfReader.tsx` itself is eagerly imported by
  `BookReaderPage`, so a static CSS import would land the stylesheet in the main
  CSS bundle for every visitor. Verify the exact path against the installed
  `react-pdf@^10.4.1` — a wrong path here is the "visible garbage text over the
  canvas" failure mode from §1.1, and it fails *loudly*, which is good.
- Overlay: wrap `<Page>` in a `position: relative` container; render a sibling
  `<div className="pdf-highlight-layer">` with one absolutely-positioned div per
  rect (`left: x*100%`, `top: y*100%`, `width: w*100%`, `height: h*100%`),
  `pointer-events: none` on the layer, `pointer-events: auto` on each rect so
  clicking one opens its note. Z-order: canvas → highlight layer → text layer,
  so text stays selectable *through* an existing highlight.
- Only the current page's highlights are rendered — one page is all that exists
  in the DOM.
- **No selectable text on a page** (scanned/image PDF): `getTextContent()` for
  the current page returns no items. Show a one-line hint in the reader
  controls: *"This page has no selectable text (scanned image), so it can't be
  highlighted."* This is the same species of honesty as Phase 3's
  "Page N — X of Y pages" label.

### 6.4 `BookReaderPage.tsx` wiring

- Owns `useBookHighlights(book.id, loggedIn)`; passes `highlights` + callbacks
  down to whichever reader is mounted. The popup lives inside each reader
  component (it needs that reader's coordinate space), not in the page.
- Deep link `?highlight={id}`: jump to that highlight (PDF → its page; TXT →
  scroll its offset into view) and **skip the resume prompt entirely** — an
  explicit "take me to this highlight" beats "continue from page 12?". Feed it
  into the existing derived `resumeChoice` expression as a third source, do
  **not** add an effect that sets state (this file hit
  `react-hooks/set-state-in-effect` during Phase 1; the memory entry lists
  derive-don't-sync as the established idiom here).
- States, per repo rule #6: highlights loading (render the book immediately, add
  the marks when they arrive — never block the text on the highlight fetch);
  save failure (revert the optimistic mark + an inline toast, don't lose the
  note text); empty (the panel says "No highlights in this book yet — select
  text to add one").

---

## 7. Delete-cascade discipline — non-negotiable

This repo has shipped or nearly-shipped the same FK-cleanup bug three times
(`post_attachments` 500 on post delete; Phase 1's own four-table book delete,
which only survived because a regression test was written for it; and
`PostService.delete()` still lacks cleanup for comments/access-groups/series).
Nothing in this codebase uses `ON DELETE CASCADE`, so cleanup is always
app-level and always someone's job to remember.

`book_highlights` has **two** FKs — `book_id` and `user_id` — so it lands in two
delete paths.

### 7.1 Book delete — required

`BookService.delete()` (line ~175) becomes a **five**-table ordered cleanup:

```
bookHighlightRepository.deleteByBookId(id);   // NEW — must be first or anywhere before books
progressRepository.deleteByBookId(id);
bookAccessGroupRepository.deleteByBookId(id);
bookUserPermissionRepository.deleteByBookId(id);
bookFileRepository.deleteByBookId(id);
bookRepository.deleteById(id);
```

**Acceptance criterion:** extend the existing Phase 1 regression test (the one
that creates a book with a file + group grant + user grant + progress row and
asserts `204`) to **also create a highlight** before deleting. Extending the
existing test is better than adding a new one — it keeps a single canonical
"book with all its dependents" fixture that the next phase must also extend.

### 7.2 User delete — a pre-existing bug this feature makes worse

`UserService.delete()` (`UserService.java:75`) is:

```java
if (!userRepository.existsById(id)) { throw new NotFoundException(...); }
userRepository.deleteById(id);
```

**No dependent cleanup at all**, and `DELETE` on the user controller
(`UserController.java:67`) is live. Deleting a user who has any
`book_reading_progress`, `book_user_permissions`, `user_access_groups`, or
`post_user_permissions` row already 500s on an FK violation today. This is the
fourth instance of the same bug class, and it is pre-existing — not caused by
this feature.

Phase 2's obligation: **add `bookHighlightRepository.deleteByUserId(id)` to
`UserService.delete()`** (our row, our job) and add a test that a user with a
highlight can be deleted. Do **not** attempt the full `UserService.delete()`
sweep inside this feature — that touches posts, exams, comments, access groups,
and audit rows, and needs its own test pass. File it as a separate task with the
note that user deletion is **currently broken**, not merely at risk. Whoever
picks it up should decide delete-vs-anonymize for user-authored content
(comments, and now highlights) rather than defaulting to delete.

### 7.3 File replace — no delete, per §2.3

If the user overrides §2.3 and prefers deletion on file replace, then
`bookHighlightRepository.deleteByBookId(id)` goes next to the existing
`progressRepository.deleteByBookId(id)` in `BookService.update()` (line 160),
**and a regression test must cover it** — a partial "we delete progress but not
highlights" state is the exact shape of the bugs above.

### 7.4 Explicitly not affected

`AccessGroupService.delete()` needs **no** change — `book_highlights` has no
access-group FK. Stated so nobody adds a defensive call and nobody worries it
was forgotten.

---

## 8. Implementation risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| **H1** | **Text-layer CSS not imported** → visible duplicated garbage text over every PDF page. The classic react-pdf bug. | Medium (fails loudly) | Import inside the lazy `import('react-pdf')` step; verify the v10 path; eyeball one page before anything else in 2b. |
| **H2** | **Text layer costs page-turn latency / DOM weight** on dense PDFs, reopening the §4.2 tradeoff. | Medium | One page at a time only (already the architecture); measurement gate in §1.2 on the largest real PDF before 2b is called done; documented fallback (activate on pointer-down) if it regresses. |
| **H3** | **`SecurityConfig` matcher ordering** — `GET .../highlights` below the `GET /api/books/**` wildcard silently makes a reader's private notes an anonymous endpoint. R4, again. | **High** | Explicit block placement (§5.4) + a `401`-without-token test, mirroring the existing progress test. |
| **H4** | **FK cleanup on book delete and user delete.** Two FKs, two delete paths, and one of those paths (`UserService.delete()`) is already broken. | **High** (near-certain if untested) | §7 — extend the existing five-table regression test; add `deleteByUserId` + its test; file the broader user-delete sweep separately. |
| **H5** | **The TXT boundary-sweep refactor breaks Phase 3 search.** `renderHighlighted()` is shipped, working, and about to be rewritten. | Medium | Re-run Phase 3's four manual search checks as an acceptance criterion; keep the boundary sweep pure and unit-testable in isolation from React. |
| **H6** | **Members can't actually use it** — the `authHeader()`/`publicAuthHeader()` bug (§4.4) means every copy-pasted highlight API function fails silently for the exact audience that needs it. | **High** (already live for progress) | Fix both progress functions first; use `publicAuthHeader()` everywhere new; one backend test asserting a MEMBER token is accepted. |
| **H7** | **Stale anchors after a file replace.** Page 42 in a new edition is a wrong highlight, which is worse than a missing one. | Medium | `file_version` + `stale` (§2.3); never render a stale anchor inline; TXT snippet re-anchor as the recovery path. |
| **H8** | **Selection-offset drift in TXT** if the encoding selector is used, or if the rendered text ever diverges from the decoded string (e.g. `white-space` changes). | Medium | Snippet verification + re-anchor + orphaned state (§2.1); a comment on `.reader-body__txt`'s `pre-wrap` saying highlight offsets depend on it. |
| **H9** | **DTO width creep.** `/api/me/highlights` wants book fields; the admin book DTO will want a highlight count. This is the same `postCount`/`examCount`/`bookCount` smell §7.8 of the Phase 1 doc flagged as "the next feature triggers the refactor". | Low | Three flat fields on the list row, no nested `BookResponse`; **no** `highlightCount` on the admin DTO (static warning text instead, §2.3). |
| **H10** | **`ddl-auto: update` adding a NOT NULL `file_version` to a populated `books` table.** The dev DB has real rows. Standing Flyway gap (R8). | Medium | Record the DDL + back-fill statement in the task note; add the column with a default; verify on dev before production. |
| **H11** | **Popup positioning** — a selection near the viewport edge, mid-scroll, or on a re-rendered page can put the toolbar off-screen or leave it stranded. | Low | Clamp to the viewport and flip above/below; dismiss on scroll, page change, `Escape`, and `selectionchange` to empty. |
| **H12** | **Scanned PDFs can't be highlighted at all**, and the reason is invisible to the user. | Low (expectation risk) | Explicit per-page hint (§6.3). Rectangle "marker" mode stays deferred (§9) as the eventual fix. |
| **H13** | **Quota / abuse** — authenticated MEMBERs writing unbounded rows, no rate limiting anywhere in this app. | Low | 500-per-(book,user) cap → `409` (§3.4); 2000-char caps on `text` and `note`. |

---

## 9. Explicitly deferred (with reasons)

| Deferred | Why |
|---|---|
| **Highlight colors** | Pure decoration; the note is the substance. One enum column + 4 CSS classes + a picker in the popup, addable later with zero migration pain under `ddl-auto`. |
| **Shared / public highlights** | Needs per-highlight visibility, an author label, a toggle, and moderation of free-text user content. A different feature with a different threat model (§4.2). |
| **Admin "all highlights" viewer** | Only justified by a moderation need that doesn't exist while highlights are private. |
| **Rectangle "marker" annotations for scanned PDFs** | The right answer for image-only PDFs (§1.1 Option B), but it's a second interaction model and a second anchor type. Revisit if a scanned book actually lands in the library. |
| **Export highlights** (Markdown / clipboard / per-book) | Genuinely useful and genuinely cheap once the list view exists (it's a client-side string join). Deliberately held back so Phase 2 ships; **first follow-up candidate**, the same slot PDF outline/TOC holds in the Phase 1 doc. |
| **Tags / categories on highlights** | `Post` tags are already documented as unqueryable-by-design; duplicating that onto highlights adds a field nobody can filter on. |
| **Search within highlights** | `GET /api/me/highlights` returns everything under a 200-row cap; a client-side filter box is enough if it's ever wanted. |
| **Cross-device conflict handling** | Highlights are append/delete by id, not a mutable position — there is no conflict to resolve (unlike progress's last-write-wins). Nothing to build; stated so nobody builds it. |
| **Highlight-aware PDF outline / annotation export to the PDF file itself** | Writing PDF annotations back into the file requires server-side PDF manipulation (PDFBox), rejected in §4.4 and again in Phase 3. |
| **Sync of anonymous `localStorage` highlights on sign-up** | There are no anonymous highlights, on purpose (§4.3). |

---

## 10. Confirm before coding

Mirrors Phase 1 §7. Phase 1's equivalent list produced three real answers
(Kindle-level reading, one-file-per-book, reuse access groups), so this is worth
doing again rather than guessing.

**Put back to the user before implementation starts:**

1. **Replacing a book's file: flag existing highlights as stale, or delete
   them?** Recommendation: **flag** (§2.3). Progress is deleted today (R12) for
   the same technical reason, but progress is a disposable machine-derived
   integer while a highlight's note is user-authored content, this app has no
   scheduled backups, and the destructive action would be taken by an *admin*
   against a *reader's* data. Cost of "flag": one integer column on `books`, one
   on `book_highlights`, one line in `BookService.update()`. This is a data-loss
   policy, not an architecture preference — it should be the user's call.

2. **PDF highlighting in Phase 2, accepting the text layer?** Recommendation:
   **yes, as sub-phase 2b after TXT** (§1.2). The user already chose
   "Kindle-level" reading up front, so this is more confirmation than a real
   fork — but §4.2 explicitly disabled the text layer, and reversing a
   documented decision should be visible, not quiet. The honest costs: bounded
   per-page DOM growth, a small page-turn latency increase on dense pages,
   slightly imprecise selection rectangles with some embedded fonts, and
   **nothing at all on scanned image-only PDFs**. If any of that is
   unacceptable, Phase 2 ships TXT-only and PDF highlighting becomes Phase 4.

3. **Multi-color highlights?** Recommendation: **no, single style at Phase 2**
   (§9). Asked only because it is nearly free to include *now* (one enum column
   + a picker) and mildly annoying to retrofit into the popup UX later. A yes
   costs about half a day; a no costs nothing.

4. **Is a cross-book "My highlights" page wanted at Phase 2, or is the in-reader
   per-book panel enough?** Recommendation: **build both** — the panel is where
   highlights get used, the page is what makes them feel kept. But the page is
   ~30% of the frontend work in this phase (a route, a page, grouping, deep
   links back into the reader), so if the user only wants the in-reader panel,
   that is a meaningful scope cut and `GET /api/me/highlights` can be dropped
   from the contract.

**Recorded assumptions, not worth a question (challenge them if wrong):**

5. **Highlights are private to their creator, ADMIN included** (§4.2). Very low
   ambiguity — every e-reader works this way — but it does determine whether the
   table needs a visibility column, so it is stated rather than assumed.
6. **Anonymous readers cannot highlight, and get no `localStorage` fallback**
   (§4.3), diverging from how anonymous progress works. The popup says "Sign in
   to save highlights" instead of silently discarding work.
7. **A highlight's anchor and snippet are immutable; only the note is editable**
   (§5.1). "Move a highlight" = delete + create.
8. **The 500-per-book and 2000-character caps are policy guesses**, chosen to be
   invisible in real use and cheap to raise. If a real reader hits either, raise
   the number; do not remove the cap (no rate limiting exists anywhere here).
9. **`UserService.delete()` is already broken** for reasons predating this
   feature (§7.2). Phase 2 cleans up its own rows only, and files the rest.

---

## 11. Implementation plan

Backend first, then TXT end-to-end, then PDF — each step independently
committable and test-green, same discipline as Phase 1 §9.

### Phase 2a — TXT, end to end

**BE-H0 — Prerequisite fix (~10 min).** `frontend/src/api.ts`:
`fetchBookProgress` / `putBookProgress` → `publicAuthHeader()`. Backend test:
a MEMBER token is accepted on `PUT /api/books/{id}/progress`. This is a bug fix
that happens to unblock the feature (§4.4); commit it separately so it can be
cherry-picked.

**BE-H1 — Schema & entity.** `BookHighlight`, `HighlightAnchorType`;
`books.file_version`; `BookHighlightRepository` with
`findByBookIdAndUserIdOrderByStartOffsetAscPageNumberAsc`,
`findByUserIdOrderByUpdatedAtDesc`, `countByBookIdAndUserId`,
`findByIdAndUserId`, `deleteByBookId`, `deleteByUserId`. Record the DDL +
`file_version` back-fill in the task note (H10). *Done when:* app boots against
the dev DB (which has real book rows), no behaviour change.

**BE-H2 — `BookHighlightService` + DTOs.** `BookHighlightRequest`,
`BookHighlightUpdateRequest`, `BookHighlightResponse`,
`MyBookHighlightResponse`. `list(bookId, user)`, `create`, `updateNote`,
`delete`, `listForUser(user, limit)`. Every method goes through
`BookAccessService.requireRead` (copy `BookProgressService`'s
`requireReadableBook`). One `validateAnchor()` guard covering the whole §5.3
table. `stale` computed from `file_version`. `listForUser` filters on
`canRead` **and** `status == PUBLISHED` (§4.1).

**BE-H3 — Controller, security, cleanup.** Add the five endpoints to
`PublicBookController` (it already owns `/api/me/reading`; a separate controller
would split one reader-facing surface for no reason). `SecurityConfig` block
**in the order in §5.4**. `BookService.delete()` → five-table cleanup;
`UserService.delete()` → `deleteByUserId`; `BookService.update()` → increment
`file_version` on file replace.

**BE-H4 — Tests** (`mvn test`, extend `BookControllerTest`). Minimum matrix:
create TXT highlight → `201` and appears in the per-book list; note-only update;
delete → `204`; another user's highlight → `404` on GET/PUT/DELETE; ADMIN cannot
see a member's highlight; no token → `401` (**guards H3**); no read access →
`403 NO_ACCESS`, then `201` after a group grant; wrong `anchorType` for the
book's `fileType` → `400`; `endOffset <= startOffset` → `400`; 2001-char text →
`400`; note over 2000 → `400`; quota exceeded → `409`; **book delete with a
highlight + file + grants + progress → `204`** (extends the Phase 1 test,
**guards H4**); **user delete with a highlight → `204`** (guards H4);
`/api/me/highlights` drops a book whose grant was revoked and a `DRAFT` book;
replacing the file marks existing highlights `stale: true` and does **not**
delete them.

**FE-H1 — Types + API client.** `BookHighlight`, `HighlightAnchorType`,
`MyBookHighlight` in `types.ts`; 5 functions in `api.ts`, all with
`publicAuthHeader()`.

**FE-H2 — TXT rendering refactor.** Replace `renderHighlighted()` with the
boundary-sweep renderer (§6.2), `data-offset` spans, highlight + search classes
including the overlap case. **Re-run Phase 3's four manual search checks**
(H5). No new UI yet — render highlights loaded from the API, read-only.

**FE-H3 — Selection UX.** `HighlightPopup.tsx`,
`HighlightNoteEditor.tsx`, `useBookHighlights.ts`; wire creation from a TXT
selection; optimistic add with revert-on-failure; the anonymous "Sign in to save
highlights" variant. *Shippable slice: TXT highlighting works end to end.*

**FE-H4 — In-reader panel.** `BookHighlightsPanel.tsx` + a `ReaderToolbar`
toggle; click-to-jump; edit note; delete; empty state.

### Phase 2b — PDF

**FE-H5 — Text layer.** `renderTextLayer={true}` + the CSS import inside the
lazy step (H1); verify one page renders with no visible garbage text and no
change to the eager CSS bundle in `npm run build`.

**FE-H6 — PDF selection + overlay.** Range → normalized rects (merge, round,
cap); `pdf-highlight-layer` overlay with the z-order in §6.3; click a rect to
open its note; the no-selectable-text hint (§6.3, H12).

**FE-H7 — Measurement gate (H2).** Page through ~20 dense pages of the largest
real PDF with the text layer on; check page-turn feel and devtools memory. Record
the numbers in the memory entry — a measurement written down is what stops this
being re-litigated.

### Phase 2c — Cross-book view & docs

**FE-H8 — `MyHighlightsPage.tsx`** at `/library/highlights`; grouped by book;
`stale` badge; `?highlight={id}` deep link into the reader, skipping the resume
prompt (§6.4); links from `ReaderToolbar` + `LibraryPage`. *Skip entirely if
§10 question 4 comes back as "panel only".*

**FE-H9 — Checks.** `npm run lint && npm run typecheck && npm run build`, plus a
manual pass: highlight in a TXT book, add a note, reload, confirm it renders in
place; same for a PDF at two different window widths (proves normalized rects);
verify a MEMBER account can highlight a private granted book (H6); verify search
still works in both readers (H5); replace a book's file and confirm the
highlights are flagged, not gone.

### Phase 2d — Docs

**DOC-H1** — `docs/04-api-contract.md` §12 Phase-2 subsection; `TASKS.md`
(`TASK-BE-014` → DONE, plus new follow-up tasks for the `UserService.delete()`
sweep and highlight export); `docs/06-project-memory.md` entry including the
H7 measurement numbers and the §10 answers as received.

### Sizing

Roughly **0.6× Phase 1**: 1 new backend entity + 1 repository + 1 service + 5
endpoints + ~16 tests, and 5 new frontend files + one real refactor of shipped
code (`TxtReader.renderHighlighted`) + one reversal of a documented Phase 1
decision (the PDF text layer). **No new dependency.** The two things most likely
to consume unplanned time are the TXT boundary-sweep refactor (because search
must keep working) and the react-pdf text-layer CSS/geometry fiddling — not the
backend, which is a straightforward third instance of a pattern this repo has
now built twice.
