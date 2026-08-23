#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@localhost:5432/appforge}"
BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file>"
  ls -lh "$BACKUP_DIR"/daily/*.sql* 2>/dev/null | tail -10
  exit 1
fi

[ ! -f "$BACKUP_FILE" ] && [ -f "$BACKUP_DIR/$BACKUP_FILE" ] && BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
[ ! -f "$BACKUP_FILE" ] && echo "Backup file not found: $BACKUP_FILE" && exit 1

DB_NAME=$(echo "$DATABASE_URL" | grep -oP '(?<=/)[^?]+')

echo "[$(date)] Restoring from: $BACKUP_FILE"
read -p "WARNING: This will DROP and RECREATE the database: $DB_NAME. Continue? (yes/no): " confirm
[ "$confirm" != "yes" ] && echo "Restore cancelled." && exit 0

RESTORE_FILE="$BACKUP_FILE"
[[ "$BACKUP_FILE" == *.gz ]] && RESTORE_FILE="/tmp/restore_$(basename "$BACKUP_FILE" .gz)" && gunzip -c "$BACKUP_FILE" > "$RESTORE_FILE"

psql "$DATABASE_URL" -c "DROP DATABASE IF EXISTS ${DB_NAME}_restore;"
psql "$DATABASE_URL" -c "CREATE DATABASE ${DB_NAME}_restore;"
psql "${DATABASE_URL/$DB_NAME/${DB_NAME}_restore}" -f "$RESTORE_FILE"

[ "$RESTORE_FILE" != "$BACKUP_FILE" ] && rm -f "$RESTORE_FILE"

echo "[$(date)] Database restored to: ${DB_NAME}_restore"
echo "To replace original: ALTER DATABASE $DB_NAME RENAME TO ${DB_NAME}_old; ALTER DATABASE ${DB_NAME}_restore RENAME TO $DB_NAME;"
