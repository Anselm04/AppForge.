from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace(path: str, old: str, new: str) -> None:
    text = read(path)
    updated = text.replace(old, new)
    if updated != text:
        write(path, updated)


# Shared Stripe account: AppForge is isolated by its own configured prices,
# metadata, webhook handling and entitlements, not by a separate Stripe account.
path = "src/utils/env-validator.ts"
text = read(path)
text = text.replace("  APPFORGE_STRIPE_ACCOUNT_ID?: string;\n", "")
text = re.sub(
    r"\n  if \(\n    isProduction &&\n    billingEnabled &&\n    !/\^acct_\[A-Za-z0-9\]\+\$/\.test\(config\.APPFORGE_STRIPE_ACCOUNT_ID \?\? \"\"\)\n  \) \{\n    errors\.push\(\n      \"APPFORGE_STRIPE_ACCOUNT_ID is required for isolated production billing\",\n    \);\n  \}\n",
    "\n",
    text,
)
write(path, text)

path = ".env.schema.json"
text = read(path)
text = re.sub(
    r'^\s*"APPFORGE_STRIPE_ACCOUNT_ID"\s*:\s*\{[^\n]*\},\s*\n',
    "",
    text,
    flags=re.M,
)
write(path, text)

path = ".env.example"
text = read(path)
text = text.replace(
    "# Dedicated AppForge Stripe billing\n# Use credentials and prices from the AppForge account only.\nAPPFORGE_STRIPE_ACCOUNT_ID=\n",
    "# AppForge Stripe billing\n# This Stripe account may host other independent products. Configure only AppForge-owned Price IDs here.\n",
)
text = text.replace("TRILLION_ECOSYSTEM_SHARED_SECRET", "APPFORGE_MARKETING_SHARED_SECRET")
text = text.replace("TRILLION_PUBLIC_SITE_URL", "APPFORGE_PUBLIC_SITE_URL")
text = re.sub(
    r"APPFORGE_PUBLIC_SITE_URL=https?://[^\s]+",
    "APPFORGE_PUBLIC_SITE_URL=https://appforge.example",
    text,
)
write(path, text)

path = ".github/workflows/deploy-production.yml"
text = read(path)
text = "\n".join(
    line for line in text.splitlines() if "APPFORGE_STRIPE_ACCOUNT_ID" not in line
) + "\n"
text = text.replace(
    "billing catalog must come from the dedicated account",
    "billing catalog must use only AppForge-owned Stripe prices",
)
write(path, text)

# Remove the obsolete dedicated-account verification from webhook processing.
path = "src/webhooks/stripe.ts"
text = read(path)
text = text.replace(
    'import { verifyAppForgeStripeAccount } from "../services/appForgeStripe.js";\n',
    "",
)
text = text.replace("    await verifyAppForgeStripeAccount(stripe);\n", "")
write(path, text)

path = "src/__tests__/stripeDelayedEvents.test.ts"
text = read(path)
text = text.replace(
    'vi.mock("../services/appForgeStripe.js", () => ({\n  verifyAppForgeStripeAccount: vi.fn(),\n}));\n',
    "",
)
write(path, text)

path = "src/__tests__/customer-flow-contract.e2e.spec.ts"
text = read(path)
text = text.replace(
    '    expect(deploy).toContain("APPFORGE_STRIPE_ACCOUNT_ID");\n',
    '    expect(deploy).not.toContain("APPFORGE_STRIPE_ACCOUNT_ID");\n',
)
write(path, text)

# Generated apps must not leak the company catalogue site or another product identity.
path = "src/lib/hostedRuntime.ts"
text = read(path)
text = re.sub(
    r'<footer class="brand">.*?</footer>',
    '<footer class="brand">Built with AppForge</footer>',
    text,
    count=1,
    flags=re.S,
)
write(path, text)

# Marketing is optional and independently configured. The catalogue website is not
# part of AppForge's runtime or production-readiness dependency graph.
path = "src/integrations/catalog.ts"
text = read(path)
text = re.sub(
    r'\s*\{ id: "marketing-app", name: "TrillionAI Marketing", kind: "ecosystem", job: "Receives AppForge products and turns them into measurable marketing campaigns\.", requiredForProduction: true, capabilities: \["campaigns", "content", "seo", "social", "ads"\], env: \["MARKETING_APP_URL", "TRILLION_ECOSYSTEM_SHARED_SECRET"\] \},',
    '\n  { id: "marketing-app", name: "Marketing Integration", kind: "external", job: "Optional export of AppForge products to an independently configured marketing service.", requiredForProduction: false, capabilities: ["campaigns", "content", "seo", "social", "ads"], env: ["MARKETING_APP_URL", "APPFORGE_MARKETING_SHARED_SECRET"] },',
    text,
)
text = re.sub(r'\n\s*\{ id: "trillionaitech-site",[^\n]*\},', "", text)
write(path, text)

path = "src/integrations/health.ts"
text = read(path)
text = text.replace("TRILLION_ECOSYSTEM_SHARED_SECRET", "APPFORGE_MARKETING_SHARED_SECRET")
text = text.replace(
    "Marketing app URL and ecosystem shared secret are required",
    "Marketing integration URL and AppForge shared secret are required",
)
text = re.sub(
    r'\n\s*case "trillionaitech-site": \{.*?\n\s*\}\n\n\s*default:',
    "\n\n    default:",
    text,
    flags=re.S,
)
write(path, text)

replace(
    "src/services/marketingBridge.ts",
    "TRILLION_ECOSYSTEM_SHARED_SECRET",
    "APPFORGE_MARKETING_SHARED_SECRET",
)
replace(
    "src/routers/ecosystem.ts",
    "Create or sign in to the matching TrillionAI Marketing account first",
    "Create or sign in to the matching marketing service account first",
)

# Remove cross-product identity/contact coupling from AppForge-facing surfaces.
path = "README.md"
text = read(path)
text = text.replace("Trillion-owned source code", "AppForge-owned source code")
text = text.replace("TrillionAI Tech", "AppForge")
text = text.replace("Trillion AI Tech", "AppForge")
write(path, text)

for file_path in [
    "index.html",
    "src/pages/Home.tsx",
    "src/components/layout/MarketingLayout.tsx",
    "public/branding/BRAND-GUIDELINES.md",
]:
    p = ROOT / file_path
    if not p.exists():
        continue
    text = p.read_text(encoding="utf-8")
    text = text.replace("TrillionAI Tech", "AppForge")
    text = text.replace("Trillion AI Tech", "AppForge")
    p.write_text(text, encoding="utf-8")

for file_path in ["src/components/SiteFooter.tsx", "src/pages/About.tsx"]:
    path = ROOT / file_path
    text = path.read_text(encoding="utf-8")
    text = re.sub(
        r'<a\s+href="mailto:[^"]+"[^>]*>\s*[^<]+\s*</a>',
        '<a href="/help" className="hover:text-slate-900 dark:hover:text-white">AppForge Support</a>',
        text,
        flags=re.S,
    )
    path.write_text(text, encoding="utf-8")

path = "src/pages/Pricing.tsx"
text = read(path)
text = re.sub(
    r'const ENTERPRISE_CONTACT\s*=\s*\n?\s*"mailto:[^"]+";',
    'const ENTERPRISE_CONTACT = "/help?topic=enterprise";',
    text,
)
write(path, text)

# Keep all translated AppForge UI independent as well.
for p in sorted((ROOT / "src/i18n/data").glob("*.json")):
    text = p.read_text(encoding="utf-8")
    text = text.replace("TrillionAI Tech", "AppForge")
    text = text.replace("Trillion AI Tech", "AppForge")
    text = re.sub(r'("ownerOf"\s*:\s*)"[^"]*"', r'\1"AppForge"', text)
    p.write_text(text, encoding="utf-8")

# Recovery governance: document the corrected billing/product boundary without secrets.
recovery_path = ROOT / "docs/RECOVERY_INVENTORY.md"
if recovery_path.exists():
    recovery = recovery_path.read_text(encoding="utf-8")
    marker = "### Shared Stripe account product isolation — 5 October 2026"
    if marker not in recovery:
        recovery += f'''\n\n{marker}\n\nRecovery invariant:\n- AppForge uses the same Stripe account as other independent products; account-level isolation is not required and `APPFORGE_STRIPE_ACCOUNT_ID` must not be restored or reintroduced.\n- Recover `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and only the AppForge-owned subscription/credit Price IDs used by AppForge.\n- AppForge checkout metadata remains namespaced with `product_line=appforge`; AppForge entitlements and credit records must only be created from AppForge-owned prices and valid settled AppForge payments.\n- Stripe events for unrelated products in the shared account must never create, change, cancel, refund, or grant AppForge entitlements/credits.\n- The external marketing integration is optional. The catalogue website and every other product are not AppForge runtime, billing, deployment, or recovery dependencies.\n- The product-isolation repair/release gates must fail closed if obsolete account-level Stripe isolation or production-facing cross-product coupling is reintroduced.\n\nVerification target:\n- Verify all AppForge subscription and credit Price IDs resolve to the intended AppForge products before reopening paid traffic.\n- Exercise AppForge checkout, delayed/replayed webhook delivery, refund, cancellation, failed-payment reconciliation, and entitlement/credit idempotency.\n- Deliver representative unrelated-product Stripe events from the shared account and confirm AppForge acknowledges/ignores them without mutating AppForge billing state.\n- Confirm a deliberately AppForge-marked event with a non-AppForge price fails closed and grants nothing.\n'''
        recovery_path.write_text(recovery, encoding="utf-8")

# Guard only production-facing/runtime product boundaries; arbitrary test fixture data
# is not a dependency and must not be rewritten merely because it contains a company name.
protected_paths = [
    ROOT / "README.md",
    ROOT / ".env.example",
    ROOT / ".env.schema.json",
    ROOT / "src/components",
    ROOT / "src/pages",
    ROOT / "src/services",
    ROOT / "src/integrations",
    ROOT / "src/routers",
    ROOT / "src/webhooks",
    ROOT / "src/i18n",
    ROOT / "src/lib/hostedRuntime.ts",
    ROOT / ".github/workflows/deploy-production.yml",
]
violations: list[str] = []
for protected in protected_paths:
    files = [protected] if protected.is_file() else protected.rglob("*")
    for p in files:
        if not p.is_file():
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        rel = str(p.relative_to(ROOT))
        if re.search(r"trillion", text, flags=re.I):
            violations.append(rel + " (cross-product identity)")
        if "APPFORGE_STRIPE_ACCOUNT_ID" in text:
            violations.append(rel + " (obsolete Stripe account id)")
        if "TRILLION_ECOSYSTEM_SHARED_SECRET" in text:
            violations.append(rel + " (cross-product shared secret)")
        if "trillionaitech-site" in text:
            violations.append(rel + " (catalogue-site coupling)")

if violations:
    raise SystemExit(
        "product isolation violations remain:\n" + "\n".join(sorted(set(violations)))
    )

print("AppForge product isolation repair complete")
