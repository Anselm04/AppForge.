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
    securityChecks: ["code_signing_verification", "provisioning_profile_check"],
  }),
  adapter({
    id: "android-sdk-gradle",
    label: "Android SDK + Gradle",
    category: "mobile_toolchain",
    supportedVersions: ["API 34", "API 35"],
    latestCompatibleStableVersion: "API 35",
    supportedPlatforms: ["android", "linux", "macos", "windows"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "sdkmanager managed Android SDK + Gradle wrapper",
      requiresProvisioning: true,
      requiredToolchain: [
        "Java 17+",
        "Android command line tools",
        "Gradle wrapper",
      ],
    },
    authentication: {
      required: false,
      kind: "service_account",
      credentialIsolation: "disposable_runner",
    },
    commands: {
      install: ["sdkmanager --install 'platforms;android-35'"],
      build: "./gradlew assembleRelease",
      test: "./gradlew test connectedAndroidTest",
      runtime: "emulator -avd <device>",
      packaging: "./gradlew bundleRelease",
      deploy: null,
      healthCheck: "sdkmanager --list_installed",
    },
    capabilityTests: ["gradle_build", "emulator_boot", "bundle_release"],
    securityChecks: ["dependency_scan", "signing_verification"],
  }),
  adapter({
    id: "electron-desktop",
    label: "Electron",
    category: "desktop_toolchain",
    supportedVersions: ["30", "31", "32"],
    latestCompatibleStableVersion: "32",
    supportedPlatforms: ["windows", "macos", "linux"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "npm install electron electron-builder",
      requiresProvisioning: false,
      requiredToolchain: ["Node.js", "electron-builder"],
    },
    authentication: {
      required: false,
      kind: "none",
      credentialIsolation: "not_applicable",
    },
    commands: {
      install: ["npm ci"],
      build: "npm run build",
      test: "npm test",
      runtime: "npm run start",
      packaging: "npm run electron:package",
      deploy: null,
      healthCheck: null,
    },
    capabilityTests: ["npm_build", "electron_launch", "installer_package"],
    securityChecks: ["dependency_scan", "electron_security_checklist"],
    // The electron-react stack adapter already generates real scaffold code,
    // but Electron itself has not been installed/built in a verified runner.
  }),
  adapter({
    id: "tauri-toolchain",
    label: "Tauri",
    category: "desktop_toolchain",
    supportedVersions: ["2.0", "2.1"],
    latestCompatibleStableVersion: "2.1",
    supportedPlatforms: ["windows", "macos", "linux"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "cargo install tauri-cli",
      requiresProvisioning: true,
      requiredToolchain: ["Rust toolchain", "platform WebView runtime"],
    },
    authentication: {
      required: false,
      kind: "none",
      credentialIsolation: "not_applicable",
    },
    commands: {
      install: ["rustup default stable"],
      build: "npm run tauri build",
      test: "cargo test",
      runtime: "npm run tauri dev",
      packaging: "npm run tauri build",
      deploy: null,
      healthCheck: null,
    },
    capabilityTests: ["cargo_build", "tauri_dev_launch", "installer_package"],
    securityChecks: ["dependency_scan", "cargo_audit"],
  }),
];

const CONTENT_TOOLS: TechnologyAdapterDescriptor[] = [
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

const DATABASES: TechnologyAdapterDescriptor[] = [
  adapter({
    id: "postgresql",
    label: "PostgreSQL",
    category: "database",
    supportedVersions: ["15", "16", "17"],
    latestCompatibleStableVersion: "17",
    supportedPlatforms: ["linux", "windows", "macos"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "managed Postgres provider or Docker image",
      requiresProvisioning: true,
      requiredToolchain: ["psql client", "drizzle-kit"],
    },
    authentication: {
      required: true,
      kind: "api_key",
      credentialIsolation: "scoped_secret",
    },
    commands: {
      install: ["docker run postgres:17-alpine"],
      build: "drizzle-kit generate",
      test: "drizzle-kit check",
      runtime: null,
      packaging: null,
      deploy: "drizzle-kit push",
      healthCheck: "pg_isready",
    },
    capabilityTests: [
      "connection_check",
      "migration_apply",
      "migration_rollback",
    ],
    securityChecks: ["tls_enforced", "least_privilege_role"],
    // AppForge already connects to and migrates a real Postgres database.
    state: "runnable",
    evidence: {
      discovered: true,
      installVerified: true,
      compileOrBuildVerified: true,
      runtimeVerified: true,
    },
  }),
  adapter({
    id: "mysql",
    label: "MySQL",
    category: "database",
    supportedVersions: ["8.0", "8.4"],
    latestCompatibleStableVersion: "8.4",
    supportedPlatforms: ["linux", "windows", "macos"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "managed MySQL provider or Docker image",
      requiresProvisioning: true,
      requiredToolchain: ["mysql client"],
    },
    authentication: {
      required: true,
      kind: "api_key",
      credentialIsolation: "scoped_secret",
    },
    commands: {
      install: ["docker run mysql:8.4"],
      build: null,
      test: null,
      runtime: null,
      packaging: null,
      deploy: null,
      healthCheck: "mysqladmin ping",
    },
    capabilityTests: ["connection_check"],
    securityChecks: ["tls_enforced", "least_privilege_role"],
  }),
  adapter({
    id: "mongodb",
    label: "MongoDB",
    category: "database",
    supportedVersions: ["7.0", "8.0"],
    latestCompatibleStableVersion: "8.0",
    supportedPlatforms: ["linux", "windows", "macos"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "managed Atlas cluster or Docker image",
      requiresProvisioning: true,
      requiredToolchain: ["mongosh"],
    },
    authentication: {
      required: true,
      kind: "api_key",
      credentialIsolation: "scoped_secret",
    },
    commands: {
      install: ["docker run mongo:8.0"],
      build: null,
      test: null,
      runtime: null,
      packaging: null,
      deploy: null,
      healthCheck: "mongosh --eval db.adminCommand('ping')",
    },
    capabilityTests: ["connection_check"],
    securityChecks: ["tls_enforced", "least_privilege_role"],
  }),
];

const CLOUD_PLATFORMS: TechnologyAdapterDescriptor[] = [
  adapter({
    id: "fly-io",
    label: "Fly.io",
    category: "cloud_platform",
    supportedVersions: ["v2 machines API"],
    latestCompatibleStableVersion: "v2 machines API",
    supportedPlatforms: ["linux"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "flyctl CLI",
      requiresProvisioning: false,
      requiredToolchain: ["flyctl"],
    },
    authentication: {
      required: true,
      kind: "api_key",
      credentialIsolation: "scoped_secret",
    },
    commands: {
      install: ["curl -L https://fly.io/install.sh | sh"],
      build: "flyctl deploy --build-only",
      test: null,
      runtime: null,
      packaging: null,
      deploy: "flyctl deploy",
      healthCheck: "flyctl status",
    },
    capabilityTests: ["flyctl_auth_check", "deploy_dry_run"],
    securityChecks: ["secrets_scoped_per_app"],
    // AppForge already deploys real projects to Fly.io.
    state: "deployable",
    evidence: {
      discovered: true,
      installVerified: true,
      compileOrBuildVerified: true,
      runtimeVerified: true,
      packageVerified: true,
      deploymentVerified: true,
    },
  }),
  adapter({
    id: "vercel",
    label: "Vercel",
    category: "cloud_platform",
    supportedVersions: ["v2 deployments API"],
    latestCompatibleStableVersion: "v2 deployments API",
    supportedPlatforms: ["linux"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "Vercel CLI / REST API",
      requiresProvisioning: false,
      requiredToolchain: ["vercel CLI"],
    },
    authentication: {
      required: true,
      kind: "api_key",
      credentialIsolation: "scoped_secret",
    },
    commands: {
      install: ["npm install -g vercel"],
      build: "vercel build",
      test: null,
      runtime: null,
      packaging: null,
      deploy: "vercel deploy --prebuilt",
      healthCheck: "vercel inspect",
    },
    capabilityTests: ["vercel_auth_check", "deploy_dry_run"],
    securityChecks: ["secrets_scoped_per_project"],
  }),
  adapter({
    id: "aws",
    label: "Amazon Web Services",
    category: "cloud_platform",
    supportedVersions: ["current"],
    latestCompatibleStableVersion: "current",
    supportedPlatforms: ["linux"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "AWS CLI v2 / SDK",
      requiresProvisioning: true,
      requiredToolchain: ["aws CLI", "IAM role"],
    },
    authentication: {
      required: true,
      kind: "service_account",
      credentialIsolation: "scoped_secret",
    },
    commands: {
      install: ["install aws CLI v2"],
      build: null,
      test: null,
      runtime: null,
      packaging: null,
      deploy: "aws cloudformation deploy",
      healthCheck: "aws sts get-caller-identity",
    },
    capabilityTests: ["sts_identity_check"],
    securityChecks: ["least_privilege_iam", "secrets_manager_only"],
  }),
];

const COMPILER_RUNTIMES: TechnologyAdapterDescriptor[] = [
  adapter({
    id: "node-runtime",
    label: "Node.js",
    category: "compiler_runtime",
    supportedVersions: ["20", "22"],
    latestCompatibleStableVersion: "22",
    supportedPlatforms: ["linux", "windows", "macos"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "preinstalled in build runners",
      requiresProvisioning: false,
      requiredToolchain: ["npm"],
    },
    authentication: {
      required: false,
      kind: "none",
      credentialIsolation: "not_applicable",
    },
    commands: {
      install: ["npm ci"],
      build: "npm run build",
      test: "npm test",
      runtime: "npm run start",
      packaging: null,
      deploy: null,
      healthCheck: "node --version",
    },
    capabilityTests: ["npm_install", "npm_build", "npm_test", "npm_start"],
    securityChecks: ["npm_audit"],
    // Node stack adapters (react-node, api-service, node-service, ...) are
    // generated, built and behaviorally tested throughout this codebase.
    state: "verified",
    evidence: {
      discovered: true,
      installVerified: true,
      compileOrBuildVerified: true,
      runtimeVerified: true,
      packageVerified: true,
      deploymentVerified: true,
      testsVerified: true,
      securityScanVerified: true,
      behavioralVerified: true,
    },
  }),
  adapter({
    id: "python-runtime",
    label: "Python",
    category: "compiler_runtime",
    supportedVersions: ["3.11", "3.12", "3.13"],
    latestCompatibleStableVersion: "3.13",
    supportedPlatforms: ["linux", "windows", "macos"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "venv + pip",
      requiresProvisioning: true,
      requiredToolchain: ["pip", "venv"],
    },
    authentication: {
      required: false,
      kind: "none",
      credentialIsolation: "not_applicable",
    },
    commands: {
      install: ["python -m venv .venv", "pip install -r requirements.txt"],
      build: "python -m compileall app",
      test: "pytest",
      runtime: "python -m app.main",
      packaging: null,
      deploy: null,
      healthCheck: "python --version",
    },
    capabilityTests: ["pip_install", "compileall", "pytest_run"],
    securityChecks: ["pip_audit"],
    // The python-service / ai-agent-python stack adapters are structural
    // (generated) but Python itself has not been provisioned or run in a
    // verified runner yet, so this stays at "discovered".
  }),
  adapter({
    id: "rust-toolchain",
    label: "Rust",
    category: "compiler_runtime",
    supportedVersions: ["1.79", "1.82"],
    latestCompatibleStableVersion: "1.82",
    supportedPlatforms: ["linux", "windows", "macos"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "rustup",
      requiresProvisioning: true,
      requiredToolchain: ["rustup", "cargo"],
    },
    authentication: {
      required: false,
      kind: "none",
      credentialIsolation: "not_applicable",
    },
    commands: {
      install: ["rustup default stable"],
      build: "cargo build --release",
      test: "cargo test",
      runtime: "cargo run",
      packaging: null,
      deploy: null,
      healthCheck: "rustc --version",
    },
    capabilityTests: ["cargo_build", "cargo_test"],
    securityChecks: ["cargo_audit"],
  }),
];

const AI_PROVIDERS: TechnologyAdapterDescriptor[] = [
  adapter({
    id: "openai-provider",
    label: "OpenAI",
    category: "ai_provider",
    supportedVersions: ["v1 chat completions"],
    latestCompatibleStableVersion: "v1 chat completions",
    supportedPlatforms: ["linux"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "OPENAI_API_KEY environment credential",
      requiresProvisioning: false,
      requiredToolchain: [],
    },
    authentication: {
      required: true,
      kind: "api_key",
      credentialIsolation: "scoped_secret",
    },
    commands: {
      install: [],
      build: null,
      test: "GET /v1/models",
      runtime: "POST /v1/chat/completions",
      packaging: null,
      deploy: null,
      healthCheck: "GET /v1/models",
    },
    capabilityTests: [
      "models_list",
      "chat_completion_roundtrip",
      "tool_call_roundtrip",
    ],
    securityChecks: ["key_scoping", "prompt_injection_resistance"],
    // llmProviders.ts routes real chat completions through this provider
    // when a key is configured, but no live-API capability test runs in CI.
    state: "structural",
    evidence: {
      discovered: true,
      installVerified: true,
      compileOrBuildVerified: true,
    },
  }),
  adapter({
    id: "anthropic-provider",
    label: "Anthropic",
    category: "ai_provider",
    supportedVersions: ["2023-06-01"],
    latestCompatibleStableVersion: "2023-06-01",
    supportedPlatforms: ["linux"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "ANTHROPIC_API_KEY environment credential",
      requiresProvisioning: false,
      requiredToolchain: [],
    },
    authentication: {
      required: true,
      kind: "api_key",
      credentialIsolation: "scoped_secret",
    },
    commands: {
      install: [],
      build: null,
      test: "GET /v1/models",
      runtime: "POST /v1/messages",
      packaging: null,
      deploy: null,
      healthCheck: "GET /v1/models",
    },
    capabilityTests: [
      "models_list",
      "message_roundtrip",
      "tool_call_roundtrip",
    ],
    securityChecks: ["key_scoping", "prompt_injection_resistance"],
    state: "structural",
    evidence: {
      discovered: true,
      installVerified: true,
      compileOrBuildVerified: true,
    },
  }),
  adapter({
    id: "gemini-provider",
    label: "Google Gemini",
    category: "ai_provider",
    supportedVersions: ["v1beta openai-compatible"],
    latestCompatibleStableVersion: "v1beta openai-compatible",
    supportedPlatforms: ["linux"],
    supportedArchitectures: ["x86_64", "arm64"],
    installation: {
      method: "GEMINI_API_KEY environment credential",
      requiresProvisioning: false,
      requiredToolchain: [],
    },
    authentication: {
      required: true,
      kind: "api_key",
      credentialIsolation: "scoped_secret",
    },
    commands: {
      install: [],
      build: null,
      test: "GET /v1beta/openai/models",
      runtime: "POST /v1beta/openai/chat/completions",
      packaging: null,
      deploy: null,
      healthCheck: "GET /v1beta/openai/models",
    },
    capabilityTests: ["models_list", "chat_completion_roundtrip"],
    securityChecks: ["key_scoping", "prompt_injection_resistance"],
    state: "structural",
    evidence: {
      discovered: true,
      installVerified: true,
      compileOrBuildVerified: true,
    },
  }),
];

const DEPLOYMENT_TARGETS: TechnologyAdapterDescriptor[] = [
  adapter({
    id: "apple-app-store",
    label: "Apple App Store",
    category: "deployment_target",
    supportedVersions: ["App Store Connect API v1"],
    latestCompatibleStableVersion: "App Store Connect API v1",
    supportedPlatforms: ["ios", "macos"],
    supportedArchitectures: ["arm64"],
    installation: {
      method: "App Store Connect API key",
      requiresProvisioning: true,
      requiredToolchain: ["xcrun altool / notarytool"],
    },
    authentication: {
      required: true,
      kind: "service_account",
      credentialIsolation: "scoped_secret",
    },
    commands: {
      install: [],
      build: null,
      test: null,
      runtime: null,
      packaging: null,
      deploy: "xcrun altool --upload-app",
      healthCheck: null,
    },
    capabilityTests: ["app_store_connect_auth_check"],
    securityChecks: ["code_signing_verification", "notarization_check"],
  }),
  adapter({
    id: "google-play",
    label: "Google Play Console",
    category: "deployment_target",
    supportedVersions: ["Android Publisher API v3"],
    latestCompatibleStableVersion: "Android Publisher API v3",
    supportedPlatforms: ["android"],
    supportedArchitectures: ["arm64"],
    installation: {
      method: "Google Play service account",
      requiresProvisioning: true,
      requiredToolchain: ["Play Developer API client"],
    },
    authentication: {
      required: true,
      kind: "service_account",
      credentialIsolation: "scoped_secret",
    },
    commands: {
      install: [],
      build: null,
      test: null,
      runtime: null,
      packaging: null,
      deploy: "Play Developer API edits.tracks.update",
      healthCheck: null,
    },
    capabilityTests: ["play_console_auth_check"],
    securityChecks: ["signing_verification"],
  }),
  adapter({
    id: "chrome-web-store",
    label: "Chrome Web Store",
    category: "deployment_target",
    supportedVersions: ["Chrome Web Store API v1.1"],
    latestCompatibleStableVersion: "Chrome Web Store API v1.1",
    supportedPlatforms: ["linux"],
    supportedArchitectures: ["x86_64"],
    installation: {
      method: "Chrome Web Store publish API credentials",
      requiresProvisioning: true,
      requiredToolchain: ["chrome-webstore-upload CLI"],
    },
    authentication: {
      required: true,
      kind: "oauth",
      credentialIsolation: "scoped_secret",
    },
    commands: {
      install: [],
      build: null,
      test: null,
      runtime: null,
      packaging: null,
      deploy: "chrome-webstore-upload upload --auto-publish",
      healthCheck: null,
    },
    capabilityTests: ["webstore_auth_check", "manifest_v3_validation"],
    securityChecks: ["permission_review"],
  }),
];

const HARDWARE_TOOLCHAINS: TechnologyAdapterDescriptor[] = [
  adapter({
    id: "arduino-toolchain",
    label: "Arduino",
    category: "hardware_toolchain",
    supportedVersions: ["arduino-cli 1.x"],
    latestCompatibleStableVersion: "arduino-cli 1.x",
    supportedPlatforms: ["embedded"],
    supportedArchitectures: ["arm"],
    installation: {
      method: "arduino-cli core install",
      requiresProvisioning: true,
      requiredToolchain: ["arduino-cli", "board core package"],
    },
    authentication: {
      required: false,
      kind: "none",
      credentialIsolation: "not_applicable",
    },
    commands: {
      install: ["arduino-cli core install <board-package>"],
      build: "arduino-cli compile",
      test: null,
      runtime: null,
      packaging: null,
      deploy: "arduino-cli upload",
      healthCheck: "arduino-cli board list",
    },
    capabilityTests: ["compile_blink_sketch", "board_detection"],
    securityChecks: ["firmware_signing_where_supported"],
  }),
  adapter({
    id: "esp32-toolchain",
    label: "ESP32 / ESP-IDF",
    category: "hardware_toolchain",
    supportedVersions: ["5.2", "5.3"],
    latestCompatibleStableVersion: "5.3",
    supportedPlatforms: ["embedded"],
    supportedArchitectures: ["arm"],
    installation: {
      method: "ESP-IDF install script",
      requiresProvisioning: true,
      requiredToolchain: ["esp-idf", "idf.py"],
    },
    authentication: {
      required: false,
      kind: "none",
      credentialIsolation: "not_applicable",
    },
    commands: {
      install: ["./install.sh esp32"],
      build: "idf.py build",
      test: "idf.py test",
      runtime: null,
      packaging: null,
      deploy: "idf.py flash",
      healthCheck: "idf.py --version",
    },
    capabilityTests: ["idf_build", "flash_dry_run"],
    securityChecks: ["secure_boot_check"],
  }),
];

/** All external technology adapters AppForge currently knows about. */
export const EXTERNAL_TECHNOLOGY_ADAPTERS: readonly TechnologyAdapterDescriptor[] =
  [
    ...GAME_ENGINES,
    ...MOBILE_DESKTOP_TOOLCHAINS,
    ...CONTENT_TOOLS,
    ...DATABASES,
    ...CLOUD_PLATFORMS,
    ...COMPILER_RUNTIMES,
    ...AI_PROVIDERS,
    ...DEPLOYMENT_TARGETS,
    ...HARDWARE_TOOLCHAINS,
  ];

const BY_ID = new Map(
  EXTERNAL_TECHNOLOGY_ADAPTERS.map((entry) => [entry.id, entry]),
);

export function getExternalTechnologyAdapter(
  id: string,
): TechnologyAdapterDescriptor | undefined {
  return BY_ID.get(id);
}

export function listAdaptersByCategory(
  category: AdapterCategory,
): TechnologyAdapterDescriptor[] {
  return EXTERNAL_TECHNOLOGY_ADAPTERS.filter(
    (entry) => entry.category === category,
  );
}

/** Minimal evidence shape external callers must prove before claiming discovery. */
export function discoveryEvidence(): AdapterEvidence {
  return { discovered: true };
}
