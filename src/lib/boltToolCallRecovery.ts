/**
 * Adapted from bolt.diy's recoverJsonToolCalls in
 * app/lib/.server/llm/agent-stream.ts (MIT License).
 * Copyright (c) 2024 StackBlitz, Inc. and bolt.diy contributors.
 *
 * AppForge adapts the bounded, allowlisted JSON recovery algorithm to its
 * existing OpenAI-compatible completion format without adding a new SDK.
 * Original source: Anselm04/Bolt-DIY-Source-Code-Reference.
 *
 * MIT License: Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including without
 * limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to
 * whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const MAX_RECOVERED_CALLS = 8;

export type RecoveredToolCall = {
  name: string;
  input: Record<string, unknown>;
};

/** Recovery is allowed only when the caller explicitly requires a tool. */
export function recoverBoltJsonToolCalls(
  text: string,
  availableToolNames: readonly string[],
  requiredToolName: string,
): RecoveredToolCall[] {
  if (!requiredToolName || !availableToolNames.includes(requiredToolName)) {
    return [];
  }
  try {
    const trimmed = text
      .trim()
      .replace(/^\x60\x60\x60(?:json)?\s*\n([\s\S]*)\n\x60\x60\x60$/, "$1");
    let parsed: unknown = JSON.parse(trimmed);
    for (
      let depth = 0;
      depth < 2 &&
      Array.isArray(parsed) &&
      parsed.length === 1 &&
      Array.isArray(parsed[0]);
      depth++
    ) {
      parsed = parsed[0];
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    const available = new Set(availableToolNames);
    if (!candidates.length || candidates.length > MAX_RECOVERED_CALLS) {
      return [];
    }

    const calls: RecoveredToolCall[] = [];
    for (const candidate of candidates) {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate)
      ) {
        return [];
      }
      const entry = candidate as Record<string, unknown>;
      const name = entry.name;
      const input = entry.parameters;
      if (
        typeof name !== "string" ||
        !available.has(name) ||
        name !== requiredToolName ||
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(entry).some(
          (key) => key !== "name" && key !== "parameters",
        )
      ) {
        return [];
      }
      calls.push({ name, input: input as Record<string, unknown> });
    }
    return calls;
  } catch {
    return [];
  }
}
