import { createHash } from "node:crypto";
import type { StackAdapter } from "../lib/stackAdapters.js";
import type { ArtifactIntegrity } from "../lib/artifactIntegrity.js";

export type PreviewArtifact = {
  snapshotId: number;
  version: number;
  files: Record<string, string>;
  integrity: ArtifactIntegrity;
};

type RemotePreviewEnvelope = {
  url?: unknown;
  expiresAt?: unknown;
  data?: { url?: unknown; expiresAt?: unknown };
  result?: { url?: unknown; expiresAt?: unknown };
};

type CachedPreview = { url: string; expiresAt: number };

const runtimeCache = new Map<string, CachedPreview>();
const DEFAULT_TTL_MS = 10 * 60_000;
const MIN_TTL_MS = 30_000;

function previewEndpoint(): URL | null {
  const raw = process.env.SPRITES_PREVIEW_URL?.trim();
  if (!raw) return null;
  const endpoint = new URL(raw);
  if (endpoint.username || endpoint.password) {
    throw new Error("Sprites preview URL must not contain credentials");
  }
  if (process.env.NODE_ENV === "production" && endpoint.protocol !== "https:") {
    throw new Error("Sprites production preview URL must use HTTPS");
  }
  return endpoint;
}

export function isolatedPreviewConfigured(): boolean {
  return Boolean(
    process.env.SPRITES_PREVIEW_URL?.trim() &&
      process.env.SPRITES_API_TOKEN?.trim(),
  );
}

function allowedPreviewHost(hostname: string, endpoint: URL): boolean {
  if (hostname === endpoint.hostname) return true;
  if (hostname.endsWith(".sprites.app")) return true;
  const configured = (process.env.SPRITES_PREVIEW_HOST_SUFFIXES || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configured.some(
    (suffix) => hostname === suffix || hostname.endsWith("." + suffix),
  );
}

export function validateIsolatedPreviewUrl(
  raw: string,
  endpointRaw?: string,
): string {
  const endpoint = endpointRaw ? new URL(endpointRaw) : previewEndpoint();
  if (!endpoint) throw new Error("Sprites preview runtime is not configured");
  const url = new URL(raw);
  if (url.username || url.password) {
    throw new Error("Isolated preview URL must not contain credentials");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("Isolated production preview must use HTTPS");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Isolated preview URL must use HTTP(S)");
  }
  if (!allowedPreviewHost(url.hostname.toLowerCase(), endpoint)) {
    throw new Error("Untrusted isolated preview host: " + url.hostname);
  }
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function joinIsolatedPreviewUrl(
  base: string,
  requestPath: string,
): string {
  const url = new URL(base.endsWith("/") ? base : base + "/");
  const cleanPath = requestPath.split("?")[0]?.split("#")[0] ?? "";
  const safePath = cleanPath.startsWith("/") ? cleanPath.slice(1) : cleanPath;
  url.pathname = (url.pathname.replace(/\/$/, "") + "/" + safePath).replace(
    /\/+/g,
    "/",
  );
  url.search = "";
  url.hash = "";
  return url.toString();
}

function cacheKey(
  projectId: number,
  artifact: PreviewArtifact,
  stack: StackAdapter,
): string {
  return [
    projectId,
    artifact.snapshotId,
    artifact.version,
    artifact.integrity.sha256,
    stack.id,
  ].join(":");
}

export function invalidateIsolatedPreview(projectId: number): void {
  const prefix = String(projectId) + ":";
  for (const key of runtimeCache.keys()) {
    if (key.startsWith(prefix)) runtimeCache.delete(key);
  }
}

function parseExpiry(value: unknown): number {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return Math.max(Date.now() + MIN_TTL_MS, parsed);
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(Date.now() + MIN_TTL_MS, value);
  }
  return Date.now() + DEFAULT_TTL_MS;
}

export async function ensureIsolatedPreview(input: {
  projectId: number;
  artifact: PreviewArtifact;
  stack: StackAdapter;
}): Promise<string | null> {
  const endpoint = previewEndpoint();
  const token = process.env.SPRITES_API_TOKEN?.trim();
  if (!endpoint || !token) return null;

  const key = cacheKey(input.projectId, input.artifact, input.stack);
  const cached = runtimeCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 5_000) return cached.url;

  const serializedFiles = JSON.stringify(input.artifact.files);
  if (Buffer.byteLength(serializedFiles, "utf8") > 10 * 1024 * 1024) {
    throw new Error("Generated project exceeds isolated preview payload limit");
  }
  const payloadSha256 = createHash("sha256")
    .update(serializedFiles)
    .digest("hex");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
        "x-appforge-agent-runtime": "sprites-preview",
        "x-appforge-artifact-sha256": input.artifact.integrity.sha256,
      },
      body: JSON.stringify({
        operation: "preview-generated-product",
        projectId: input.projectId,
        snapshotId: input.artifact.snapshotId,
        artifactVersion: input.artifact.version,
        artifactSha256: input.artifact.integrity.sha256,
        payloadSha256,
        techStack: input.stack.id,
        runtime: input.stack.runtime,
        previewMode: input.stack.previewMode,
        buildCommand: input.stack.buildCommand,
        startCommand: input.stack.startCommand,
        files: input.artifact.files,
        policy: {
          disposable: true,
          cleanWorkspace: true,
          noHostCredentials: true,
          networkIsolation: true,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        "Sprites preview runtime failed with HTTP " + response.status,
      );
    }

    const envelope = (await response.json()) as RemotePreviewEnvelope;
    const payload = envelope.data ?? envelope.result ?? envelope;
    const rawUrl = typeof payload.url === "string" ? payload.url : "";
    if (!rawUrl.trim()) {
      throw new Error("Sprites preview runtime returned no URL");
    }

    const url = validateIsolatedPreviewUrl(rawUrl);
    runtimeCache.set(key, { url, expiresAt: parseExpiry(payload.expiresAt) });
    return url;
  } finally {
    clearTimeout(timeout);
  }
}
