import { decryptUtf8, encryptUtf8 } from "./serverSecrets.js";

const PREFIX = "enc:v1:";
const PURPOSE = "github-oauth-token";

export function protectGithubAccessToken(token: string): string {
  const value = token.trim();
  if (!value) throw new Error("GitHub access token is empty");
  if (value.startsWith(PREFIX)) return value;
  return `${PREFIX}${encryptUtf8(value, PURPOSE)}`;
}

export function revealGithubAccessToken(stored: string): string {
  const value = stored.trim();
  if (!value) throw new Error("GitHub access token is empty");

  // Backward compatibility for existing plaintext rows. They remain usable
  // until the user reconnects GitHub, at which point the token is rewritten
  // using authenticated AES-256-GCM encryption.
  if (!value.startsWith(PREFIX)) return value;

  return decryptUtf8(value.slice(PREFIX.length), PURPOSE);
}
