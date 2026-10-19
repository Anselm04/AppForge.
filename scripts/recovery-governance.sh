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

# CI and deployment workflows are recovery-critical controls. In particular,
# production boot/liveness gates must remain governed so a release cannot bypass
# executable startup verification after dependency or middleware changes.
# Workflow display names used by launch-bar certification are part of the same
# recovery contract: changing one can silently orphan exact-SHA evidence unless
# the certification gate and its regression coverage remain aligned.
# Physical-evidence workflows are also fail-closed recovery controls: requesting
# an email/SMS challenge is not equivalent to completing the real auth or MFA
# lifecycle, so only successful full/fresh evidence may satisfy certification.
# Recovery review (19 October 2026): Flutter/Node qualification timeout and
# simulator-readiness hardening preserves the existing fail-closed evidence
# boundary. A hung or unhealthy Android/iOS qualification now fails within a
# bounded interval; it does not weaken restore, release, credential, backup, or
# production recovery assumptions and does not promote mobile maturity on failure.
# Recovery review (19 October 2026): the qualification-only Flutter log-reader
# backport is pinned to upstream c3ed85ef987759ee54a6bce275490cde2a238dc1,
# applied before tool bootstrap and recorded with its diff/hash in evidence.
# It synchronizes log readiness before launch; real Node ok:1, all execution
# bounds, Android, unsigned iOS release evidence, and governance stay enforced.
# Recovery review (19 October 2026): CodeQL init/analyze are upgraded together
# to immutable v4.39.0 commit 6f2ac81f5cd81fe351a197ba0b00d91d03cd2aee.
# The hosted bundle exceeds the new 2.20.7 minimum; both steps use the workspace
# checkout. Scanning scope, permissions, failure gates and recovery evidence
# requirements stay enforced. Matching versions prevent configuration rejection.
# Recovery review (20 October 2026): github-script v9 runs on hosted Node 24.
# Checklist scripts use only injected context/core; no removed require calls or
# getOctokit redeclarations. Required template checks and file gates stay intact.
critical_regex='^(\.github/workflows/|fly\.toml$|Dockerfile|docker/|supabase/|migrations/|drizzle/|src/lib/auth\.ts$|src/services/(productionAutoDeploy|deployHealth|build-worker|stripeCheckout|stripeEventLedger)\.ts$|src/webhooks/stripe\.ts$|src/routers/(auth|projects|billing|stripe).*\.ts$)'
recovery_regex='^(docs/DISASTER_RECOVERY\.md$|docs/OFFSITE_BACKUP\.md$|docs/OWNER_BREAK_GLASS\.md$|docs/RECOVERY_INVENTORY\.md$|docs/RECOVERY_AND_ROLLBACK\.md$|docs/PLATINUM_SECURITY_PROTOCOL\.md$|\.github/workflows/repository-backup\.yml$|\.github/workflows/repository-metadata-backup\.yml$|\.github/workflows/recovery-readiness\.yml$|scripts/recovery-governance\.sh$)'

critical="$(printf '%s\n' "$changed" | grep -E "$critical_regex" || true)"

if [ -z "$critical" ]; then
  echo "No recovery-impacting infrastructure files changed."
  exit 0
fi

recovery_updates="$(printf '%s\n' "$changed" | grep -E "$recovery_regex" || true)"

if [ -z "$recovery_updates" ]; then
  echo "Recovery-impacting files changed without a recovery protocol review:" >&2
  printf '%s\n' "$critical" >&2
  echo "Update the disaster/off-site/owner/platinum recovery docs, recovery inventory, a recovery workflow, or this governance policy in the same change." >&2
  exit 1
fi

echo "Recovery-impacting change includes recovery protocol review:"
printf '%s\n' "$recovery_updates"
