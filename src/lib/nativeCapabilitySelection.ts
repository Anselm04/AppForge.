import type { ProductContract } from "./productContract.js";
import type { ProductCapabilityId } from "./productCapabilityAdapters.js";

function contractText(contract: ProductContract): string {
  return [
    contract.originalPrompt,
    contract.canonicalInterpretation,
    ...contract.coreWorkflows,
    ...contract.functionalRequirements.map((requirement) => requirement.text),
    ...contract.nonFunctionalRequirements,
    ...contract.integrations,
    ...contract.runtimeRequirements,
    ...contract.deploymentRequirements,
    ...contract.securityRequirements,
  ]
    .join("\n")
    .toLowerCase();
}

function add(
  selected: Set<ProductCapabilityId>,
  ...ids: ProductCapabilityId[]
): void {
  for (const id of ids) selected.add(id);
}

/**
 * Deterministically derives native product capabilities from the preserved
 * canonical contract. This chooses what must be planned/proven; it never
 * promotes adapter maturity or claims runtime support.
 */
export function deriveRequestedProductCapabilities(
  contract: ProductContract,
): ProductCapabilityId[] {
  const text = contractText(contract);
  const selected = new Set<ProductCapabilityId>();

  const mobileProduct =
    contract.productType === "mobile_app" ||
    contract.productFamilies.includes("mobile") ||
    /\b(?:iphone|ipad|ios|android|mobile app|mobile application)\b/.test(text);

  const pushRequested =
    /\bpush[- ]?notifications?\b/.test(text) ||
    /\bnotification\b[^\n]{0,60}\b(?:phone|device|mobile)\b/.test(text);
  if (pushRequested) {
    add(selected, "push_notifications");
    // Actionable mobile push must have a deterministic in-app destination.
    if (mobileProduct) add(selected, "deep_links");
  }

  const voiceInteraction =
    /\b(?:hands[- ]?free|voice interaction|voice command|voice reply|answer by voice|respond by voice|spoken command|speech recognition)\b/.test(
      text,
    );
  if (voiceInteraction) {
    add(selected, "speech_recognition", "text_to_speech", "microphone");
  }

  if (
    /\b(?:text[- ]?to[- ]?speech|tts|read(?:s)? (?:the )?(?:response|message|result) aloud|speak(?:s|ing)? aloud)\b/.test(
      text,
    )
  ) {
    add(selected, "text_to_speech");
  }

  if (/\b(?:siri|app intents?)\b/.test(text)) {
    add(selected, "siri_app_intents");
  }
  if (/\b(?:android voice actions?|app actions?)\b/.test(text)) {
    add(selected, "android_voice_actions");
  }

  if (/\bcamera\b|\btake (?:a )?(?:photo|picture)\b/.test(text)) {
    add(selected, "camera");
  }
  if (/\b(?:photo library|photo picker|photos?|images?)\b/.test(text)) {
    add(selected, "photos");
  }
  if (/\bmicrophone\b|\brecord (?:audio|voice)\b/.test(text)) {
    add(selected, "microphone");
  }
  if (/\b(?:audio playback|play audio|play sound|audio player)\b/.test(text)) {
    add(selected, "audio");
  }

  if (/\b(?:gps|current location|user location|geolocation)\b/.test(text)) {
    add(selected, "gps_location");
  }
  if (/\bbackground location\b|\blocation tracking\b/.test(text)) {
    add(selected, "gps_location", "background_location");
  }
  if (/\bbluetooth\b|\bble\b/.test(text)) {
    add(selected, "bluetooth");
  }
  if (/\b(?:biometric|face id|touch id|fingerprint)\b/.test(text)) {
    add(selected, "biometrics");
  }

  if (/\b(?:deep links?|deep[- ]link|universal links?|app links?)\b/.test(text)) {
    add(selected, "deep_links");
  }
  if (/\b(?:file picker|document picker|file access|select (?:a )?file)\b/.test(text)) {
    add(selected, "file_access");
  }
  if (/\b(?:share sheet|system share|sharing extension|share (?:a )?(?:file|link|image))\b/.test(text)) {
    add(selected, "sharing");
  }
  if (/\b(?:contacts?|address book)\b/.test(text)) {
    add(selected, "contacts");
  }
  if (/\b(?:calendar|eventkit)\b/.test(text)) {
    add(selected, "calendar");
  }
  if (/\b(?:home[- ]screen widget|lock[- ]screen widget|widgets?)\b/.test(text)) {
    add(selected, "widgets");
  }
  if (/\blive activit(?:y|ies)\b|\bdynamic island\b/.test(text)) {
    add(selected, "live_activities");
  }

  const backgroundMonitoring =
    /\bbackground\b[^\n]{0,100}\b(?:monitor|monitoring|watch|job|task|sync|poll|tracking|availability)\b/.test(
      text,
    ) ||
    /\b(?:monitor|monitoring|watch|poll)\b[^\n]{0,100}\bbackground\b/.test(
      text,
    );
  if (backgroundMonitoring) {
    add(selected, "background_jobs", "scheduling");
  }

  if (
    /\b(?:scheduled tasks?|scheduler|cron|recurring job|recurring task|run every|check every)\b/.test(
      text,
    )
  ) {
    add(selected, "scheduling");
  }
  if (
    /\b(?:background jobs?|background task|background worker|durable worker|job queue)\b/.test(
      text,
    )
  ) {
    add(selected, "background_jobs");
  }

  return [...selected];
}
