import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const partsDir = join(root, "src/agents/.pipeline_parts");
const out = join(root, "src/agents/pipeline.ts");

if (!existsSync(join(partsDir, "part0.txt"))) {
  console.warn("assemble-pipeline: parts missing — skip (ok during docker deps install)");
  process.exit(0);
}

const content = [0, 1, 2, 3, 4]
  .map((i) => readFileSync(join(partsDir, `part${i}.txt`), "utf8"))
  .join("");

if (!content.includes("isNeverGiveUpEnabled") || !content.includes("assertProductQuality")) {
  console.error("assemble-pipeline: missing never-give-up markers");
  process.exit(1);
}
if (content.includes("guaranteed-green-fallback") || content.includes("recoveredFromError")) {
  console.error("assemble-pipeline: fake-success markers still present");
  process.exit(1);
}

writeFileSync(out, content);
console.log(`assemble-pipeline: wrote ${out} (${content.length} chars)`);
