import type { TechnologyAdapterDescriptor } from "./adapterSdk.js";
import { adapter } from "./externalTechnologyAdapterHelpers.js";

export const AI_PROVIDERS: TechnologyAdapterDescriptor[] = [
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
