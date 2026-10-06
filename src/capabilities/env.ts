export type CapabilityProviderEnvResult = {
  valid: boolean;
  errors: string[];
  brokerEnabled: boolean;
  composioEnabled: boolean;
  composioApiKey: string;
};

function parseBoolean(name: string, value: string | undefined, errors: string[]): boolean {
  if (value === undefined || value.trim() === "") return false;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  errors.push(`${name} must be exactly true or false`);
  return false;
}

export function validateCapabilityProviderEnv(
  env: Record<string, string | undefined> = process.env,
): CapabilityProviderEnvResult {
  const errors: string[] = [];
  const brokerEnabled = parseBoolean(
    "CAPABILITY_BROKER_ENABLED",
    env.CAPABILITY_BROKER_ENABLED,
    errors,
  );
  const composioEnabled = parseBoolean(
    "COMPOSIO_ENABLED",
    env.COMPOSIO_ENABLED,
    errors,
  );
  const composioApiKey = env.COMPOSIO_API_KEY?.trim() ?? "";

  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("VITE_COMPOSIO") && value?.trim()) {
      errors.push(`${key} is forbidden: Composio credentials are server-only`);
    }
  }

  if (composioEnabled && !brokerEnabled) {
    errors.push("COMPOSIO_ENABLED=true requires CAPABILITY_BROKER_ENABLED=true");
  }
  if (composioEnabled && !composioApiKey) {
    errors.push("COMPOSIO_ENABLED=true requires COMPOSIO_API_KEY");
  }

  return {
    valid: errors.length === 0,
    errors,
    brokerEnabled,
    composioEnabled,
    composioApiKey,
  };
}

export function requireValidCapabilityProviderEnv(
  env: Record<string, string | undefined> = process.env,
): CapabilityProviderEnvResult {
  const result = validateCapabilityProviderEnv(env);
  if (!result.valid) {
    throw new Error(`Invalid capability provider environment: ${result.errors.join("; ")}`);
  }
  return result;
}
