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

function mergeNodeDependencies(
  current: string | undefined,
  required: Record<string, string>,
): string {
  try {
    const parsed = current ? record(JSON.parse(current)) : {};
    return JSON.stringify(
      {
        ...parsed,
        dependencies: {
          ...record(parsed.dependencies),
          ...required,
        },
      },
      null,
      2,
    );
  } catch {
    return JSON.stringify({ dependencies: required }, null, 2);
  }
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

function backgroundSupportFiles(): Record<string, string> {
  return {
    "server/src/background/queue.ts": `import { createHash } from 'node:crypto';
import { Queue, Worker, type Job } from 'bullmq';

export type BackgroundTaskPayload = {
  kind: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
};

export type BackgroundExecutionContext = {
  executionId: string;
  attempt: number;
};

export type BackgroundTaskHandler = (
  task: BackgroundTaskPayload,
  context: BackgroundExecutionContext,
) => Promise<void>;

function redisConnection() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) throw new Error('REDIS_URL is required for durable background jobs');
  return { url };
}

function queueName(): string {
  return process.env.BACKGROUND_QUEUE_NAME?.trim() || 'product-background-jobs';
}

function workerConcurrency(): number {
  const value = Number(process.env.BACKGROUND_WORKER_CONCURRENCY ?? 2);
  if (!Number.isInteger(value) || value < 1 || value > 32) {
    throw new Error('BACKGROUND_WORKER_CONCURRENCY must be an integer from 1 to 32');
  }
  return value;
}

function stableJobId(idempotencyKey: string): string {
  const normalized = idempotencyKey.trim();
  if (!normalized) throw new Error('idempotencyKey is required');
  return createHash('sha256').update(normalized).digest('hex');
}

export function createBackgroundQueue(): Queue<BackgroundTaskPayload> {
  return new Queue<BackgroundTaskPayload>(queueName(), {
    connection: redisConnection(),
  });
}

export async function enqueueBackgroundTask(
  queue: Queue<BackgroundTaskPayload>,
  task: BackgroundTaskPayload,
) {
  const idempotencyKey = task.idempotencyKey.trim();
  const jobId = stableJobId(idempotencyKey);
  return queue.add(
    task.kind,
    { ...task, idempotencyKey },
    {
      jobId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}

export async function upsertRecurringTask(
  queue: Queue<BackgroundTaskPayload>,
  input: {
    schedulerId: string;
    name: string;
    payload: Record<string, unknown>;
    pattern?: string;
    everyMs?: number;
  },
) {
  const schedulerId = input.schedulerId.trim();
  if (!schedulerId) throw new Error('schedulerId is required');
  const pattern = input.pattern?.trim();
  const everyMs = input.everyMs;
  const usesPattern = Boolean(pattern);
  const usesInterval = Number.isFinite(everyMs) && Number(everyMs) > 0;
  if (usesPattern === usesInterval) {
    throw new Error('Provide exactly one recurring schedule: pattern or everyMs');
  }

  const repeat = usesPattern
    ? { pattern: pattern as string, tz: 'UTC' }
    : { every: Number(everyMs) };
  return queue.upsertJobScheduler(
    schedulerId,
    repeat,
    {
      name: input.name,
      data: {
        kind: input.name,
        payload: input.payload,
        idempotencyKey: 'scheduler-' + schedulerId,
      },
      opts: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    },
  );
}

export function createBackgroundWorker(
  handler: BackgroundTaskHandler,
): Worker<BackgroundTaskPayload> {
  return new Worker<BackgroundTaskPayload>(
    queueName(),
    async (job: Job<BackgroundTaskPayload>) => {
      if (!job.id) throw new Error('Background job is missing an execution id');
      await handler(job.data, {
        executionId: String(job.id),
        attempt: job.attemptsMade + 1,
      });
    },
    {
      connection: redisConnection(),
      concurrency: workerConcurrency(),
      maxStalledCount: 2,
    },
  );
}

export async function closeBackgroundRuntime(
  queue: Queue<BackgroundTaskPayload>,
  worker: Worker<BackgroundTaskPayload>,
): Promise<void> {
  await worker.close();
  await queue.close();
}
`,
  };
}

/**
 * Adds reusable Flutter client and Node backend support only for native
 * capabilities selected from the canonical ProductContract. Provider sending
 * credentials stay server-side; this layer never certifies runtime delivery
 * merely because support files exist.
 */
export function applyFlutterNativeCapabilitySupport(
  generatedFiles: Record<string, string>,
  productContract: ProductContract,
): Record<string, string> {
  if (productContract.selectedTechnologyStack !== "flutter-node") {
    return { ...generatedFiles };
  }

  const requested = new Set(
    deriveRequestedProductCapabilities(productContract),
  );
  const deepLinks = requested.has("deep_links");
  const pushNotifications = requested.has("push_notifications");
  const backgroundJobs = requested.has("background_jobs");
  const scheduling = requested.has("scheduling");
  const backgroundRuntime = backgroundJobs || scheduling;
  if (!deepLinks && !pushNotifications && !backgroundRuntime) {
    return { ...generatedFiles };
  }

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

  if (backgroundRuntime) {
    files["package.json"] = mergeNodeDependencies(files["package.json"], {
      bullmq: "^5.81.4",
    });
  }

  const clientEnvironment = [
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
    clientEnvironment,
  );

  if (backgroundRuntime) {
    files["server/.env.example"] = mergeEnvironmentExample(
      files["server/.env.example"],
      "REDIS_URL=\nBACKGROUND_QUEUE_NAME=product-background-jobs\nBACKGROUND_WORKER_CONCURRENCY=2\n",
    );
  }

  for (const [path, source] of Object.entries({
    ...(deepLinks ? deepLinkSupportFiles() : {}),
    ...(pushNotifications ? pushSupportFiles() : {}),
    ...(backgroundRuntime ? backgroundSupportFiles() : {}),
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
        ...(backgroundJobs
          ? {
              backgroundJobs: {
                serverImplemented: true,
                durableQueue: true,
                provider: "bullmq-redis",
                idempotencyRequired: true,
                retryBackoff: true,
                runtimeVerified: false,
              },
            }
          : {}),
        ...(scheduling
          ? {
              scheduling: {
                serverImplemented: true,
                schedulerApi: "bullmq-upsertJobScheduler",
                timezone: "UTC",
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
      backgroundJobs: backgroundJobs
        ? {
            runtime: "node-bullmq-redis",
            requiresRedis: true,
            retries: 5,
            idempotency: "required",
            gracefulShutdown: true,
          }
        : null,
      scheduling: scheduling
        ? {
            schedulerApi: "bullmq-upsertJobScheduler",
            timezone: "UTC",
            requiresRedis: true,
          }
        : null,
    },
    null,
    2,
  );

  return files;
}
