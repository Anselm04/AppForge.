import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  scanProjectFiles,
  validateGeneratedSecurityPosture,
} from "./projectSecurityScanner.js";

type HostProof = {
  passed: boolean;
  stage: string;
  errors: string[];
  durationMs: number;
  isolationId: string;
  artifactSha256: string;
  techStack: string;
  steps: Record<string, { passed?: boolean }>;
};
type HostController = {
  existingHostReady(): boolean;
  validateExistingHost(
    files: Record<string, string>,
    techStack: string,
    options: { sourceSecurityVerified: boolean },
  ): Promise<HostProof>;
};

// The controller stays outside the server output: its relative tooling paths
// must resolve to the immutable runtime directory copied into the image.
async function controller(): Promise<HostController> {
  return import(
    pathToFileURL(resolve("scripts/runtime/existing-host-controller.mjs")).href
  );
}

export async function existingHostBuildReady(): Promise<boolean> {
  if (process.env.EXISTING_HOST_SANDBOX_ENABLED !== "true") return false;
  try {
    return (await controller()).existingHostReady();
  } catch {
    return false;
  }
}

export async function validateWithExistingHost(
  files: Record<string, string>,
  techStack: string,
): Promise<HostProof | null> {
  if (process.env.EXISTING_HOST_SANDBOX_ENABLED !== "true") return null;
  // Repeat the source gate at this entry point; callers cannot assert their
  // own sourceSecurityVerified flag or bypass review by calling this directly.
  const findings = [
    ...scanProjectFiles(files).findings.filter(
      (finding) =>
        finding.severity === "critical" || finding.severity === "high",
    ),
    ...validateGeneratedSecurityPosture(files, techStack),
  ];
  if (findings.length) {
    return {
      passed: false,
      stage: "security",
      errors: findings.map(
        (finding) => `${finding.ruleId}: ${finding.message}`,
      ),
      durationMs: 0,
      isolationId: "",
      artifactSha256: "",
      techStack,
      steps: {},
    };
  }
  if (!(await existingHostBuildReady())) {
    return {
      passed: false,
      stage: "isolation",
      errors: ["Existing-host isolation has not qualified startup preparation"],
      durationMs: 0,
      isolationId: "",
      artifactSha256: "",
      techStack,
      steps: {},
    };
  }
  return (await controller()).validateExistingHost(files, techStack, {
    sourceSecurityVerified: true,
  });
}
