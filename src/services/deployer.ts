import { createHmac } from "crypto";
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

export function previewSignature(projectId: number): string {
  const secret =
    process.env.PREVIEW_SECRET ||
    process.env.COOKIE_SECRET ||
    process.env.JWT_SECRET ||
    "appforge-preview-dev";
  return createHmac("sha256", secret)
    .update(`preview:${projectId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyPreviewSignature(
  projectId: number,
  sig: string | undefined,
): boolean {
  if (!sig) return false;
  const expected = previewSignature(projectId);
  if (sig.length !== expected.length) return false;
  let ok = 0;
  for (let i = 0; i < sig.length; i++) {
    ok |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return ok === 0;
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
  for (const [p, c] of Object.entries(files)) zip.file(p, c);
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
  deployProject,
  listDeployDestinations,
  previewSignature,
  verifyPreviewSignature,
};
