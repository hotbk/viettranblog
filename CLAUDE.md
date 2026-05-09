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
- Long-term project memory in `docs/06-project-memory.md`

## Token Saving Rules

- Read only the files needed for the current task. Do not scan the whole repository unless the task requires cross-project context.
- Start with the files explicitly named by the user, then inspect only direct imports, tests, or documentation that are necessary.
- Keep responses short and practical: summarize the cause, changed files, and verification steps.
- Do not paste long file contents, logs, or generated code in the response unless the user asks for them.
- For large tasks, split work into small steps and confirm the next target instead of loading many unrelated files at once.
- Prefer concise diffs and focused edits over broad rewrites.
- When a task only affects frontend, backend, docs, or DevOps, stay inside that area unless an integration point must be checked.

## Long-Term Memory Rules

- Before starting a task, read `docs/06-project-memory.md` to understand what has already been completed, decided, or intentionally deferred.
- After completing a meaningful change, update `docs/06-project-memory.md` with:
  - date
  - summary of what changed
  - files or areas touched
  - tests or checks run
  - decisions made
  - follow-up tasks or known gaps
- Do not repeat work already marked as completed in project memory unless the user explicitly asks to revisit it.
- If project memory conflicts with current code, trust the current code and update the memory with the corrected state.
- Keep memory entries concise. Record durable facts and decisions, not full logs or long explanations.

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
