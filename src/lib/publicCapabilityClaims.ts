export const CAPABILITY_MATURITY = [
  "planned",
  "experimental",
  "structural",
  "buildable",
  "runnable",
  "deployable",
  "verified",
  "production-certified",
] as const;

export type CapabilityMaturity = (typeof CAPABILITY_MATURITY)[number];

export type CapabilityEvidence = {
  adapter?: CapabilityMaturity;
  resource?: CapabilityMaturity;
  runtime?: CapabilityMaturity;
  platform?: CapabilityMaturity;
  regressionHealthy: boolean;
};

export type PublicCapabilityClaim = {
  maturity: CapabilityMaturity;
  customerLabel: string;
  canPromise: boolean;
  explanation: string;
};

const CUSTOMER_LABEL: Record<CapabilityMaturity, string> = {
  planned: "Not yet available",
  experimental: "Experimental",
  structural: "Foundation available",
  buildable: "Build support",
  runnable: "Runnable",
  deployable: "Deployable",
  verified: "Verified",
  "production-certified": "Production certified",
};

const EXPLANATION: Record<CapabilityMaturity, string> = {
  planned:
    "Required evidence is missing, so AppForge does not claim support yet.",
  experimental:
    "Evidence exists, but this capability is not ready for a production promise.",
  structural:
    "The required structure exists, but end-to-end build evidence is incomplete.",
  buildable:
    "AppForge has build evidence, but runtime evidence is not yet complete.",
  runnable:
    "The generated result has runtime evidence, but deployment evidence is not yet complete.",
  deployable:
    "Deployment evidence exists, but full verification is not yet complete.",
  verified:
    "The capability has current verification evidence, but is not production-certified.",
  "production-certified":
    "Current adapter, resource, runtime and platform evidence is production-certified.",
};

function rank(maturity: CapabilityMaturity): number {
  return CAPABILITY_MATURITY.indexOf(maturity);
}

export function publicClaimForEvidence(
  evidence: CapabilityEvidence,
): PublicCapabilityClaim {
  const dimensions = [
    evidence.adapter,
    evidence.resource,
    evidence.runtime,
    evidence.platform,
  ];

  if (dimensions.some((value) => !value)) {
    return {
      maturity: "planned",
      customerLabel: CUSTOMER_LABEL.planned,
      canPromise: false,
      explanation: EXPLANATION.planned,
    };
  }

  if (!evidence.regressionHealthy) {
    return {
      maturity: "experimental",
      customerLabel: CUSTOMER_LABEL.experimental,
      canPromise: false,
      explanation:
        "A regression invalidated the previous claim. AppForge has downgraded this capability until fresh evidence passes.",
    };
  }

  const maturity = (dimensions as CapabilityMaturity[]).reduce(
    (lowest, current) => (rank(current) < rank(lowest) ? current : lowest),
  );

  return {
    maturity,
    customerLabel: CUSTOMER_LABEL[maturity],
    canPromise: maturity === "production-certified",
    explanation: EXPLANATION[maturity],
  };
}

export function isPubliclyUsable(maturity: CapabilityMaturity): boolean {
  return rank(maturity) >= rank("runnable");
}
