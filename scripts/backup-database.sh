#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATABASE_URL="${DATABASE_URL:-}"
S3_BUCKET="${S3_BUCKET:-}"

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required; refusing to guess or use a fallback database." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to parse DATABASE_URL safely." >&2
  exit 1
fi

DB_NAME=$(DATABASE_URL="$DATABASE_URL" node -e '
  const url = new URL(process.env.DATABASE_URL);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name) process.exit(1);
  process.stdout.write(name);
')
SAFE_DB_NAME=$(printf "%s" "$DB_NAME" | tr -c '[:alnum:]_.-' '_')

checksum_file() {
  local file="$1"
  local dir
  local base
  dir=$(dirname "$file")
  base=$(basename "$file")
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$dir" && sha256sum "$base" > "$base.sha256")
  elif command -v shasum >/dev/null 2>&1; then
    (cd "$dir" && shasum -a 256 "$base" > "$base.sha256")
  else
    echo "A SHA-256 utility (sha256sum or shasum) is required." >&2
    exit 1
  fi
}

mkdir -p "$BACKUP_DIR"/{daily,weekly,monthly}

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
DAY_OF_WEEK=$(date '+%u')
DAY_OF_MONTH=$(date '+%d')
BACKUP_FILE="$BACKUP_DIR/daily/${SAFE_DB_NAME}_${TIMESTAMP}.sql"

echo "[$(date)] Starting backup of $DB_NAME"

if command -v pg_dump >/dev/null 2>&1; then
  pg_dump --no-owner --no-privileges "$DATABASE_URL" > "$BACKUP_FILE"
elif command -v docker >/dev/null 2>&1; then
  docker run --rm postgres:15 pg_dump --no-owner --no-privileges "$DATABASE_URL" > "$BACKUP_FILE"
else
  echo "Neither pg_dump nor Docker is available for database backup." >&2
  exit 1
fi

if [ ! -s "$BACKUP_FILE" ]; then
  echo "Database backup is empty; refusing to continue." >&2
  exit 1
fi

gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"
checksum_file "$BACKUP_FILE"

if [ -n "$S3_BUCKET" ]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "S3_BUCKET is configured but the AWS CLI is unavailable." >&2
    exit 1
  fi
  aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/backups/daily/"
  aws s3 cp "${BACKUP_FILE}.sha256" "s3://${S3_BUCKET}/backups/daily/"
fi

ln -sfn "$(basename "$BACKUP_FILE")" "$BACKUP_DIR/daily/latest.sql.gz"
ln -sfn "$(basename "$BACKUP_FILE").sha256" "$BACKUP_DIR/daily/latest.sql.gz.sha256"

if [ "$DAY_OF_WEEK" -eq 7 ]; then
  WEEKLY="$BACKUP_DIR/weekly/${SAFE_DB_NAME}_week_$(date '+%Y%m%d').sql.gz"
  cp "$BACKUP_FILE" "$WEEKLY"
  checksum_file "$WEEKLY"
fi

if [ "$DAY_OF_MONTH" = "01" ]; then
  MONTHLY="$BACKUP_DIR/monthly/${SAFE_DB_NAME}_month_$(date '+%Y%m').sql.gz"
  cp "$BACKUP_FILE" "$MONTHLY"
  checksum_file "$MONTHLY"
fi

echo "[$(date)] Backup completed with SHA-256 checksum: $BACKUP_FILE"
du -h "$BACKUP_FILE"
