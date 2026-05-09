# Test Plan — MVP Blog

## Backend

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

## Frontend

- Home page loads posts
- Loading state appears before API returns
- Empty state appears when no posts match
- Error state appears when API fails
- Search input calls API with q parameter
- Category dropdown calls API with category parameter
- Clicking a post opens detail page

## Security

- Write APIs are unauthenticated in MVP and must be blocked before production
- CORS is limited to local frontend during development
- No secrets committed
