import type {
  AdapterCapabilityState,
  AdapterEvidence,
  AdapterPlatform,
} from "./adapterSdk.js";

export const PRODUCT_CAPABILITY_IDS = [
  "push_notifications",
  "speech_recognition",
  "text_to_speech",
  "siri_app_intents",
  "android_voice_actions",
  "camera",
  "photos",
  "microphone",
  "audio",
  "gps_location",
  "background_location",
  "bluetooth",
  "biometrics",
  "deep_links",
  "file_access",
  "sharing",
  "contacts",
  "calendar",
  "widgets",
  "live_activities",
  "background_jobs",
  "scheduling",
] as const;

export type ProductCapabilityId = (typeof PRODUCT_CAPABILITY_IDS)[number];

export type ProductCapabilityCredentialRequirements = {
  required: boolean;
  kinds: string[];
  isolation: "scoped_secret" | "generated_public_config" | "not_applicable";
};

export type ProductCapabilityAdapterDescriptor = {
  id: ProductCapabilityId;
  label: string;
  supportedPlatforms: AdapterPlatform[];
  dependencies: string[];
  permissions: Partial<Record<AdapterPlatform, string[]>>;
  nativeConfiguration: string[];
  credentialRequirements: ProductCapabilityCredentialRequirements;
  provisioning: string[];
  installSteps: string[];
  buildRequirements: string[];
  runtimeTests: string[];
  behavioralTests: string[];
  failureDetection: string[];
  securityBoundaries: string[];
  limitations: string[];
  evidenceRequirements: Array<keyof AdapterEvidence>;
  state: AdapterCapabilityState;
  evidence: AdapterEvidence;
  lastVerifiedAt: string | null;
};

type CapabilityInput = Omit<
  ProductCapabilityAdapterDescriptor,
  "state" | "evidence" | "lastVerifiedAt" | "evidenceRequirements"
>;

const NATIVE_RUNTIME_EVIDENCE: Array<keyof AdapterEvidence> = [
  "discovered",
  "installVerified",
  "compileOrBuildVerified",
  "testsVerified",
  "runtimeVerified",
  "behavioralVerified",
];

function discoveredCapability(
  input: CapabilityInput,
): ProductCapabilityAdapterDescriptor {
  return {
    ...input,
    evidenceRequirements: NATIVE_RUNTIME_EVIDENCE,
    state: "discovered",
    evidence: {
      discovered: true,
      evidenceLedgerIds: [`repository-audit-2026-10-15:${input.id}`],
    },
    lastVerifiedAt: null,
  };
}

const IOS_ANDROID: AdapterPlatform[] = ["ios", "android"];
const IOS_ONLY: AdapterPlatform[] = ["ios"];
const ANDROID_ONLY: AdapterPlatform[] = ["android"];

export const PRODUCT_CAPABILITY_ADAPTERS: readonly ProductCapabilityAdapterDescriptor[] =
  [
    discoveredCapability({
      id: "push_notifications",
      label: "Push notifications",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Flutter/native push client selected through current-technology research",
        "APNs and/or Firebase Cloud Messaging provider integration",
      ],
      permissions: {
        ios: ["remote notifications"],
        android: ["POST_NOTIFICATIONS"],
      },
      nativeConfiguration: [
        "Configure platform notification entitlements/channels and provider identifiers",
        "Register device tokens without embedding server credentials in the client",
      ],
      credentialRequirements: {
        required: true,
        kinds: [
          "APNs signing key/certificate",
          "FCM server/service credential",
        ],
        isolation: "scoped_secret",
      },
      provisioning: [
        "Provision provider application identifiers and server-side sending credentials",
      ],
      installSteps: [
        "Install the researched compatible Flutter/native notification client dependency",
      ],
      buildRequirements: [
        "Apply iOS entitlements and Android manifest/channel configuration before native build",
      ],
      runtimeTests: [
        "Register a real simulator/device token where the platform/provider permits and receive a test notification",
      ],
      behavioralTests: [
        "Tap notification and prove routing to the intended product state through a validated deep link",
      ],
      failureDetection: [
        "Detect denied permission, token registration failure, provider rejection and stale-token responses",
      ],
      securityBoundaries: [
        "Provider sending credentials remain server-side and notifications must not disclose sensitive data on locked devices",
      ],
      limitations: [
        "Real APNs delivery may require Apple signing/provisioning and physical-device access",
      ],
    }),
    discoveredCapability({
      id: "speech_recognition",
      label: "Speech recognition",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform speech recognizer or current compatible Flutter bridge",
      ],
      permissions: {
        ios: ["microphone", "speech recognition"],
        android: ["RECORD_AUDIO"],
      },
      nativeConfiguration: [
        "Declare microphone/speech usage descriptions and locale handling",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Select on-device/platform service first; declare external provider only when required",
      ],
      installSteps: [
        "Install the researched compatible speech-recognition bridge",
      ],
      buildRequirements: [
        "Compile native microphone/speech permissions into the app",
      ],
      runtimeTests: [
        "Capture a controlled utterance and produce recognized text on the target runtime",
      ],
      behavioralTests: [
        "Prove recognized command text drives only the allowed product action",
      ],
      failureDetection: [
        "Detect permission denial, unavailable recognizer, silence, timeout and low-confidence/empty results",
      ],
      securityBoundaries: [
        "Do not record or transmit microphone audio before explicit permission and active user intent",
      ],
      limitations: [
        "Simulator speech support varies; device/provider/network may be required for full proof",
      ],
    }),
    discoveredCapability({
      id: "text_to_speech",
      label: "Text to speech",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform TTS engine or current compatible Flutter bridge",
      ],
      permissions: { ios: [], android: [] },
      nativeConfiguration: [
        "Configure language, voice availability and audio-session behavior",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Prefer installed platform voices; report when a requested voice/language is unavailable",
      ],
      installSteps: ["Install the researched compatible text-to-speech bridge"],
      buildRequirements: [
        "Compile audio-session/platform integration for supported targets",
      ],
      runtimeTests: [
        "Synthesize a deterministic phrase and observe successful playback lifecycle",
      ],
      behavioralTests: [
        "Prove product prompt is spoken once and can be cancelled/interrupted safely",
      ],
      failureDetection: [
        "Detect missing voice/language, synthesis failure and audio interruption",
      ],
      securityBoundaries: [
        "Never speak secrets, payment credentials or sensitive content without product-level authorization",
      ],
      limitations: [
        "Available voices and offline behavior differ by device/OS",
      ],
    }),
    discoveredCapability({
      id: "siri_app_intents",
      label: "Siri and App Intents",
      supportedPlatforms: IOS_ONLY,
      dependencies: [
        "Apple App Intents/Siri frameworks and generated native integration",
      ],
      permissions: { ios: ["Siri capability where required"] },
      nativeConfiguration: [
        "Define typed App Intents, phrases and app entitlement configuration",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Require legitimate Xcode/iOS target capable of compiling App Intents",
      ],
      installSteps: ["Generate/compile the native App Intent target or bridge"],
      buildRequirements: [
        "Build with supported Xcode SDK and validate intent metadata",
      ],
      runtimeTests: [
        "Invoke an intent in simulator/device environment that supports it",
      ],
      behavioralTests: [
        "Verify intent executes only the declared action and respects confirmation requirements",
      ],
      failureDetection: [
        "Detect unavailable intent, missing entitlement, invalid parameters and cancelled invocation",
      ],
      securityBoundaries: [
        "Sensitive or irreversible actions require explicit in-app/user confirmation where appropriate",
      ],
      limitations: [
        "Signing, OS availability and some Siri behavior may require Apple developer access/device testing",
      ],
    }),
    discoveredCapability({
      id: "android_voice_actions",
      label: "Android voice actions",
      supportedPlatforms: ANDROID_ONLY,
      dependencies: [
        "Android intents/App Actions/Assistant-compatible integration selected through current research",
      ],
      permissions: { android: [] },
      nativeConfiguration: [
        "Declare supported deep links/intents and typed parameters",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Use legitimate Android tooling and current platform/Assistant integration path",
      ],
      installSteps: [
        "Generate native intent/action integration and app-link bindings",
      ],
      buildRequirements: [
        "Compile and validate Android manifest/intent filters",
      ],
      runtimeTests: [
        "Invoke the supported voice/deep-link intent on an emulator/device",
      ],
      behavioralTests: [
        "Verify parsed voice intent reaches only the expected product action",
      ],
      failureDetection: [
        "Detect unmatched intent, invalid parameters and unavailable voice service",
      ],
      securityBoundaries: [
        "Require explicit confirmation before purchases, bookings or destructive actions",
      ],
      limitations: [
        "Assistant/App Actions availability and certification vary by current Google platform support",
      ],
    }),
    discoveredCapability({
      id: "camera",
      label: "Camera",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform camera APIs or current compatible Flutter camera bridge",
      ],
      permissions: { ios: ["camera"], android: ["CAMERA"] },
      nativeConfiguration: [
        "Declare camera usage reason and supported capture modes",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Select target camera APIs supported by the requested devices",
      ],
      installSteps: ["Install researched compatible camera dependency"],
      buildRequirements: [
        "Compile camera permissions and native camera integration",
      ],
      runtimeTests: [
        "Open camera, capture controlled media and close resources cleanly",
      ],
      behavioralTests: [
        "Verify captured media is attached only to the intended product workflow",
      ],
      failureDetection: [
        "Detect permission denial, unavailable camera, capture failure and lifecycle interruption",
      ],
      securityBoundaries: [
        "Never activate camera without visible user intent and granted permission",
      ],
      limitations: [
        "Emulators may provide synthetic/no camera; physical hardware may be required for full proof",
      ],
    }),
    discoveredCapability({
      id: "photos",
      label: "Photo library",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform photo picker/library API or current compatible Flutter bridge",
      ],
      permissions: {
        ios: ["photo library when required"],
        android: ["platform photo picker or scoped media access"],
      },
      nativeConfiguration: [
        "Prefer least-privilege system photo picker/scoped media access",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Choose picker/scoped-storage path appropriate to target OS versions",
      ],
      installSteps: [
        "Install researched compatible photo-picker dependency when needed",
      ],
      buildRequirements: ["Compile supported picker/library configuration"],
      runtimeTests: [
        "Select a controlled image and verify readable content/metadata",
      ],
      behavioralTests: [
        "Verify only user-selected media enters the product workflow",
      ],
      failureDetection: [
        "Detect cancellation, permission denial, inaccessible media and invalid file types",
      ],
      securityBoundaries: [
        "Request the minimum photo access and avoid broad library access when a picker suffices",
      ],
      limitations: [
        "Permission model differs by OS version and selected picker API",
      ],
    }),
    discoveredCapability({
      id: "microphone",
      label: "Microphone",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform audio-recording API or current compatible Flutter bridge",
      ],
      permissions: { ios: ["microphone"], android: ["RECORD_AUDIO"] },
      nativeConfiguration: [
        "Declare microphone usage reason and audio-session behavior",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Select recording format/sample settings required by the product",
      ],
      installSteps: ["Install researched compatible recording dependency"],
      buildRequirements: [
        "Compile microphone permission and audio-session configuration",
      ],
      runtimeTests: [
        "Record and stop a controlled audio sample without resource leakage",
      ],
      behavioralTests: [
        "Verify recording begins only after explicit product/user action",
      ],
      failureDetection: [
        "Detect denied permission, audio-session conflict, interruption and write failure",
      ],
      securityBoundaries: [
        "Never record in the background unless explicitly required, disclosed and permitted",
      ],
      limitations: [
        "Simulator microphone fidelity varies; physical device may be required",
      ],
    }),
    discoveredCapability({
      id: "audio",
      label: "Audio playback and session",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform audio engine or current compatible Flutter audio bridge",
      ],
      permissions: { ios: [], android: [] },
      nativeConfiguration: [
        "Configure playback category/focus and background audio only when requested",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: ["Select codec/playback path supported by target devices"],
      installSteps: [
        "Install researched compatible audio dependency when needed",
      ],
      buildRequirements: ["Compile audio-session/focus configuration"],
      runtimeTests: ["Play, pause, resume and stop a controlled audio asset"],
      behavioralTests: [
        "Verify lifecycle/focus handling and user controls behave correctly",
      ],
      failureDetection: [
        "Detect unsupported codec, focus loss, missing asset and playback error",
      ],
      securityBoundaries: [
        "Do not continue sensitive audio unexpectedly after app/session state changes",
      ],
      limitations: [
        "Background playback requires additional platform configuration and separate proof",
      ],
    }),
    discoveredCapability({
      id: "gps_location",
      label: "Location",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform location API or current compatible Flutter bridge",
      ],
      permissions: {
        ios: ["location when in use"],
        android: [
          "ACCESS_COARSE_LOCATION",
          "ACCESS_FINE_LOCATION when justified",
        ],
      },
      nativeConfiguration: [
        "Declare purpose strings and least-privilege accuracy requirements",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Select accuracy and update policy from product requirements",
      ],
      installSteps: ["Install researched compatible location dependency"],
      buildRequirements: [
        "Compile location permissions and platform configuration",
      ],
      runtimeTests: [
        "Obtain a controlled/simulated location fix on target runtime",
      ],
      behavioralTests: [
        "Verify location-dependent behavior changes only from validated coordinates",
      ],
      failureDetection: [
        "Detect denied permission, disabled services, timeout and unavailable accuracy",
      ],
      securityBoundaries: [
        "Minimize precision/retention and never expose location across users",
      ],
      limitations: [
        "Physical GPS behavior and accuracy may require device testing",
      ],
    }),
    discoveredCapability({
      id: "background_location",
      label: "Background location",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform background-location APIs and a qualified location bridge",
      ],
      permissions: {
        ios: ["background location when explicitly required"],
        android: ["ACCESS_BACKGROUND_LOCATION when explicitly required"],
      },
      nativeConfiguration: [
        "Configure background modes/services and disclosure required by each platform",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Require product justification before enabling background location",
      ],
      installSteps: [
        "Install researched background-capable location dependency",
      ],
      buildRequirements: [
        "Compile background modes/service configuration and permission flows",
      ],
      runtimeTests: [
        "Move app to background and verify bounded authorized location updates",
      ],
      behavioralTests: [
        "Verify updates stop when permission/service is revoked and follow product policy",
      ],
      failureDetection: [
        "Detect revoked permission, OS throttling, killed service and stale coordinates",
      ],
      securityBoundaries: [
        "Background tracking must be explicit, least-privilege, user-controllable and retention-bounded",
      ],
      limitations: [
        "Store policy review and physical-device testing may be required",
      ],
    }),
    discoveredCapability({
      id: "bluetooth",
      label: "Bluetooth",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform CoreBluetooth/Bluetooth LE APIs or current compatible Flutter bridge",
      ],
      permissions: {
        ios: ["Bluetooth usage"],
        android: ["BLUETOOTH_SCAN", "BLUETOOTH_CONNECT when required"],
      },
      nativeConfiguration: [
        "Declare Bluetooth usage and target BLE/classic profile requirements",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Define allowed device/service UUIDs and pairing expectations",
      ],
      installSteps: ["Install researched compatible Bluetooth dependency"],
      buildRequirements: ["Compile Bluetooth permissions and platform modes"],
      runtimeTests: [
        "Scan/connect/read a controlled test peripheral where hardware exists",
      ],
      behavioralTests: [
        "Verify only expected device/service data drives application behavior",
      ],
      failureDetection: [
        "Detect denied permission, radio off, scan timeout, disconnect and protocol error",
      ],
      securityBoundaries: [
        "Restrict discovered peripherals/services and validate untrusted device data",
      ],
      limitations: ["Real Bluetooth proof normally requires physical hardware"],
    }),
    discoveredCapability({
      id: "biometrics",
      label: "Biometric authentication",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform LocalAuthentication/BiometricPrompt or current compatible Flutter bridge",
      ],
      permissions: {
        ios: ["Face ID usage description when applicable"],
        android: ["USE_BIOMETRIC"],
      },
      nativeConfiguration: [
        "Configure biometric prompt purpose and secure fallback policy",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Require platform secure-enclave/keystore-backed authentication semantics",
      ],
      installSteps: ["Install researched compatible biometric bridge"],
      buildRequirements: [
        "Compile biometric permissions and minimum platform levels",
      ],
      runtimeTests: [
        "Exercise success, failure and cancellation on simulator/device support",
      ],
      behavioralTests: [
        "Verify protected action remains blocked after failed/cancelled biometric challenge",
      ],
      failureDetection: [
        "Detect no enrollment, unavailable hardware, lockout, cancellation and auth failure",
      ],
      securityBoundaries: [
        "Biometrics authorize access; raw biometric data must never be collected or stored by AppForge products",
      ],
      limitations: [
        "Hardware-backed proof requires compatible simulator/device configuration",
      ],
    }),
    discoveredCapability({
      id: "deep_links",
      label: "Deep links and universal/app links",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform universal/app-link APIs or current compatible Flutter router bridge",
      ],
      permissions: { ios: [], android: [] },
      nativeConfiguration: [
        "Declare associated domains/intent filters and route allowlist",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Provision verified domain association files when universal/app links are requested",
      ],
      installSteps: [
        "Install researched compatible routing/deep-link bridge if framework support is insufficient",
      ],
      buildRequirements: [
        "Compile entitlements/manifest filters and route parser",
      ],
      runtimeTests: [
        "Open a controlled deep link into installed app on simulator/emulator",
      ],
      behavioralTests: [
        "Verify route and parameters map to the intended screen/action and reject unknown routes",
      ],
      failureDetection: [
        "Detect malformed URL, unverified domain, unknown route and missing required state",
      ],
      securityBoundaries: [
        "Treat all deep-link input as untrusted and never bypass auth/confirmation boundaries",
      ],
      limitations: [
        "Universal/app-link verification requires control of the associated web domain",
      ],
    }),
    discoveredCapability({
      id: "file_access",
      label: "File access",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform document picker/scoped-storage APIs or current compatible Flutter bridge",
      ],
      permissions: {
        ios: ["user-selected document access"],
        android: ["Storage Access Framework/user-selected document access"],
      },
      nativeConfiguration: ["Prefer system document picker and scoped access"],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: ["Define accepted file types and size limits"],
      installSteps: [
        "Install researched compatible document-picker dependency when needed",
      ],
      buildRequirements: ["Compile picker/scoped-storage integration"],
      runtimeTests: [
        "Select/read a controlled document and release access cleanly",
      ],
      behavioralTests: ["Validate type/size/content before product processing"],
      failureDetection: [
        "Detect cancellation, revoked access, invalid path/type/size and read failure",
      ],
      securityBoundaries: [
        "Never traverse arbitrary filesystem paths or retain broader access than the user selected",
      ],
      limitations: ["Filesystem semantics differ by platform and provider"],
    }),
    discoveredCapability({
      id: "sharing",
      label: "System sharing",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform share sheet/intent APIs or current compatible Flutter bridge",
      ],
      permissions: { ios: [], android: [] },
      nativeConfiguration: [
        "Declare shareable content types and incoming/outgoing sharing scope",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Define data sanitization rules before content enters a system share sheet",
      ],
      installSteps: [
        "Install researched compatible sharing bridge if required",
      ],
      buildRequirements: [
        "Compile share extension/intent configuration only when requested",
      ],
      runtimeTests: ["Open system share UI with controlled text/file payload"],
      behavioralTests: [
        "Verify sensitive fields are excluded and cancellation leaves product state consistent",
      ],
      failureDetection: [
        "Detect unavailable target, cancelled share and inaccessible file payload",
      ],
      securityBoundaries: [
        "Never share secrets, tokens or private cross-user data",
      ],
      limitations: ["Available share targets are environment dependent"],
    }),
    discoveredCapability({
      id: "contacts",
      label: "Contacts",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform Contacts/ContactsContract APIs or current compatible Flutter bridge",
      ],
      permissions: {
        ios: ["contacts"],
        android: ["READ_CONTACTS and/or WRITE_CONTACTS only when required"],
      },
      nativeConfiguration: [
        "Declare exact read/write purpose and requested contact fields",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Prefer picker/limited fields over bulk address-book access",
      ],
      installSteps: ["Install researched compatible contacts dependency"],
      buildRequirements: ["Compile requested contact permissions"],
      runtimeTests: ["Read/select a controlled contact after permission grant"],
      behavioralTests: [
        "Verify product only uses requested fields and handles permission revocation",
      ],
      failureDetection: [
        "Detect denial, empty selection, missing fields and write conflict",
      ],
      securityBoundaries: [
        "Treat contact data as private user data; minimize collection and prohibit cross-user leakage",
      ],
      limitations: [
        "Contact access may be restricted by OS/user policy and store review",
      ],
    }),
    discoveredCapability({
      id: "calendar",
      label: "Calendar",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform EventKit/Calendar Provider APIs or current compatible Flutter bridge",
      ],
      permissions: {
        ios: ["calendar events when required"],
        android: ["READ_CALENDAR and/or WRITE_CALENDAR only when required"],
      },
      nativeConfiguration: [
        "Declare event read/write scope and timezone handling",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Select system calendar integration only for explicit product requirements",
      ],
      installSteps: ["Install researched compatible calendar bridge"],
      buildRequirements: ["Compile requested calendar permissions"],
      runtimeTests: [
        "Create/read/delete a controlled test event in an authorized calendar",
      ],
      behavioralTests: [
        "Verify duplicates, timezone and cancellation behavior",
      ],
      failureDetection: [
        "Detect denial, unavailable calendar, conflict and failed write",
      ],
      securityBoundaries: [
        "Do not read or mutate unrelated calendar data beyond product need",
      ],
      limitations: [
        "Calendar account/provider behavior differs by device configuration",
      ],
    }),
    discoveredCapability({
      id: "widgets",
      label: "Home/lock-screen widgets",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "WidgetKit and/or Android App Widgets plus generated native bridge",
      ],
      permissions: { ios: [], android: [] },
      nativeConfiguration: [
        "Define widget extension/provider, refresh policy and shared data contract",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Generate platform-specific extension/provider target only when requested",
      ],
      installSteps: ["Generate/install native widget target and bridge"],
      buildRequirements: [
        "Build widget extension/provider together with host app",
      ],
      runtimeTests: [
        "Add widget on simulator/emulator/device and observe a controlled data refresh",
      ],
      behavioralTests: [
        "Verify stale/error/empty states and tap routing to the host app",
      ],
      failureDetection: [
        "Detect missing shared state, refresh failure and unsupported widget family",
      ],
      securityBoundaries: [
        "Do not expose sensitive data on unlocked/locked surfaces without explicit policy",
      ],
      limitations: [
        "Widget families, background refresh frequency and lock-screen behavior vary by OS",
      ],
    }),
    discoveredCapability({
      id: "live_activities",
      label: "iOS Live Activities",
      supportedPlatforms: IOS_ONLY,
      dependencies: ["ActivityKit/WidgetKit and generated native integration"],
      permissions: { ios: [] },
      nativeConfiguration: [
        "Define ActivityAttributes, lifecycle and push-update configuration if requested",
      ],
      credentialRequirements: {
        required: false,
        kinds: [
          "APNs credential only when remote Live Activity updates are requested",
        ],
        isolation: "not_applicable",
      },
      provisioning: [
        "Require supported iOS/Xcode target and optional APNs setup for remote updates",
      ],
      installSteps: ["Generate/compile ActivityKit extension and bridge"],
      buildRequirements: [
        "Build host app plus widget/activity extension on supported Xcode SDK",
      ],
      runtimeTests: [
        "Start, update and end a controlled Live Activity on supported simulator/device",
      ],
      behavioralTests: [
        "Verify activity lifecycle mirrors product state and terminates when stale/completed",
      ],
      failureDetection: [
        "Detect disabled activities, stale state, update rejection and unsupported OS",
      ],
      securityBoundaries: [
        "Limit lock-screen/Dynamic Island data to explicitly safe information",
      ],
      limitations: [
        "iOS-only; remote updates require separate APNs evidence and signing access",
      ],
    }),
    discoveredCapability({
      id: "background_jobs",
      label: "Background jobs",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Platform background-task APIs plus AppForge-generated durable server worker when continuous execution is required",
      ],
      permissions: {
        ios: ["declared background modes only when justified"],
        android: [
          "WorkManager/foreground service configuration only when justified",
        ],
      },
      nativeConfiguration: [
        "Define bounded device background task and server-side durable-work responsibilities separately",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Reuse AppForge single-writer/idempotency patterns for server-side work; never rely on mobile process permanence",
      ],
      installSteps: [
        "Install researched platform background-task bridge only when device-side scheduling is required",
      ],
      buildRequirements: [
        "Compile platform background modes/work constraints and server worker configuration",
      ],
      runtimeTests: [
        "Background the app/process and prove bounded task execution or durable server job recovery",
      ],
      behavioralTests: [
        "Verify duplicate/retry/restart paths produce one logical side effect",
      ],
      failureDetection: [
        "Detect OS deferral/termination, duplicate lease, stale job, exhausted retry and unavailable queue",
      ],
      securityBoundaries: [
        "Use idempotency, scoped secrets, bounded retries, per-user authorization and single-writer/deduplication for mutating work",
      ],
      limitations: [
        "Mobile OS scheduling is opportunistic; continuous monitoring belongs on durable backend infrastructure",
      ],
    }),
    discoveredCapability({
      id: "scheduling",
      label: "Scheduled tasks",
      supportedPlatforms: IOS_ANDROID,
      dependencies: [
        "Durable backend scheduler/queue and optional platform local scheduling APIs",
      ],
      permissions: {
        ios: [],
        android: [
          "exact alarm permission only when truly required and policy-compliant",
        ],
      },
      nativeConfiguration: [
        "Represent schedule, timezone, recurrence and idempotency key explicitly",
      ],
      credentialRequirements: {
        required: false,
        kinds: [],
        isolation: "not_applicable",
      },
      provisioning: [
        "Prefer durable server scheduling for business-critical work; use device scheduling for local UX only",
      ],
      installSteps: [
        "Connect to existing AppForge-compatible queue/scheduler pattern and optional native scheduler bridge",
      ],
      buildRequirements: [
        "Compile only platform scheduling permissions/modes actually required",
      ],
      runtimeTests: [
        "Execute a controlled scheduled task across restart/time-boundary conditions",
      ],
      behavioralTests: [
        "Verify recurrence, cancellation, deduplication and timezone behavior",
      ],
      failureDetection: [
        "Detect missed schedule, duplicate dispatch, clock/timezone shift and exhausted retry",
      ],
      securityBoundaries: [
        "Authorize scheduled side effects at execution time and prevent one user's schedule from acting on another user's data",
      ],
      limitations: [
        "Exact timing is not guaranteed by mobile OS background schedulers; server infrastructure is required for reliable monitoring",
      ],
    }),
  ];

const BY_ID = new Map(
  PRODUCT_CAPABILITY_ADAPTERS.map((adapter) => [adapter.id, adapter]),
);

export function getProductCapabilityAdapter(
  id: string,
): ProductCapabilityAdapterDescriptor | undefined {
  return BY_ID.get(id as ProductCapabilityId);
}

export function listProductCapabilitiesForPlatform(
  platform: AdapterPlatform,
): ProductCapabilityAdapterDescriptor[] {
  return PRODUCT_CAPABILITY_ADAPTERS.filter((adapter) =>
    adapter.supportedPlatforms.includes(platform),
  );
}
