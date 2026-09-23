import { describe, expect, it } from "vitest";
import {
  cloneBuildJob,
  deserializeBuildJob,
  serializeBuildJob,
  validateBuildJob,
  type BuildJob,
} from "../buildJob.js";
import {
  buildProductContract,
  classifyProductIntent,
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
});
