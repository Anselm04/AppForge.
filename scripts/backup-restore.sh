#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATABASE_URL="${DATABASE_URL:-}"
BACKUP_FILE="${1:-}"

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required; refusing to guess or use a fallback database." >&2
  exit 1
fi

for cmd in node psql; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd is required for database restore." >&2
    exit 1
  fi
done

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file>"
  find "$BACKUP_DIR/daily" -maxdepth 1 -type f \( -name '*.sql' -o -name '*.sql.gz' -o -name '*.sql.bz2' \) -print 2>/dev/null | tail -10
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ] && [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
  BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
fi
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ ! -r "$CHECKSUM_FILE" ]; then
  echo "Backup checksum missing: $CHECKSUM_FILE" >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$(dirname "$BACKUP_FILE")" && sha256sum -c "$(basename "$BACKUP_FILE").sha256")
elif command -v shasum >/dev/null 2>&1; then
  expected=$(awk '{print $1}' "$CHECKSUM_FILE")
  actual=$(shasum -a 256 "$BACKUP_FILE" | awk '{print $1}')
  if [ "$expected" != "$actual" ]; then
    echo "Backup checksum verification failed." >&2
    exit 1
  fi
else
  echo "A SHA-256 utility (sha256sum or shasum) is required." >&2
  exit 1
fi

DB_NAME=$(DATABASE_URL="$DATABASE_URL" node -e '
  const url = new URL(process.env.DATABASE_URL);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name) process.exit(1);
  process.stdout.write(name);
')
RESTORE_DB="${DB_NAME}_restore"
RESTORE_DATABASE_URL=$(DATABASE_URL="$DATABASE_URL" TARGET_DB="$RESTORE_DB" node -e '
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/" + process.env.TARGET_DB;
  process.stdout.write(url.toString());
')

echo "[$(date)] Verified backup: $BACKUP_FILE"
echo "This restores into a separate database named $RESTORE_DB; it does not overwrite $DB_NAME."
read -r -p "Continue with isolated restore? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

RESTORE_FILE="$BACKUP_FILE"
TEMP_FILE=""
case "$BACKUP_FILE" in
  *.gz)
    TEMP_FILE=$(mktemp /tmp/appforge-db-restore.XXXXXX.sql)
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    RESTORE_FILE="$TEMP_FILE"
    ;;
  *.bz2)
    TEMP_FILE=$(mktemp /tmp/appforge-db-restore.XXXXXX.sql)
    bunzip2 -c "$BACKUP_FILE" > "$TEMP_FILE"
    RESTORE_FILE="$TEMP_FILE"
    ;;
esac

cleanup() {
  if [ -n "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
  fi
}
trap cleanup EXIT

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$RESTORE_DB\";"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$RESTORE_DB\";"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$RESTORE_FILE"

if [ -f package.json ] && grep -q '"db:migrate"' package.json; then
  echo "[$(date)] Applying authoritative migration chain to restored database"
  DATABASE_URL="$RESTORE_DATABASE_URL" npm run db:migrate
fi

TABLE_COUNT=$(psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d '[:space:]')
if ! [[ "$TABLE_COUNT" =~ ^[0-9]+$ ]] || [ "$TABLE_COUNT" -lt 1 ]; then
  echo "Restore verification failed: no public tables found." >&2
  exit 1
fi

echo "[$(date)] Database restored and migrated successfully to: $RESTORE_DB"
echo "Public tables restored: $TABLE_COUNT"
echo "Do not promote this database until readiness, integrity, billing/auth boundary, and customer-flow checks pass."
