import type { ProductContract } from "../lib/productContract.js";
import { deriveRequestedProductCapabilities } from "../lib/nativeCapabilitySelection.js";
import { mergeFlutterNodeManifest } from "./flutterNodeScaffold.js";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function voiceSupportFile(): string {
  return `import 'package:flutter_tts/flutter_tts.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

enum ExplicitConfirmation { confirm, decline, unknown }

class VoiceInteractionService {
  final stt.SpeechToText speech;
  final FlutterTts tts;
  bool _initialized = false;

  VoiceInteractionService({
    stt.SpeechToText? speech,
    FlutterTts? tts,
  })  : speech = speech ?? stt.SpeechToText(),
        tts = tts ?? FlutterTts();

  Future<void> initialize({
    void Function(String status)? onStatus,
    void Function(Object error)? onError,
  }) async {
    final available = await speech.initialize(
      onStatus: onStatus,
      onError: (error) => onError?.call(error),
    );
    if (!available) {
      throw StateError('Speech recognition is unavailable or microphone permission was denied');
    }
    await tts.awaitSpeakCompletion(true);
    _initialized = true;
  }

  Future<void> listenForCommand({
    required void Function(String command) onFinalCommand,
    String? localeId,
    void Function(Object error)? onError,
  }) async {
    if (!_initialized) {
      throw StateError('VoiceInteractionService must be initialized before listening');
    }
    await speech.listen(
      onResult: (result) {
        if (!result.finalResult) return;
        final command = result.recognizedWords.trim();
        if (command.isNotEmpty) onFinalCommand(command);
      },
      listenOptions: stt.SpeechListenOptions(
        cancelOnError: true,
        partialResults: false,
        listenMode: stt.ListenMode.confirmation,
        autoPunctuation: true,
        localeId: localeId,
        listenFor: const Duration(seconds: 15),
        pauseFor: const Duration(seconds: 3),
      ),
    ).catchError((Object error) {
      onError?.call(error);
    });
  }

  Future<void> stopListening() => speech.stop();

  Future<void> speak(String text, {String? language}) async {
    final value = text.trim();
    if (value.isEmpty) throw ArgumentError('Spoken text cannot be empty');
    if (value.length > 1000) {
      throw ArgumentError('Spoken text exceeds the 1000-character safety limit');
    }
    if (language != null && language.trim().isNotEmpty) {
      final available = await tts.isLanguageAvailable(language.trim());
      if (available != true) {
        throw StateError('Requested text-to-speech language is unavailable');
      }
      await tts.setLanguage(language.trim());
    }
    final result = await tts.speak(value);
    if (result != 1) throw StateError('Text-to-speech playback failed');
  }

  Future<void> stopSpeaking() async {
    await tts.stop();
  }

  ExplicitConfirmation parseExplicitConfirmation(
    String command, {
    Set<String> confirmPhrases = const {'yes', 'confirm', 'proceed'},
    Set<String> declinePhrases = const {'no', 'cancel', 'pass'},
  }) {
    final normalized = command.trim().toLowerCase();
    if (confirmPhrases.map((value) => value.toLowerCase()).contains(normalized)) {
      return ExplicitConfirmation.confirm;
    }
    if (declinePhrases.map((value) => value.toLowerCase()).contains(normalized)) {
      return ExplicitConfirmation.decline;
    }
    return ExplicitConfirmation.unknown;
  }
}
`;
}

/**
 * Adds reusable short-command speech recognition, TTS and microphone support
 * when those capabilities are selected by the canonical ProductContract.
 * This layer never performs a protected product action; callers must require
 * an explicit confirmation decision before irreversible actions.
 */
export function applyFlutterVoiceCapabilitySupport(
  generatedFiles: Record<string, string>,
  productContract: ProductContract,
): Record<string, string> {
  if (productContract.selectedTechnologyStack !== "flutter-node") {
    return { ...generatedFiles };
  }

  const requested = new Set(
    deriveRequestedProductCapabilities(productContract),
  );
  const speechRecognition = requested.has("speech_recognition");
  const textToSpeech = requested.has("text_to_speech");
  const microphone = requested.has("microphone");
  if (!speechRecognition && !textToSpeech && !microphone) {
    return { ...generatedFiles };
  }

  const files = { ...generatedFiles };
  const supportManifest = [
    "name: appforge_voice_support",
    "publish_to: none",
    "environment:",
    "  sdk: '>=3.12.0 <4.0.0'",
    "dependencies:",
    "  flutter:",
    "    sdk: flutter",
    ...(speechRecognition || microphone ? ["  speech_to_text: ^7.5.0"] : []),
    ...(textToSpeech ? ["  flutter_tts: ^4.2.5"] : []),
    "",
  ].join("\n");
  files["pubspec.yaml"] = files["pubspec.yaml"]
    ? mergeFlutterNodeManifest(supportManifest, files["pubspec.yaml"])
    : supportManifest;

  if (!files["lib/platform/voice_interaction.dart"]?.trim()) {
    files["lib/platform/voice_interaction.dart"] = voiceSupportFile();
  }

  const currentApi = (() => {
    try {
      return files["shared/contracts/product-api.json"]
        ? record(JSON.parse(files["shared/contracts/product-api.json"]))
        : {};
    } catch {
      return {};
    }
  })();
  files["shared/contracts/product-api.json"] = JSON.stringify(
    {
      ...currentApi,
      nativeCapabilities: {
        ...record(currentApi.nativeCapabilities),
        ...(speechRecognition
          ? {
              speechRecognition: {
                clientImplemented: true,
                shortCommandMode: true,
                explicitPermissionRequired: true,
                microphonePermissionRequired: true,
                runtimeVerified: false,
              },
            }
          : {}),
        ...(textToSpeech
          ? {
              textToSpeech: {
                clientImplemented: true,
                explicitStopSupported: true,
                runtimeVerified: false,
              },
            }
          : {}),
        ...(microphone
          ? {
              microphone: {
                clientImplemented: true,
                explicitPermissionRequired: true,
                backgroundRecordingEnabled: false,
                runtimeVerified: false,
              },
            }
          : {}),
      },
    },
    null,
    2,
  );

  const currentNative = (() => {
    try {
      return files["appforge/native-capabilities.json"]
        ? record(JSON.parse(files["appforge/native-capabilities.json"]))
        : {};
    } catch {
      return {};
    }
  })();
  files["appforge/native-capabilities.json"] = JSON.stringify(
    {
      ...currentNative,
      version: 1,
      voice: {
        speechRecognition,
        textToSpeech,
        microphone,
        protectedActionsRequireExplicitConfirmation: true,
        android: {
          requiresRecordAudioPermission: speechRecognition || microphone,
          requiresTtsServiceQuery: textToSpeech,
        },
        ios: {
          requiresMicrophoneUsageDescription: speechRecognition || microphone,
          requiresSpeechRecognitionUsageDescription: speechRecognition,
        },
      },
    },
    null,
    2,
  );

  return files;
}
