---
name: build-feature
description: Standard workflow to build a blog feature from task definition to tested implementation.
---

Build the feature described in: $ARGUMENTS

Workflow:

1. Read:
   - `CLAUDE.md`
   - `docs/01-prd.md`
   - `docs/02-ui-flow.md`
   - `docs/03-architecture.md`
   - `docs/04-api-contract.md`
   - `TASKS.md`

2. Confirm scope:
   - frontend files
   - backend files
   - database changes
   - tests
   - documentation

3. Implement only the assigned task.

4. Run relevant checks:

Frontend:

```bash
cd frontend && npm run lint && npm run typecheck && npm run build
```

Backend:

```bash
cd backend && mvn test
```

5. Final response must include:
   - files changed
   - commands run
   - result
   - risks or gaps
