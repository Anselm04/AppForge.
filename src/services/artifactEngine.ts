import { getProjectFiles, updateProjectFiles } from "../db.js";

export type ArtifactFormat = "markdown" | "html" | "csv" | "presentation" | "pdf";

export type StoredArtifact = {
  path: string;
  mimeType: string;
  encoding: "utf8" | "base64";
  size: number;
};

export function sanitizeArtifactName(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return cleaned || fallback;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ");
}

function encodeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function createCsv(headers: string[], rows: unknown[][]): string {
  const normalizedHeaders = headers.map((header) => encodeCsvCell(header));
  const normalizedRows = rows.map((row) =>
    headers.map((_, index) => encodeCsvCell(row[index])).join(","),
  );
  return [normalizedHeaders.join(","), ...normalizedRows].join("\r\n");
}

export function createDocumentHtml(input: {
  title: string;
  content: string;
}): string {
  const paragraphs = input.content
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(input.title)}</title>
  <style>
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:840px;margin:48px auto;padding:0 24px;line-height:1.65;color:#111827;background:#fff}
    h1{font-size:2rem;margin-bottom:1.5rem}p{margin:0 0 1rem}code{background:#f3f4f6;padding:.15rem .35rem;border-radius:.25rem}
  </style>
</head>
<body>
  <h1>${escapeHtml(input.title)}</h1>
  ${paragraphs}
</body>
</html>`;
}

export function createPresentationHtml(input: {
  title: string;
  slides: Array<{ title: string; body?: string; bullets?: string[] }>;
}): string {
  const slides = input.slides
    .map((slide, index) => {
      const bullets = (slide.bullets ?? [])
        .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
        .join("");
      const body = slide.body
        ? `<p>${escapeHtml(slide.body).replace(/\n/g, "<br>")}</p>`
        : "";
      return `<section class="slide" id="slide-${index + 1}">
  <div class="counter">${index + 1} / ${input.slides.length}</div>
  <h2>${escapeHtml(slide.title)}</h2>
  ${body}
  ${bullets ? `<ul>${bullets}</ul>` : ""}
</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(input.title)}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#0b1020;color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.deck{display:grid;gap:24px;padding:24px}.slide{position:relative;aspect-ratio:16/9;min-height:520px;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:64px;background:linear-gradient(135deg,#111827,#1e293b);box-shadow:0 20px 60px rgba(0,0,0,.3);display:flex;flex-direction:column;justify-content:center}.slide h2{font-size:3rem;margin:0 0 24px}.slide p,.slide li{font-size:1.4rem;line-height:1.55;color:#dbeafe}.slide li{margin:.5rem 0}.counter{position:absolute;right:28px;bottom:22px;color:#94a3b8;font-size:.9rem}@media(max-width:800px){.slide{min-height:360px;padding:32px}.slide h2{font-size:2rem}.slide p,.slide li{font-size:1rem}}
  </style>
</head>
<body>
  <main class="deck">
    ${slides}
  </main>
</body>
</html>`;
}

export function createSimplePdf(input: {
  title: string;
  lines: string[];
}): Buffer {
  const safeLines = [input.title, "", ...input.lines]
    .flatMap((line) => {
      const text = String(line ?? "");
      if (text.length <= 90) return [text];
      const chunks: string[] = [];
      for (let index = 0; index < text.length; index += 90) {
        chunks.push(text.slice(index, index + 90));
      }
      return chunks;
    })
    .slice(0, 48);

  let y = 760;
  const content = safeLines
    .map((line, index) => {
      const size = index === 0 ? 18 : 11;
      const command = `BT /F1 ${size} Tf 54 ${y} Td (${escapePdfText(line)}) Tj ET`;
      y -= index === 0 ? 30 : 16;
      return command;
    })
    .join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, "utf8");
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

export async function saveProjectArtifact(input: {
  projectId: number;
  path: string;
  content: string;
}): Promise<StoredArtifact> {
  const files = await getProjectFiles(input.projectId);
  await updateProjectFiles(input.projectId, {
    ...files,
    [input.path]: input.content,
  });

  const isBase64Pdf = input.path.endsWith(".pdf.base64");
  return {
    path: input.path,
    mimeType: isBase64Pdf ? "application/pdf" : "text/plain; charset=utf-8",
    encoding: isBase64Pdf ? "base64" : "utf8",
    size: Buffer.byteLength(input.content, "utf8"),
  };
}
