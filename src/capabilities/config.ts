type CapabilityEnv = Partial<
  Record<
    "CAPABILITY_BROKER_ENABLED" | "COMPOSIO_ENABLED" | "COMPOSIO_API_KEY",
    string | undefined
  >
>;

function parseBoolean(name: string, value: string | undefined): boolean {
  if (value === undefined || value.trim() === "") return false;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`${name} must be a boolean flag`);
}

export function resolveCapabilityConfig(
  env: CapabilityEnv = process.env,
): {
  brokerEnabled: boolean;
  composioEnabled: boolean;
  composioConfigured: boolean;
  composioApiKey: string;
} {
  const brokerEnabled = parseBoolean(
    "CAPABILITY_BROKER_ENABLED",
    env.CAPABILITY_BROKER_ENABLED,
  );
  const composioEnabled = parseBoolean(
    "COMPOSIO_ENABLED",
    env.COMPOSIO_ENABLED,
  );
  const composioApiKey = env.COMPOSIO_API_KEY?.trim() ?? "";

  return {
    brokerEnabled,
    composioEnabled,
    composioConfigured:
      brokerEnabled && composioEnabled && composioApiKey.length > 0,
    composioApiKey,
  };
}
