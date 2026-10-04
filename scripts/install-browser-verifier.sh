#!/usr/bin/env bash
set -euo pipefail
# Keep npm's dependency graph for the browser verifier separate from AppForge.
# Runtime imports and npx still resolve the verifier through these local links.
root="$(cd "$(dirname "$0")/.." && pwd)"
npm ci --ignore-scripts --no-audit --no-fund --prefix "$root/scripts/browser-verifier"
mkdir -p "$root/node_modules/@playwright" "$root/node_modules/.bin"
ln -sfn "$root/scripts/browser-verifier/node_modules/@playwright/test" "$root/node_modules/@playwright/test"
ln -sfn "$root/scripts/browser-verifier/node_modules/.bin/playwright" "$root/node_modules/.bin/playwright"
