import { describe, expect, it } from "vitest";
import {
  classifyHostedKind,
  materializeHostedHtml,
  publicAppUrl,
} from "../lib/hostedRuntime.js";

describe("hostedRuntime", () => {
  it("classifies six product kinds", () => {
    expect(classifyHostedKind("a todo list app")).toBe("app");
    expect(classifyHostedKind("a phaser arcade game")).toBe("game");
    expect(classifyHostedKind("a langchain assistant agent")).toBe("agent");
    expect(classifyHostedKind("a word count converter tool")).toBe("tool");
    expect(classifyHostedKind("electron notes software")).toBe("software");
    expect(classifyHostedKind("marketing landing website")).toBe("website");
  });

  it("produces a public Fly URL", () => {
    expect(publicAppUrl(42)).toMatch(/\/apps\/42$/);
  });

  it("app html has add/complete controls", () => {
    const html = materializeHostedHtml({
      projectId: 1,
      title: "TaskFlow",
      description: "A simple todo list app for daily tasks",
      techStack: "react-node",
    });
    expect(html).toContain("\u003c!doctype html>");
    expect(html).toContain("id=\"add-btn\"");
    expect(html).toContain("TrillionAI Tech");
    expect(html).toContain("hello@trillionaitech.com");
    expect(html).not.toContain("Ride Global");
  });

  it("game html has canvas and score", () => {
    const html = materializeHostedHtml({
      projectId: 2,
      title: "Orb Catch",
      description: "A playable arcade game with orbs",
      techStack: "phaser-html5",
    });
    expect(html).toContain("\u003ccanvas");
    expect(html).toContain("id=\"score\"");
  });

  it("agent html can send a message", () => {
    const html = materializeHostedHtml({
      projectId: 3,
      title: "Brief Agent",
      description: "An assistant agent that answers from a product brief",
      techStack: "ai-agent-node",
    });
    expect(html).toContain("id=\"send\"");
    expect(html).toContain("id=\"q\"");
  });

  it("tool html converts text", () => {
    const html = materializeHostedHtml({
      projectId: 4,
      title: "Case Tool",
      description: "A word count converter tool",
      techStack: "vanilla-node",
    });
    expect(html).toContain("id=\"upper\"");
    expect(html).toContain("id=\"chars\"");
  });

  it("software html saves notes", () => {
    const html = materializeHostedHtml({
      projectId: 5,
      title: "Quick Notes",
      description: "Desktop notes software",
      techStack: "electron-react",
    });
    expect(html).toContain("id=\"save\"");
    expect(html).toContain("Save note");
  });

  it("website html has waitlist form", () => {
    const html = materializeHostedHtml({
      projectId: 6,
      title: "Northstar",
      description: "Marketing landing website for a new SaaS",
      techStack: "astro-node",
    });
    expect(html).toContain("id=\"form\"");
    expect(html).toContain("Join waitlist");
  });
});
