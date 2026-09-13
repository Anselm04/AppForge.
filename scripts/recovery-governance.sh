#!/usr/bin/env bash
set -euo pipefail

base="${1:-}"
head="${2:-HEAD}"

if [ -z "$base" ]; then
  echo "Base revision is required."
  exit 2
fi

changed="$(git diff --name-only --diff-filter=ACMR "$base"..."$head" || true)"

if [ -z "$changed" ]; then
  echo "No changed files; recovery governance passed."
  exit 0
fi

printf '%s\n' "$changed"

critical_regex='^(\.github/workflows/|fly\.toml$|Dockerfile|docker/|supabase/|migrations/|drizzle/|src/lib/auth\.ts$|src/services/(productionAutoDeploy|deployHealth|build-worker|stripeCheckout|stripeEventLedger)\.ts$|src/webhooks/stripe\.ts$|src/routers/(auth|projects|billing|stripe).*\.ts$)'
recovery_regex='^(docs/DISASTER_RECOVERY\.md$|docs/OFFSITE_BACKUP\.md$|\.github/workflows/repository-backup\.yml$|scripts/recovery-governance\.sh$)'

critical="$(printf '%s\n' "$changed" | grep -E "$critical_regex" || true)"

if [ -z "$critical" ]; then
  echo "No recovery-impacting infrastructure files changed."
  exit 0
fi

recovery_updates="$(printf '%s\n' "$changed" | grep -E "$recovery_regex" || true)"

if [ -z "$recovery_updates" ]; then
  echo "Recovery-impacting files changed without a recovery protocol review:" >&2
  printf '%s\n' "$critical" >&2
  echo "Update docs/DISASTER_RECOVERY.md, docs/OFFSITE_BACKUP.md, .github/workflows/repository-backup.yml, or this governance policy in the same change." >&2
  exit 1
fi

echo "Recovery-impacting change includes recovery protocol review:"
printf '%s\n' "$recovery_updates"
