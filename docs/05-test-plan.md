# Test Plan — MVP Blog

## Backend

### Post endpoints
- Health endpoint returns ok
- List posts returns only published posts by default
- List posts can include drafts when requested
- Search works by keyword
- Category filter works
- Get post by slug returns correct post
- Missing slug returns structured error
- Create post validates required fields
- Update post changes data
- Delete post removes data

### View count (added 2026-05-12)
- POST /api/posts/{slug}/view returns 204 for a PUBLISHED post
- POST /api/posts/{slug}/view is public (no token required)
- POST /api/posts/{slug}/view does NOT increment count when post is DRAFT (WHERE status = PUBLISHED guard)
- POST /api/posts/{slug}/view for unknown slug returns 204 (no-op; repository UPDATE affects 0 rows — acceptable)
- GET /api/posts and GET /api/posts/{slug} include viewCount in response body
- viewCount starts at 0 for newly created posts
- viewCount in PostResponse reflects updated value after increment

### Series endpoints (added 2026-05-12)
- GET /api/series returns only PUBLISHED series
- GET /api/series/{slug} returns series with ordered posts
- GET /api/series/{slug} returns 404 for unknown slug
- GET /api/admin/series requires authentication (401 if no token)
- GET /api/admin/series returns all series regardless of status
- GET /api/admin/series/{id} returns series by id
- POST /api/admin/series creates series, returns 201
- POST /api/admin/series returns 400 when slug already exists
- POST /api/admin/series returns 400 when title or slug is blank
- PUT /api/admin/series/{id} updates title, slug, description, status
- PUT /api/admin/series/{id} returns 400 when new slug collides with another series
- PUT /api/admin/series/{id}/posts replaces post ordering atomically
- DELETE /api/admin/series/{id} removes series_posts rows then series row (cascade)
- DELETE /api/admin/series/{id} returns 404 for unknown id
- DELETE /api/admin/series/{id} does not delete the posts themselves

## Frontend

### Post pages
- Home page loads posts
- Loading state appears before API returns
- Empty state appears when no posts match
- Error state appears when API fails
- Search input calls API with q parameter
- Category dropdown calls API with category parameter
- Clicking a post opens detail page

### View count — frontend (added 2026-05-12)
- PostCard renders post.viewCount.toLocaleString() + " views" in card footer
- PostDetail shows post.viewCount.toLocaleString() + " views" in category row
- AdminPosts table includes a Views column showing post.viewCount.toLocaleString()
- recordPostView() is called after successful fetch in PostDetail; not awaited (fire-and-forget)
- recordPostView() swallows fetch errors (no throw, no user-visible message)
- viewCount field is absent from PostForm (not editable by admin)
- PostDetail still handles loading, error, and not-found states correctly when view count is present

### Series pages (added 2026-05-12)
- /series shows loading spinner while fetching
- /series shows empty state when no published series exist
- /series shows error state when API fails
- /series renders a card grid with title, post count, and description
- /series/:slug shows loading spinner while fetching
- /series/:slug shows error/not-found state for bad slug
- /series/:slug renders ordered post list with position numbers
- /series/:slug: published posts are clickable links; draft posts show "Unpublished" badge
- /admin/series redirects to /admin/login when session is expired (UnauthorizedError)
- /admin/series shows loading, empty, error, and list states
- /admin/series delete triggers confirmation dialog; optimistically removes row on success
- /admin/series/new renders blank form with auto-slugify from title
- /admin/series/:id/edit loads existing data including ordered post list
- AdminSeriesForm: add post dropdown excludes already-added posts
- AdminSeriesForm: move up / move down reorders list and updates position numbers
- AdminSeriesForm: remove post removes from ordered list
- AdminSeriesForm: saving redirects to /admin/series on success
- AdminSeriesForm: shows error message when save fails
- AdminSeriesForm: UnauthorizedError during save redirects to /admin/login

## Route coverage
- / — public home
- /posts/:slug — public post detail
- /series — public series list
- /series/:slug — public series detail
- /admin/login — login page
- /admin/posts — protected
- /admin/series — protected
- /admin/series/new — protected
- /admin/series/:id/edit — protected

## Security
- Write APIs require ADMIN or EDITOR role; unauthenticated requests get 401
- All /api/admin/** routes require ADMIN role
- /api/series and /api/series/** GET endpoints are public (no token needed)
- POST /api/posts/*/view is public (no token required)
- CORS is limited to localhost and configured origin patterns
- No secrets committed to repository
