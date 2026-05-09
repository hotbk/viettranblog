# TASKS.md

## Phase 1 — MVP Blog

### TASK-PD-001 — Product requirement baseline

Owner agent: `product-agent`

Output:
- `docs/01-prd.md`

Acceptance criteria:
- Defines target user
- Defines blog use cases
- Defines MVP and out of scope
- Defines acceptance criteria

---

### TASK-UX-001 — UI flow baseline

Owner agent: `ux-agent`

Output:
- `docs/02-ui-flow.md`

Acceptance criteria:
- Defines public home page
- Defines post detail page
- Defines search/filter behavior
- Defines empty/loading/error states

---

### TASK-ARCH-001 — Technical architecture baseline

Owner agent: `architect-agent`

Output:
- `docs/03-architecture.md`
- `docs/04-api-contract.md`

Acceptance criteria:
- Defines frontend/backend boundaries
- Defines Post data model
- Defines API contract
- Defines error handling

---

### TASK-BE-001 — Implement post CRUD API

Owner agent: `backend-agent`

Files likely affected:
- `backend/src/main/java/com/example/blog/post/*`
- `backend/src/main/resources/application.yml`

Acceptance criteria:
- `GET /api/posts` returns published posts by default
- `GET /api/posts/{slug}` returns one published post
- `POST /api/posts` creates a post
- `PUT /api/posts/{id}` updates a post
- `DELETE /api/posts/{id}` deletes a post
- API returns clear error responses

Test command:

```bash
cd backend && mvn test
```

---

### TASK-FE-001 — Implement public blog UI

Owner agent: `frontend-agent`

Files likely affected:
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `frontend/src/components/*`
- `frontend/src/styles.css`

Acceptance criteria:
- Home page displays post list
- Search input filters posts through API query
- Category filter works
- Post detail page opens by slug
- UI handles loading, empty, and error states

Test command:

```bash
cd frontend && npm run lint && npm run typecheck && npm run build
```

---

### TASK-QA-001 — MVP verification

Owner agent: `qa-agent`

Output:
- `docs/05-test-plan.md`

Acceptance criteria:
- Test plan maps to PRD acceptance criteria
- API test cases listed
- Frontend test cases listed
- Known gaps listed

---

### TASK-SEC-001 — Security review

Owner agent: `security-agent`

Output:
- `docs/security-review.md`

Acceptance criteria:
- Checks CORS
- Checks mass assignment risk
- Checks unauthenticated write APIs and flags as MVP limitation
- Checks secret handling
- Checks input validation

---

### TASK-DEVOPS-001 — CI and local dev flow

Owner agent: `devops-agent`

Files likely affected:
- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `README.md`

Acceptance criteria:
- PostgreSQL starts locally
- Frontend CI command documented
- Backend CI command documented
- No secrets committed
