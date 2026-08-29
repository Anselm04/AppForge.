/** Platform-side checks that generated billing apps can complete the income golden path. */

type Files = Record<string, string>;

export type BillingE2eReport = {
  passed: boolean;
  checks: Array<{ id: string; label: string; passed: boolean; hint?: string }>;
};

export function validateBillingGoldenPath(files: Files): BillingE2eReport {
  const text = Object.values(files).join("\n").toLowerCase();
  const paths = Object.keys(files).map((p) => p.toLowerCase());

  const checks = [
    {
      id: "checkout",
      label: "Stripe Checkout route",
      passed:
        text.includes("checkout.sessions") ||
        paths.some((p) => p.includes("checkout")),
      hint: "Enable Fintech capability on build",
    },
    {
      id: "webhook_db",
      label: "Webhook persists to subscriptions table",
      passed: text.includes("upsertfromcheckoutsession"),
      hint: "Rebuild with latest AppForge billing scaffold",
    },
    {
      id: "entitlements_db",
      label: "Entitlements read from database",
      passed: text.includes("getsubscriptionbyuserid"),
      hint: "Requires DATABASE_URL + migration",
    },
    {
      id: "auth_link",
      label: "Checkout linked to user session",
      passed:
        text.includes("client_reference_id") &&
        (text.includes("getuseridfromrequest") ||
          (text.includes("userid") && text.includes("session"))),
      hint: "Login before checkout; set userId cookie",
    },
    {
      id: "gate",
      label: "Premium feature gate component",
      passed: text.includes("requirepro") || text.includes("canaccessfeature"),
      hint: "Wrap pro routes with RequirePro",
    },
    {
      id: "migration",
      label: "Billing SQL migration present",
      passed: Boolean(files["database/billing-schema.sql"]),
      hint: "Run database/billing-schema.sql on Postgres",
    },
  ];

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}
