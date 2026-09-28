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
    {
      id: "catalog",
      label: "Server-side product and price catalog",
      passed: text.includes("resolvebillingplan") && text.includes("priceid"),
      hint: "Generate server-side billing catalog",
    },
    {
      id: "portal",
      label: "Customer portal for plan changes",
      passed: text.includes("billingportal.sessions.create"),
      hint: "Generate authenticated billing portal route",
    },
    {
      id: "invoice_failure",
      label: "Invoice paid and failed-payment handling",
      passed:
        text.includes("invoice.paid") &&
        text.includes("invoice.payment_failed") &&
        text.includes("past_due"),
      hint: "Handle invoice lifecycle server-side",
    },
    {
      id: "refunds",
      label: "Refund and reconciliation handling",
      passed:
        text.includes("refundpayment") &&
        text.includes("stripe.refunds.create"),
      hint: "Generate server-side refund path",
    },
    {
      id: "idempotency",
      label: "Duplicate webhook protection",
      passed:
        text.includes("processbillingeventonce") &&
        text.includes("billing_events"),
      hint: "Persist and deduplicate provider event IDs",
    },
    {
      id: "audit",
      label: "Billing event audit trail",
      passed:
        text.includes("auditbillingaction") && text.includes("billing_audit"),
      hint: "Persist billing event outcomes",
    },
    {
      id: "limits",
      label: "Server-side access limits",
      passed:
        text.includes("requirepaidaccess") && text.includes("plan_limits"),
      hint: "Enforce paid limits on the server",
    },
    {
      id: "verified_config",
      label: "Verified billing configuration state",
      passed:
        text.includes("verifybillinghealth") &&
        text.includes("configured") &&
        text.includes("verified") &&
        text.includes("unconfigured"),
      hint: "Do not claim billing active until provider config is verified",
    },
  ];

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}
