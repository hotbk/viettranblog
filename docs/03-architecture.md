# Architecture — Personal Blog

## 1. Overview

The system is a classic web application:

```text
React Frontend → Spring Boot REST API → PostgreSQL
```

The frontend is responsible for rendering public blog pages. The backend is responsible for post persistence, filtering, validation, and API error handling.

## 2. Frontend

Technology:
- React
- TypeScript
- Vite

Main modules:
- `api.ts`: API client
- `types.ts`: shared frontend types
- `components/PostList.tsx`
- `components/PostDetail.tsx`

## 3. Backend

Technology:
- Java 21
- Spring Boot
- Spring Web
- Spring Data JPA
- PostgreSQL

Main modules:

```text
com.example.blog
├── BlogApplication
├── common
├── post
└── health
```

## 4. Data Model

### Post

Fields:

- id: Long
- title: String
- slug: String, unique
- excerpt: String
- content: String
- category: String
- tags: String, comma-separated at MVP stage
- status: enum DRAFT/PUBLISHED
- createdAt: Instant
- updatedAt: Instant
- publishedAt: Instant

## 5. Error Handling

Backend returns structured error response:

```json
{
  "message": "Post not found",
  "code": "POST_NOT_FOUND"
}
```

## 6. Security Notes

MVP does not include authentication. Therefore:

- Public read APIs are acceptable
- Write APIs must not be deployed publicly without authentication
- Future phase must add Spring Security before production exposure

## 7. Deployment Direction

MVP local:

```text
Docker PostgreSQL + local backend + local frontend
```

Future production:

```text
Frontend: Vercel/Netlify/Nginx
Backend: VM/Container/Fly.io/Render/Railway
Database: Managed PostgreSQL
```
