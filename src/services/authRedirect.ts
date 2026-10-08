/** Confirmation links must never trust the incoming request's Host header. */
export function signupRedirect(next: string): string {
  const configured = (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ""
  ).trim();
  if (!configured) throw new Error("A trusted signup origin is required");
  const url = new URL(configured);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  ) {
    throw new Error("Invalid trusted signup origin");
  }
  return `${url.origin}/login?next=${encodeURIComponent(next)}`;
}
