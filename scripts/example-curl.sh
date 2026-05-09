#!/usr/bin/env bash
set -euo pipefail

curl http://localhost:8080/api/health

echo
curl http://localhost:8080/api/posts

echo
curl -X POST http://localhost:8080/api/posts \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "New Blog Post",
    "slug": "new-blog-post",
    "excerpt": "Short introduction",
    "content": "Full content goes here",
    "category": "Technology",
    "tags": ["react", "spring"],
    "status": "PUBLISHED"
  }'
