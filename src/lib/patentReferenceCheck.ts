/** Cross-check reference numerals between specification text and drawing labels. */

export type ReferenceCheckResult = {
  ok: boolean;
  inSpecOnly: string[];
  inDrawingsOnly: string[];
  matched: string[];
};

const NUMERAL_RE = /\b(\d{1,3}[a-z]?)\b/g;

function extractNumerals(text: string): Set<string> {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(NUMERAL_RE.source, "g");
  while ((m = re.exec(text))) {
    const n = m[1];
    if (parseInt(n, 10) >= 10) found.add(n);
  }
  return found;
}

export function checkReferenceNumerals(
  specification: string,
  drawingLabels: string,
): ReferenceCheckResult {
  const specNums = extractNumerals(specification);
  const drawNums = extractNumerals(drawingLabels);

  const matched: string[] = [];
  const inSpecOnly: string[] = [];
  const inDrawingsOnly: string[] = [];

  for (const n of specNums) {
    if (drawNums.has(n)) matched.push(n);
    else inSpecOnly.push(n);
  }
  for (const n of drawNums) {
    if (!specNums.has(n)) inDrawingsOnly.push(n);
  }

  return {
    ok: inSpecOnly.length === 0 && inDrawingsOnly.length === 0,
    inSpecOnly: inSpecOnly.sort(),
    inDrawingsOnly: inDrawingsOnly.sort(),
    matched: matched.sort((a, b) => parseInt(a, 10) - parseInt(b, 10)),
  };
}
