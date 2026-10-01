import type { TechnologyAdapterDescriptor } from "./adapterSdk.js";
import { adapter } from "./externalTechnologyAdapterHelpers.js";

export const CONTENT_TOOLS: TechnologyAdapterDescriptor[] = [
  adapter({
    id: "blender",
    label: "Blender",
    category: "content_tool",
    supportedVersions: ["4.1", "4.2", "4.3"],
    latestCompatibleStableVersion: "4.3",
    supportedPlatforms: ["linux", "windows", "macos"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "Blender headless binary download",
      requiresProvisioning: true,
      requiredToolchain: ["Blender headless binary"],
    },
    authentication: {
      required: false,
      kind: "none",
      credentialIsolation: "not_applicable",
    },
    commands: {
      install: ["download blender headless binary"],
      build: null,
      test: "blender --background --python tests/run_tests.py",
      runtime: "blender --background",
      packaging: "blender --background --python export_glb.py",
      deploy: null,
      healthCheck: "blender --version",
    },
    capabilityTests: ["blender_version", "headless_render", "glb_export"],
    securityChecks: ["dependency_scan"],
  }),
];
