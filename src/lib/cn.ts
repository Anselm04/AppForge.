export type ClassValue = string | false | null | undefined | 0 | ClassValue[];

function flatten(inputs: ClassValue[], out: string[]) {
  for (const v of inputs) {
    if (!v) continue;
    if (Array.isArray(v)) flatten(v, out);
    else out.push(v);
  }
}

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  flatten(inputs, out);
  return out.join(" ");
}
