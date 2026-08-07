#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@localhost:5432/appforge}"
S3_BUCKET="${S3_BUCKET:-}"

mkdir -p "$BACKUP_DIR"/{daily,weekly,monthly}

DB_NAME=$(echo "$DATABASE_URL" | grep -oP '(?<=/)[^?]+')
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
DAY_OF_WEEK=$(date '+%u')
DAY_OF_MONTH=$(date '+%d')

BACKUP_FILE="$BACKUP_DIR/daily/${DB_NAME}_${TIMESTAMP}.sql"

echo "[$(date)] Starting backup of $DB_NAME"

if command -v pg_dump &> /dev/null; then
  pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
else
  docker run --rm postgres:15 pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
fi

gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
  aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/backups/daily/"
fi

ln -sf "$BACKUP_FILE" "$BACKUP_DIR/daily/latest.sql.gz"

[ "$DAY_OF_WEEK" -eq 7 ] && cp "$BACKUP_FILE" "$BACKUP_DIR/weekly/${DB_NAME}_week_$(date '+%Y%m%d').sql.gz"
[ "$DAY_OF_MONTH" -eq "01" ] && cp "$BACKUP_FILE" "$BACKUP_DIR/monthly/${DB_NAME}_month_$(date '+%Y%m').sql.gz"

echo "[$(date)] Backup completed: $BACKUP_FILE"
du -h "$BACKUP_FILE"
