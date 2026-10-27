/** Auth links must never trust the incoming request's Host header. */
function trustedAppOrigin(): string {
  const configured = (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ""
  ).trim();
  if (!configured) throw new Error("A trusted auth origin is required");
  const url = new URL(configured);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  ) {
    throw new Error("Invalid trusted auth origin");
  }
  return url.origin;
}

export function signupRedirect(next: string): string {
  return `${trustedAppOrigin()}/login?next=${encodeURIComponent(next)}`;
}

export function passwordRecoveryRedirect(): string {
  return `${trustedAppOrigin()}/password-reset`;
}
