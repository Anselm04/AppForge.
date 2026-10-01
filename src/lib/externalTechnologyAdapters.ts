/**
 * Concrete registry of external technology adapters AppForge can orchestrate.
 * Each entry describes how to discover, provision, invoke, test and certify
 * one external technology. States are intentionally conservative: an entry
 * only claims a state this codebase can currently back with real evidence
 * (e.g. an existing, tested stack adapter or build path). Everything else
 * starts at "discovered" until a provisioning/build/test harness exists.
 */

import type {
  AdapterCategory,
  AdapterEvidence,
  TechnologyAdapterDescriptor,
} from "./adapterSdk.js";

function adapter(
  input: Pick<
    TechnologyAdapterDescriptor,
    | "id"
    | "label"
    | "category"
    | "supportedVersions"
    | "latestCompatibleStableVersion"
    | "supportedPlatforms"
    | "supportedArchitectures"
    | "installation"
    | "authentication"
    | "commands"
    | "capabilityTests"
    | "securityChecks"
  > &
    Partial<
      Pick<
        TechnologyAdapterDescriptor,
        | "state"
        | "evidence"
        | "lifecycleStatus"
        | "deprecationNotice"
        | "eolDate"
        | "evidenceRequirements"
        | "replacementPath"
        | "lastVerifiedAt"
      >
    >,
): TechnologyAdapterDescriptor {
  return {
    version: 1,
    lifecycleStatus: "active",
    deprecationNotice: null,
    eolDate: null,
    evidenceRequirements: [
      "discovered",
      "installVerified",
      "compileOrBuildVerified",
      "runtimeVerified",
    ],
    replacementPath: {
      successorAvailable: false,
      successorIdentifier: null,
      migrationNotes: null,
    },
    state: "discovered",
    evidence: { discovered: true },
    quarantine: null,
    lastVerifiedAt: null,
    ...input,
  };
}

const GAME_ENGINES: TechnologyAdapterDescriptor[] = [
  adapter({
    id: "unreal-engine",
    label: "Unreal Engine",
    category: "game_engine",
    supportedVersions: ["5.3", "5.4", "5.5"],
    latestCompatibleStableVersion: "5.5",
    supportedPlatforms: ["windows", "macos", "linux"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "Epic Games Launcher / Unreal Engine source build",
      requiresProvisioning: true,
      requiredToolchain: ["Visual Studio or Xcode", "Unreal Build Tool"],
    },
    authentication: {
      required: true,
      kind: "oauth",
      credentialIsolation: "disposable_runner",
    },
    commands: {
      install: ["./Setup.sh", "./GenerateProjectFiles.sh"],
      build: "UnrealBuildTool Development",
      test: "RunUAT.sh BuildCookRun -run",
      runtime: null,
      packaging: "RunUAT.sh BuildCookRun -package",
      deploy: null,
      healthCheck: null,
    },
    capabilityTests: ["compile_empty_project", "cook_content", "package_build"],
    securityChecks: ["dependency_scan", "signing_verification"],
  }),
  adapter({
    id: "unity-engine",
    label: "Unity",
    category: "game_engine",
    supportedVersions: ["2022 LTS", "6000 LTS"],
    latestCompatibleStableVersion: "6000 LTS",
    supportedPlatforms: ["windows", "macos", "linux", "android", "ios", "web"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "Unity Hub managed editor install",
      requiresProvisioning: true,
      requiredToolchain: ["Unity Hub", "platform build support modules"],
    },
    authentication: {
      required: true,
      kind: "license_key",
      credentialIsolation: "disposable_runner",
    },
    commands: {
      install: ["unityhub --headless install --version <version>"],
      build: "Unity -batchmode -quit -executeMethod Builder.Build",
      test: "Unity -runTests -testPlatform PlayMode",
      runtime: null,
      packaging: "Unity -batchmode -buildTarget",
      deploy: null,
      healthCheck: null,
    },
    capabilityTests: [
      "compile_empty_project",
      "run_playmode_tests",
      "build_target",
    ],
    securityChecks: ["dependency_scan", "signing_verification"],
  }),
  adapter({
    id: "godot-engine",
    label: "Godot",
    category: "game_engine",
    supportedVersions: ["4.2", "4.3", "4.4"],
    latestCompatibleStableVersion: "4.4",
    supportedPlatforms: ["windows", "macos", "linux", "android", "ios", "web"],
    supportedArchitectures: ["x86_64", "arm64", "wasm"],
    installation: {
      method: "Godot headless editor binary download",
      requiresProvisioning: true,
      requiredToolchain: ["godot headless binary", "export templates"],
    },
    authentication: {
      required: false,
      kind: "none",
      credentialIsolation: "not_applicable",
    },
    commands: {
      install: ["curl -L godot headless binary", "download export templates"],
      build: "godot --headless --export-release",
      test: "godot --headless --script res://tests/run_tests.gd",
      runtime: "godot --headless",
      packaging: "godot --headless --export-release",
      deploy: null,
      healthCheck: null,
    },
    capabilityTests: [
      "compile_empty_project",
      "run_headless_tests",
      "export_release",
    ],
    securityChecks: ["dependency_scan"],
  }),
];

const MOBILE_DESKTOP_TOOLCHAINS: TechnologyAdapterDescriptor[] = [
  adapter({
    id: "flutter-sdk",
    label: "Flutter SDK",
    category: "mobile_toolchain",
    supportedVersions: ["3.24", "3.27"],
    latestCompatibleStableVersion: "3.27",
    supportedPlatforms: ["android", "ios", "web", "windows", "macos", "linux"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "flutter channel stable + flutter precache",
      requiresProvisioning: true,
      requiredToolchain: [
        "Dart SDK",
        "Android SDK or Xcode for device targets",
      ],
    },
    authentication: {
      required: false,
      kind: "none",
      credentialIsolation: "not_applicable",
    },
    commands: {
      install: ["flutter channel stable", "flutter precache"],
      build: "flutter build apk | flutter build ios",
      test: "flutter test",
      runtime: "flutter run",
      packaging: "flutter build appbundle",
      deploy: null,
      healthCheck: "flutter doctor",
    },
    capabilityTests: ["flutter_doctor", "flutter_test", "flutter_build_apk"],
    securityChecks: ["dependency_scan", "pub_audit"],
    // The existing flutter-firebase stack adapter already generates real
    // Dart source, but the Flutter SDK itself has not been provisioned or
    // built in a verified runner yet, so this stays at "discovered".
  }),
  adapter({
    id: "xcode-apple-toolchain",
    label: "Xcode / Apple Developer Toolchain",
    category: "mobile_toolchain",
    supportedVersions: ["15", "16"],
    latestCompatibleStableVersion: "16",
    supportedPlatforms: ["macos", "ios"],
    supportedArchitectures: ["arm64", "x86_64"],
    installation: {
      method: "Xcode.app via Apple Developer / App Store, macOS-only runner",
      requiresProvisioning: true,
      requiredToolchain: ["Xcode command line tools", "provisioning profiles"],
    },
    authentication: {
      required: true,
      kind: "service_account",
      credentialIsolation: "disposable_runner",
    },
    commands: {
      install: ["xcode-select --install"],
      build: "xcodebuild -scheme <scheme> build",
      test: "xcodebuild test -destination 'platform=iOS Simulator'",
      runtime: "xcrun simctl boot <device>",
      packaging: "xcodebuild -exportArchive",
      deploy: "xcrun altool --upload-app",
      healthCheck: "xcodebuild -version",
    },
    capabilityTests: ["xcodebuild_version", "simulator_boot", "archive_export"],
