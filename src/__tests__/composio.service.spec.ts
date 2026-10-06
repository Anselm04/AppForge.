import { describe, expect, it, vi } from "vitest";
import {
  buildComposioUserId,
  searchComposioTools,
  type ComposioSessionLike,
} from "../capabilities/providers/composio.js";

describe("Composio provider", () => {
  it("namespaces AppForge user IDs so connected accounts stay product-scoped", () => {
    expect(buildComposioUserId("user-123")).toBe("appforge:user-123");
  });

  it("uses the session Tool Router for safe tool discovery", async () => {
    const execute = vi.fn().mockResolvedValue({ successful: true, data: {} });
    const session: ComposioSessionLike = { execute };

    const result = await searchComposioTools(session, "find GitHub repositories");

    expect(execute).toHaveBeenCalledWith("COMPOSIO_SEARCH_TOOLS", {
      queries: [{ use_case: "find GitHub repositories" }],
      session: { generate_id: true },
    });
    expect(result).toEqual({ successful: true, data: {} });
  });
});
