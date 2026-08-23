#!/bin/bash
set -euo pipefail

# ── AppForge Fly.io Deployment Script ──
# Usage: ./scripts/fly-deploy.sh
# Prerequisite: flyctl installed and logged in

echo "🚀 AppForge Fly.io Deployment"
echo "==============================="

if ! command -v flyctl &> /dev/null; then
  echo "❌ flyctl not found. Install with:"
  echo "   curl -L https://fly.io/install.sh | sh"
  echo "   Then: flyctl auth login"
  exit 1
fi

echo "✓ flyctl available"

if ! flyctl status &> /dev/null; then
  echo "⚠️  App not launched yet. Launching..."
  flyctl launch --name appforge --region lhr --dockerfile Dockerfile --build-target production --no-deploy
  echo "✓ App launched. Now set secrets."
  echo ""
  echo "⚠️  CRITICAL: You must set your secrets before deploying:"
  echo ""
  echo "  flyctl secrets set \\"
  echo "    DATABASE_URL=\"postgresql://...\" \\"
  echo "    SUPABASE_SERVICE_ROLE_KEY=\"...\" \\"
  echo "    JWT_SECRET=\"$(openssl rand -base64 48)\" \\"
  echo "    COOKIE_SECRET=\"$(openssl rand -base64 48)\" \\"
  echo "    STRIPE_SECRET_KEY=\"sk_live_...\" \\"
  echo "    STRIPE_WEBHOOK_SECRET=\"whsec_...\" \\"
  echo "    STRIPE_STARTER_PRICE_ID=\"price_...\" \\"
  echo "    STRIPE_BUILDER_PRICE_ID=\"price_...\" \\"
  echo "    STRIPE_STUDIO_PRICE_ID=\"price_...\" \\"
  echo "    STRIPE_STARTER_PAYMENT_LINK=\"https://...\" \\"
  echo "    STRIPE_BUILDER_PAYMENT_LINK=\"https://...\" \\"
  echo "    STRIPE_STUDIO_PAYMENT_LINK=\"https://...\" \\"
  echo "    BUILT_IN_FORGE_API_KEY=\"...\" \\"
  echo "    BUILT_IN_FORGE_API_URL=\"https://forge.manus.im\" \\"
  echo "    OWNER_EMAIL=\"anselm.perkins@gmail.com\" \\"
  echo "    CORS_ORIGIN=\"https://appforge.fly.dev\" \\"
  echo "    SENTRY_DSN=\"https://...\" \\"
  echo "    VITE_SUPABASE_URL=\"https://...\" \\"
  echo "    VITE_SUPABASE_PUBLISHABLE_KEY=\"...\""
  echo ""
  echo "Then run this script again to deploy."
  exit 0
fi

echo "✓ App exists on Fly.io"

echo "📦 Checking pre-deployment health..."

if ! flyctl status | grep -q "running"; then
  echo "⚠️  No running machines. Proceeding with fresh deploy."
fi

echo "🚀 Deploying to Fly.io..."
flyctl deploy --config fly.toml --dockerfile Dockerfile --build-target production

echo ""
echo "✅ Deployment complete!"
echo ""
APP_URL="https://appforge.fly.dev"
echo "Your app is live at: $APP_URL"
echo ""
echo "Next steps:"
echo "1. Verify health: curl $APP_URL/api/health"
echo "2. Run smoke tests: npx tsx src/utils/smoke-test.ts $APP_URL"
echo "3. Check logs: flyctl logs"
echo "4. Scale if needed: flyctl scale count 2"
echo ""
echo "IMPORTANT: Register webhook endpoint in Stripe Dashboard:"
echo "  $APP_URL/api/webhooks/stripe"

# Post-deploy health check
sleep 5
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/api/health" 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
  echo "✓ Health check passed ($HEALTH)"
else
  echo "⚠️  Health check returned $HEALTH — check logs: flyctl logs"
fi