import { resolve } from "node:path";

/**
 * Child processes that execute generated customer content must never inherit
 * the privileged AppForge environment. Filesystem/process isolation is still
 * required separately; this layer prevents accidental environment disclosure.
 */
const HOST_KEYS = [
  "PATH",
  "LANG",
  "LC_ALL",
  "SYSTEMROOT",
  "WINDIR",
  "TERM",
] as const;
const ALLOWED_OVERRIDES = new Set([
  "NODE_ENV",
  "NODE_OPTIONS",
  "PORT",
  "HOST",
  "npm_config_cache",
  "npm_config_prefer_offline",
]);

export function generatedChildEnvironment(
  workspace: string,
  overrides: Record<string, string> = {},
  hostEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {
    HOME: resolve(workspace),
    TMPDIR: resolve(workspace),
    TEMP: resolve(workspace),
    TMP: resolve(workspace),
    NODE_ENV: "test",
    npm_config_userconfig: resolve(workspace, ".npmrc"),
  };
  for (const key of HOST_KEYS) {
    if (hostEnv[key]) result[key] = hostEnv[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (!ALLOWED_OVERRIDES.has(key) || typeof value !== "string") {
      throw new Error(
        `Unsupported generated-process environment override: ${key}`,
      );
    }
    result[key] = value;
  }
  return result;
}
