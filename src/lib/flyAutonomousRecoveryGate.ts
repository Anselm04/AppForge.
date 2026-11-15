/**
 * An autonomous repair is permitted to prepare and validate source without
 * permission to spend or deploy. The historical production-auto-deploy path
 * targets Fly.io; keep it disconnected unless the owner explicitly reconnects
 * the provider AND enables autonomous production recovery.
 *
 * Do not infer permission from legacy FLY_API_TOKEN or Sentry environment.
 */
export function flyAutonomousRecoveryAuthorized(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.APPFORGE_FLY_OWNER_RECONNECTED === "true" &&
    env.APPFORGE_AUTONOMOUS_PRODUCTION_DEPLOY === "true" &&
    typeof env.FLY_API_TOKEN === "string" &&
    env.FLY_API_TOKEN.trim().length > 0
  );
}
