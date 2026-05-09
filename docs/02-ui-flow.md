# UI Flow — Personal Blog

## 1. Public Home Page

Route:

```text
/
```

Sections:

1. Header
   - Blog name
   - Short tagline

2. Filter bar
   - Search input
   - Category dropdown

3. Post list
   - Post title
   - Excerpt
   - Category
   - Tags
   - Published date
   - Read more link/button

4. State handling
   - Loading: show loading text/skeleton
   - Empty: show “No posts found”
   - Error: show API error message and retry guidance

## 2. Post Detail Page

Route:

```text
/posts/:slug
```

Sections:

1. Back link
2. Title
3. Metadata: category, tags, published date
4. Content
5. Error state if post not found

## 3. Visual Direction

- Minimal, readable, content-first
- White background
- Strong typography
- Max content width around 900px
- Avoid heavy animation in MVP

## 4. Future Admin UI

Route planned:

```text
/admin/posts
/admin/posts/new
/admin/posts/:id/edit
```

Not included in MVP frontend unless explicitly requested.
