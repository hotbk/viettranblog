# Security Review — Initial Baseline

## Current MVP Risk

The backend exposes write APIs without authentication. This is acceptable only for local MVP development.

## Required Before Production

1. Add Spring Security
2. Add login for blog owner
3. Protect create/update/delete APIs
4. Restrict CORS to production frontend domain
5. Move all credentials to environment variables or secret manager
6. Add input sanitization if rendering HTML/Markdown content

## Current Controls

- `.claude/settings.json` denies reading/writing `.env` files
- API uses DTOs instead of binding request directly to entity
- CORS configured for localhost development
