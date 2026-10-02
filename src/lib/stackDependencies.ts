/**
 * Declares which external technology adapters each internal STACK_ADAPTERS
 * entry depends on. This reuses the existing stack adapter ids verbatim —
 * it does not duplicate or replace stackAdapters.ts, it only attaches
 * external-dependency metadata onto the stacks that already exist there.
 */

import type { AdapterCapabilityState } from "./adapterSdk.js";

export type StackExternalDependency = {
  /** id of an entry in EXTERNAL_TECHNOLOGY_ADAPTERS */
  adapterId: string;
  /** one of the adapter's supportedVersions, or "any" */
  versionConstraint: string;
  /** lowest AdapterCapabilityState this dependency must have reached */
  minimumCapabilityLevel: AdapterCapabilityState;
  /** short label for what this dependency is used for, e.g. "runtime" */
  purpose: string;
};

/**
 * Keyed by StackAdapter.id. A stack with no entry here has no external
 * technology dependency beyond the AppForge build runner itself (e.g. pure
 * static output).
 */
export const STACK_EXTERNAL_DEPENDENCIES: Record<
  string,
  StackExternalDependency[]
> = {
  "react-node": [
    {
      adapterId: "node-runtime",
      versionConstraint: "any",
      minimumCapabilityLevel: "runnable",
      purpose: "runtime",
    },
  ],
  "static-html": [],
  "next-node": [
    {
      adapterId: "node-runtime",
      versionConstraint: "any",
      minimumCapabilityLevel: "runnable",
      purpose: "runtime",
    },
  ],
  "phaser-html5": [],
  "three-js-3d": [],
  "react-native-expo": [
    {
      adapterId: "android-sdk-gradle",
      versionConstraint: "any",
      minimumCapabilityLevel: "discovered",
      purpose: "android_target",
    },
    {
      adapterId: "xcode-apple-toolchain",
      versionConstraint: "any",
      minimumCapabilityLevel: "discovered",
      purpose: "ios_target",
    },
  ],
  "flutter-firebase": [
    {
      adapterId: "flutter-sdk",
      versionConstraint: "any",
      minimumCapabilityLevel: "discovered",
      purpose: "sdk",
    },
    {
      adapterId: "android-sdk-gradle",
      versionConstraint: "any",
      minimumCapabilityLevel: "discovered",
      purpose: "android_target",
    },
    {
      adapterId: "xcode-apple-toolchain",
      versionConstraint: "any",
      minimumCapabilityLevel: "discovered",
      purpose: "ios_target",
    },
  ],
  "electron-react": [
    {
      adapterId: "node-runtime",
      versionConstraint: "any",
      minimumCapabilityLevel: "verified",
      purpose: "frontend_runtime",
    },
    {
      adapterId: "electron-desktop",
      versionConstraint: "any",
      minimumCapabilityLevel: "discovered",
      purpose: "desktop_packaging",
    },
  ],
  "tauri-rust": [
    {
      adapterId: "node-runtime",
      versionConstraint: "any",
      minimumCapabilityLevel: "verified",
      purpose: "frontend_runtime",
    },
    {
      adapterId: "rust-toolchain",
      versionConstraint: "any",
      minimumCapabilityLevel: "discovered",
      purpose: "native_toolchain",
    },
    {
      adapterId: "tauri-toolchain",
      versionConstraint: "any",
      minimumCapabilityLevel: "discovered",
      purpose: "desktop_packaging",
    },
  ],
  "api-service": [
    {
      adapterId: "node-runtime",
      versionConstraint: "any",
      minimumCapabilityLevel: "runnable",
      purpose: "runtime",
    },
  ],
  "node-service": [
    {
      adapterId: "node-runtime",
      versionConstraint: "any",
      minimumCapabilityLevel: "runnable",
      purpose: "runtime",
    },
  ],
  "python-service": [
    {
      adapterId: "python-runtime",
      versionConstraint: "any",
      minimumCapabilityLevel: "runnable",
      purpose: "runtime",
    },
  ],
  "ai-agent-node": [
    {
      adapterId: "node-runtime",
      versionConstraint: "any",
      minimumCapabilityLevel: "runnable",
      purpose: "runtime",
    },
  ],
  "ai-agent-python": [
    {
      adapterId: "python-runtime",
      versionConstraint: "any",
      minimumCapabilityLevel: "runnable",
      purpose: "runtime",
    },
  ],
  "chrome-extension": [],
  "browser-automation": [
    {
      adapterId: "node-runtime",
      versionConstraint: "any",
      minimumCapabilityLevel: "runnable",
      purpose: "runtime",
    },
  ],
  "data-visualization": [
    {
      adapterId: "node-runtime",
      versionConstraint: "any",
      minimumCapabilityLevel: "runnable",
      purpose: "runtime",
    },
  ],
  // No external adapter for Docker/Kubernetes exists in the registry yet
  // (the universal builder batch deliberately did not expand the registry
  // further), so these infrastructure stacks declare no dependency today.
  "docker-compose-infra": [],
  "kubernetes-helm-infra": [],
};

export function externalDependenciesForStack(
  stackId: string,
): StackExternalDependency[] {
  return STACK_EXTERNAL_DEPENDENCIES[stackId] ?? [];
}
