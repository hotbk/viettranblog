#!/usr/bin/env bash
set -euo pipefail

docker compose up -d postgres

echo "PostgreSQL is starting on localhost:5432"
echo "Run backend: cd backend && mvn spring-boot:run"
echo "Run frontend: cd frontend && npm install && npm run dev"
