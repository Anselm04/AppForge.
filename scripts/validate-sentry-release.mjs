export function validateSentryReleaseConfig(
  environment,
  { production = false } = {},
) {
  const required = [
    "SENTRY_AUTH_TOKEN",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    "RELEASE_SHA",
  ];
  const missing = required.filter((name) => !environment[name]);

  if (!production) {
    return { valid: true, missing };
  }
  if (missing.length > 0) {
    throw new Error(
      `Production source-map release requires: ${missing.join(", ")}.`,
    );
  }
  if (!/^[a-f0-9]{40}$/i.test(environment.RELEASE_SHA)) {
    throw new Error(
      "RELEASE_SHA must be the exact 40-character release commit SHA.",
    );
  }

  const expectedRelease = `appforge@${environment.RELEASE_SHA}`;
  if (environment.SENTRY_RELEASE !== expectedRelease) {
    throw new Error(
      "SENTRY_RELEASE must equal appforge@RELEASE_SHA for deterministic release mapping.",
    );
  }
  return { valid: true, release: expectedRelease };
}

const production = process.argv.includes("--production");
try {
  const result = validateSentryReleaseConfig(process.env, { production });
  if (production) {
    console.log("Production Sentry release configuration is complete.");
  } else if (result.missing.length > 0) {
    console.log("Sentry release credentials are optional outside production.");
  } else {
    console.log("Sentry release configuration is valid.");
  }
} catch (error) {
  console.error(
    "[sentry-release] FAILED",
    error instanceof Error ? error.message : "configuration validation failed",
  );
  process.exitCode = 1;
}
