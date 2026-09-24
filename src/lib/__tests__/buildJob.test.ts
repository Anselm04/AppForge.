import { describe, expect, it } from "vitest";
import {
  buildJobSchema,
  cloneBuildJob,
  deserializeBuildJob,
  extractBuildJobIdentity,
  parseBuildJob,
  serializeBuildJob,
  validateBuildJob,
  type BuildJob,
} from "../buildJob.js";
import {
  buildProductContract,
  classifyProductIntent,
  resolveIntakeContract,
  withSelectedTechnologyStack,
} from "../productContract.js";

function fixture(): BuildJob {
  const description =
    "Build a SaaS application with login, database storage, Stripe billing, and production deployment.";
  const productContract = withSelectedTechnologyStack(
    buildProductContract(description),
    "react-node",
  );

  return {
    projectId: 101,
    userId: 202,
    description,
    techStack: "react-node",
    locale: "en",
    buildCapabilities: ["auth", "billing"],
    promptIntent: classifyProductIntent(description),
    productContract,
    createdAt: "2026-09-23T05:00:00.000Z",
    reservationCharged: true,
  };
}

describe("typed build queue context", () => {
  it("preserves the canonical contract through JSON queue serialization", () => {
    const job = fixture();
    const restored = deserializeBuildJob(serializeBuildJob(job));

    expect(restored).toEqual(job);
    expect(restored.productContract).toEqual(job.productContract);
    expect(restored.description).toBe(job.description);
    expect(restored.techStack).toBe(job.techStack);
  });

  it("clones the in-memory job without losing canonical context", () => {
    const job = fixture();
    const cloned = cloneBuildJob(job);

    expect(cloned).toEqual(job);
    expect(cloned).not.toBe(job);
    expect(cloned.productContract).not.toBe(job.productContract);
  });

  it("rejects a queued job with no canonical product contract", () => {
    const { productContract: _removed, ...invalid } = fixture();

    expect(() => validateBuildJob(invalid)).toThrow();
  });

  it("rejects a queued job whose selected stack disagrees with the contract", () => {
    const job = fixture();

    expect(() =>
      validateBuildJob({
        ...job,
        techStack: "nextjs",
      }),
    ).toThrow(/stack/i);
  });

  it("rejects a queued job whose original prompt disagrees with the contract", () => {
    const job = fixture();

    expect(() =>
      validateBuildJob({
        ...job,
        description: "Build a different SaaS application",
      }),
    ).toThrow(/original prompt/i);
  });

  it("rejects a prompt-intent product type that disagrees with the contract", () => {
    const job = fixture();

    expect(() =>
      validateBuildJob({
        ...job,
        promptIntent: {
          ...job.promptIntent!,
          primaryProductType: "website",
        },
      }),
    ).toThrow(/product type/i);
  });

  it("rejects a queued job with no prompt intent instead of reclassifying it", () => {
    const { promptIntent: _removed, ...invalid } = fixture();

    expect(() => validateBuildJob(invalid)).toThrow();
    const parsed = parseBuildJob(invalid);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/promptIntent/);
  });

  it("rejects a queued job whose prompt intent is still ambiguous", () => {
    const job = fixture();

    expect(() =>
      validateBuildJob({
        ...job,
        promptIntent: { ...job.promptIntent, ambiguous: true },
      }),
    ).toThrow(/ambiguous/i);
    expect(
      parseBuildJob({
        ...job,
        promptIntent: { ...job.promptIntent, primaryProductType: null },
      }).ok,
    ).toBe(false);
  });

  it("parses a valid job without throwing and exposes the typed job", () => {
    const job = fixture();
    const parsed = parseBuildJob(JSON.parse(JSON.stringify(job)));

    expect(parsed).toEqual({ ok: true, job });
  });

  it("reads only the settlement identity from an otherwise invalid job", () => {
    const { productContract: _removed, ...invalid } = fixture();

    expect(extractBuildJobIdentity(invalid)).toEqual({
      projectId: 101,
      userId: 202,
      createdAt: "2026-09-23T05:00:00.000Z",
      reservationCharged: true,
    });
    expect(extractBuildJobIdentity({ projectId: "x" })).toBeNull();
    expect(extractBuildJobIdentity("not a job")).toBeNull();
  });

  it("accepts the job produced by a clarified intake for an ambiguous prompt", () => {
    const description = "Build me something cool";
    const resolution = resolveIntakeContract(description, undefined, {
      productType: "game",
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    const job = {
      projectId: 7,
      userId: 8,
      description,
      techStack: resolution.productContract.selectedTechnologyStack,
      promptIntent: resolution.promptIntent,
      productContract: resolution.productContract,
      createdAt: "2026-09-25T00:00:00.000Z",
      reservationCharged: true,
    };

    const parsed = buildJobSchema.safeParse(job);
    expect(parsed.success).toBe(true);
    expect(resolution.productContract.productType).toBe("game");
    expect(deserializeBuildJob(serializeBuildJob(job)).promptIntent).toEqual(
      resolution.promptIntent,
    );
  });
});
