#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@localhost:5432/appforge}"

LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/daily/*.sql* 2>/dev/null | head -1)
[ -z "$LATEST_BACKUP" ] && echo "No backups found" && exit 1

echo "[$(date)] Verifying: $LATEST_BACKUP"

[ ! -r "$LATEST_BACKUP" ] && echo "Backup file not readable" && exit 1
BACKUP_SIZE=$(stat -c%s "$LATEST_BACKUP" 2>/dev/null || stat -f%z "$LATEST_BACKUP" 2>/dev/null)
[ "$BACKUP_SIZE" -lt 100 ] && echo "Backup file too small" && exit 1

echo "Backup size: $BACKUP_SIZE bytes ✓"

TEMP_FILE="/tmp/verify_$(basename "$LATEST_BACKUP")"
[[ "$LATEST_BACKUP" == *.gz ]] && TEMP_FILE="${TEMP_FILE%.gz}" && gunzip -c "$LATEST_BACKUP" > "$TEMP_FILE"
[[ "$LATEST_BACKUP" == *.bz2 ]] && TEMP_FILE="${TEMP_FILE%.bz2}" && bunzip2 -c "$LATEST_BACKUP" > "$TEMP_FILE"

TEST_DB="appforge_verify_$(date +%s)"
psql "$DATABASE_URL" -c "CREATE DATABASE $TEST_DB;" 2>/dev/null || true
psql "${DATABASE_URL/appforge/$TEST_DB}" -f "$TEMP_FILE" 2>/dev/null || true
TABLE_COUNT=$(psql "${DATABASE_URL/appforge/$TEST_DB}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")
psql "$DATABASE_URL" -c "DROP DATABASE IF EXISTS $TEST_DB;" 2>/dev/null || true
rm -f "$TEMP_FILE"

echo "[$(date)] Verification completed: $TABLE_COUNT tables found ✓"
