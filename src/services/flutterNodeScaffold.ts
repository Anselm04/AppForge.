import { parse, stringify } from "yaml";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
        ...record(base.dependencies),
        ...record(current.dependencies),
      },
      dev_dependencies: {
        ...record(base.dev_dependencies),
        ...record(current.dev_dependencies),
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

/** Infrastructure only; substantive application entrypoints must come from generation. */
export function flutterNodeScaffold(): Record<string, string> {
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
        authentication: {
          transport: "bearer",
          verification: "backend",
          tokenStorage: "platform-secure-storage",
          implemented: false,
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
    "pubspec.yaml": `name: appforge_mobile\npublish_to: none\nversion: 0.1.0+1\nenvironment:\n  sdk: '>=3.4.0 <4.0.0'\ndependencies:\n  flutter:\n    sdk: flutter\n  http: ^1.2.0\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\nflutter:\n  uses-material-design: true\n  assets:\n    - shared/contracts/product-api.json\n`,
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
    ".env.example": "API_BASE_URL=\n",
    "server/.env.example": "PORT=3000\nHOST=127.0.0.1\nDATABASE_URL=\n",
  };
}
