import type { GraphicElement } from "./types";
import { PREMIUM_GRADIENTS } from "./presets";

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function gradientSvg(id: string, colors: [string, string], angle = 0) {
  return `  <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${angle})">
    <stop offset="0%" stop-color="${colors[0]}" />
    <stop offset="100%" stop-color="${colors[1]}" />
  </linearGradient>`;
}

export function buildSvgExport(elements: GraphicElement[], w: number, h: number): string {
  const defs: string[] = [];
  const usedGradients = new Set<string>();
  const body: string[] = [];

  elements.filter((e) => e.visible).forEach((el, i) => {
    let fill = el.color;
    let stroke = el.stroke;
    let opacity = el.opacity;
    let filterRef = "";

    if (el.gradient && PREMIUM_GRADIENTS[el.gradient]) {
      const gradId = `g${i}`;
      if (!usedGradients.has(gradId)) {
        defs.push(gradientSvg(gradId, PREMIUM_GRADIENTS[el.gradient]));
        usedGradients.add(gradId);
      }
      fill = `url(#${gradId})`;
    }

    if (el.shadow) {
      const sid = `sd${i}`;
      defs.push(`  <filter id="${sid}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.35"/></filter>`);
      filterRef = ` filter="url(#${sid})"`;
    }

    if (el.glow) {
      const gid = `gl${i}`;
      defs.push(`  <filter id="${gid}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
      filterRef = ` filter="url(#${gid})"`;
    }

    const style = `fill="${fill}" stroke="${stroke}" stroke-width="${el.strokeWidth}" opacity="${opacity}"${filterRef}`;

    if (el.type === "rect") {
      body.push(`  <rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${el.radius}" ${style} />`);
    } else if (el.type === "circle") {
      const r = Math.min(el.w, el.h) / 2;
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      body.push(`  <ellipse cx="${cx}" cy="${cy}" rx="${el.w / 2}" ry="${el.h / 2}" ${style} />`);
    } else if (el.type === "text") {
      body.push(`  <text x="${el.x}" y="${el.y + el.fontSize}" font-family="Inter,system-ui,sans-serif" font-size="${el.fontSize}" font-weight="${el.fontWeight}" fill="${el.color}" opacity="${opacity}"${filterRef}>${el.text || ""}</text>`);
    } else if (el.type === "line" || el.type === "arrow") {
      body.push(`  <line x1="${el.x}" y1="${el.y}" x2="${el.x + el.w}" y2="${el.y + el.h}" stroke="${el.color}" stroke-width="${el.strokeWidth}" opacity="${opacity}" stroke-linecap="round"${filterRef} />`);
      if (el.type === "arrow") {
        const angle = Math.atan2(el.h, el.w);
        const ax = el.x + el.w;
        const ay = el.y + el.h;
        const s = el.strokeWidth * 3;
        body.push(`  <polygon points="${ax},${ay} ${ax - s * Math.cos(angle - 0.5)},${ay - s * Math.sin(angle - 0.5)} ${ax - s * Math.cos(angle + 0.5)},${ay - s * Math.sin(angle + 0.5)}" fill="${el.color}" opacity="${opacity}"${filterRef} />`);
      }
    } else if (el.type === "image") {
      body.push(`  <rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${el.radius}" fill="#1e293b" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" opacity="${opacity}" stroke-dasharray="6 4"${filterRef} />`);
      body.push(`  <text x="${el.x + el.w / 2}" y="${el.y + el.h / 2 + 6}" text-anchor="middle" font-family="monospace" font-size="12" fill="${el.color}" opacity="0.5">IMG</text>`);
    }
  });

  const bgRect = `<rect width="${w}" height="${h}" fill="#080c18" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
${defs.join("\n")}
</defs>
${bgRect}
${body.join("\n")}
</svg>`;
}
