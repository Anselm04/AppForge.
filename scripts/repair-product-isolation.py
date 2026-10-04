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


# Shared Stripe account: remove the obsolete dedicated-account requirement only.
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
    "# AppForge Stripe billing\n# The Stripe account may host other products; configure AppForge-owned price IDs only.\n",
)
text = text.replace("TRILLION_ECOSYSTEM_SHARED_SECRET", "APPFORGE_MARKETING_SHARED_SECRET")
text = text.replace("TRILLION_PUBLIC_SITE_URL", "APPFORGE_PUBLIC_SITE_URL")
write(path, text)

path = ".github/workflows/deploy-production.yml"
text = read(path)
text = "\n".join(
    line for line in text.splitlines() if "APPFORGE_STRIPE_ACCOUNT_ID" not in line
) + "\n"
write(path, text)

# Webhook processing must never verify a dedicated Stripe account. AppForge is
# isolated by its configured prices, product metadata and entitlement records.
path = "src/webhooks/stripe.ts"
text = read(path)
text = text.replace(
    'import { verifyAppForgeStripeAccount } from "../services/appForgeStripe.js";\n',
    "",
)
text = text.replace("    await verifyAppForgeStripeAccount(stripe);\n", "")
write(path, text)

# Remove only the obsolete test mock; do not rewrite test syntax mechanically.
path = "src/__tests__/stripeDelayedEvents.test.ts"
text = read(path)
text = text.replace(
    'vi.mock("../services/appForgeStripe.js", () => ({\n  verifyAppForgeStripeAccount: vi.fn(),\n}));\n',
    "",
)
write(path, text)

# AppForge's optional marketing bridge must be independent of every other product.
path = "src/integrations/catalog.ts"
text = read(path)
text = re.sub(
    r'\s*\{ id: "marketing-app", name: "TrillionAI Marketing", kind: "ecosystem", job: "Receives AppForge products and turns them into measurable marketing campaigns\.", requiredForProduction: true, capabilities: \["campaigns", "content", "seo", "social", "ads"\], env: \["MARKETING_APP_URL", "TRILLION_ECOSYSTEM_SHARED_SECRET"\] \},',
    '\n  { id: "marketing-app", name: "Marketing Integration", kind: "external", job: "Optional export of AppForge products to an independently configured marketing service.", requiredForProduction: false, capabilities: ["campaigns", "content", "seo", "social", "ads"], env: ["MARKETING_APP_URL", "APPFORGE_MARKETING_SHARED_SECRET"] },',
    text,
)
text = re.sub(
    r'\n\s*\{ id: "trillionaitech-site",[^\n]*\},',
    "",
    text,
)
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

# Optional marketing integration is AppForge-namespaced and never production-required.
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

# AppForge customer-facing identity stands alone from the catalogue website and
# other products. These replacements are deliberately scoped to known files.
for file_path in [
    "README.md",
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

# The repair itself must not mutate arbitrary tests/docs by deleting lines. Guard
# the runtime/config boundary instead, where cross-product coupling matters.
protected_paths = [
    ROOT / "src/services",
    ROOT / "src/integrations",
    ROOT / "src/routers",
    ROOT / "src/webhooks",
    ROOT / ".env.example",
    ROOT / ".env.schema.json",
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
