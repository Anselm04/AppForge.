#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
RETENTION_WEEKS="${RETENTION_WEEKS:-4}"
RETENTION_MONTHS="${RETENTION_MONTHS:-12}"

echo "[$(date)] Starting backup cleanup..."
echo "Retention: $RETENTION_DAYS days, $RETENTION_WEEKS weeks, $RETENTION_MONTHS months"

DELETED_DAILY=0
while IFS= read -r file; do
  [ -n "$file" ] && rm -f "$file" && ((DELETED_DAILY++)) && echo "Deleted: $file"
done < <(find "$BACKUP_DIR/daily" -name "*.sql*" -type f -mtime +"$RETENTION_DAYS" 2>/dev/null)

DELETED_WEEKLY=0
WEEKS_DAYS=$((RETENTION_WEEKS * 7))
while IFS= read -r file; do
  [ -n "$file" ] && rm -f "$file" && ((DELETED_WEEKLY++)) && echo "Deleted: $file"
done < <(find "$BACKUP_DIR/weekly" -name "*.sql*" -type f -mtime +"$WEEKS_DAYS" 2>/dev/null)

DELETED_MONTHLY=0
MONTHS_DAYS=$((RETENTION_MONTHS * 30))
while IFS= read -r file; do
  [ -n "$file" ] && rm -f "$file" && ((DELETED_MONTHLY++)) && echo "Deleted: $file"
done < <(find "$BACKUP_DIR/monthly" -name "*.sql*" -type f -mtime +"$MONTHS_DAYS" 2>/dev/null)

TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "0")

echo "[$(date)] Cleanup completed. Deleted: $DELETED_DAILY daily, $DELETED_WEEKLY weekly, $DELETED_MONTHLY monthly"
echo "Total storage used: $TOTAL_SIZE"
