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

- Login/admin dashboard
- Rich markdown editor
- Image upload
- Comment system
- Newsletter
- Full SEO automation
- Multilingual content

## 7. Assumptions

- Single author in MVP
- PostgreSQL is the main database
- API is open during MVP local development
- Production deployment will add authentication and authorization before public write access
