# Product Requirement Document — Personal Blog

## 1. Objective

Build a personal blog website where the owner can publish articles on different topics such as technology, data engineering, management, personal notes, and learning journals.

The MVP focuses on clean content publishing and reading experience. Administration, authentication, and advanced SEO are planned for later phases.

## 2. Target Users

### Public reader

Can:
- browse published posts
- search posts by keyword
- filter posts by category
- read full article content

### Blog owner

For MVP, the blog owner uses backend APIs to create/update/delete posts. A dedicated admin UI will be added later.

## 3. MVP Features

### Public blog home

- Display list of published posts
- Show title, excerpt, category, tags, published date
- Search by keyword
- Filter by category
- Open post detail by slug

### Post detail

- Display title, category, tags, published date
- Display content
- Back to home

### Backend post management API

- Create post
- Update post
- Delete post
- List posts
- Get post by slug

## 4. Post Status

- `DRAFT`: not visible on public blog by default
- `PUBLISHED`: visible on public blog

## 5. Acceptance Criteria

- Public home only shows published posts by default
- Search returns matching posts by title, excerpt, or content
- Category filter returns posts in selected category
- Detail page returns 404-like error when slug does not exist
- Backend validates required fields: title, slug, content, status
- Frontend handles loading, empty, and error states

## 6. Out of Scope for MVP

This list is the original MVP-era scope line. Several items below have since
shipped in Phase 2 (see `docs/06-project-memory.md`) — left here as the
historical record of what MVP itself excluded, not a current backlog.

- Login/admin dashboard — shipped
- Rich markdown editor — shipped
- Image upload — shipped
- Comment system — shipped
- Newsletter — still out of scope
- Full SEO automation — partially shipped (sitemap; see `docs/03-architecture.md` §6)
- ~~Multilingual content~~ — reversed 2026-08-10: now in scope, design in
  `docs/10-multilingual-content.md`, tracked as `TASK-BE-016`/`TASK-FE-008`
  (Phase 1) and `TASK-BE-017`/`TASK-FE-009` (Phase 2) in `TASKS.md`.

## 7. Assumptions

- Single author in MVP
- PostgreSQL is the main database
- API is open during MVP local development
- Production deployment will add authentication and authorization before public write access
