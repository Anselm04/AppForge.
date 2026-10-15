import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { getStackScaffold } from "../../../src/services/stackScaffolds.js";
import { parse, stringify } from "yaml";
const destination = process.argv[2];
if (!destination)
  throw new Error(
    "Usage: node --import tsx scripts/fixtures/flutter-node-qualification/materialize.ts ABSOLUTE_DESTINATION",
  );
if (!destination.startsWith("/"))
  throw new Error("Destination must be absolute");
const files = getStackScaffold("flutter-node", "mobile_app");
for (const [path, content] of Object.entries(files)) {
  await mkdir(resolve(destination, path, ".."), { recursive: true });
  await writeFile(join(destination, path), content);
}
const manifest = parse(files["pubspec.yaml"]);
manifest.dev_dependencies.integration_test = { sdk: "flutter" };
await writeFile(join(destination, "pubspec.yaml"), stringify(manifest));
for (const path of [
  "integration_test/qualification_test.dart",
  "test/qualification_test.dart",
]) {
  await mkdir(resolve(destination, path, ".."), { recursive: true });
  await writeFile(
    join(destination, path),
    await readFile(new URL(path.replace(/\//g, "_"), import.meta.url), "utf8"),
  );
}
await writeFile(
  join(destination, "QUALIFICATION_SCOPE.txt"),
  "Trusted scaffold shell only. Original lib/main.dart and API client preserved. Test UI is an explicit harness, not generated business behavior or golden app.\n",
);

await writeFile(
  join(destination, "scaffold-hashes.json"),
  JSON.stringify(
    Object.fromEntries(
      Object.entries(files).map(([path, content]) => [
        path,
        createHash("sha256").update(content).digest("hex"),
      ]),
    ),
    null,
    2,
  ),
);
