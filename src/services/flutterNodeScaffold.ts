import { parse, stringify } from "yaml";
import type { ProductContract } from "../lib/productContract.js";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasCapability(
  contract: ProductContract | undefined,
  capability: "authentication" | "database",
): boolean {
  return contract?.secondaryCapabilities.includes(capability) ?? false;
}

function mergeJsonObject(
  baseSource: string,
  generatedSource: string | undefined,
): string {
  try {
    const base = record(JSON.parse(baseSource));
    const current = generatedSource
      ? record(JSON.parse(generatedSource))
      : {};
    return JSON.stringify(
      {
        ...current,
        ...base,
        scripts: {
          ...record(current.scripts),
          ...record(base.scripts),
        },
        dependencies: {
          ...record(current.dependencies),
          ...record(base.dependencies),
        },
        devDependencies: {
          ...record(current.devDependencies),
          ...record(base.devDependencies),
        },
      },
      null,
      2,
    );
  } catch {
    return generatedSource ?? baseSource;
  }
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

/** Preserve product configuration while connecting mandatory infrastructure. Invalid YAML is left for validation. */
export function mergeFlutterNodeManifest(
  baseSource: string,
  generatedSource: string,
): string {
  try {
    const base = record(parse(baseSource));
    const current = record(parse(generatedSource));
    const baseFlutter = record(base.flutter);
    const currentFlutter = record(current.flutter);
    return stringify({
      ...base,
      ...current,
      environment: {
        ...record(base.environment),
        ...record(current.environment),
      },
      dependencies: {
        ...record(current.dependencies),
        ...record(base.dependencies),
      },
      dev_dependencies: {
        ...record(current.dev_dependencies),
        ...record(base.dev_dependencies),
      },
      flutter: {
        ...baseFlutter,
        ...currentFlutter,
        assets: [
          ...new Set([
            ...(Array.isArray(baseFlutter.assets) ? baseFlutter.assets : []),
            ...(Array.isArray(currentFlutter.assets)
              ? currentFlutter.assets
              : []),
          ]),
        ],
      },
    });
  } catch {
    return generatedSource;
  }
}

function authInfrastructureFiles(): Record<string, string> {
  return {
    "lib/auth/session.dart": `import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> initializeSupabaseFromEnvironment() async {
  const url = String.fromEnvironment('SUPABASE_URL');
  const publishableKey = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');
  if (url.isEmpty || publishableKey.isEmpty) {
    throw StateError('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required');
  }
  await Supabase.initialize(url: url, publishableKey: publishableKey);
}

class AuthSession {
  SupabaseClient get client => Supabase.instance.client;

  Session? get currentSession => client.auth.currentSession;

  Future<AuthResponse> signUp({
    required String email,
    required String password,
  }) => client.auth.signUp(email: email, password: password);

  Future<AuthResponse> signInWithPassword({
    required String email,
    required String password,
  }) => client.auth.signInWithPassword(email: email, password: password);

  Future<void> signOut() => client.auth.signOut();
}
`,
    "server/src/auth.ts": `import { createClient, type JwtPayload } from '@supabase/supabase-js';

export class AuthenticationError extends Error {}

function supabaseClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    throw new AuthenticationError('Supabase auth is not configured');
  }
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function getVerifiedClaims(
  authorizationHeader: string | undefined,
): Promise<JwtPayload> {
  const match = /^Bearer\\s+(.+)$/i.exec(authorizationHeader?.trim() ?? '');
  if (!match?.[1]) throw new AuthenticationError('Bearer token required');
  const { data, error } = await supabaseClient().auth.getClaims(match[1]);
  if (error || !data?.claims?.sub) {
    throw new AuthenticationError('Invalid or expired bearer token');
  }
  return data.claims;
}
`,
  };
}

function ownerScopedPersistenceFiles(): Record<string, string> {
  return {
    "database/migrations/001_user_data.sql": `create table if not exists public.user_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_records enable row level security;
revoke all on table public.user_records from anon;
grant select, insert, update, delete to authenticated;

drop policy if exists user_records_select_own on public.user_records;
create policy user_records_select_own
on public.user_records for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists user_records_insert_own on public.user_records;
create policy user_records_insert_own
on public.user_records for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists user_records_update_own on public.user_records;
create policy user_records_update_own
on public.user_records for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists user_records_delete_own on public.user_records;
create policy user_records_delete_own
on public.user_records for delete to authenticated
using ((select auth.uid()) = user_id);
`,
  };
}

/** Infrastructure only; substantive application entrypoints must come from generation. */
export function flutterNodeScaffold(
  productContract?: ProductContract,
): Record<string, string> {
  const authentication = hasCapability(productContract, "authentication");
  const database = hasCapability(productContract, "database");
  const ownerScopedPersistence = authentication && database;
  const backendDependencies = authentication
    ? { "@supabase/supabase-js": "^2.117.1" }
    : undefined;
  const flutterAuthDependency = authentication
    ? "  supabase_flutter: ^2.18.3\n"
    : "";
  const authEnvironment = authentication
    ? "SUPABASE_URL=\nSUPABASE_PUBLISHABLE_KEY=\n"
    : "";

  return {
    "package.json": JSON.stringify(
      {
        name: "appforge-mobile-backend",
        private: true,
        version: "0.1.0",
        type: "module",
        scripts: {
          build: "tsc -p server/tsconfig.json",
          start: "node build/server/server.js",
          test: "vitest run",
          "build:client": "flutter build web",
          "test:client": "flutter test",
        },
        ...(backendDependencies ? { dependencies: backendDependencies } : {}),
        devDependencies: {
          typescript: "^5.3.3",
          "@types/node": "^22.0.0",
          // Fresh npm 10.9.x installs currently crash in Arborist on Vitest 4.1.x's
          // optional peer graph. Generated projects must remain installable on the
          // supported Node 22/npm 10 runner without disabling peer validation.
          vitest: "^3.2.7",
        },
      },
      null,
      2,
    ),
    "server/tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          outDir: "../build/server",
          rootDir: "src",
          types: ["node"],
          skipLibCheck: true,
        },
        include: ["src/**/*.ts"],
      },
      null,
      2,
    ),
    "shared/contracts/product-api.json": JSON.stringify(
      {
        version: 1,
        health: { live: "/health/live", ready: "/health/ready" },
        error: { fields: ["code", "message"] },
        authentication: authentication
          ? {
              transport: "bearer",
              provider: "supabase",
              verification: "backend",
              tokenStorage: "provider-managed-session",
              implemented: true,
            }
          : {
              transport: "bearer",
              verification: "backend",
              tokenStorage: "platform-secure-storage",
              implemented: false,
            },
        database: {
          provider: database ? "supabase-postgres" : null,
          ownerScopedPersistence,
          implemented: ownerScopedPersistence,
        },
      },
      null,
      2,
    ),
    "server/src/api-contract.ts": `import { readFileSync } from 'node:fs';
export interface ApiContract { version: 1; health: {live: string; ready: string} }
export function loadContract(path = 'shared/contracts/product-api.json'): ApiContract {
  const value = JSON.parse(readFileSync(path, 'utf8')) as Partial<ApiContract>;
  if (value.version !== 1 || !value.health || value.health.live !== '/health/live' || value.health.ready !== '/health/ready') throw new Error('Invalid API contract');
  return value as ApiContract;
}
`,
    "server/src/server.ts": `import { createServer } from 'node:http';
import { loadContract } from './api-contract.js';
const contract = loadContract();
const server = createServer((request, response) => {
  response.setHeader('content-type', 'application/json');
  response.setHeader('cache-control', 'no-store');
  if (request.method === 'GET' && [contract.health.live, contract.health.ready].includes(request.url ?? '')) {
    response.end(JSON.stringify({status: 'ok', apiVersion: contract.version, scope: 'infrastructure-only'}));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({error: {code: 'NOT_FOUND', message: 'Route not found'}}));
});
server.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '127.0.0.1', () => {
  const address = server.address();
  console.log(JSON.stringify({port: typeof address === 'object' && address ? address.port : null}));
});
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => server.close());
`,
    "pubspec.yaml": `name: appforge_mobile\npublish_to: none\nversion: 0.1.0+1\nenvironment:\n  sdk: '>=3.4.0 <4.0.0'\ndependencies:\n  flutter:\n    sdk: flutter\n  http: ^1.2.0\n${flutterAuthDependency}dev_dependencies:\n  flutter_test:\n    sdk: flutter\nflutter:\n  uses-material-design: true\n  assets:\n    - shared/contracts/product-api.json\n`,
    "lib/api_client.dart": `import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

class ApiClient {
  final Uri baseUrl;
  final http.Client transport;
  ApiClient(this.baseUrl, this.transport) {
    if (!baseUrl.hasAuthority || !['http', 'https'].contains(baseUrl.scheme)) {
      throw ArgumentError('A valid API_BASE_URL is required');
    }
    if (const bool.fromEnvironment('dart.vm.product') && baseUrl.scheme != 'https') {
      throw ArgumentError('Release API_BASE_URL must use HTTPS');
    }
  }
  Future<Map<String, dynamic>> health() async {
    final contract = jsonDecode(await rootBundle.loadString('shared/contracts/product-api.json')) as Map<String, dynamic>;
    if (contract['version'] != 1) throw StateError('Unsupported API contract');
    final path = (contract['health'] as Map<String, dynamic>)['live'] as String;
    if (path != '/health/live') throw StateError('Invalid health contract');
    final response = await transport.get(baseUrl.resolve(path)).timeout(const Duration(seconds: 10));
    if (response.statusCode != 200) throw StateError('Backend health request failed');
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (body['apiVersion'] != contract['version']) throw StateError('API version mismatch');
    return body;
  }
  void close() => transport.close();
}
`,
    "lib/main.dart": `import 'package:flutter/material.dart';
void main() => runApp(const MaterialApp(home: Scaffold(body: SizedBox.shrink())));
`,
    ".env.example": `API_BASE_URL=\n${authEnvironment}`,
    "server/.env.example": `PORT=3000\nHOST=127.0.0.1\nDATABASE_URL=\n${authEnvironment}`,
    ...(authentication ? authInfrastructureFiles() : {}),
    ...(ownerScopedPersistence ? ownerScopedPersistenceFiles() : {}),
  };
}

/**
 * Augment a generated Flutter + Node product with mandatory contract-driven
 * infrastructure while preserving substantive customer code. This is safe to
 * run before or after the structural scaffold merge.
 */
export function applyFlutterNodeContractSupport(
  generatedFiles: Record<string, string>,
  productContract: ProductContract,
): Record<string, string> {
  if (productContract.selectedTechnologyStack !== "flutter-node") {
    return { ...generatedFiles };
  }
  if (
    !hasCapability(productContract, "authentication") &&
    !hasCapability(productContract, "database")
  ) {
    return { ...generatedFiles };
  }

  const support = flutterNodeScaffold(productContract);
  const files = { ...generatedFiles };

  files["package.json"] = mergeJsonObject(
    support["package.json"],
    files["package.json"],
  );
  files["pubspec.yaml"] = files["pubspec.yaml"]
    ? mergeFlutterNodeManifest(support["pubspec.yaml"], files["pubspec.yaml"])
    : support["pubspec.yaml"];

  try {
    const currentApi = files["shared/contracts/product-api.json"]
      ? record(JSON.parse(files["shared/contracts/product-api.json"]))
      : {};
    const supportApi = record(
      JSON.parse(support["shared/contracts/product-api.json"]),
    );
    files["shared/contracts/product-api.json"] = JSON.stringify(
      {
        ...currentApi,
        ...supportApi,
        health: {
          ...record(currentApi.health),
          ...record(supportApi.health),
        },
        authentication: supportApi.authentication,
        database: supportApi.database,
      },
      null,
      2,
    );
  } catch {
    files["shared/contracts/product-api.json"] =
      support["shared/contracts/product-api.json"];
  }

  files[".env.example"] = mergeEnvironmentExample(
    files[".env.example"],
    support[".env.example"],
  );
  files["server/.env.example"] = mergeEnvironmentExample(
    files["server/.env.example"],
    support["server/.env.example"],
  );

  for (const path of [
    "lib/auth/session.dart",
    "server/src/auth.ts",
    "database/migrations/001_user_data.sql",
  ]) {
    if (support[path] && !files[path]?.trim()) {
      files[path] = support[path];
    }
  }

  return files;
}
