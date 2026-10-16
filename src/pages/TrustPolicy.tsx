import { Link, useParams } from "react-router-dom";

const EFFECTIVE_DATE = "16 October 2026";
const SUPPORT_EMAIL = "anselm.perkins@gmail.com";

type PolicySection = { heading: string; paragraphs: string[] };
type Policy = {
  title: string;
  summary: string;
  sections: PolicySection[];
};

const POLICIES: Record<string, Policy> = {
  privacy: {
    title: "Privacy",
    summary:
      "How AppForge handles account, project, billing, security and service data.",
    sections: [
      {
        heading: "What AppForge handles",
        paragraphs: [
          "AppForge processes the information needed to create and secure your account, provide product-generation services, store your projects, operate billing, diagnose failures, prevent abuse and provide support. This can include account details, project content, build records, service settings, security events, provider-connection metadata and payment references.",
          "Payment card details are handled by the payment provider rather than being intentionally stored in AppForge application records. Provider access tokens and other credentials are treated as secrets and are excluded from customer data exports.",
        ],
      },
      {
        heading: "Why data is used",
        paragraphs: [
          "Data is used to provide requested services, maintain account and project state, enforce ownership and security boundaries, settle billing and credits, investigate incidents, support recovery, meet record-keeping obligations and improve service reliability.",
          "AppForge does not treat a customer project as permission to expose that project or another customer's information publicly.",
        ],
      },
      {
        heading: "Retention and deletion",
        paragraphs: [
          "Retention depends on the record type. Customer project content and provider connections are removed through the account-deletion lifecycle, while a minimum set of billing, transaction, security and deletion-audit records may need to be retained for legitimate accounting, fraud, dispute or legal purposes. Retained account identifiers are anonymized where the product can do so without defeating those purposes.",
          "Operational backups age out through the backup lifecycle rather than being edited in place. Deleted customer data must not be restored into active service during a recovery without the deletion state being reapplied.",
        ],
      },
      {
        heading: "Your controls",
        paragraphs: [
          "Authenticated customers can manage sessions and security settings and can request or use supported account export and deletion controls. Questions about access, correction, export or deletion can be sent to AppForge support.",
        ],
      },
      {
        heading: "Service providers and transfers",
        paragraphs: [
          "AppForge uses external infrastructure and product providers where necessary to operate features such as identity, hosting, payments, repositories, observability and generated-product services. Provider use is limited to the service purpose and is governed by the provider configuration and applicable terms. A provider being technically integrated is not itself a claim that every provider feature or region is production-certified.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    summary: "The operating terms for using AppForge and generated-product services.",
    sections: [
      {
        heading: "Using AppForge",
        paragraphs: [
          "You must provide accurate account information, keep credentials secure and use AppForge only for lawful purposes. You are responsible for reviewing generated software before relying on it for high-impact, regulated or safety-critical use.",
          "AppForge may block or limit activity that threatens service security, other customers, providers or the platform's lawful operation.",
        ],
      },
      {
        heading: "Generated products and customer content",
        paragraphs: [
          "You retain responsibility for content, data, instructions and third-party materials you provide. AppForge's builder may select and adapt internal reusable engineering resources to create customer-specific products; access to AppForge's private internal resource library is not transferred merely because a generated product uses adapted output from it.",
          "Generated output can depend on external SDKs, APIs, stores, accounts, approvals and provider terms. AppForge must not present unavailable external permissions or unverified provider capabilities as guaranteed.",
        ],
      },
      {
        heading: "Billing and credits",
        paragraphs: [
          "Plan, credit and checkout terms shown in the product at purchase time control the amount charged. AppForge defects, duplicate execution and qualifying provider failures should not unfairly consume build credits; settlement rules are described in the Refund and Failure Settlement Policy.",
        ],
      },
      {
        heading: "Availability, changes and recovery",
        paragraphs: [
          "Software generation and deployment can fail because of code defects, infrastructure problems, provider outages, invalid credentials or external approval decisions. AppForge uses validation, checkpoints and recovery controls, but does not promise uninterrupted operation or approval by a third-party platform.",
        ],
      },
      {
        heading: "Account exit",
        paragraphs: [
          "Customers can export supported customer-owned data and source and can use the account-deletion lifecycle. Required financial, security and dispute records may be retained in minimized or anonymized form where deletion would conflict with legitimate record-keeping requirements.",
        ],
      },
    ],
  },
  "acceptable-use": {
    title: "Acceptable Use",
    summary: "Rules that protect customers, providers and AppForge infrastructure.",
    sections: [
      {
        heading: "Prohibited use",
        paragraphs: [
          "Do not use AppForge to compromise accounts or systems, distribute malware, evade access controls, steal credentials, deliberately expose another customer's data, conduct unlawful surveillance, abuse third-party services, or generate or deploy content or software in violation of applicable law or binding provider rules.",
          "Do not attempt to defeat tenant isolation, rate limits, billing controls, moderation safeguards, sandbox boundaries or security monitoring.",
        ],
      },
      {
        heading: "Enforcement",
        paragraphs: [
          "AppForge may pause builds, restrict provider operations, revoke sessions or suspend access when necessary to contain a credible security, abuse or service-integrity risk. Decisions should be evidence-based and proportionate, and support can be contacted if you believe a restriction is incorrect.",
        ],
      },
    ],
  },
  "refund-policy": {
    title: "Refund and Failure Settlement Policy",
    summary: "How subscriptions, credits and failed builds are treated.",
    sections: [
      {
        heading: "Build credits",
        paragraphs: [
          "A build should not unfairly consume credits when AppForge fails before useful work is delivered because of an AppForge defect, duplicate execution, qualifying interruption or a provider outage that is not caused by the customer's configuration. The service records reservations and settlement so eligible credits can be released or restored idempotently.",
          "Failures caused by invalid customer credentials, unsupported external requests, third-party rejection of a valid submission, or customer cancellation after material work has been performed can have different treatment. The failure result should explain the reason and the credit outcome rather than silently charging or refunding.",
        ],
      },
      {
        heading: "Subscriptions and payment disputes",
        paragraphs: [
          "Subscription cancellation, renewal and payment handling follow the checkout terms and billing-provider state shown to the customer. Where a payment is duplicated, reversed or disputed, AppForge reconciles access and the credit ledger against authoritative provider events instead of applying the same adjustment twice.",
        ],
      },
      {
        heading: "Requesting help",
        paragraphs: [
          "If an automated settlement is incorrect, contact support with the project or build reference. Support should be able to link the case to build evidence and any billing adjustment without requiring you to expose passwords, API keys or provider secrets.",
        ],
      },
    ],
  },
  security: {
    title: "Security",
    summary: "AppForge's public security and responsible-reporting information.",
    sections: [
      {
        heading: "Security approach",
        paragraphs: [
          "AppForge uses authenticated ownership checks, session controls, secret handling, tenant boundaries, validation, recovery checkpoints and security-focused testing as part of its engineering controls. Public claims are intentionally limited to controls and evidence that the product can actually prove.",
          "This page is not a claim of certification under SOC 2, ISO 27001, PCI DSS, GDPR or any other framework. Any future certification claim must be backed by current, auditable evidence before it appears here.",
        ],
      },
      {
        heading: "Report a security issue",
        paragraphs: [
          `Report suspected vulnerabilities privately to ${SUPPORT_EMAIL}. Include enough detail to reproduce the issue, but do not send passwords, private keys, payment-card numbers or unnecessary personal data.`,
          "Do not access, alter or retain another customer's data to prove a report. Stop testing if you encounter data that is not yours and report the boundary immediately.",
        ],
      },
      {
        heading: "Incidents",
        paragraphs: [
          "Security and reliability incidents are triaged by severity, contained, evidenced, recovered and followed by corrective work and regression testing. Customer communication depends on the incident's verified impact and available contact channels.",
        ],
      },
    ],
  },
};

export function TrustPolicy({ policyId }: { policyId?: string }) {
  const params = useParams();
  const id = policyId ?? params.policyId ?? "privacy";
  const policy = POLICIES[id];

  if (!policy) {
    return (
      <main className="forge-container forge-section">
        <h1 className="forge-h1">Policy not found</h1>
        <Link className="text-forge-cyan hover:underline" to="/help">
          Contact support
        </Link>
      </main>
    );
  }

  return (
    <main className="bg-forge-mesh">
      <article className="forge-container forge-section max-w-4xl">
        <p className="text-sm text-forge-text-muted">Effective {EFFECTIVE_DATE}</p>
        <h1 className="forge-h1 mt-2 mb-4">{policy.title}</h1>
        <p className="forge-body mb-4">{policy.summary}</p>
        <div className="mb-8 rounded-card border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-forge-text-muted">
          This policy describes AppForge's intended product behaviour and current operating rules. It is version-controlled with the product and must receive qualified legal review before being treated as final legal advice or a regulatory certification.
        </div>
        <div className="space-y-8">
          {policy.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="forge-h3 mb-3">{section.heading}</h2>
              <div className="space-y-3 text-forge-text-muted leading-relaxed">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <footer className="mt-10 border-t border-forge-border pt-6 text-sm text-forge-text-muted">
          Questions: <a className="text-forge-cyan hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See also <Link className="text-forge-cyan hover:underline" to="/help">Support</Link>.
        </footer>
      </article>
    </main>
  );
}
