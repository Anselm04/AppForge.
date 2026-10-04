from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace(path: str, old: str, new: str, *, required: bool = False) -> None:
    text = read(path)
    if required and old not in text:
        raise SystemExit(f"required pattern missing in {path}: {old[:80]!r}")
    write(path, text.replace(old, new))


# Stripe isolation is product-level inside a shared Stripe account.
path = "src/utils/env-validator.ts"
text = read(path)
text = text.replace("  APPFORGE_STRIPE_ACCOUNT_ID?: string;\n", "")
text = re.sub(
    r"\n  if \(\n    isProduction &&\n    billingEnabled &&\n    !/\^acct_\[A-Za-z0-9\]\+\$/\.test\(config\.APPFORGE_STRIPE_ACCOUNT_ID \?\? \"\"\)\n  \) \{\n    errors\.push\(\n      \"APPFORGE_STRIPE_ACCOUNT_ID is required for isolated production billing\",\n    \);\n  \}\n",
    "\n",
    text,
)
write(path, text)

# Remove the obsolete account-id schema requirement.
path = ".env.schema.json"
text = read(path)
text = re.sub(r'^\s*"APPFORGE_STRIPE_ACCOUNT_ID"\s*:\s*\{[^\n]*\},\s*\n', "", text, flags=re.M)
write(path, text)

# AppForge env examples must contain only AppForge configuration and generic optional integrations.
path = ".env.example"
text = read(path)
text = text.replace("# Dedicated AppForge Stripe billing\n# Use credentials and prices from the AppForge account only.\nAPPFORGE_STRIPE_ACCOUNT_ID=\n", "# AppForge Stripe billing\n# The Stripe account may host other products; configure AppForge-owned price IDs only.\n")
text = re.sub(
    r"# ============================================\n# Holy Trinity ecosystem\n# ============================================\nMARKETING_APP_URL=.*?TRILLION_PUBLIC_SITE_URL=.*?\n\n",
    "# ============================================\n# Optional external marketing integration\n# ============================================\nMARKETING_APP_URL=https://your-marketing-app.example.com\nAPPFORGE_MARKETING_SHARED_SECRET=replace-with-long-random-shared-secret\n\n",
    text,
    flags=re.S,
)
if "APPFORGE_EMAIL_FROM=" not in text:
    text = text.replace("# RESEND_API_KEY=resend_sk_xxxxxx\n", "# RESEND_API_KEY=resend_sk_xxxxxx\nAPPFORGE_EMAIL_FROM=\nAPPFORGE_SUPPORT_EMAIL=\n")
write(path, text)

# Production deploy must not require a dedicated Stripe account id.
path = ".github/workflows/deploy-production.yml"
text = read(path)
text = "\n".join(line for line in text.splitlines() if "APPFORGE_STRIPE_ACCOUNT_ID" not in line) + "\n"
write(path, text)

# Catalog: generic optional marketing bridge, no dependency on another product/site.
path = "src/integrations/catalog.ts"
text = read(path)
text = text.replace(
    '{ id: "marketing-app", name: "TrillionAI Marketing", kind: "ecosystem", job: "Receives AppForge products and turns them into measurable marketing campaigns.", requiredForProduction: true, capabilities: ["campaigns", "content", "seo", "social", "ads"], env: ["MARKETING_APP_URL", "TRILLION_ECOSYSTEM_SHARED_SECRET"] },',
    '{ id: "marketing-app", name: "Marketing Integration", kind: "external", job: "Optional export of AppForge products to an independently configured marketing service.", requiredForProduction: false, capabilities: ["campaigns", "content", "seo", "social", "ads"], env: ["MARKETING_APP_URL", "APPFORGE_MARKETING_SHARED_SECRET"] },',
)
text = re.sub(r'^\s*\{ id: "trillionaitech-site"[^\n]*\n', "", text, flags=re.M)
write(path, text)

# Health checks follow the generic optional marketing integration only.
path = "src/integrations/health.ts"
text = read(path).replace("TRILLION_ECOSYSTEM_SHARED_SECRET", "APPFORGE_MARKETING_SHARED_SECRET")
text = re.sub(
    r'\n    case "trillionaitech-site": \{.*?\n    \}\n',
    "\n",
    text,
    flags=re.S,
)
write(path, text)

# Marketing bridge is optional and AppForge-namespaced, not tied to another product.
replace("src/services/marketingBridge.ts", "TRILLION_ECOSYSTEM_SHARED_SECRET", "APPFORGE_MARKETING_SHARED_SECRET")
replace(
    "src/routers/ecosystem.ts",
    "Create or sign in to the matching TrillionAI Marketing account first",
    "Create or sign in to the matching marketing service account first",
)

# AppForge-facing identity must stand alone.
replace("README.md", "developed by **TrillionAI Tech**", "developed and operated as the independent **AppForge** product")
replace("README.md", "Trillion-owned source code", "AppForge-owned source code")
replace("README.md", "AppForge is developed by **TrillionAI Tech**.", "AppForge is developed and operated as an independent product.")
replace("index.html", " A TrillionAI Tech product.", "")
replace("index.html", "From TrillionAI Tech, Founder & CEO Anselm Perkins.", "Built for independent production software delivery.")
replace("src/pages/Home.tsx", "A TrillionAI Tech Product", "Independent AI App Builder")
replace("src/components/layout/MarketingLayout.tsx", "AppForge · TrillionAI Tech", "AppForge")
replace("src/routers/ecosystem.ts", "TrillionAI", "AppForge")

# Remove hard-coded cross-product contact addresses from UI. Support routes remain inside AppForge.
for path in ["src/components/SiteFooter.tsx", "src/pages/About.tsx"]:
    text = read(path)
    text = re.sub(
        r'<a\s+href="mailto:[^"]+"[^>]*>\s*[^<]+\s*</a>',
        '<a href="/help" className="hover:text-slate-900 dark:hover:text-white">AppForge Support</a>',
        text,
        flags=re.S,
    )
    write(path, text)

path = "src/pages/Pricing.tsx"
text = read(path)
text = re.sub(
    r'const ENTERPRISE_CONTACT\s*=\s*\n?\s*"mailto:[^"]+";',
    'const ENTERPRISE_CONTACT = "/help?topic=enterprise";',
    text,
)
write(path, text)

path = "src/lib/hostedRuntime.ts"
text = read(path)
text = re.sub(
    r'<footer class="brand">\s*Built with AppForge by .*?</footer>',
    '<footer class="brand">Built with AppForge</footer>',
    text,
    flags=re.S,
)
write(path, text)

# Brand docs and translations keep AppForge as the sole product identity.
for p in [ROOT / "public/branding/BRAND-GUIDELINES.md", *sorted((ROOT / "src/i18n/data").glob("*.json"))]:
    if not p.exists():
        continue
    text = p.read_text(encoding="utf-8")
    text = text.replace("TrillionAI Tech", "AppForge").replace("Trillion AI Tech", "AppForge")
    if p.suffix == ".json":
        text = re.sub(r'("ownerOf"\s*:\s*)"[^"]*"', r'\1"AppForge"', text)
    p.write_text(text, encoding="utf-8")

# Recovery docs must describe product-level isolation, not account-level isolation.
if (ROOT / "docs/RECOVERY_INVENTORY.md").exists():
    text = read("docs/RECOVERY_INVENTORY.md")
    text = text.replace("Dedicated AppForge payment recovery", "AppForge payment recovery")
    text = re.sub(
        r"Recover the dedicated APPFORGE_STRIPE_ACCOUNT_ID, STRIPE_SECRET_KEY and\nSTRIPE_WEBHOOK_SECRET together, plus the seven AppForge subscription and credit\nprice secrets\. The account behind the key must match before checkout, portal or\nwebhook processing\. Never restore website/marketing credentials into AppForge\.",
        "Recover STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET together with the AppForge subscription and credit price secrets. The Stripe account may contain other independent products; only AppForge-owned prices, metadata, webhooks and entitlement records may be used by AppForge.",
        text,
    )
    write("docs/RECOVERY_INVENTORY.md", text)

# Remove obsolete account-id references from tests/docs/config that no longer define behavior.
for p in ROOT.rglob("*"):
    if not p.is_file() or ".git" in p.parts:
        continue
    try:
        text = p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        continue
    if "APPFORGE_STRIPE_ACCOUNT_ID" in text:
        lines = [line for line in text.splitlines() if "APPFORGE_STRIPE_ACCOUNT_ID" not in line]
        p.write_text("\n".join(lines) + ("\n" if text.endswith("\n") else ""), encoding="utf-8")

# Remove the old product/site identity everywhere in the current tree. Documentation
# may use appforge.example as an explicit placeholder, never as production runtime config.
replacements = {
    "TRILLION_ECOSYSTEM_SHARED_SECRET": "APPFORGE_MARKETING_SHARED_SECRET",
    "TRILLION_PUBLIC_SITE_URL": "APPFORGE_PUBLIC_SITE_URL",
    "TrillionAI Tech": "AppForge",
    "Trillion AI Tech": "AppForge",
    "TrillionAI": "AppForge",
    "Trillionaitech": "AppForge",
    "trillionaitech.com": "appforge.example",
    "trillionaitech": "appforge",
    "trillionaitech-site": "public-site",
}
for p in ROOT.rglob("*"):
    if not p.is_file() or ".git" in p.parts or p.name == "repair-product-isolation.py":
        continue
    try:
        text = p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        continue
    new = text
    for old, replacement in replacements.items():
        new = new.replace(old, replacement)
    if new != text:
        p.write_text(new, encoding="utf-8")

# Guard the invariant: current AppForge source/config/docs must not contain the old product identity.
violations = []
for p in ROOT.rglob("*"):
    if not p.is_file() or ".git" in p.parts or p.name == "repair-product-isolation.py":
        continue
    try:
        text = p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        continue
    if re.search(r"trillion", text, flags=re.I):
        violations.append(str(p.relative_to(ROOT)))
    if "APPFORGE_STRIPE_ACCOUNT_ID" in text:
        violations.append(str(p.relative_to(ROOT)) + " (obsolete Stripe account id)")

if violations:
    raise SystemExit("product isolation violations remain:\n" + "\n".join(sorted(set(violations))))

print("AppForge product isolation repair complete")
