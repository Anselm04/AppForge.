#!/bin/bash
set -euo pipefail

echo "🚀 AppForge Deployment Script"
echo "============================="

TARGET_ENV="${1:-preview}"

if [[ "$TARGET_ENV" != "preview" && "$TARGET_ENV" != "production" ]]; then
  echo "❌ Invalid target. Use 'preview' or 'production'."
  exit 1
fi

echo "Target environment: $TARGET_ENV"

if ! command -v vercel &> /dev/null; then
  echo "⚠️  Vercel CLI not found. Installing..."
  npm install -g vercel
fi

echo "✓ Vercel CLI available"

if [[ ! -f ".vercel/project.json" ]]; then
  echo "⚠️  No .vercel/project.json found. Creating project..."
  vercel --name appforge --confirm --scope anselm04s-projects
fi

echo "✓ Project configuration found"

echo "📦 Running pre-deployment checks..."

if ! npm run lint &> /dev/null; then
  echo "❌ Lint check failed. Fix errors before deploying."
  exit 1
fi
echo "✓ Lint passed"

if ! npm run test &> /dev/null; then
  echo "❌ Test check failed. Fix failing tests before deploying."
  exit 1
fi
echo "✓ Tests passed"

if ! npm run build &> /dev/null; then
  echo "❌ Build failed. Fix build errors before deploying."
  exit 1
fi
echo "✓ Build succeeded"

echo "🚀 Deploying to $TARGET_ENV..."

if [[ "$TARGET_ENV" == "production" ]]; then
  vercel --prod --confirm
else
  vercel --confirm
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Run smoke tests: npx tsx src/utils/smoke-test.ts <deployment-url>"
echo "2. Check health: curl <deployment-url>/health"
echo "3. Monitor logs: vercel logs"
