import { describe, expect, it } from "vitest";
import { recoverBoltJsonToolCalls } from "../lib/boltToolCallRecovery.js";

describe("Bolt.diy tool-call recovery adapted for AppForge", () => {
  const tools = ["project_write_file", "project_read_file"];

  it("recovers a required tool from valid fenced JSON", () => {
    const text =
      '```json\n{"name":"project_write_file","parameters":{"path":"src/App.tsx","content":"export default function App() { return null; }"}}\n```';
    expect(
      recoverBoltJsonToolCalls(text, tools, "project_write_file"),
    ).toEqual([
      {
        name: "project_write_file",
        input: {
          path: "src/App.tsx",
          content: "export default function App() { return null; }",
        },
      },
    ]);
  });

  it("rejects tools not explicitly requested or on the allowlist", () => {
    const text =
      '{"name":"project_read_file","parameters":{"path":"secrets.txt"}}';
    expect(
      recoverBoltJsonToolCalls(text, tools, "project_write_file"),
    ).toEqual([]);
    expect(
      recoverBoltJsonToolCalls(text, ["project_write_file"], "project_read_file"),
    ).toEqual([]);
  });

  it("rejects extra fields, non-objects and more than eight calls", () => {
    expect(
      recoverBoltJsonToolCalls(
        '{"name":"project_write_file","parameters":{},"unsafe":true}',
        tools,
        "project_write_file",
      ),
    ).toEqual([]);
    expect(
      recoverBoltJsonToolCalls(
        '{"name":"project_write_file","parameters":[]}',
        tools,
        "project_write_file",
      ),
    ).toEqual([]);
    const calls = Array.from({ length: 9 }, () => ({
      name: "project_write_file",
      parameters: {},
    }));
    expect(
      recoverBoltJsonToolCalls(
        JSON.stringify(calls),
        tools,
        "project_write_file",
      ),
    ).toEqual([]);
  });

  it("does not interpret prose, invalid JSON or empty responses as tools", () => {
    for (const text of [
      "",
      "I would call project_write_file.",
      "{name: project_write_file}",
      "[]",
    ]) {
      expect(
        recoverBoltJsonToolCalls(text, tools, "project_write_file"),
      ).toEqual([]);
    }
  });
});
