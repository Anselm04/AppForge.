export type IsolatedRuntimePurpose = "build" | "preview" | "health" | "agent";
export type IsolatedRuntimeConfig = {
  url: string;
  token: string;
  provider: "isolated" | "sprites";
};

export function spritesDisabled(): boolean {
  return process.env.SPRITES_DISABLED?.trim().toLowerCase() === "true";
}

export function isolatedRuntimeConfig(
  purpose: IsolatedRuntimePurpose,
): IsolatedRuntimeConfig | null {
  const value = (name: string) => process.env[name]?.trim() || "";
  const neutralNames = [
    "ISOLATED_BUILD_URL",
    "ISOLATED_PREVIEW_URL",
    "ISOLATED_EXEC_URL",
    "ISOLATED_HEALTH_URL",
    "ISOLATED_RUNTIME_TOKEN",
  ];
  // An incomplete provider-neutral configuration must never silently fall
  // through to a metered legacy provider.
  const neutral = neutralNames.some((name) => Boolean(value(name)));
  if (neutral) {
    const token = value("ISOLATED_RUNTIME_TOKEN");
    const url =
      purpose === "build"
        ? value("ISOLATED_BUILD_URL") || value("ISOLATED_EXEC_URL")
        : purpose === "preview"
          ? value("ISOLATED_PREVIEW_URL") || value("ISOLATED_EXEC_URL")
          : purpose === "health"
            ? value("ISOLATED_HEALTH_URL")
            : value("ISOLATED_EXEC_URL");
    if (!url || !token) return null;
    return { url, token, provider: "isolated" };
  }
  if (spritesDisabled()) return null;
  const token = value("SPRITES_API_TOKEN");
  const url =
    purpose === "build"
      ? value("SPRITES_BUILD_URL") || value("SPRITES_EXEC_URL")
      : purpose === "preview"
        ? value("SPRITES_PREVIEW_URL") || value("SPRITES_EXEC_URL")
        : purpose === "health"
          ? value("SPRITES_HEALTH_URL")
          : value("SPRITES_EXEC_URL");
  return url && token ? { url, token, provider: "sprites" } : null;
}

export function assertRuntimeProviderAllowed(endpoint: URL): void {
  const hostname = endpoint.hostname.toLowerCase().replace(/\.$/, "");
  if (
    spritesDisabled() &&
    (hostname === "sprites.app" || hostname.endsWith(".sprites.app"))
  ) {
    throw new Error("Sprites execution is disabled");
  }
}
