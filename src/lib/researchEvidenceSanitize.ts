import type { WebSearchResult } from "../services/webSearch.js";
import type { EvidenceAuthority } from "./researchEvidenceTypes.js";

const OFFICIAL_HOST_HINTS = [
  "developer.mozilla.org",
  "docs.github.com",
  "nodejs.org",
  "react.dev",
  "nextjs.org",
  "typescriptlang.org",
  "python.org",
  "docs.python.org",
  "fastapi.tiangolo.com",
  "supabase.com",
  "stripe.com",
  "vercel.com",
  "openai.com",
  "developers.openai.com",
  "docs.anthropic.com",
  "w3.org",
  "ietf.org",
  "owasp.org",
  "nvd.nist.gov",
];

const REPOSITORY_HOSTS = new Set(["github.com", "gitlab.com", "bitbucket.org"]);
const STANDARDS_HOSTS = ["w3.org", "ietf.org", "nist.gov", "owasp.org"];
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
]);

export const CREDENTIAL_BEARING_PATTERN =
  /(?:api[_ -]?key|password|secret|credential|access[_ -]?token)\s*[:=]\s*[^\s]{4,}/i;

const INSTRUCTION_LIKE_PATTERNS = [
  /ignore\s+(?:all\s+|any\s+|the\s+)?previous\s+instructions?/i,
  /(?:reveal|print|return|show)\s+(?:the\s+)?(?:system|developer)\s+prompt/i,
  /(?:system|developer)\s+message\s*:/i,
  /you\s+are\s+(?:chatgpt|an?\s+ai|the\s+assistant)/i,
  /(?:api[_ -]?key|password|secret|credential)\s*[:=]/i,
  /execute\s+(?:this\s+)?(?:command|code|script)/i,
];

function isPrivateIpv4(host: string): boolean {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((n) => n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

export function safeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "invalid";
  }
}

/**
 * Research results are evidence only. Reject URLs that should never become
 * Planner evidence (non-web schemes, localhost/private-network targets, or
 * credential-bearing URLs), and canonicalize harmless tracking differences so
 * one source cannot masquerade as many independent sources.
 */
export function canonicalizeResearchUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;

    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (
      !host ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host === "::1" ||
      isPrivateIpv4(host)
    ) {
      return null;
    }

    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        TRACKING_PARAMS.has(key.toLowerCase())
      ) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = host;
    return url.toString();
  } catch {
    return null;
  }
}

export function containsInstructionLikeResearchText(text: string): boolean {
  return INSTRUCTION_LIKE_PATTERNS.some((pattern) => pattern.test(text));
}

function replaceUnsafeControlCharacters(value: string): string {
  let cleaned = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    const allowedWhitespace = code === 9 || code === 10 || code === 13;
    cleaned += allowedWhitespace || (code >= 32 && code !== 127) ? char : " ";
  }
  return cleaned;
}

export function sanitizeEvidenceText(text: string, maxLength: number): string {
  return replaceUnsafeControlCharacters(text)
    .replace(/```/g, "''' ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function classifyAuthority(url: string): EvidenceAuthority {
  const host = safeHost(url);
  if (STANDARDS_HOSTS.some((d) => host === d || host.endsWith(`.${d}`)))
    return "standards";
  if (OFFICIAL_HOST_HINTS.some((d) => host === d || host.endsWith(`.${d}`)))
    return "official";
  if (REPOSITORY_HOSTS.has(host)) return "repository";
  if (
    host.endsWith(".dev") ||
    host.endsWith(".io") ||
    host.includes("docs.") ||
    host.includes("developer.")
  )
    return "vendor";
  if (
    host === "stackoverflow.com" ||
    host === "reddit.com" ||
    host.endsWith(".reddit.com") ||
    host === "dev.to" ||
    host === "medium.com"
  )
    return "community";
  return "unknown";
}

export function baseAuthorityScore(authority: EvidenceAuthority): number {
  switch (authority) {
    case "standards":
      return 95;
    case "official":
      return 92;
    case "repository":
      return 82;
    case "vendor":
      return 76;
    case "community":
      return 58;
    default:
      return 48;
  }
}

function normalizeTopicTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9.+#-]+/)
    .filter((token) => token.length >= 4)
    .slice(0, 24);
}

export function relevanceScore(result: WebSearchResult, queries: string[]): number {
  const haystack = `${result.title} ${result.snippet} ${result.url}`.toLowerCase();
  const tokens = [...new Set(queries.flatMap(normalizeTopicTokens))];
  if (tokens.length === 0) return 0;
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return Math.min(10, Math.round((hits / Math.min(tokens.length, 10)) * 10));
}

export function claimFingerprint(result: WebSearchResult): Set<string> {
  return new Set(
    `${result.title} ${result.snippet}`
      .toLowerCase()
      .split(/[^a-z0-9.+#-]+/)
      .filter((token) => token.length >= 5),
  );
}

export function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const token of a) if (b.has(token)) common++;
  return common / Math.min(a.size, b.size);
}
