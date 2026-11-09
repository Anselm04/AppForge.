import { getStackAdapter } from "./stackAdapters.js";

// prettier-ignore
export type CustomerServiceCost = {
  service: string;
  provider: string;
  monthlyUsdCents: number | null;
  variable: boolean;
  billedTo: "customer" | "trillionai";
  notes: string;
};

// prettier-ignore
export type DeploymentChoice = {
  destination: string;
  label: string;
  explanation: string;
  accountOwner: string;
  priceKnown: false;
  priceNotice: string;
};

// prettier-ignore
const DEPLOY_LABELS: Record<string, string> = {
  vercel: "Vercel",
  netlify: "Netlify",
  fly: "Fly.io",
  "github-pages": "GitHub Pages",
  "google-play": "Google Play",
  "apple-app-store": "Apple App Store",
  "expo-eas": "Expo",
};

// prettier-ignore
export function compareDeploymentChoices(
  stack: string | null | undefined,
): DeploymentChoice[] {
  if (!stack) return [];
  let adapter;
  try {
    adapter = getStackAdapter(stack);
  } catch {
    return [];
  }
  if (adapter.generationMode !== "runnable") return [];
  return adapter.deploymentTargets
    .filter((destination) => destination !== "preview")
    .map((destination) => ({
      destination,
      label: DEPLOY_LABELS[destination] ?? destination,
      explanation:
        destination === "github-pages"
          ? "Suitable for static sites; backend services need separate hosting."
          : destination === "google-play" ||
              destination === "apple-app-store"
            ? "Store publication requires your own developer account and platform approval."
            : "Requires an account with this hosting provider. Usage, storage and add-ons may cost extra.",
      accountOwner: "Your own provider account",
      priceKnown: false as const,
      priceNotice: "Check your provider quote; no live price is connected.",
    }));
}

// prettier-ignore
export function summariseOngoingCosts(costs: CustomerServiceCost[]) {
  const knownMonthlyUsdCents = costs.reduce(
    (sum, cost) => sum + (cost.monthlyUsdCents ?? 0),
    0,
  );
  const hasUnknownCosts = costs.some(
    (cost) => cost.monthlyUsdCents === null || cost.variable,
  );
  return {
    knownMonthlyUsdCents,
    hasUnknownCosts,
    label: hasUnknownCosts
      ? "Known monthly costs plus variable or unquoted charges"
      : "Customer-recorded monthly estimate",
  };
}

// prettier-ignore
export function aftercareGuidance(
  question: string,
  input: {
    name: string;
    stack: string | null;
    status: string | null;
    costs: CustomerServiceCost[];
  },
): string {
  const q = question.trim().toLowerCase();
  const summary = summariseOngoingCosts(input.costs);
  if (/cost|price|fee|pay|bill|subscription|expense/.test(q)) {
    const known = (summary.knownMonthlyUsdCents / 100).toFixed(2);
    return `For ${input.name}, your recorded recurring costs total USD $${known}/month. ${summary.hasUnknownCosts ? "Some services also have variable or unknown charges; this is not a final invoice." : "This is based on your saved estimates, not live provider invoices."} Review every provider's billing dashboard for current charges and limits.`;
  }
  if (/deploy|launch|publish|live|hosting|domain/.test(q)) {
    return `Your project uses ${input.stack || "an unconfirmed technology stack"} and its recorded build status is ${input.status || "unknown"}. Open the project workspace and choose a supported deployment option. Connect only your own provider account, review its price, then verify the actual live URL. A build or source export is not proof of publication.`;
  }
  if (/backup|maintain|update|security|repair|error|broken|crash/.test(q)) {
    return `For ${input.name}, start by checking the deployed host's health logs and the latest successful build. Back up data before updating. Review dependency/security updates, domain renewal and any provider usage limits. If the issue continues, open a support case with the error message but never a password or API key.`;
  }
  if (/cancel|move|migrat|lock.in|transfer|ownership/.test(q)) {
    return "Export your source and data before cancelling a host. Confirm where the database, files, domain and secrets are held. Your own provider account keeps billing under your control. Check licence and data-export rules before migration.";
  }
  return `I can help with deployment, recurring costs, maintenance, backups and provider changes for ${input.name}. Ask one specific question and I will explain the relevant next steps. For an unresolved product defect, open a support case.`;
}
