export type VisualStylePatch = Partial<
  Record<
    | "color"
    | "backgroundColor"
    | "fontSize"
    | "fontWeight"
    | "textAlign"
    | "padding"
    | "margin"
    | "borderRadius"
    | "width"
    | "height",
    string
  >
>;

export type StaticHtmlVisualEdit = {
  targetId: string;
  text?: string;
  styles?: VisualStylePatch;
};

const TARGET_ID = /^[A-Za-z][A-Za-z0-9_:.-]{0,119}$/;
const SAFE_CSS_VALUE = /^[A-Za-z0-9#(),.%+\-\s/]{0,120}$/;
const STYLE_NAME: Record<keyof VisualStylePatch, string> = {
  color: "color",
  backgroundColor: "background-color",
  fontSize: "font-size",
  fontWeight: "font-weight",
  textAlign: "text-align",
  padding: "padding",
  margin: "margin",
  borderRadius: "border-radius",
  width: "width",
  height: "height",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mergeStyleAttribute(
  openingTag: string,
  styles: VisualStylePatch,
): string {
  const entries = Object.entries(styles) as Array<
    [keyof VisualStylePatch, string | undefined]
  >;
  if (entries.length === 0) return openingTag;

  const styleMatch = openingTag.match(/\sstyle\s*=\s*(["'])(.*?)\1/i);
  const declarations = new Map<string, string>();
  if (styleMatch) {
    for (const declaration of styleMatch[2].split(";")) {
      const colon = declaration.indexOf(":");
      if (colon <= 0) continue;
      const name = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      if (name && value) declarations.set(name, value);
    }
  }

  for (const [key, rawValue] of entries) {
    if (rawValue === undefined) continue;
    const value = rawValue.trim();
    if (!SAFE_CSS_VALUE.test(value)) {
      throw new Error(`Unsafe CSS value for ${key}`);
    }
    const cssName = STYLE_NAME[key];
    if (!value) declarations.delete(cssName);
    else declarations.set(cssName, value);
  }

  const serialized = [...declarations.entries()]
    .map(([name, value]) => `${name}: ${value}`)
    .join("; ");
  const styleAttribute = serialized ? ` style="${serialized}"` : "";
  if (styleMatch) {
    return openingTag.replace(styleMatch[0], styleAttribute);
  }
  return openingTag.replace(/>$/, `${styleAttribute}>`);
}

export function applyStaticHtmlVisualEdit(
  html: string,
  edit: StaticHtmlVisualEdit,
): string {
  if (!TARGET_ID.test(edit.targetId)) {
    throw new Error("Visual edit requires a safe element id");
  }
  if (edit.text !== undefined && edit.text.length > 2_000) {
    throw new Error("Visual edit text is too long");
  }

  const id = escapeRegExp(edit.targetId);
  const openingPattern = new RegExp(
    `<([A-Za-z][A-Za-z0-9:-]*)\\b(?=[^>]*\\bid\\s*=\\s*(["'])${id}\\2)[^>]*>`,
    "gi",
  );
  const openings = [...html.matchAll(openingPattern)];
  if (openings.length !== 1) {
    throw new Error(
      openings.length === 0
        ? "Element id was not found in this HTML file"
        : "Element id is not unique in this HTML file",
    );
  }

  const match = openings[0];
  const opening = match[0];
  const tagName = match[1];
  const start = match.index ?? 0;
  let updatedOpening = opening;
  if (edit.styles) updatedOpening = mergeStyleAttribute(opening, edit.styles);

  let next =
    html.slice(0, start) + updatedOpening + html.slice(start + opening.length);
  if (edit.text === undefined) return next;

  const contentStart = start + updatedOpening.length;
  const closingPattern = new RegExp(`</${escapeRegExp(tagName)}\\s*>`, "i");
  const closingMatch = closingPattern.exec(next.slice(contentStart));
  if (!closingMatch) throw new Error("Selected element has no closing tag");
  const contentEnd = contentStart + closingMatch.index;
  const inner = next.slice(contentStart, contentEnd);
  if (/<[A-Za-z!/][^>]*>/.test(inner)) {
    throw new Error(
      "Text editing is only available for elements without nested markup",
    );
  }

  next =
    next.slice(0, contentStart) +
    escapeHtmlText(edit.text) +
    next.slice(contentEnd);
  return next;
}
