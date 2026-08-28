import { mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const CACHE_ROOT = join(tmpdir(), "appforge-npm-cache");

export async function npmCacheEnv(): Promise<Record<string, string>> {
  await mkdir(CACHE_ROOT, { recursive: true });
  return {
    npm_config_cache: CACHE_ROOT,
    npm_config_prefer_offline: "true",
  };
}
