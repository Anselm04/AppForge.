import { PROMPT_MAX_CHARS } from "./prompt.js";

export const PROMPT_DRAFT_KEY = "appforge.promptDraft";

function readKey(key: string): string {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) return "";
    return storage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeKey(key: string, value: string) {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) return;
    if (value) storage.setItem(key, value);
    else storage.removeItem(key);
  } catch {
    /* private mode / quota */
  }
}

export function readPromptDraft(): string {
  return readKey(PROMPT_DRAFT_KEY).slice(0, PROMPT_MAX_CHARS);
}

export function writePromptDraft(text: string) {
  writeKey(PROMPT_DRAFT_KEY, text.slice(0, PROMPT_MAX_CHARS));
}

export function clearPromptDraft() {
  writeKey(PROMPT_DRAFT_KEY, "");
}
