# CLAUDE.md

This repository is a personal blog web application using React and Spring Boot.

## Stack

Frontend:
- React
- TypeScript
- Vite
- CSS modules/plain CSS at MVP stage

Backend:
- Java 21
- Spring Boot
- Spring Web
- Spring Data JPA
- PostgreSQL

AI workflow:
- Claude Code subagents in `.claude/agents`
- Project instructions in this file
- Task breakdown in `TASKS.md`
- Documents in `docs/`

## Product Scope

The application is a personal blog for publishing articles on multiple topics.

Core domain entities:
- Post
- Category
- Tag
- Author, later phase

Initial post fields:
- id
- title
- slug
- excerpt
- content
- category
- tags
- status: DRAFT or PUBLISHED
- createdAt
- updatedAt
- publishedAt

## Non-negotiable Engineering Rules

1. Do not implement before reading:
   - `docs/01-prd.md`
   - `docs/03-architecture.md`
   - `TASKS.md`

2. Do not change backend API behavior without updating:
   - `docs/04-api-contract.md`
   - frontend API client
   - tests

3. Do not change database schema without updating:
   - JPA entity
   - migration plan or schema note
   - API DTOs
   - tests

4. Do not store secrets in the repository.

5. Do not modify `.env`, `.env.*`, private keys, tokens, or credentials.

6. Every feature must include:
   - success state
   - loading state
   - error state
   - empty state if list-based
   - basic test or test note

7. Keep the MVP simple. Do not over-engineer with microservices, queues, Kubernetes, or unnecessary abstractions.

## Commands

Frontend:

```bash
cd frontend
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
```

Backend:

```bash
cd backend
mvn spring-boot:run
mvn test
```

Database:

```bash
docker compose up -d postgres
```

## Branching Rule

Use short feature branches:

```text
feature/<task-id>-<short-name>
```

Example:

```text
feature/TASK-FE-001-post-list
```

## Pull Request Rule

Every PR must include:

- What changed
- Why it changed
- Files changed
- Tests run
- Screenshots if UI changed
- Risk and rollback note

## AI Agent Boundaries

- Product Agent writes requirements, not code.
- UX Agent designs screen flow, not production code.
- Architect Agent designs technical structure, not production code unless explicitly asked.
- Frontend Agent modifies frontend only.
- Backend Agent modifies backend only.
- QA Agent writes/runs tests; does not rewrite production logic unless asked.
- Security Agent reviews and reports; does not directly patch unless asked.
- DevOps Agent modifies Docker, CI/CD, environment templates, and deployment docs.
