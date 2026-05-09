---
name: review-pr
description: Review the current branch before opening or merging a pull request.
---

Review the current changes.

Checklist:

1. Read `CLAUDE.md` and `TASKS.md`.
2. Inspect git diff.
3. Check whether the implementation matches the assigned task.
4. Check for unnecessary file changes.
5. Check frontend/backend contract consistency.
6. Check whether tests were added or updated.
7. Check whether docs need updates.
8. Check security risks.

Output:
- Summary
- Blocking issues
- Non-blocking issues
- Test commands to run
- Merge recommendation
