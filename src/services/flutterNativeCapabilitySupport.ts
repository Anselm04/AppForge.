import type { ProductContract } from "../lib/productContract.js";
import { deriveRequestedProductCapabilities } from "../lib/nativeCapabilitySelection.js";
import { mergeFlutterNodeManifest } from "./flutterNodeScaffold.js";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mergeEnvironmentExample(
  current: string | undefined,
  required: string,
): string {
  const lines = (current ?? "")
    .split("\n")
    .filter((line) => line.trim().length > 0);
  const existingKeys = new Set(
    lines
      .map((line) => /^([A-Z0-9_]+)=/.exec(line)?.[1])
      .filter((key): key is string => Boolean(key)),
  );
  for (const line of required.split("\n")) {
    const key = /^([A-Z0-9_]+)=/.exec(line)?.[1];
    if (key && !existingKeys.has(key)) {
      lines.push(line);
      existingKeys.add(key);
    }
  }
  return lines.length ? `${lines.join("\n")}\n` : required;
}

function deepLinkSupportFiles(): Record<string, string> {
  return {
    "lib/platform/deep_links.dart": `import 'dart:async';

import 'package:app_links/app_links.dart';

class ValidatedDeepLinkService {
  final AppLinks _appLinks;
  final String allowedHost;
  final String customScheme;
  StreamSubscription<Uri>? _subscription;

  ValidatedDeepLinkService({
    AppLinks? appLinks,
    String? allowedHost,
    String? customScheme,
  })  : _appLinks = appLinks ?? AppLinks(),
        allowedHost = allowedHost ?? const String.fromEnvironment('APP_LINK_HOST'),
        customScheme = customScheme ?? const String.fromEnvironment('APP_LINK_SCHEME');

  Uri validate(Uri uri) {
    if (!uri.isAbsolute || uri.userInfo.isNotEmpty) {
      throw const FormatException('Deep link must be an absolute URL without user info');
    }
    final scheme = uri.scheme.toLowerCase();
    final configuredHost = allowedHost.trim().toLowerCase();
    final configuredScheme = customScheme.trim().toLowerCase();
    if (scheme == 'https') {
      if (configuredHost.isEmpty || uri.host.toLowerCase() != configuredHost) {
        throw const FormatException('Deep-link host is not allowed');
      }
      return uri;
    }
    if (configuredScheme.isNotEmpty && scheme == configuredScheme) {
      if (configuredHost.isNotEmpty &&
          uri.host.isNotEmpty &&
          uri.host.toLowerCase() != configuredHost) {
        throw const FormatException('Deep-link host is not allowed');
      }
      return uri;
    }
    throw const FormatException('Deep-link scheme is not allowed');
  }

  Uri? validateNotificationLink(Object? value) {
    if (value is! String || value.trim().isEmpty) return null;
    return validate(Uri.parse(value.trim()));
  }

  void start(
    void Function(Uri uri) onAccepted, {
    void Function(Object error, StackTrace stackTrace)? onError,
  }) {
    if (_subscription != null) {
      throw StateError('Deep-link listener already started');
    }
    _subscription = _appLinks.uriLinkStream.listen(
      (uri) {
        try {
          onAccepted(validate(uri));
        } catch (error, stackTrace) {
          onError?.call(error, stackTrace);
        }
      },
      onError: onError,
    );
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    _subscription = null;
  }
}
`,
  };
}

function pushSupportFiles(): Record<string, string> {
  return {
    "lib/platform/push_notifications.dart": `import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'deep_links.dart';

typedef DeviceTokenRegistrar = Future<void> Function(String token);

class PushNotificationService {
  final FirebaseMessaging _messaging;
  final ValidatedDeepLinkService deepLinks;
  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;

  PushNotificationService({
    FirebaseMessaging? messaging,
    ValidatedDeepLinkService? deepLinks,
  })  : _messaging = messaging ?? FirebaseMessaging.instance,
        deepLinks = deepLinks ?? ValidatedDeepLinkService();

  Future<NotificationSettings> initialize({
    required DeviceTokenRegistrar registerToken,
    required void Function(Uri uri) onNotificationLink,
    void Function(Object error, StackTrace stackTrace)? onError,
  }) async {
    const apiKey = String.fromEnvironment('FIREBASE_API_KEY');
    const appId = String.fromEnvironment('FIREBASE_APP_ID');
    const senderId = String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
    const projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
    if ([apiKey, appId, senderId, projectId].any((value) => value.trim().isEmpty)) {
      throw StateError('Firebase public client configuration is required for push notifications');
    }

    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp(
        options: const FirebaseOptions(
          apiKey: apiKey,
          appId: appId,
          messagingSenderId: senderId,
          projectId: projectId,
        ),
      );
    }

    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    if (settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional) {
      final token = await _messaging.getToken();
      if (token != null && token.trim().isNotEmpty) {
        await registerToken(token);
      }
      _tokenSubscription = _messaging.onTokenRefresh.listen(
        (token) => unawaited(registerToken(token)),
        onError: onError,
      );
    }

    void route(RemoteMessage? message) {
      if (message == null) return;
      try {
        final link = deepLinks.validateNotificationLink(
          message.data['deep_link'] ?? message.data['link'],
        );
        if (link != null) onNotificationLink(link);
      } catch (error, stackTrace) {
        onError?.call(error, stackTrace);
      }
    }

    route(await _messaging.getInitialMessage());
    _openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen(
      route,
      onError: onError,
    );
    return settings;
  }

  Future<void> dispose() async {
    await _tokenSubscription?.cancel();
    await _openedSubscription?.cancel();
    _tokenSubscription = null;
    _openedSubscription = null;
  }
}
`,
  };
}

/**
 * Adds reusable Flutter client support only for native capabilities selected
 * from the canonical ProductContract. Provider sending credentials stay
 * server-side; this layer never certifies provider delivery by itself.
 */
export function applyFlutterNativeCapabilitySupport(
  generatedFiles: Record<string, string>,
  productContract: ProductContract,
): Record<string, string> {
  if (productContract.selectedTechnologyStack !== "flutter-node") {
    return { ...generatedFiles };
  }

  const requested = new Set(deriveRequestedProductCapabilities(productContract));
  const deepLinks = requested.has("deep_links");
  const pushNotifications = requested.has("push_notifications");
  if (!deepLinks && !pushNotifications) return { ...generatedFiles };

  const files = { ...generatedFiles };
  const supportManifest = [
    "name: appforge_native_support",
    "publish_to: none",
    "environment:",
    "  sdk: '>=3.6.0 <4.0.0'",
    "dependencies:",
    "  flutter:",
    "    sdk: flutter",
    ...(deepLinks ? ["  app_links: ^7.2.2"] : []),
    ...(pushNotifications
      ? ["  firebase_core: ^4.15.0", "  firebase_messaging: ^16.7.0"]
      : []),
    "",
  ].join("\n");
  files["pubspec.yaml"] = files["pubspec.yaml"]
    ? mergeFlutterNodeManifest(supportManifest, files["pubspec.yaml"])
    : supportManifest;

  const environment = [
    ...(deepLinks ? ["APP_LINK_HOST=", "APP_LINK_SCHEME="] : []),
    ...(pushNotifications
      ? [
          "FIREBASE_API_KEY=",
          "FIREBASE_APP_ID=",
          "FIREBASE_MESSAGING_SENDER_ID=",
          "FIREBASE_PROJECT_ID=",
        ]
      : []),
    "",
  ].join("\n");
  files[".env.example"] = mergeEnvironmentExample(
    files[".env.example"],
    environment,
  );

  for (const [path, source] of Object.entries({
    ...(deepLinks ? deepLinkSupportFiles() : {}),
    ...(pushNotifications ? pushSupportFiles() : {}),
  })) {
    if (!files[path]?.trim()) files[path] = source;
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
        ...(deepLinks
          ? {
              deepLinks: {
                clientImplemented: true,
                hostAllowlistRequired: true,
                nativeAssociationRequired: true,
                runtimeVerified: false,
              },
            }
          : {}),
        ...(pushNotifications
          ? {
              pushNotifications: {
                clientImplemented: true,
                provider: "firebase-cloud-messaging",
                providerCredentialsRequired: true,
                providerCredentialsBundledInClient: false,
                nativeProvisioningRequired: true,
                runtimeVerified: false,
              },
            }
          : {}),
      },
    },
    null,
    2,
  );

  files["appforge/native-capabilities.json"] = JSON.stringify(
    {
      version: 1,
      deepLinks: deepLinks
        ? {
            android: {
              requiresIntentFilter: true,
              requiresAssetLinks: true,
              flutterDefaultHandlerDisabledForAppLinksPlugin: true,
            },
            ios: {
              requiresAssociatedDomains: true,
              requiresAppleAppSiteAssociation: true,
              flutterDefaultHandlerDisabledForAppLinksPlugin: true,
            },
          }
        : null,
      pushNotifications: pushNotifications
        ? {
            android: { requiresPostNotificationsPermission: true },
            ios: {
              requiresPushEntitlement: true,
              requiresRemoteNotificationBackgroundMode: true,
              requiresApnsProviderCredential: true,
            },
          }
        : null,
    },
    null,
    2,
  );

  return files;
}
