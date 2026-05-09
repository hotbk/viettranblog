# API Contract — Personal Blog

Base URL:

```text
http://localhost:8080/api
```

## 1. Health

### GET `/health`

Response:

```json
{
  "status": "ok"
}
```

## 2. List Posts

### GET `/posts`

Query parameters:

| Name | Type | Required | Description |
|---|---|---:|---|
| q | string | no | Search keyword |
| category | string | no | Filter by category |
| includeDrafts | boolean | no | Include draft posts; default false |

Response:

```json
[
  {
    "id": 1,
    "title": "First Post",
    "slug": "first-post",
    "excerpt": "Short intro",
    "content": "Full content",
    "category": "Technology",
    "tags": ["react", "spring"],
    "status": "PUBLISHED",
    "createdAt": "2026-05-09T00:00:00Z",
    "updatedAt": "2026-05-09T00:00:00Z",
    "publishedAt": "2026-05-09T00:00:00Z"
  }
]
```

## 3. Get Post By Slug

### GET `/posts/{slug}`

Response:

```json
{
  "id": 1,
  "title": "First Post",
  "slug": "first-post",
  "excerpt": "Short intro",
  "content": "Full content",
  "category": "Technology",
  "tags": ["react", "spring"],
  "status": "PUBLISHED",
  "createdAt": "2026-05-09T00:00:00Z",
  "updatedAt": "2026-05-09T00:00:00Z",
  "publishedAt": "2026-05-09T00:00:00Z"
}
```

## 4. Create Post

### POST `/posts`

Request:

```json
{
  "title": "First Post",
  "slug": "first-post",
  "excerpt": "Short intro",
  "content": "Full content",
  "category": "Technology",
  "tags": ["react", "spring"],
  "status": "PUBLISHED"
}
```

## 5. Update Post

### PUT `/posts/{id}`

Same request body as create.

## 6. Delete Post

### DELETE `/posts/{id}`

Response status:

```text
204 No Content
```
