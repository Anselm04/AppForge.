#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATABASE_URL="${DATABASE_URL:-}"

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required; refusing to guess or use a fallback database." >&2
  exit 1
fi

for cmd in node psql; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd is required for database backup verification." >&2
    exit 1
  fi
done

LATEST_BACKUP=$(find "$BACKUP_DIR/daily" -maxdepth 1 -type f \( -name '*.sql' -o -name '*.sql.gz' -o -name '*.sql.bz2' \) -print 2>/dev/null | xargs -r ls -t | head -1)
if [ -z "$LATEST_BACKUP" ]; then
  echo "No database backups found." >&2
  exit 1
fi

CHECKSUM_FILE="${LATEST_BACKUP}.sha256"
if [ ! -r "$CHECKSUM_FILE" ]; then
  echo "Backup checksum missing: $CHECKSUM_FILE" >&2
  exit 1
fi

verify_checksum() {
  local file="$1"
  local dir
  local base
  dir=$(dirname "$file")
  base=$(basename "$file")
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$dir" && sha256sum -c "$base.sha256")
  elif command -v shasum >/dev/null 2>&1; then
    local expected actual
    expected=$(awk '{print $1}' "$file.sha256")
    actual=$(shasum -a 256 "$file" | awk '{print $1}')
    [ "$expected" = "$actual" ]
  else
    echo "A SHA-256 utility (sha256sum or shasum) is required." >&2
    exit 1
  fi
}

verify_checksum "$LATEST_BACKUP"

BACKUP_SIZE=$(stat -c%s "$LATEST_BACKUP" 2>/dev/null || stat -f%z "$LATEST_BACKUP")
if [ "$BACKUP_SIZE" -lt 100 ]; then
  echo "Backup file is too small to be credible: $BACKUP_SIZE bytes" >&2
  exit 1
fi

RESTORE_FILE="$LATEST_BACKUP"
TEMP_FILE=""
case "$LATEST_BACKUP" in
  *.gz)
    TEMP_FILE=$(mktemp /tmp/appforge-db-verify.XXXXXX.sql)
    gunzip -c "$LATEST_BACKUP" > "$TEMP_FILE"
    RESTORE_FILE="$TEMP_FILE"
    ;;
  *.bz2)
    TEMP_FILE=$(mktemp /tmp/appforge-db-verify.XXXXXX.sql)
    bunzip2 -c "$LATEST_BACKUP" > "$TEMP_FILE"
    RESTORE_FILE="$TEMP_FILE"
    ;;
esac

TEST_DB="appforge_verify_$(date +%s)_$$"
TEST_DATABASE_URL=$(DATABASE_URL="$DATABASE_URL" TARGET_DB="$TEST_DB" node -e '
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/" + process.env.TARGET_DB;
  process.stdout.write(url.toString());
')

cleanup() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$TEST_DB\";" >/dev/null 2>&1 || true
  if [ -n "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
  fi
}
trap cleanup EXIT

echo "[$(date)] Restoring verified backup into disposable database $TEST_DB"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$TEST_DB\";" >/dev/null
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$RESTORE_FILE" >/dev/null

TABLE_COUNT=$(psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d '[:space:]')
if ! [[ "$TABLE_COUNT" =~ ^[0-9]+$ ]] || [ "$TABLE_COUNT" -lt 1 ]; then
  echo "Restored backup contains no public tables." >&2
  exit 1
fi

if [ -f package.json ] && grep -q '"db:migrate"' package.json; then
  echo "[$(date)] Applying authoritative migration chain to restored backup"
  DATABASE_URL="$TEST_DATABASE_URL" npm run db:migrate >/dev/null
fi

MIGRATION_LEDGER=$(psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT to_regclass('public.appforge_schema_migrations') IS NOT NULL;" | tr -d '[:space:]')
if [ "$MIGRATION_LEDGER" != "t" ]; then
  echo "Restored database did not produce the AppForge migration ledger." >&2
  exit 1
fi

echo "[$(date)] Database backup verification passed: $TABLE_COUNT public tables restored and migrations verified."
