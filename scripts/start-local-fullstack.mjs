#!/usr/bin/env node
/**
 * Run the actual integrated AppForge Node/React application on a trusted Linux
 * development host. PostgreSQL and Redis remain private Docker dependencies;
 * Docker validation of generated code uses the host's existing Docker CLI.
 *
 * This is an owner-only, loopback-bound verification environment, not public
 * multi-tenant production hosting. It never contacts Fly or Sprites.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

const root = resolve(import.meta.dirname, "..");
const envFile = resolve(root, ".env.production");
if (!existsSync(envFile)) {
  throw new Error("Missing private .env.production configuration");
}
const loaded = config({ path: envFile });
if (loaded.error) throw loaded.error;

for (const name of ["POSTGRES_PASSWORD", "REDIS_PASSWORD"]) {
  if (!process.env[name]?.trim()) {
    throw new Error(`Required local database setting is missing: ${name}`);
  }
}

const docker = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
  cwd: root,
  stdio: "ignore",
});
if (docker.status !== 0) {
  throw new Error("Docker Engine is not accessible on this Linux host");
}

const compose = spawnSync(
  "docker",
  [
    "compose",
    "--env-file",
    envFile,
    "-f",
    "docker-compose.prod.yml",
    "up",
    "-d",
    "postgres",
    "redis",
  ],
  { cwd: root, stdio: "inherit" },
);
if (compose.status !== 0) {
  throw new Error("Private PostgreSQL/Redis startup failed");
}
if (!existsSync(resolve(root, "dist/server.js"))) {
  throw new Error("Build the real application first: npm ci && npm run build");
}

const dbUser = encodeURIComponent(process.env.POSTGRES_USER || "appforge");
const dbPassword = encodeURIComponent(process.env.POSTGRES_PASSWORD);
const dbName = encodeURIComponent(process.env.POSTGRES_DB || "appforge");
const redisPassword = encodeURIComponent(process.env.REDIS_PASSWORD);
const env = {
  ...process.env,
  NODE_ENV: "production",
  PORT: "3000",
  BIND_HOST: "127.0.0.1",
  APP_URL: "http://127.0.0.1:3000",
  CORS_ORIGIN: "http://127.0.0.1:3000",
  DATABASE_URL: `postgresql://${dbUser}:${dbPassword}@127.0.0.1:55432/${dbName}`,
  REDIS_URL: `redis://:${redisPassword}@127.0.0.1:56379`,
  SPRITES_DISABLED: "true",
  ISOLATED_BUILD_URL: "",
  ISOLATED_EXEC_URL: "",
  ISOLATED_PREVIEW_URL: "",
  ISOLATED_HEALTH_URL: "",
  ISOLATED_RUNTIME_TOKEN: "",
  DOCKER_VALIDATION: "true",
};
const server = spawn(process.execPath, ["dist/server.js"], {
  cwd: root,
  env,
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("error", (error) => {
  process.stderr.write(`AppForge startup failed: ${error.message}\n`);
  process.exitCode = 1;
});
server.on("exit", (code, signal) => {
  if (signal) process.exitCode = 1;
  else process.exitCode = code ?? 1;
});
