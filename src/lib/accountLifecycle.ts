export type AccountPreferences = {
  language: string;
  communications: {
    product: boolean;
    billing: boolean;
    marketing: boolean;
  };
  accessibility: {
    reducedMotion: boolean;
    highContrast: boolean;
  };
};

export const DEFAULT_ACCOUNT_PREFERENCES: AccountPreferences = {
  language: "en",
  communications: {
    product: true,
    billing: true,
    marketing: false,
  },
  accessibility: {
    reducedMotion: false,
    highContrast: false,
  },
};

const LANGUAGE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;
const RECENT_SESSION_SECONDS = 15 * 60;

export function normalizeAccountPreferences(
  input: Partial<AccountPreferences> | null | undefined,
): AccountPreferences {
  const language =
    typeof input?.language === "string" && LANGUAGE.test(input.language.trim())
      ? input.language.trim()
      : DEFAULT_ACCOUNT_PREFERENCES.language;

  return {
    language,
    communications: {
      product:
        input?.communications?.product ??
        DEFAULT_ACCOUNT_PREFERENCES.communications.product,
      billing:
        input?.communications?.billing ??
        DEFAULT_ACCOUNT_PREFERENCES.communications.billing,
      marketing:
        input?.communications?.marketing ??
        DEFAULT_ACCOUNT_PREFERENCES.communications.marketing,
    },
    accessibility: {
      reducedMotion:
        input?.accessibility?.reducedMotion ??
        DEFAULT_ACCOUNT_PREFERENCES.accessibility.reducedMotion,
      highContrast:
        input?.accessibility?.highContrast ??
        DEFAULT_ACCOUNT_PREFERENCES.accessibility.highContrast,
    },
  };
}

function decodeJwtPayload(token: string): { iat?: number } | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      iat?: number;
    };
  } catch {
    return null;
  }
}

export function assertRecentSession(
  accessToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): void {
  const payload = decodeJwtPayload(accessToken);
  if (
    typeof payload?.iat !== "number" ||
    payload.iat > nowSeconds + 60 ||
    nowSeconds - payload.iat > RECENT_SESSION_SECONDS
  ) {
    throw new Error(
      "For security, sign in again before permanently deleting your account.",
    );
  }
}

export type AccountDeletionDependencies = {
  loadUser(
    userId: number,
  ): Promise<{ id: number; openId?: string | null } | undefined>;
  beginDeletion(userId: number): Promise<void>;
  stopCustomerWork(userId: number): Promise<void>;
  disableEntitlements(userId: number): Promise<void>;
  revokeIdentity(openId: string): Promise<void>;
  deleteCustomerProjects(userId: number): Promise<void>;
  deleteProviderConnections(userId: number): Promise<void>;
  anonymizeAccount(userId: number): Promise<void>;
  recordAudit(userId: number): Promise<void>;
  revokeSessions(userId: number): Promise<void>;
};

export async function completeAccountDeletion(
  userId: number,
  dependencies: AccountDeletionDependencies,
): Promise<void> {
  const user = await dependencies.loadUser(userId);
  if (!user || user.id !== userId) throw new Error("Account not found");

  await dependencies.beginDeletion(userId);
  await dependencies.stopCustomerWork(userId);
  await dependencies.disableEntitlements(userId);

  // Keep the identity and current session available until retryable local
  // cleanup has completed. That prevents a transient database failure from
  // stranding a customer in a pending-deletion state they cannot resume.
  await dependencies.deleteCustomerProjects(userId);
  await dependencies.deleteProviderConnections(userId);

  // A retry may arrive after the provider identity was already revoked and
  // the retained AppForge user row was anonymized. In that case openId is
  // intentionally null and the remaining idempotent cleanup may continue.
  if (user.openId) {
    await dependencies.revokeIdentity(user.openId);
  }

  await dependencies.anonymizeAccount(userId);
  await dependencies.recordAudit(userId);
  await dependencies.revokeSessions(userId);
}
