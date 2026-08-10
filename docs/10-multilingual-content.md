# Multilingual Content (Vietnamese / English) — Architecture & Plan

Status: **design only, not implemented, and not yet a committed feature.**
Author: architect agent, 2026-08-10.

Source ask: *posts and books should exist in two language versions (Vietnamese
and English), with optional machine-assisted translation to help produce the
second version.*

Note up front: `docs/01-prd.md` §6 lists **"Multilingual content"** as explicitly
out of scope for the MVP. That line predates almost everything the product has
since grown (access control, exams, the book library, highlights). Building this
means consciously reversing a written scope decision — which is fine, but it
should be reversed on purpose, in the PRD, not quietly in a migration. See §11
question 1.

Read alongside:
- `docs/03-architecture.md` — §4.1 Post, **§4.2 the shared access-control
  model**, §4.3 binary storage, **§4.4 highlight anchoring**, §5 schema
  management (Flyway), §8.1 the matcher ladder.
- `docs/08-book-library-module.md` — Book Phase 1 (§1 data model, §2 access
  control, §8 risks).
- `docs/09-book-highlights-phase2.md` — §2 anchoring, §2.3 the
  `file_version`/`stale` pattern this doc reuses for translation staleness.
- `docs/04-api-contract.md` §12 (Book Library as shipped).
- `docs/06-project-memory.md` — the Flyway/`validate` entry (2026-08-10) and
  the highlights-wiring entry (same day).

---

## 0. Scope decision summary (read this first)

| Question | Decision |
|---|---|
| Data model | **Each language is a full separate row** (`posts`, `books`), linked by a `translation_group_id` correlation column. Not per-field `title_vi`/`title_en`. Not one row + a toggle. §1 |
| Group identity | **Plain `BIGINT` column, no `translation_groups` table, no self-FK.** NOT NULL, backfilled to the row's own id. §1.3 |
| URL scheme | **Unchanged.** No `/en/` path prefix, no locale routing. Each variant keeps its own globally-unique slug: `/posts/toi-uu-postgres` and `/posts/optimizing-postgres`. §4.2 |
| Access control | **The translation group is the unit of access configuration**, enforced at **write** time by propagation; the read path (`PostAccessService`/`BookAccessService`) is untouched. §2 |
| Editorial status | **Per row, deliberately not propagated.** A machine translation lands as `DRAFT` while its source stays `PUBLISHED`. §2.3 |
| Listing pre-filter | **Yes** — a `language` query param, driven by a `localStorage` preference with an explicit **All languages** option. Not `Accept-Language`, not a cookie, never a redirect. §4.3 |
| SEO | Sitemap `xhtml:link` alternates are the **primary** hreflang channel; per-page `<head>` links are secondary. Self-referential canonical per language, always. §5 |
| UI chrome language | **Not translated.** Nav/buttons/labels stay in one language at both phases. No i18n library. §4.6, §10 |
| Machine translation | **Phase 2 only.** LLM API (Anthropic Messages) called server-side, admin-triggered, always produces/updates a **DRAFT**, never publishes. §6 |
| Machine translation of PDF books | **Explicitly not supported.** Admin uploads a separately-prepared translated PDF as its own `Book` row in the group. §6.5 |
| Comments | **Per language row.** Not shared across the group. §7.2 |
| Series | **Single-language, enforced by a write-time guard.** No schema change to `series`. §7.4 |
| Third language, canonical-reordering UI, translated categories/tags, exams | **Deferred**, §10 |
| New backend dependency | **None** at Phase 1. Phase 2 adds one outbound HTTP call via the existing `RestClient` — no SDK. |

---

## 1. Data model

### 1.1 The pivotal question: separate rows, or per-field columns?

Three candidate models were considered. The answer is different in *strength*
for books and posts, so both are argued separately rather than assumed
identical.

**Option A — per-field columns.** `posts.title_vi` / `title_en`,
`content_vi` / `content_en`, etc. One row per article.

**Option B — one row, one language column, no linkage.** Two independent posts,
no relationship recorded. (This is what an admin can already do today by hand.)

**Option C — separate full rows linked by a `translation_group_id`.**
Recommended.

#### For `Book`, Option C is forced

This is not a preference. Three shipped invariants make a shared `Book` row
impossible:

1. **`book_files.book_id` is UNIQUE** (`docs/08` §1.2). One book row holds
   exactly one file's bytes. A translated book is a *different file*.
2. **`book_highlights` anchors are file-specific.** Verified in
   `BookHighlight.java`: `TXT_OFFSET` stores `start_offset`/`end_offset` as
   character offsets into the decoded text of one exact file; `PDF_RECTS` stores
   `page_number` plus normalized rectangles on one exact rendered page. A
   Vietnamese page 42 and an English page 42 are unrelated. The denormalized
   `text` snippet (§3.3 of `docs/09`) is in one language. There is no meaningful
   way to share a highlight across languages, and no meaningful way to store two
   files' worth of anchors against one `book_id` without adding a language
   discriminator to `book_highlights`, `book_reading_progress`,
   `book_files`, and every query that touches them.
3. **`books.file_version`** exists specifically to invalidate anchors when *the*
   file changes. A per-language file makes `file_version` ambiguous — is it the
   VI file's version or the EN file's?

Under Option C, all three invariants hold untouched: the EN edition is a
`Book` row with its own `book_files` row, its own `file_version`, its own
highlights, its own reading progress. **Zero changes to `BookHighlightService`,
`BookProgressService`, `PdfReader`, `TxtReader`, or any of the 15 highlight
integration tests.** That is the whole argument, and it is decisive.

#### For `Post`, Option C is chosen but the case is genuinely closer — here is the honest comparison

Post has no offset anchoring. Nothing in the post domain is file-bound. So
Option A deserves a real hearing rather than a hand-wave.

What Option A actually buys:

- One comment thread for both languages (`comments.post_id` stays one row).
- One `view_count`.
- One access configuration — **no drift risk at all**, which is otherwise the
  single most dangerous thing in this feature (§8, R2).
- One `series_posts` membership, one position, no mixed-language series problem.
- One row to delete, so `PostService.delete()`'s already-incomplete cleanup
  doesn't get another path.

What Option A costs, concretely, against this codebase:

1. **Independent editorial lifecycle is impossible without duplicating the
   lifecycle columns too.** The core Phase-2 workflow is "machine-translate,
   land it as a DRAFT, review, publish" while the source stays PUBLISHED. That
   needs `status_en`, and then `published_at_en`, and then (for the drift
   problem, §8 R1) `updated_at_en`. Three more columns, and `Post.onCreate()`/
   `onUpdate()` grow a per-language branch.
2. **The column count roughly doubles and every one is nullable.** `title`,
   `excerpt`, `content`, plus arguably `category` and `tags`. Combined with (1)
   that is ~8 nullable columns whose collective meaning is "there is a second
   post here" — which Option C expresses as: a second row.
3. **"Does an English version exist?" becomes a fuzzy predicate**
   (`content_en IS NOT NULL AND status_en = 'PUBLISHED'`) evaluated in every
   listing, the sitemap, and the switcher. Under C it is `count(*) in the group`.
4. **`PostRepository.search`'s JPQL would have to `like` across both content
   columns**, or take a language parameter that switches which columns it reads
   and which it returns — a genuinely awkward query, on the hot path.
5. **Every DTO factory in `PostResponse` (`from`, `teaser`, `withAttachments`)
   would need a language argument** to decide which half of the row to project.
   `teaser()` in particular is security-relevant.
6. **`Book` cannot use Option A** (above). Two different multilingual models in
   one codebase is exactly the drift smell this repo already documented for
   `PostAccessService` vs `ExamAccessService` (`docs/03` §4.2).

Weighing it: Option A wins on *shared* concerns (comments, views, access,
series) and loses on *lifecycle* and *uniformity*. Because the machine-
translation workflow makes independent DRAFT/PUBLISHED lifecycle a hard
requirement — and because that requirement alone drags three lifecycle columns
into Option A, at which point the row model is strictly cleaner and reuses
every existing query path unchanged — **Option C wins for Post too.**

But Option A's advantages are real, so they are addressed head-on rather than
lost:

| Option A advantage | How Option C handles it |
|---|---|
| One access configuration | §2: access config is group-level, propagated on write, tested. |
| One comment thread | §7.2: accepted as per-language, with the reasoning. |
| One `view_count` | §7.6: per-language counts are *better* here, not worse. |
| One series membership | §7.4: a write-time guard keeps a series single-language. |
| One delete path | §1.3: the group column carries **no FK**, so deletes need no new cleanup. |

**Option B (separate rows, no linkage) is rejected** because it makes the
language switcher, hreflang, translation-staleness detection, and uniform access
all impossible — those are the entire feature. The link is the feature.

### 1.2 New columns

Identical set on **`posts`** and **`books`**.

```
language              enum ContentLanguage {VI, EN}, NOT NULL, default 'VI'
translation_group_id  BIGINT NOT NULL          -- correlation id, no FK (§1.3)
translated_from_id    BIGINT NULL              -- the row this was translated from; NULL = original
source_updated_at     TIMESTAMP NULL           -- source row's updated_at when this translation was
                                               -- last reviewed; drives `translationStale` (§8 R1)
translation_origin    enum TranslationOrigin {HUMAN, MACHINE}, NOT NULL, default 'HUMAN'

UNIQUE (translation_group_id, language)
INDEX  (language)
```

Field-by-field, for the non-obvious ones:

- **`language`** — `@Enumerated(EnumType.STRING)`, `@Column(length = 5)`. The
  values are `VI`/`EN`; `length 5` leaves headroom for a regional variant later
  without a second `ALTER`.
- **`UNIQUE (translation_group_id, language)`** — the constraint that makes the
  whole model safe. It is structurally impossible to have two Vietnamese posts
  in one translation group, so "the VI variant of this group" is always a
  single row and the switcher can never be ambiguous. This is the one index that
  must not be forgotten.
- **`translated_from_id`** — records direction. Needed for two things and
  nothing else: (a) `x-default` in the sitemap points at the original-language
  URL, (b) staleness compares against *the source*, not against an arbitrary
  sibling. **Deliberately not a foreign key** — see §1.3.
- **`source_updated_at`** — the `docs/09` §2.3 `file_version` pattern,
  transposed. A translation is stale when
  `source.updatedAt > translation.sourceUpdatedAt`. Computed on read, never
  stored as a boolean, so there is one source of truth. Set at creation and by
  the explicit "mark reviewed" action (§3.3) — **not** by every save of the
  translation row (§3.3 explains why).
- **`translation_origin`** — provenance. One enum column that answers "was this
  published English text originally machine output?", which is the quality/
  liability question in §8 R3. Cheap now, impossible to reconstruct later.

**No `is_canonical` column.** "Canonical" is derivable:
`translated_from_id IS NULL`. A boolean would be a second, desynchronizable
source of truth for the same fact.

**No new table.** No `translations`, no `translation_groups`, no
`post_translations`. The relationship is one column.

### 1.3 Why a bare correlation column and not a group table or a self-FK

Three shapes were considered:

**A `translation_groups` table** with `posts.translation_group_id` FK. Costs: a
new table with no useful payload at MVP, a new join, and a new lifecycle
question ("when the last member leaves a group, who deletes the group row?").
An orphaned group row is invisible garbage. Rejected: the group has no
attributes of its own.

**A self-referencing `translated_from_id` FK** as the *only* link (canonical row
is the hub). Rejected as the primary link because: deleting the canonical row
orphans or breaks its translations; this repo has **no `ON DELETE CASCADE`
anywhere** (`docs/03` §4.2) and has shipped the missing-cleanup bug at least
three times; and `PostService.delete()` is *already documented as incomplete*
for comments/access-groups/series links. Adding a self-FK to `posts` would add a
fourth thing that delete must remember. (`translated_from_id` survives as a
plain nullable BIGINT for direction only — see below.)

**A plain `BIGINT` correlation column, no FK.** Chosen. Consequences:

- **Deleting one variant needs no new cleanup at all.** Delete the VI post; the
  EN post is left in a group of one, which is a perfectly valid state (every
  pre-existing post is in a group of one after the backfill). No FK violation,
  no orphan, no new line in `delete()`. Given this repo's track record, that
  property is worth more than referential elegance.
- `translated_from_id` can dangle after its source is deleted. Handled by
  treating a dangling id as `NULL` (i.e. "this row is now the original"), which
  is exactly the right semantics: if the Vietnamese original is gone, the
  English row *is* the only version. One `Optional` in the service; no cleanup
  job. This must be an explicit test case.
- The absence of an FK is a deliberate, documented trade — not an oversight.
  Record it in the migration file comment, in the same voice `V2`/`V3` use.

**Value assignment.** `translation_group_id` is `NOT NULL` and, for a standalone
row, equals the row's own `id`. New standalone rows therefore need the id first:
`save()`, then `setTranslationGroupId(getId())` inside the same transaction
(Hibernate emits one extra `UPDATE`). A new *linked* row gets the target's group
id at insert, so it costs nothing. The alternative — a dedicated Postgres
sequence — buys nothing here and introduces the only sequence in the schema.

`NOT NULL` rather than nullable so there is no `IS NULL` branch anywhere: every
row is always in exactly one group, and the group is size 1 by default.

### 1.4 Shared `ContentLanguage` enum — a deliberate break from convention

This repo duplicates enums per domain: `PostStatus`/`BookStatus`,
`PostVisibility`/`BookVisibility`, `PostMetadataVisibility`/
`BookMetadataVisibility`. Language does **not** follow that convention:

```java
package com.example.blog.common;

public enum ContentLanguage {
    VI("vi", "Tiếng Việt"),
    EN("en", "English");

    public String bcp47();      // for hreflang, <html lang>, og:locale
    public String displayName();
}
```

Justification for breaking the convention:

1. The duplicated enums differ in *behaviour* (`PostVisibility` denial is
   reason-coded; `ExamVisibility` denial is a plain 404). `ContentLanguage` has
   zero per-domain semantics — `VI` means the same thing everywhere.
2. The API query parameter, the sitemap's `hreflang` attribute, and the
   frontend's `localStorage` preference must all use **identical string
   values**. Two enums is two places for a third language to be added to one of.
3. `bcp47()` is the single mapping from enum name to hreflang code. Duplicating
   it is how you end up with `hreflang="VI"` (invalid) in one of two places.

`TranslationOrigin { HUMAN, MACHINE }` goes in the same package for the same
reason.

### 1.5 Migration plan — Flyway `V4`, not `ddl-auto`

Schema is Flyway-owned with `ddl-auto: validate` (`docs/03` §5). Existing
migrations are `V1__baseline.sql`, `V2__add_book_highlights.sql`,
`V3__add_books_file_version.sql`. **Next free version is `V4`.**

`backend/src/main/resources/db/migration/V4__add_content_language.sql`:

```sql
-- Posts
ALTER TABLE posts ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'VI';
ALTER TABLE posts ADD COLUMN translation_group_id BIGINT;
UPDATE posts SET translation_group_id = id;
ALTER TABLE posts ALTER COLUMN translation_group_id SET NOT NULL;
ALTER TABLE posts ADD COLUMN translated_from_id BIGINT;   -- intentionally NOT a FK, see doc §1.3
ALTER TABLE posts ADD COLUMN source_updated_at TIMESTAMP;
ALTER TABLE posts ADD COLUMN translation_origin VARCHAR(10) NOT NULL DEFAULT 'HUMAN';
CREATE UNIQUE INDEX ux_posts_translation_group_language ON posts (translation_group_id, language);
CREATE INDEX idx_posts_language ON posts (language);

-- Books: identical six columns + two indexes
ALTER TABLE books ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'VI';
ALTER TABLE books ADD COLUMN translation_group_id BIGINT;
UPDATE books SET translation_group_id = id;
ALTER TABLE books ALTER COLUMN translation_group_id SET NOT NULL;
ALTER TABLE books ADD COLUMN translated_from_id BIGINT;
ALTER TABLE books ADD COLUMN source_updated_at TIMESTAMP;
ALTER TABLE books ADD COLUMN translation_origin VARCHAR(10) NOT NULL DEFAULT 'HUMAN';
CREATE UNIQUE INDEX ux_books_translation_group_language ON books (translation_group_id, language);
CREATE INDEX idx_books_language ON books (language);
```

Rules this must respect, all of them already burned into this repo:

1. **Never edit `V1`–`V3`.** This is a new versioned file, exactly as `V3` was
   for `books.file_version` (its header comment says so explicitly).
2. **Entity change and migration must land in the same commit.** Under
   `validate`, an entity field without a column is a **startup failure**, not a
   silent column add. A half-merged PR takes production down on the next
   restart. Say this in the PR description.
3. **`V1__baseline.sql` still has not been diffed against a real
   `pg_dump --schema-only` of production** (open gap, memory 2026-08-10). `V4`
   only runs safely on a database where `validate` already passes — confirm the
   current deploy boots clean *before* merging this, not after.
4. **CI does not cover this.** Tests run on H2 with `spring.flyway.enabled:
   false` and `ddl-auto: create-drop`. A green `mvn test` says nothing about
   whether `V4` is valid Postgres. Apply it to the dev Postgres by hand first.

**The `DEFAULT 'VI'` back-fill is a product decision, not a technical one.**
It stamps every existing post and book — including everything already indexed by
Google — as Vietnamese. If the existing catalogue is actually English (the site
brands itself TECH2BLOGS and several titles read as English), this silently
publishes wrong `hreflang` and wrong `<html lang>` for the entire site. Changing
`'VI'` to `'EN'` is a one-character edit *before* the migration runs and an
`UPDATE` afterwards, but the SEO consequence of getting it wrong is not
one-character. **Confirm before running** — §11 question 2.

---

## 2. Access control and the translation group

### 2.1 The invariant we need

> If a reader may read one language version of an article, they may read all of
> them.

Anything weaker means a private Vietnamese post can be read in English by
someone who was never granted access — a real leak, produced by nothing more
exotic than an admin forgetting to tick the same checkbox twice.

### 2.2 Where to enforce it: read path or write path?

**Read-path enforcement** (`PostAccessService.evaluate` resolves grants across
the whole group) was evaluated first, because a single source of truth cannot
drift. It does not survive contact with the actual code:

- `evaluate()` currently does `existsByPostIdAndUserId(post.getId(), ...)` and
  `findByPostId(post.getId())`. Making those group-aware means first expanding
  the group to sibling ids — one extra query on the private path. Tolerable.
- **But `visibility` itself is a per-row column, and grants cannot fix it.** If
  the VI row is `PRIVATE` and the EN row is `PUBLIC`, no amount of grant-
  expansion helps: `evaluate()` returns `null` (allow) on line 1 for the EN row
  because it is public. To close that, "effective visibility" would have to be
  the most restrictive across the group — which means a group lookup **on the
  public path**, i.e. on every row of every listing. `resolveAccessiblePostIds`
  is documented as "exactly 3 queries regardless of list size"; this would add a
  fourth *and* restructure its fast path.
- `PostAccessService` is described in `docs/08` §2.1 as "the single most
  security-critical class in the app, with ~86 tests riding on its behaviour."
  Restructuring its public fast path for a feature that has no users yet is a
  bad trade.

So the visibility axis has to be kept uniform by the write path regardless.
Once that is true, keeping the *grants* uniform by the same mechanism is free,
and the read path needs no change at all.

### 2.3 Decision: the translation group is the unit of access configuration, enforced on write

**`visibility`, `privateMetadataVisibility` (posts) / `metadataVisibility`
(books), and the access-group + direct-user grant sets are group-level
properties.** Any admin write that changes one of them applies it to every row
in the translation group, in one transaction.

**`status` (DRAFT/PUBLISHED) is explicitly NOT propagated.** That asymmetry is
the crux of the model and is deliberate:

- `status` is *editorial* state: "is this text finished?" It is per-language by
  definition — the whole Phase-2 flow is a machine-translated DRAFT sitting
  beside a PUBLISHED source.
- `visibility` is *authorization* state: "who is allowed to see this article?"
  That is a property of the article, not of a translation of it.

`docs/03` §4.1 already states these are two independent axes. This feature makes
them independent in a second dimension too: status varies by language,
visibility does not.

No leak is created by the asymmetry: a DRAFT sibling is invisible to the public
regardless of visibility, and a PUBLIC PUBLISHED sibling of a DRAFT row is just
a normal public article.

### 2.4 Why the write path is cheap — a useful finding

Every direct-grant and group-grant write in the codebase already funnels through
`AccessGroupService`. Making these five methods translation-group-aware covers
**everything**, including surfaces that never mention translations:

| Method | Line | Change |
|---|---|---|
| `setPostAccessGroups(postId, groupIds)` | ~181 | apply to all sibling post ids |
| `setPostDirectUsers(postId, userIds, admin)` | ~207 | apply to all sibling post ids |
| `setPostDirectUsersAdd(postId, userId, admin)` | ~229 | apply to all sibling post ids |
| `setBookAccessGroups(bookId, groupIds)` | ~316 | apply to all sibling book ids |
| `setBookDirectUsers(bookId, userIds, admin)` | ~341 | apply to all sibling book ids |

Plus visibility propagation in `PostService.create/update` and
`BookService.create/update`.

**The `AccessRequest` workflow then needs no changes of its own.**
`AccessRequestService.approve()` (line ~89) grants either via
`accessGroupService.addUserToGroup(...)` — already group-wide, because a group
gates every row that references it, and `setPostAccessGroups` propagation
guarantees both rows reference it — or via
`accessGroupService.setPostDirectUsersAdd(request.getPost().getId(), ...)`,
which becomes group-aware by the table above. Approving a request against the
English post grants the Vietnamese one too, for free.

Two smaller `AccessRequest` consequences that *do* need code:

- **Duplicate requests.** `create()` guards with
  `existsByUserIdAndPostIdAndStatus(userId, postId, PENDING)`. A member can
  currently open a PENDING request on the VI row and another on the EN row for
  what is one decision. Widen the guard to "any sibling in the group" and return
  the existing request rather than creating a second one.
- `access_requests.post_id` stays a real FK to one row. No change. Which row was
  asked about is genuine information (it tells the admin where the member
  actually landed), and the approval is group-wide anyway.

### 2.5 Drift is still possible — how it is surfaced, not just hoped away

Write-time propagation can be bypassed by a direct DB edit, by a pre-feature row
manually linked into a group, or by a future write path that forgets to call the
propagating method. Rather than a background reconciler (over-engineering for a
single-admin blog), drift is made **visible**:

- `GET /api/admin/posts/{id}` and `GET /api/admin/books/{id}` return
  `translations: [{ id, language, slug, status, visibility, translationStale }]`.
- The admin form's Translations panel renders a warning row when two variants
  report different `visibility` — the one thing a human can spot instantly and a
  test cannot cover retroactively.
- One backend test asserts that setting `visibility=PRIVATE` + a group grant on
  the VI row makes the EN row inaccessible to a non-granted MEMBER. This is the
  acceptance criterion for BE-L3 and is non-negotiable.

Linking two *existing* posts with different access configuration is the most
likely real-world source of drift. Decision: **`PUT /translation-link` copies the
target's access configuration onto the row being linked**, and the API response
says so. Linking is an explicit admin action with a confirmation dialog that
names what will change (§3.2).

---

## 3. API contract additions

To be added to `docs/04-api-contract.md` as **§13. Multilingual content**
(§12 is Book Library). Error bodies keep the existing `ApiError { code, message }`
shape. **No new `SecurityConfig` matchers are needed** — every new endpoint is
under `/api/admin/**`, and the public reads are additions to existing paths.
That is a welcome contrast with the last two features, where matcher ordering
was the top risk (R4/H3).

### 3.1 Public read changes

#### `GET /api/posts` and `GET /api/books` — new `language` param

| Name | Type | Required | Description |
|---|---|---:|---|
| `language` | `VI` \| `EN` | no | Omitted ⇒ **all languages**, i.e. today's behaviour. |

`PostRepository.search`'s JPQL gains one clause in exactly the shape `category`
already uses, so null-means-all stays consistent:

```
and (cast(:language as String) is null or p.language = :language)
```

Unknown value ⇒ `400 BAD_REQUEST`. Interaction with `includeDrafts`: orthogonal,
both filters apply.

#### `GET /api/posts/{slug}` and `GET /api/books/{slug}` — new fields

```json
{
  "...": "existing fields unchanged",
  "language": "VI",
  "translations": [
    { "language": "EN", "slug": "optimizing-postgres", "title": "Optimizing PostgreSQL" }
  ]
}
```

Rules, all of which matter:

- `translations` **excludes the row itself**. It answers "where else can I read
  this", not "what languages exist".
- Three flat fields per entry, not a nested `PostResponse`. Same call
  `docs/09` §5.2 made for `/api/me/highlights` — a switcher needs a label and a
  URL, and dragging content/cover/access fields into it is payload for nothing.
- **Public callers only see `PUBLISHED` siblings.** A DRAFT machine translation
  must never be advertised. Admin callers (`includeDrafts=true` / the admin
  endpoints) see all siblings with their `status`.
- **`translations` is `[]` on a locked teaser row.** Teasers already strip
  content; adding sibling titles to a row the viewer cannot read is extra
  surface for zero benefit. Populate it only when `accessible == true`, and
  build it in the same `PostResponse.from(...)`/`teaser(...)` factory split that
  already exists, not at the call site (the `R11` teaser-leak lesson).
- Listing rows (`GET /api/posts`) carry `language` but **not** `translations` —
  it would be an N+1 group lookup per row for a field no card renders. The
  switcher lives on detail pages only (§4.4).

`RelatedPostResponse` gains nothing; related posts are language-filtered instead
(§7.1).

#### `GET /api/sitemap.xml`

See §5.1. No new parameters.

### 3.2 Admin endpoints

Two new endpoints per domain at Phase 1, plus parameters on existing creates.
Deliberately minimal.

| Method + path | Purpose |
|---|---|
| `POST /api/admin/posts` | Gains optional `language` (default `VI`) and `translationOfPostId`. When present, the new post joins that post's group, `translated_from_id` is set, `source_updated_at` is stamped, and the source's access config is copied. |
| `POST /api/admin/books` | Same two multipart params: `language`, `translationOfBookId`. **This is how a translated PDF is added** (§6.5) — no separate endpoint needed, because a book variant always requires a file upload anyway. |
| `PUT /api/admin/posts/{id}` / `PUT /api/admin/books/{id}` | Gains `language` (changing it is allowed only if it doesn't violate `UNIQUE(translation_group_id, language)` ⇒ else `409 TRANSLATION_LANGUAGE_TAKEN`). |
| `PUT /api/admin/posts/{id}/translation-link` | Body `{ "targetId": 42 }` links this row into `targetId`'s group; `{ "targetId": null }` unlinks it into a fresh group of its own. Copies the target's access config on link (§2.5). |
| `PUT /api/admin/books/{id}/translation-link` | Same. |
| `POST /api/admin/posts/{id}/translation-reviewed` | Sets `source_updated_at = source.updatedAt`. Clears `translationStale`. `204`. |
| `POST /api/admin/books/{id}/translation-reviewed` | Same. |
| `POST /api/admin/posts/{id}/machine-translate` | **Phase 2 only.** §6. |

Admin listing/detail responses (`GET /api/admin/posts`, `GET /api/admin/books`,
and their `{id}` details) gain `language`, `translationStale` (boolean,
computed), `translationOrigin`, and — on detail only — the full `translations`
array including DRAFT siblings.

Errors:

| Condition | Response |
|---|---|
| `translationOfPostId` / `targetId` unknown | `404 POST_NOT_FOUND` / `404 BOOK_NOT_FOUND` |
| Linking would put two rows of the same language in one group | `409 TRANSLATION_LANGUAGE_TAKEN` |
| Linking a row to itself | `400 BAD_REQUEST` |
| `language` not a known value | `400 BAD_REQUEST` |
| `translation-reviewed` on a row with `translated_from_id IS NULL` | `400 NOT_A_TRANSLATION` |

Note the `@Valid`-on-multipart trap already recorded from Book Phase 1: the book
endpoints take multipart params, so bean validation does **not** fire — validate
in the service. The post `translation-link` body is JSON, so `@Valid` does fire
there; validate in the service anyway, since the service is the only chokepoint.

### 3.3 Why "mark reviewed" is its own endpoint and not a side effect of saving

The tempting shortcut is: any admin save of the EN row implies the admin looked
at the VI row, so clear staleness on `PUT /api/admin/posts/{id}`.

Rejected. Fixing an English typo without re-reading the Vietnamese source would
silently mark the translation current — a **false negative on the exact signal
this feature exists to produce** (§8 R1). A stale badge that lies is worse than
no badge. A three-line endpoint and one explicit button is the correct cost.

---

## 4. Frontend

### 4.1 What is deliberately *not* changing

- **No new routes.** No `/en/*`, no `:lang` segment, no route reshuffle.
- **No i18n library** (`react-i18next`, `formatjs`, …). Zero new dependencies.
- **No message catalogs.** UI chrome stays in its current language (§4.6).
- **No SSR/prerendering.** The existing `useSeo` client-side approach and its
  documented crawler caveat are unchanged (§5.2).

### 4.2 Routing and slugs — the simplicity call

`posts.slug` and `books.slug` stay **globally unique**. Each language variant has
its own slug, in its own language:

```
/posts/toi-uu-hieu-nang-postgres      (VI)
/posts/optimizing-postgres            (EN)
/library/postgres-noi-that            (VI)
/library/postgresql-internals         (EN)
```

Why this rather than `UNIQUE(slug, language)` + an `/en/` path prefix:

1. **Zero change to `findBySlug`, `existsBySlug`, `existsBySlugAndIdNot`,
   `PostController`, `BookService`'s slug-conflict handling, or the sitemap's
   URL construction.** A composite-unique slug turns every one of those into a
   two-argument lookup and forces a language into the routing layer.
2. **Zero URL changes for existing content.** Nothing already indexed moves, no
   redirects, no lost ranking. Under an `/en/` scheme the existing corpus would
   have to move under `/vi/` (or become permanently asymmetric).
3. **Language-native slugs are better SEO anyway.** An English article at a
   Vietnamese slug is worse than one at an English slug, regardless of prefix.

Cost, stated honestly: there is **no per-language home page URL**. The home page
and `/library` are single URLs whose contents depend on a client-side
preference, so they cannot carry hreflang and Google has no "English homepage"
to rank. English entry points are the English article URLs themselves. For a
personal blog whose traffic arrives on article URLs from search, that is an
acceptable trade; for a marketing site it would not be. Stated so it is a
choice, not a discovery (§8 R5).

### 4.3 Language preference: yes, with an explicit escape hatch

**Decision: a persisted reader preference that pre-filters listing pages only.**

- Stored in `localStorage` under `content_language`, values `VI` | `EN` | `ALL`.
- Initialized **once**, on first visit, from `navigator.language`
  (`vi*` → `VI`, else `EN`). Never re-derived afterwards — a stored preference
  is the reader's, not the browser's.
- Applied by passing `?language=` to `GET /api/posts` and `GET /api/books`.
  `ALL` sends nothing.
- Surfaced as a small `VI | EN | All` control in the site header, next to the
  existing theme toggle (`theme.ts` is the precedent for this exact kind of
  persisted, header-level, no-dependency preference).

Why not the alternatives:

- **No filter at all** is simpler but produces a home page listing the same
  article twice under two titles, which reads as a bug.
- **A cookie** buys nothing without server rendering, and adds `SameSite` and
  consent questions for zero benefit. This app is a pure SPA and already keeps
  tokens and the theme in `localStorage`.
- **Server-side `Accept-Language`** would make `GET /api/posts` vary by request
  header — harder to debug, harder to cache later (`Vary:`), and it hides
  content based on something the reader never chose. An explicit client-supplied
  parameter is strictly more honest.

Three hard rules on the preference, all of them about not breaking SEO or trust:

1. **It never redirects.** Opening `/posts/optimizing-postgres` with preference
   `VI` shows the English post. Auto-redirecting to a "preferred" language is
   the single most common way sites destroy their own hreflang setup, and it
   also breaks direct links people share.
2. **It never causes a 404.** Detail pages ignore it entirely.
3. **`ALL` is always one click away**, and the empty state links straight to it.

### 4.4 The switcher on detail pages

**`PostDetail.tsx`** — an inline control in the existing title/meta row (beside
category and date), rendered **only when a visible sibling exists**:

> Also available in: **English**

Clicking is a real `<Link>` navigation to `/posts/{siblingSlug}` — not a
client-side content swap. That is what makes each language independently
crawlable, shareable, and back-button-correct.

When no sibling exists, render **nothing**. A greyed-out "EN" pill advertises
missing content and invites clicks that do nothing.

For an admin viewing the page with a DRAFT sibling, show it with a "draft"
badge, linking to the admin edit form rather than the public URL.

**`BookDetailPage.tsx`** — identical control under the title.

**`BookReaderPage.tsx` — deliberately no switcher.** Switching language
mid-read means abandoning this file's reading position and highlights for a
different file with unrelated page numbers and offsets (§1.1). Offering it in
the reader toolbar makes an irreversible-feeling action one stray click away for
no gain. The switcher lives on the detail page, one level up.

### 4.5 States (repo rule #6)

| State | Behaviour |
|---|---|
| Success | Listing filtered to the preference; detail renders with the switcher when a sibling exists. |
| Loading | Unchanged. The preference is read synchronously from `localStorage`, so there is no extra async step and no flash of the wrong language. |
| Error | Unchanged. A failed `translations` fetch must never block the article — `translations` ships inside the existing detail response, so there is no separate request to fail. |
| **Empty** | The one that actually matters early on: with preference `EN` and no English posts yet, the home list must say **"No English posts yet."** with a **[Show all languages]** button that flips the preference to `ALL`. Same on `LibraryPage`. A bare "No posts found" here reads as a broken site. |

### 4.6 UI chrome is not translated — and this is a real limitation

Nav labels, buttons, form labels, error copy, empty-state text, and admin UI all
stay in their current language at **both** phases. A Vietnamese reader on a
Vietnamese article still sees English chrome.

The reason is size, not principle: extracting every string across ~40 components
plus adding a message-catalog dependency is larger than the content feature
itself, and it was not what was asked for. It is listed in §10 as a separate
future task, and it is the most likely follow-up request the moment a Vietnamese
reader actually uses this. Flagged as §11 question 3 rather than assumed away.

### 4.7 Admin UI

**One place, not two: a "Translations" panel in `PostForm.tsx`**, below the
access-control panel, and the equivalent in `AdminBookForm.tsx`.

- Shows the current row's language (a select) and its siblings, each with
  status, `translationStale`, and links to edit/view.
- With no sibling: a **"Create English version"** action offering
  `Empty` / `Copy source content` (Phase 1) and `Machine translate` (Phase 2).
- **"Link to an existing post"** — an id/slug picker, with a confirmation
  dialog that names what will be overwritten: *"This will apply
  &lt;target&gt;'s visibility and access grants to this post."*
- **"Mark as reviewed"**, enabled only when `translationStale` is true.
- A note under the access panel: *"Visibility and access apply to all language
  versions of this post."* Written once, where the confusion would occur.

Not on the list-page rows: a per-row "Translate" action on `AdminPosts.tsx`
would have to handle unsaved-state ambiguity and duplicate the whole panel's
logic. The list gets a **language badge and a stale badge** only — read-only
signal, no action.

---

## 5. SEO

### 5.1 Sitemap — the primary hreflang channel

`SitemapController` currently iterates
`postRepository.findByStatusAndVisibility(PUBLISHED, PUBLIC)` and emits one
`<url>` per post. Changes:

1. `<urlset>` gains `xmlns:xhtml="http://www.w3.org/1999/xhtml"`.
2. Build a `Map<Long, List<Post>>` keyed by `translationGroupId` **from the
   result set already in memory** — no additional query. This matters: the
   alternates set must be computed from the *already filtered* PUBLISHED+PUBLIC
   list, so a DRAFT or PRIVATE sibling is never advertised. Deriving alternates
   from the raw group would publish gated URLs in a public sitemap, defeating
   the gate — the exact reason `findByStatusAndVisibility` exists (see its
   comment in `PostRepository`).
3. `appendUrl(...)` gains an alternates parameter and emits, after `<loc>` and
   before `<lastmod>` (matching Google's documented example ordering):

```xml
<url>
  <loc>https://tech2blogs.com/posts/toi-uu-hieu-nang-postgres</loc>
  <xhtml:link rel="alternate" hreflang="vi" href="https://tech2blogs.com/posts/toi-uu-hieu-nang-postgres"/>
  <xhtml:link rel="alternate" hreflang="en" href="https://tech2blogs.com/posts/optimizing-postgres"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://tech2blogs.com/posts/toi-uu-hieu-nang-postgres"/>
  <lastmod>2026-08-10T00:00:00Z</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>
```

Non-negotiable hreflang rules (getting any of these wrong is worse than not
doing it at all):

- **Every URL lists every alternate *including itself*.** A set of hreflang
  links must be reciprocal and self-inclusive or Google discards the whole
  cluster silently.
- **A group of one emits no `xhtml:link` elements at all.** Every existing post
  is a group of one, so this feature adds zero markup until a real pair exists.
- **`x-default` points at the original-language URL** (`translated_from_id IS
  NULL` within the group). With a group of one, omitted.
- Codes come from `ContentLanguage.bcp47()` — lowercase `vi`/`en`, never the
  enum name.

Two adjacent facts worth recording while here:

- `/` and `/series` get **no** alternates, because there is only one of each
  (§4.2).
- **Books are not in the sitemap at all today.** That is a pre-existing gap, not
  one this feature creates. If books are added later, they need the same
  alternate treatment, computed from the same PUBLISHED+PUBLIC filter. Out of
  scope here; noted so it isn't rediscovered.

### 5.2 Per-page `<head>` — secondary, and there is a real bug to avoid

`useSeo.ts` gains two options:

```ts
lang?: string;                                   // 'vi' | 'en'
alternates?: { hreflang: string; path: string }[];  // includes self + x-default
```

and:

- sets `document.documentElement.lang = opts.lang` (today `index.html` hardcodes
  `<html lang="en">` for every page, including Vietnamese ones — an accessibility
  and SEO defect that already exists and that this feature must fix);
- sets `og:locale` (`vi_VN` / `en_US`) and, when a sibling exists,
  `og:locale:alternate`;
- keeps `canonical` **self-referential**. Never point the English post's
  canonical at the Vietnamese one. That is a de-indexing instruction, not a
  translation hint, and it is the classic way to make an entire language version
  vanish from search.

**The specific footgun in existing code:** `upsertLink(rel, href)` queries
`link[rel="..."]` and upserts exactly **one** element per `rel`. hreflang needs
*N* `<link rel="alternate">` elements, and — because this is an SPA where
`useSeo` overwrites the previous page's tags — stale alternates from the
previously-viewed post would otherwise persist into the next page's `<head>`,
silently claiming the wrong translation relationships. The fix is explicit:

```ts
document.head
  .querySelectorAll('link[rel="alternate"][data-seo-alt]')
  .forEach((el) => el.remove());
// then append one tagged <link data-seo-alt> per alternate
```

Remove-then-append, tagged with a data attribute so it never touches any other
`rel="alternate"` link. This is R6 in §8 and needs a manual DOM check
(navigate post A → post B → confirm A's alternates are gone).

Ordering of the two channels: the sitemap is generated server-side and is
therefore visible to every crawler. `useSeo` only runs after JS, with the
limitation already documented in its header comment. **Treat the sitemap as
authoritative and the `<head>` links as reinforcement** — that way the feature
does not depend on the weaker channel.

### 5.3 Duplicate content

Two articles saying the same thing at two URLs is exactly what hreflang exists
to explain. Done correctly (reciprocal, self-inclusive, self-canonical), Google
treats them as one cluster and serves the right one per user. Done incorrectly
— cross-language canonicals, non-reciprocal links, or alternates pointing at
`404`/`noindex` URLs — it looks like duplicate content or de-indexes a whole
language. That asymmetry is why §8 R5 is rated High despite hreflang being
"just some links".

Machine-translated text carries a *separate* quality risk: thin auto-translated
pages are a documented spam signal. Publishing unreviewed machine output at
scale is the failure mode; the review-before-publish rule in §6.3 is the
mitigation, and it is a policy, not a mechanism.

---

## 6. Machine-assisted translation (Phase 2)

### 6.1 Provider choice

| Option | Verdict |
|---|---|
| **LLM API (Anthropic Messages)** | **Recommended.** The content is Markdown with fenced code, inline `` `code` ``, raw HTML (`rehype-raw` video/YouTube embeds live *in* `post.content`, per `docs/03` §4.1), and `/api/images/{uuid}` URLs. An instruction-following model can be told "do not translate anything inside a fenced code block, do not alter HTML tags/attributes, do not alter URLs, keep technical identifiers in English" — which is precisely where generic MT engines fail on this corpus. No SDK needed: one `RestClient` POST to `https://api.anthropic.com/v1/messages` with `x-api-key` from an env var. Consistent with a repo already built around Anthropic tooling. |
| **Google Cloud Translation v3** | Solid fallback. Definitely supports Vietnamese, has `mimeType: text/html`, is cheap and deterministic. Costs: a GCP project, a service-account credential to store and rotate, and markup fidelity that is good for HTML but indifferent to Markdown code fences. Choose this if determinism and cost matter more than markup fidelity. |
| **DeepL API** | Best-in-class markup handling (`tag_handling=html`, `ignore_tags`) — **but its Vietnamese support is comparatively recent and must be verified against the live language list before choosing it.** Do not assume the VI↔EN pair is covered because DeepL is good at European pairs. This is a five-minute check that must actually be done, not inferred. |
| **Self-hosted (LibreTranslate / Argos)** | Rejected. New infrastructure to run (against `docs/03` §1 and CLAUDE.md rule 7) for materially worse VI↔EN technical-text quality. |

**No provider interface.** One class, `MachineTranslationService`, reading
`blog.translation.*` config. If the API key is blank the endpoint returns
`503 TRANSLATION_NOT_CONFIGURED` and the admin UI hides the button entirely.
A one-method interface with a single implementation is the premature abstraction
`docs/08` §1.2 explicitly refuses; swapping providers later is one class.

Config (`application.yml`, secret from the environment — never committed, per
CLAUDE.md rules 4 and 5; production secrets live in
`/etc/viettranblog/backend.env`, `docs/03` §9):

```yaml
blog:
  translation:
    api-key: ${TRANSLATION_API_KEY:}
    model: claude-...           # pinned, not "latest"
    max-input-chars: 60000
    timeout-seconds: 120
```

### 6.2 Exactly what is sent and received

**Endpoint:** `POST /api/admin/posts/{id}/machine-translate`
Body: `{ "targetLanguage": "EN", "overwrite": false }`

**Sent to the provider:** one request containing a JSON envelope of exactly
three fields, with a system prompt that pins the rules:

```json
{ "title": "...", "excerpt": "...", "content": "...(Markdown + raw HTML)..." }
```

System-prompt rules (each exists because of something in this codebase):

- Return **only** a JSON object with the same three keys.
- Preserve fenced code blocks, inline code, and their contents **byte for byte**.
- Preserve all raw HTML tags and attributes exactly — including `<iframe>` /
  `<video>` embeds, which live inside `content`.
- Preserve every URL exactly, including `/api/images/{uuid}` and
  `/api/videos/{id}` (these are shared between variants by reference, which is
  correct — no byte duplication; see §7.7).
- Preserve Markdown heading levels, list structure, and link syntax.
- Do not translate identifiers, CLI flags, config keys, SQL keywords, or product
  names.

**Explicitly NOT sent, and not translated:**

- **`slug`** — the URL is permanent and must not derive from unreviewed machine
  output. The admin supplies it.
- **`category`** — it is a filter key. `PostRepository.search` matches
  `lower(p.category) = lower(:category)`. Translating "Cơ sở dữ liệu" to
  "Database" creates two categories that no longer filter together.
- **`tags`** — already documented as an unqueryable comma-separated string
  (`Tags.java`). Translating them fragments a facet nobody can query anyway.

Keeping `category`/`tags` untranslated has a second payoff: the related-posts
scorer (category +2, shared tag +1) keeps working across a translation group, so
§7.1's language filter is the only change that widget needs.

**Received / persisted:** a new sibling row (or, with `overwrite=true`, the
existing sibling's `title`/`excerpt`/`content`), with
`status = DRAFT`, `translation_origin = MACHINE`,
`translated_from_id = {id}`, `source_updated_at = source.updatedAt`, and the
source's visibility/access config. Response `201` with the new post's admin
detail body.

### 6.3 Rules that are policy, not implementation

- **Never auto-publish.** The result is always `DRAFT`. There is no flag to
  change this.
- **Never overwrite a PUBLISHED translation.** `overwrite=true` is honoured only
  when the target sibling is `DRAFT`; otherwise
  `409 TRANSLATION_ALREADY_PUBLISHED`. Blowing away a human-reviewed published
  translation with fresh machine output is unrecoverable in an app whose backups
  are same-host-only.
- **`translation_origin = MACHINE` is not cleared by editing.** It records where
  the text started. Whether a public "machine-assisted translation" note is
  shown to readers is a product call (§11 question 5), but the data must exist
  to make that call later.

### 6.4 Limits and failure modes

| Condition | Response |
|---|---|
| No API key configured | `503 TRANSLATION_NOT_CONFIGURED` (button hidden in the UI) |
| `content` over `max-input-chars` | `400 CONTENT_TOO_LONG_FOR_TRANSLATION` |
| Provider error / timeout | `502 TRANSLATION_FAILED`, **nothing persisted** |
| Response not parseable as the expected JSON envelope | `502 TRANSLATION_FAILED`, nothing persisted |
| Target language already present and `overwrite=false` | `409 TRANSLATION_LANGUAGE_TAKEN` |
| Target sibling is PUBLISHED and `overwrite=true` | `409 TRANSLATION_ALREADY_PUBLISHED` |

**Synchronous, on the request thread.** No queue, no job table, no worker —
CLAUDE.md rule 7, and there is direct precedent: `VideoTranscoder` holds a
Tomcat thread for up to 300 s and that is accepted at single-admin-uploader
scale (`docs/03` §6). A translation call is 30–90 s. The frontend must therefore
show elapsed time and warn against navigating away (§9, FE-T1).

**No chunking at Phase 2.** Splitting a Markdown document without cutting a
fenced code block or a raw HTML element in half is its own feature. Over the cap
⇒ a clear error, not a silent truncation.

### 6.5 Books: TXT is marginal, PDF is excluded outright

**PDF: not supported, and this is not a "later" item.**

- Translating extracted PDF text cannot reconstruct the original PDF's layout,
  figures, tables, or code formatting. The output would have to *be* a PDF,
  because `PdfReader` renders the real file with `pdf.js`.
- Extracting the text at all requires server-side PDF parsing (PDFBox), which
  this repo has explicitly rejected three times (`docs/08` §4.4, §1.1; `docs/09`
  §3.3; the Phase 3 in-book-search entry).
- `POST /api/admin/books/{id}/machine-translate` returns
  **`400 TRANSLATION_NOT_SUPPORTED_FOR_FILE_TYPE`** for `fileType = PDF`. The
  admin form shows the reason inline instead of a disabled button with no
  explanation.
- The supported path is: prepare the translated PDF however you like (a
  publisher's edition, a human translation, an external tool) and upload it via
  `POST /api/admin/books` with `translationOfBookId`. It becomes its own `Book`
  row in the group, with its own file, page count, progress, and highlights —
  which §1.1 shows is the only coherent model anyway.

**TXT: technically feasible, practically limited.** A TXT book is plain text, so
the same call works — but the cap is `max-input-chars` (60k ≈ 30 pages), and the
book-file cap is 50 MB. Most real books exceed it by orders of magnitude.
So: allowed, but the admin form states plainly that it only works for short
texts, and the honest summary is that **machine translation is realistically a
Post feature.** Say that out loud rather than shipping a button that fails on
every real book.

---

## 7. Interaction with existing features

### 7.1 Related posts — filter by language, and exclude siblings

`PostService`'s related-posts scorer runs over
`findRecentPublishedExcluding(...)`. Two filters to add:

1. **Same language as the source post.** A Vietnamese reader must not be
   offered English suggestions.
2. **Exclude the source's own translation-group siblings.** "The same article,
   in the other language" is not a related post — that is what the switcher on
   the same page is for, and surfacing it twice is confusing.

Both are predicate additions in the service (where scoring already lives), not
JPQL changes. Note that the widget "omits inaccessible posts unconditionally, no
teaser" (`docs/03` §4.2) — unchanged.

### 7.2 Comments — per language, accepted

`comments.post_id` is a NOT NULL FK to one row. Sharing a thread across a
translation group would require a group key on `comments`, a language tag per
comment, and readers seeing replies in a language they do not read.

**Decision: per-language threads.** Zero code change. This matches how localized
sites normally behave, and the cost is stated rather than hidden: a Vietnamese
article's discussion is invisible on its English page, and the English page's
comment section will be empty for a long time. The existing empty state already
covers it.

If a shared thread is ever wanted, it is a separate feature with a language
column on `comments` and a filter — not a retrofit of this one.

### 7.3 Reading progress and the continue-reading shelf

`book_reading_progress` is `UNIQUE(book_id, user_id)`, so progress is per
language automatically, which is correct: page 42 of the Vietnamese edition is
not page 42 of the English one.

Consequence: a reader who opens both editions sees **two cards** on
`/api/me/reading` for what feels like one book. Not fixed at Phase 1 — they
genuinely are two files with independent positions, and collapsing them would
require picking one to hide and losing the other's position. Mitigated only by
`GET /api/me/reading` rows carrying `language` so the cards can be labelled.
Stated so nobody builds a merge.

### 7.4 Series — single-language, enforced by a guard

`series_posts(series_id, post_id, position)` drives prev/next navigation. A
mixed-language series produces a "next" link that jumps language mid-read — a
bug, not a feature.

Options considered: add `language` to `series` (a column + validation + admin
UI field in a module this feature otherwise never touches), or do nothing, or
guard at write time.

**Decision: no schema change; a write-time guard.** `SeriesService` rejects
adding a post whose `language` differs from the posts already in that series →
`400 SERIES_LANGUAGE_MISMATCH`. Roughly five lines, no migration, no admin form
change, and it makes the invariant impossible to violate through the API.

**Explicitly deferred: linked VI/EN series pairs.** An English reader on an
English post in an English series has no path to the Vietnamese series. Fixing
that means a translation group for `series` too — a second copy of this entire
design for a module with far less content. Revisit only if series volume
justifies it.

### 7.5 Book highlights and "My Highlights"

Highlights are per `Book` row, so a reader who highlighted both editions sees two
groups under near-identical titles.

One-field fix: `MyBookHighlightResponse` gains **`bookLanguage`**, so
`MyHighlightsPage` can render "PostgreSQL Internals (EN)". The `Book` is already
loaded to populate `bookTitle`/`bookSlug`/`bookFileType`, so this costs no extra
query and no new DTO — consistent with `docs/09` §5.2's "three flat fields, not
a nested object" rule (now four).

**Do not attempt to merge highlights across languages.** §1.1 is the reason: the
anchors are file-specific and there is no correspondence between them.

`book_highlights` needs **no** schema change, and `AccessGroupService.delete()`
needs no change (no new access-group FK). Stated so nobody adds a defensive call
and nobody worries it was forgotten.

### 7.6 View counts

Per row, unchanged. A Vietnamese post with 500 views and an English sibling with
3 is *useful* information — it tells the author whether the translation effort
is paying off. Summing them would destroy that signal to make one number look
bigger.

### 7.7 Inline images and videos

`content_images` and `content_videos` have **no FK back to a post** (a known gap,
`docs/03` §4.2). A copied or machine-translated English post therefore references
the *same* `/api/images/{uuid}` URLs as its Vietnamese source: no byte
duplication, no upload step, and both variants stay in sync if an image is
replaced.

This is a genuine benefit of the reference-by-URL model. It also means the
existing known gap (images embedded in a private post are served
unauthenticated) is unchanged in scope by this feature — not worsened, not
fixed.

### 7.8 Exams

Out of scope. Exams have their own visibility/access model and a question/option
tree that would need per-language variants of every child row. If a bilingual
exam is ever wanted, it is its own design doc, and this document's translation-
group column is the pattern to copy — not to extend.

### 7.9 `DataSeeder` (dev profile)

Must set `language` and `translationGroupId` on seeded rows, and should seed
**one real VI/EN pair** of posts. Without it, nobody can exercise the switcher,
hreflang, or the language filter locally, and the feature ships untested against
the only thing it does.

---

## 8. Implementation risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| **R1** | **Translation drift.** The Vietnamese post is edited; the English version silently becomes wrong. Over months this is the *normal* state of any bilingual site, not an edge case. | **High** | `source_updated_at` on the translation + `translationStale` computed as `source.updatedAt > translation.sourceUpdatedAt` (never stored — one source of truth, the `docs/09` §2.3 pattern). Surfaced as a badge on `AdminPosts`/`AdminBooks` rows and in the Translations panel. Cleared **only** by the explicit `translation-reviewed` action, never as a side effect of saving (§3.3) — a stale badge that clears itself is worse than none. Deliberately **not** surfaced to public readers at Phase 1 (§11 question 5). |
| **R2** | **Access-control drift between variants** — the VI post is PRIVATE with a group grant, the EN one is left PUBLIC. A silent, complete bypass of the access model, produced by forgetting one checkbox. | **High** | §2.3: visibility + grants are group-level, propagated at write time through the five `AccessGroupService` methods that every write already funnels through (§2.4). `PUT /translation-link` copies the target's config. Admin detail returns each sibling's `visibility` so divergence is visible. **Acceptance test (non-negotiable): set VI to PRIVATE + group grant, assert a non-granted MEMBER gets `403 NO_ACCESS` on the EN slug.** |
| **R3** | **Machine-translation quality and liability on technical content.** A mistranslated `DROP` vs `TRUNCATE`, an inverted "must not", or a mangled code comment published under the author's name. | **High** | Never auto-publish — output is always DRAFT (§6.3). Never overwrite a PUBLISHED translation. Code/HTML/URL preservation pinned in the system prompt (§6.2). `translation_origin = MACHINE` recorded permanently so machine-assisted articles are identifiable after the fact. The review step is a human process, not a code path — say so in the admin confirmation copy rather than implying the tool guarantees quality. |
| **R4** | **`V4` migration under `ddl-auto: validate`.** Entity without migration ⇒ startup failure. `V1__baseline.sql` has still never been diffed against production. CI runs H2 with Flyway disabled, so a green `mvn test` proves nothing about this. | **High** | Entity + migration in the same commit, stated in the PR body. Apply `V4` to the dev Postgres by hand before merging. Confirm the current production deploy boots clean under `validate` *before* adding `V4` on top. Do not infer safety from CI. |
| **R5** | **hreflang done wrong is worse than not done.** Non-reciprocal links, a cross-language canonical, or alternates pointing at DRAFT/PRIVATE URLs will either merge the cluster incorrectly or de-index an entire language. | **High** | Self-inclusive, reciprocal alternates generated from **one** place (the sitemap) out of the **already filtered** PUBLISHED+PUBLIC set (§5.1). Canonical always self-referential (§5.2). A group of one emits no alternates at all. Validate the generated sitemap once with an external validator and once in Search Console. |
| **R6** | **`useSeo`'s `upsertLink` keys on `rel` alone**, so it can hold exactly one `<link rel="alternate">` and leaves the previous route's alternates in `<head>` after SPA navigation — silently asserting a wrong translation relationship on the next article. | Medium | Remove-then-append tagged `link[rel="alternate"][data-seo-alt]` elements (§5.2). Manual check: navigate post A → post B → confirm A's alternates are gone. Nothing in lint, typecheck, or build catches this. |
| **R7** | **Wrong default language on the back-fill.** `DEFAULT 'VI'` stamps the entire existing, already-indexed catalogue — potentially mislabelling every English article as Vietnamese in `hreflang` and `<html lang>`. | Medium | §1.5 / §11 question 2: confirm the existing corpus's language **before** running `V4`. If mixed, plan a per-row `UPDATE` in the same migration rather than fixing it later, once URLs are already advertising the wrong code. |
| **R8** | **Missing `UNIQUE(translation_group_id, language)`** ⇒ two Vietnamese posts in one group ⇒ an ambiguous switcher and a sitemap emitting two `hreflang="vi"` entries (which invalidates the cluster). | Medium | The unique index is in `V4` and is the single most important line in it. Test: linking a second VI post into a group with a VI post ⇒ `409 TRANSLATION_LANGUAGE_TAKEN`. |
| **R9** | **Dangling `translated_from_id`** after the source row is deleted — the column has no FK, on purpose (§1.3). | Low | Treat a dangling id as `NULL` ("this row is now the original"): `x-default` falls back to it and `translationStale` becomes `false`. One `Optional` in the service, one explicit test. No cleanup job, no cascade. |
| **R10** | **Slug collision between variants.** Slugs stay globally unique, so an admin naming both variants `postgres-tuning` hits the existing `409`. | Low | Already handled by the existing slug-conflict path; the Translations panel pre-fills a suggested distinct slug. Mentioned only so it isn't mistaken for a new failure. |
| **R11** | **Preference filtering hides content from its own author.** Admin's preference is `EN`, the home page shows nothing, and it reads as an outage. | Low | `All languages` is always one click away, the switcher is always visible in the header, and the language-aware empty state links straight to it (§4.5). |
| **R12** | **Synchronous LLM call holds a Tomcat thread for 30–90 s** and can time out mid-request. | Low | Same accepted trade as `VideoTranscoder`'s 300 s (`docs/03` §6), at single-admin scale. Hard timeout, nothing persisted on failure, elapsed-time UI, and an explicit "don't navigate away" warning. No queue — CLAUDE.md rule 7. |
| **R13** | **Response-shape creep.** `translations` on detail, `language` on listings, `bookLanguage` on highlight rows, `translationStale` on admin rows — the same DTO-width smell flagged as `bookCount`/`examCount`/`postCount` in `docs/08` §7.8 and `docs/09` H9. | Low | Flat fields only, no nested objects; `translations` on detail responses only (never listings), and `[]` on teasers. If a fifth consumer wants book fields on a list row, that is the trigger to do the counts/DTO refactor those docs already queued. |
| **R14** | **`PostService.delete()` is already incomplete** for comments/access-groups/series links (`docs/03` §4.2). | Low (unchanged) | This feature adds **no** new delete path — the group column has no FK (§1.3) and no new table exists. Recorded explicitly so the pre-existing gap is not attributed to this change, and so nobody adds an unnecessary cleanup call. |

---

## 9. Implementation plan

Backend first — every frontend task depends on a live endpoint. Each step
independently committable and test-green, same discipline as `docs/08` §9 and
`docs/09` §11.

Next free ticket numbers per `TASKS.md`: **`TASK-BE-016`**, **`TASK-FE-008`**,
**`TASK-BE-017`**, **`TASK-FE-009`**.

### Phase 1 — manual dual-language authoring (no machine translation)

#### `TASK-BE-016` — Dual-language content, backend

**BE-L1 — Migration + entities.** `V4__add_content_language.sql` (§1.5);
`common/ContentLanguage` (+ `bcp47()`, `displayName()`),
`common/TranslationOrigin`; six new fields on `Post` and `Book`;
`PostRepository`/`BookRepository` gain `findByTranslationGroupId`,
`findByTranslationGroupIdIn`, `existsByTranslationGroupIdAndLanguage`.
Set `translationGroupId = id` on create for standalone rows.
*Done when:* the app boots against the dev Postgres under `ddl-auto: validate`,
`V4` applies cleanly, no behaviour change.

**BE-L2 — Read-side DTOs and filtering.** `language` on `PostResponse`/
`BookResponse`; `translations` on detail responses only, `PUBLISHED`-filtered
for public callers, `[]` on teasers (built inside the existing factory split,
not at the call site). `language` query param on `GET /api/posts`,
`GET /api/books`, and `PostRepository.search`'s JPQL.

**BE-L3 — Access-group propagation.** The five `AccessGroupService` methods
(§2.4) become group-aware; visibility propagation in `PostService.create/update`
and `BookService.create/update`; the `AccessRequestService.create` duplicate
guard widened to the group. *Done when:* the R2 acceptance test passes —
PRIVATE + group grant on the VI row denies a non-granted MEMBER on the EN slug.

**BE-L4 — Admin surface.** `translationOfPostId`/`translationOfBookId` on
create; `PUT .../translation-link` (link + unlink, copying access config);
`POST .../translation-reviewed`; `language`, `translationStale`,
`translationOrigin`, and the full `translations` array on admin responses.

**BE-L5 — Sitemap hreflang.** `xhtml` namespace, group map built from the
already-filtered result set (no extra query), `appendUrl` alternates parameter,
`x-default`, group-of-one emits nothing (§5.1).

**BE-L6 — Feature interactions.** Related-posts language filter + sibling
exclusion (§7.1); `SERIES_LANGUAGE_MISMATCH` guard (§7.4); `bookLanguage` on
`MyBookHighlightResponse` and `language` on `/api/me/reading` rows (§7.3, §7.5);
`DataSeeder` VI/EN pair (§7.9).

**BE-L7 — Tests** (`mvn test`). Minimum matrix: create a linked variant → both
rows share a `translationGroupId`; a second row of the same language in one
group → `409`; `GET /api/posts?language=EN` excludes VI rows; detail
`translations` omits a DRAFT sibling for a public caller and includes it for an
admin; a teaser row has `translations == []`; **PRIVATE + group grant on VI
denies the EN slug for a non-granted MEMBER (R2)**; approving an `AccessRequest`
against the EN row grants the VI row; unlinking puts the row in a group of one
and both remain readable; deleting the VI row leaves the EN row intact with no
FK error (R9); a dangling `translated_from_id` is treated as `NULL`; sitemap
emits reciprocal self-inclusive alternates for a pair and **none** for a
singleton; sitemap never lists a DRAFT or PRIVATE sibling as an alternate;
adding an EN post to a VI series → `400`; related posts exclude the source's
siblings.

#### `TASK-FE-008` — Dual-language content, frontend

**FE-L1 — Types + API client.** `ContentLanguage`, `TranslationRef`; `language`
+ `translations` on `Post`/`Book` types; `language` param on the list calls;
three admin functions (link/unlink, mark-reviewed, create-linked).

**FE-L2 — Language preference + listing filters.** `contentLanguage.ts`
(`localStorage`, one-time `navigator.language` seed, `VI|EN|ALL`), a header
control beside the theme toggle, wired into the home list and `LibraryPage`.
**Language-aware empty state with a [Show all languages] action** (§4.5).

**FE-L3 — Detail switchers.** `PostDetail.tsx` and `BookDetailPage.tsx`; real
`<Link>` navigation; nothing rendered when no sibling exists; DRAFT siblings
visible to admins only. Explicitly **not** in `BookReaderPage`'s toolbar (§4.4).

**FE-L4 — SEO head.** `useSeo` gains `lang` + `alternates`;
`document.documentElement.lang`; `og:locale` / `og:locale:alternate`;
self-referential canonical preserved; **remove-then-append tagged alternate
links (R6)**; manual A→B navigation check.

**FE-L5 — Admin.** Translations panel in `PostForm.tsx` and `AdminBookForm.tsx`
(§4.7); language + stale badges on `AdminPosts.tsx`/`AdminBooks.tsx`; the
"applies to all language versions" note under the access panel.

**FE-L6 — Checks.** `npm run lint && npm run typecheck && npm run build`, plus a
manual pass: create a VI/EN pair, switch both ways, confirm the URL changes and
the back button works; set the preference to EN and confirm the home list
filters and the empty state offers "All"; view `/sitemap.xml` and check the
alternates; navigate post A → post B and confirm A's alternates are gone from
`<head>`; make one variant PRIVATE and confirm the other is gated too, from a
MEMBER account.

### Phase 2 — machine-assisted translation

#### `TASK-BE-017` — Machine translation, backend

**BE-T1 — Provider client.** `MachineTranslationService` (one class, no
interface), `blog.translation.*` config, `RestClient` call, JSON-envelope
request/response, hard timeout. Blank key ⇒ `503 TRANSLATION_NOT_CONFIGURED`.

**BE-T2 — Endpoint + rules.** `POST /api/admin/posts/{id}/machine-translate`;
DRAFT-only output; `overwrite` semantics; `translation_origin = MACHINE`;
`source_updated_at` stamped; input cap; the §6.4 error table. Books: the same
endpoint shape for TXT, **`400 TRANSLATION_NOT_SUPPORTED_FOR_FILE_TYPE` for
PDF** (§6.5).

**BE-T3 — Tests** with a stubbed provider: happy path creates a DRAFT sibling
with `MACHINE` origin and the source's access config; missing key → `503`;
provider failure → `502` and **nothing persisted**; oversized content → `400`;
PDF book → `400`; overwrite of a PUBLISHED sibling → `409`; a code fence in the
stub response round-trips unmodified.

#### `TASK-FE-009` — Machine translation, frontend

**FE-T1 —** "Machine translate" option in the Translations panel; confirmation
dialog stating the output is a draft that must be reviewed; elapsed-time
progress with a navigate-away warning; on success, navigate to the new draft's
edit form; distinct error states for 503 (button hidden entirely) / 400 (too
long) / 502 (failed, nothing saved). Checks: lint, typecheck, build, plus one
real translation of a post containing a code fence and a YouTube embed, verified
by eye.

### Docs

**DOC-L1** — `docs/04-api-contract.md` §13; `docs/03-architecture.md` §4.1
(Post fields), §4.2 (a paragraph on group-level access), and a new §4.5 on the
translation group; `TASKS.md` entries for the four tickets; `docs/01-prd.md` §6
(remove "Multilingual content" from Out of Scope — see §11 question 1);
`docs/06-project-memory.md` on completion.

### Sizing

Phase 1 is roughly **0.5× the Book Library Phase 1** and comparable to
highlights: no new tables, no new entities, no new dependency, no new
`SecurityConfig` matchers — six columns on two existing tables, four new admin
endpoints, and a set of small, wide-reaching touches (sitemap, related posts,
series guard, `useSeo`, two admin forms). The risk is concentrated in the two
places that are easy to half-do: **access propagation (R2)** and **hreflang
correctness (R5)**. Phase 2 is small in code (one service, one endpoint per
domain) and entirely dominated by prompt/quality iteration, which is not
engineering time.

---

## 10. Explicitly not doing (with reasons)

| Not doing | Why |
|---|---|
| **A third language** | The model supports it (add an enum value), but three things are sized for exactly two: `og:locale:alternate` is a single meta tag under `upsertMeta`'s key-on-property behaviour; the header switcher is a two-pill control; and the "Also available in: X" copy is singular. A third language is a real, if small, piece of work — not a free config change. Do not claim otherwise. |
| **UI chrome translation (i18n framework, message catalogs)** | Larger than the content feature itself (~40 components, a new dependency, a translation workflow for strings). Separate task. §4.6, §11 question 3. |
| **Language-prefixed URLs (`/en/posts/...`) and `UNIQUE(slug, language)`** | Would move every existing indexed URL and rewrite every slug lookup, for no reader-visible gain over distinct language-native slugs. §4.2. |
| **Automatic redirect by `Accept-Language` or by stored preference** | The reliable way to break hreflang, shared links, and crawlers. The preference filters listings only, never redirects. §4.3. |
| **Shared comment threads across a translation group** | Needs a group key + per-comment language + cross-language moderation. Different feature. §7.2. |
| **Translated `category` and `tags`** | `category` is a filter key and `tags` are an unqueryable comma-separated string. Translating either fragments a facet and breaks related-posts scoring across the group. §6.2. |
| **Translation-group support for `series`** | A second copy of this whole design for a module with a fraction of the content. A single-language guard covers the actual bug. §7.4. |
| **Bilingual exams** | Would need per-language variants of `Question`/`QuestionOption`/answers. Its own doc. §7.8. |
| **A UI for changing which language is "canonical"** | `translated_from_id` is set at creation and only affects `x-default`. Swapping it is a one-row DB edit in the rare case it matters. A form field for it would need explaining more than it would ever be used. |
| **Extra translation workflow states (`IN_REVIEW`, `NEEDS_UPDATE`, …)** | `DRAFT`/`PUBLISHED` plus a computed `translationStale` covers the real states. A workflow enum is process modelling for a one-person blog. |
| **Machine translation of PDF books** | Cannot reconstruct PDF layout; needs PDFBox, rejected three times. Upload a prepared translated PDF instead. §6.5. |
| **Chunked machine translation of long content** | Splitting Markdown without cutting a code fence or an HTML element is its own feature. Over the cap ⇒ an honest error. §6.4. |
| **Glossary / translation-memory management UI** | Term consistency belongs in the system prompt at this scale. A glossary CRUD screen for a two-language personal blog is unjustifiable. |
| **Merging cross-language reading progress or highlights** | The anchors are file-specific; there is no correspondence to merge. §1.1, §7.3, §7.5. |
| **A background job that reconciles access-config drift** | Write-time propagation plus a visible admin indicator is the right size. A reconciler is infrastructure for a problem the propagation prevents. §2.5. |
| **Books in the sitemap** | A pre-existing gap unrelated to language. If closed later, it needs the same alternate treatment. §5.1. |
| **Per-language cover images** | Already free — the cover image is a per-row column, so each variant can have its own. Listed only so nobody builds a mechanism for something the data model already gives away. |
| **A public "machine-assisted translation" disclaimer on articles** | The *data* (`translation_origin`) is captured so this can be added any time. Whether to show it is a product/voice decision, not an architecture one. §11 question 5. |

---

## 11. Confirm before coding

`docs/08` §7 and `docs/09` §10 both produced real answers that changed the plan.
This list is shorter, and the first two must be answered before **any** code —
one is a scope reversal, the other is baked into an irreversible-ish migration.

**Product decisions — outside this document's authority:**

1. **Do we actually want a second language now?** `docs/01-prd.md` §6 lists
   multilingual content as out of scope, and nothing since has revisited it.
   The real question is not technical: **maintaining two versions of every
   article is an ongoing authoring commitment**, and the failure mode is a
   half-translated site where English readers hit dead ends and stale copy
   (R1) — which is worse for the brand than being confidently monolingual. This
   design makes the mechanics cheap; it cannot make the writing cheap. If the
   answer is yes, `docs/01-prd.md` §6 must be edited in the same change.

2. **What language is the *existing* content?** `V4` back-fills every current
   post and book to a single value (§1.5, R7). If the catalogue is uniformly
   Vietnamese, `DEFAULT 'VI'` is right. If it is uniformly English, one
   character changes. If it is **mixed**, the migration needs a per-row `UPDATE`
   list and someone has to produce it. Getting this wrong publishes incorrect
   `hreflang` and `<html lang>` for content that is already indexed.

3. **Is English-only UI chrome acceptable?** A Vietnamese reader on a Vietnamese
   article will see English nav, buttons, and empty-state copy (§4.6). This is
   the most likely immediate complaint. If unacceptable, UI i18n is a separate,
   comparable-sized task that should be planned alongside rather than discovered
   after launch.

4. **Which pairing matters more: Vietnamese-original → English, or the
   reverse?** It decides the default `translated_from_id` direction, the
   `x-default` target, and — more practically — which language the machine-
   translation prompt should be tuned for. VI→EN and EN→VI are not equally easy
   for any engine, and the prompt's technical-term rules differ by direction.

5. **Should readers be told an article is a machine-assisted translation?**
   `translation_origin` captures the fact either way (§6.3). Showing it is
   honest and slightly lowers expectations; hiding it is cleaner-looking and
   normal practice. Author's call, not the architect's.

**Recorded assumptions — challenge them if wrong, but they do not block coding:**

6. **Exactly two languages, VI and EN** (§10 explains why a third is not free).
7. **Only ADMIN creates and links translations.** No translator role, no
   per-language editor permission. Consistent with every other write path in
   this app.
8. **Machine translation is a Post feature in practice.** TXT books work under a
   ~60k-character cap; PDF books never do (§6.5). If "translate my library" was
   part of the intent, that expectation needs correcting now, not at demo time.
9. **Comments, view counts, reading progress, and highlights are per language**
   (§7.2, §7.3, §7.5, §7.6). Each is defensible on its own; together they mean
   the two variants share only their access configuration and their identity.
10. **The switcher is absent, not disabled, when no translation exists** (§4.4).
    Readers are never shown a door to a room that does not exist.
