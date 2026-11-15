import { describe, expect, it } from "vitest";
import { recoverBoltJsonToolCalls } from "../lib/boltToolCallRecovery.js";

describe("Bolt.diy tool-call recovery adapted for AppForge", () => {
  const tools = ["project_write_file", "project_read_file"];

  it("recovers a required tool from fenced JSON", () => {
    const fenced = [
      "```json",
      JSON.stringify({
        name: "project_write_file",
        parameters: {
          path: "src/App.tsx",
          content: "export default function App() { return null; }",
        },
      }),
      "```",
    ].join("\n");
    const recovered = recoverBoltJsonToolCalls(
      fenced,
      tools,
      "project_write_file",
    );
    expect(recovered).toEqual([
      {
        name: "project_write_file",
        input: {
          path: "src/App.tsx",
          content: "export default function App() { return null; }",
        },
      },
    ]);
  });

  it("rejects unrequested or unknown functions", () => {
    const text = JSON.stringify({
      name: "project_read_file",
      parameters: { path: "secrets.txt" },
    });
    const otherName = recoverBoltJsonToolCalls(
      text,
      tools,
      "project_write_file",
    );
    const unknownName = recoverBoltJsonToolCalls(
      text,
      ["project_write_file"],
      "project_read_file",
    );
    expect(otherName).toEqual([]);
    expect(unknownName).toEqual([]);
  });

  it("rejects malformed arguments and excessive calls", () => {
    const extra = recoverBoltJsonToolCalls(
      '{"name":"project_write_file","parameters":{},"unsafe":true}',
      tools,
      "project_write_file",
    );
    const invalidParameters = recoverBoltJsonToolCalls(
      '{"name":"project_write_file","parameters":[]}',
      tools,
      "project_write_file",
    );
    const calls = Array.from({ length: 9 }, () => ({
      name: "project_write_file",
      parameters: {},
    }));
    const excessive = recoverBoltJsonToolCalls(
      JSON.stringify(calls),
      tools,
      "project_write_file",
    );
    expect(extra).toEqual([]);
    expect(invalidParameters).toEqual([]);
    expect(excessive).toEqual([]);
  });

  it("rejects prose, broken JSON and empty responses", () => {
    const invalid = [
      "",
      "I would call project_write_file.",
      "{name: project_write_file}",
      "[]",
    ];
    for (const text of invalid) {
      const recovered = recoverBoltJsonToolCalls(
        text,
        tools,
        "project_write_file",
      );
      expect(recovered).toEqual([]);
    }
  });
});
