#!/usr/bin/env bash
set -euo pipefail

# scripts/backup-postgres.sh
#
# Simple pg_dump backup for the VietTranBlog PostgreSQL database.
# Matches this repo's MVP philosophy (see CLAUDE.md): plain pg_dump + file
# rotation, no external backup service / agent required.
#
# Works against the `personal-blog-postgres` container regardless of how it
# was started (docker compose, per docker-compose.yml, in dev; or a plain
# `docker run`/separately-managed container in production — see
# docs/07-deployment-guide.md section 4.0), since it only relies on
# `docker exec` + the container name.
#
# Usage:
#   ./scripts/backup-postgres.sh
#
# Env var overrides (all optional):
#   CONTAINER_NAME   Docker container running Postgres (default: personal-blog-postgres)
#   DB_NAME          Database name (default: personal_blog)
#   DB_USER          Database user (default: blog_user)
#   BACKUP_DIR       Where dumps are written (default: <repo-root>/backups)
#   RETENTION_DAYS   Delete dumps older than this many days (default: 14)
#
# Output format: pg_dump custom format (`-Fc`) — compressed by default and
# restorable/inspectable with pg_restore (see restore commands below and in
# docs/07-deployment-guide.md section 5.3).
#
# Restore example:
#   docker exec -i personal-blog-postgres pg_restore \
#     -U blog_user -d personal_blog --clean --if-exists \
#     < backups/personal_blog-20260810-021500.dump
#
# Sanity-check a backup file without restoring it (confirms the archive
# isn't corrupt/truncated; NOT a full restore drill):
#   docker exec -i personal-blog-postgres pg_restore --list \
#     < backups/personal_blog-20260810-021500.dump

CONTAINER_NAME="${CONTAINER_NAME:-personal-blog-postgres}"
DB_NAME="${DB_NAME:-personal_blog}"
DB_USER="${DB_USER:-blog_user}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/personal_blog-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "[backup-postgres] Dumping '${DB_NAME}' from container '${CONTAINER_NAME}' -> ${BACKUP_FILE}"

docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$BACKUP_FILE"

if [ ! -s "$BACKUP_FILE" ]; then
  echo "[backup-postgres] ERROR: backup file is empty, dump likely failed" >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi

echo "[backup-postgres] Backup written: ${BACKUP_FILE} ($(du -h "$BACKUP_FILE" | cut -f1))"

echo "[backup-postgres] Pruning backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}"
find "$BACKUP_DIR" -maxdepth 1 -name 'personal_blog-*.dump' -type f -mtime "+${RETENTION_DAYS}" -print -delete

echo "[backup-postgres] Done."
