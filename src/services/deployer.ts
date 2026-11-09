import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import JSZip from "jszip";
import { getStackAdapter } from "../lib/stackAdapters.js";
import { assertProductComplete } from "../lib/incompleteProduct.js";
import type { ProductContract } from "../lib/productContract.js";
import type { ProductPlan } from "../lib/productPlan.js";

export type DeployDestination =
  "vercel" | "netlify" | "fly" | "github-pages" | "zip" | "preview";
export type DeployDestinationStatus = Record<
  DeployDestination,
  { configured: boolean; label: string }
>;

// Local development uses a per-process unpredictable secret instead of a
// publicly known signing key. Production must use an operator-configured key.
const developmentPreviewSecret = randomBytes(32).toString("hex");

function previewSigningSecret(): string {
  const configured = [
    process.env.PREVIEW_SECRET,
    process.env.COOKIE_SECRET,
    process.env.JWT_SECRET,
  ].find((value) => value?.trim());
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return developmentPreviewSecret;
  throw new Error(
    "Signed previews require PREVIEW_SECRET, COOKIE_SECRET, or JWT_SECRET in production",
  );
}

export function previewSignature(projectId: number): string {
  return createHmac("sha256", previewSigningSecret())
    .update(`preview:${projectId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyPreviewSignature(
  projectId: number,
  sig: string | undefined,
): boolean {
  if (!sig || !/^[a-f0-9]{32}$/.test(sig)) return false;
  let expected: string;
  try {
    expected = previewSignature(projectId);
  } catch {
    // Missing configuration must never grant anonymous signed access.
    return false;
  }
  return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
}

function customerHostingError(): Error {
  return new Error(
    "Customer hosting requires your own provider account. AppForge never deploys customer products using its shared hosting credentials. Export to GitHub or download the ZIP, then deploy through your own host.",
  );
}

/** Legacy entry point fails closed; platform credentials are never customer hosting. */
export async function deployToVercel(
  _projectName: string,
  _files: Record<string, string>,
): Promise<string> {
  throw customerHostingError();
}

export async function zipFiles(
  projectName: string,
  files: Record<string, string>,
): Promise<{ base64: string; filename: string }> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    if (
      !path ||
      path !== path.replace(/\\/g, "/") ||
      path.startsWith("/") ||
      /^[a-z]:/i.test(path) ||
      [...path].some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
      }) ||
      path
        .split("/")
        .some((segment) => !segment || segment === "." || segment === "..")
    ) {
      throw new Error(`Unsafe project export path: ${path}`);
    }
    zip.file(path, content);
  }
  const b = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  return {
    base64: b.toString("base64"),
    filename: `${projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .slice(0, 30)}-appforge.zip`,
  };
}

export function assertArtifactMatchesWorkingFiles(input: {
  workingFiles: Record<string, string>;
  validatedFiles: Record<string, string>;
}): void {
  const workingPaths = Object.keys(input.workingFiles);
  const validatedPaths = Object.keys(input.validatedFiles);
  if (
    workingPaths.length !== validatedPaths.length ||
    workingPaths.some(
      (path) => input.workingFiles[path] !== input.validatedFiles[path],
    )
  ) {
    throw new Error(
      "Saved project edits are unvalidated. Rebuild and validate the current source before previewing, exporting, or deploying.",
    );
  }
}

export function listDeployDestinations(): DeployDestinationStatus {
  return {
    vercel: { configured: false, label: "Vercel — use your own account" },
    netlify: {
      configured: false,
      label: "Netlify — use your own account",
    },
    fly: { configured: false, label: "Fly.io — use your own account" },
    "github-pages": {
      configured: false,
      label: "GitHub Pages",
    },
    zip: { configured: true, label: "ZIP download" },
    preview: { configured: true, label: "AppForge live preview" },
  };
}
export const getDeployDestinationStatus = listDeployDestinations;

export async function deployProject(opts: {
  destination: DeployDestination;
  projectName: string;
  files: Record<string, string>;
  projectId?: number;
  previewBaseUrl?: string;
  techStack?: string;
  productContract?: ProductContract;
  productPlan?: ProductPlan;
}): Promise<{ url: string; destination: DeployDestination; note?: string }> {
  const {
    destination,
    projectName,
    files,
    projectId,
    previewBaseUrl,
    techStack,
    productContract,
    productPlan,
  } = opts;
  const productionDestination =
    destination === "vercel" ||
    destination === "netlify" ||
    destination === "fly" ||
    destination === "github-pages";

  if (productionDestination && !techStack) {
    throw new Error(
      "Production deployment requires the canonical selected technology stack",
    );
  }
  if (productionDestination && !productContract) {
    throw new Error(
      "Production deployment requires the canonical product contract so incomplete artifacts cannot bypass validation",
    );
  }

  if (techStack) {
    const adapter = getStackAdapter(techStack);
    if (adapter.generationMode === "structural" && productionDestination) {
      throw new Error(
        `Structural-only stack ${adapter.id} cannot be deployed to ${destination} before native runtime verification`,
      );
    }
    if (
      productionDestination &&
      !adapter.deploymentTargets.includes(destination)
    ) {
      throw new Error(
        `Stack ${adapter.id} does not support deployment destination ${destination}`,
      );
    }
    if (productionDestination) {
      assertProductComplete({
        files,
        productContract: productContract!,
        productPlan,
        context: "Deployment completeness gate",
      });
    }
  }
  if (productionDestination) {
    throw customerHostingError();
  }
  switch (destination) {
    case "zip":
      return {
        url: "zip://download",
        destination,
        note: "Use the Download ZIP button / projects.download endpoint.",
      };
    case "preview": {
      if (!projectId) throw new Error("projectId required for preview deploy");
      const base = (
        previewBaseUrl ||
        process.env.CORS_ORIGIN ||
        process.env.APP_URL ||
        "https://appforge-unfurling-moon-9058.fly.dev"
      ).replace(/\/$/, "");
      return { url: `${base}/apps/${projectId}`, destination };
    }
    default:
      throw new Error(`Unknown destination: ${destination as string}`);
  }
}

export default {
  deployToVercel,
  zipFiles,
  assertArtifactMatchesWorkingFiles,
  deployProject,
  listDeployDestinations,
  previewSignature,
  verifyPreviewSignature,
};
