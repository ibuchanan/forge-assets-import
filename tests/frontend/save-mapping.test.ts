/**
 * Tests for the frontend's mapping save call, which must invoke the single
 * backend configureMapping resolver rather than building and submitting the
 * mapping itself (that logic now lives entirely in mapping-resolver.ts).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@forge/bridge", () => ({
  invoke: invokeMock,
}));

import { saveMapping } from "../../src/frontend/save-mapping";

describe("saveMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes only configureMapping with workspaceId and importId", async () => {
    invokeMock.mockResolvedValue({ success: true });

    await saveMapping({
      workspaceId: "workspace-123",
      importId: "import-xyz",
      schemaId: "schema-abc",
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("configureMapping", {
      workspaceId: "workspace-123",
      importId: "import-xyz",
    });
  });

  it("throws with the backend error detail when configureMapping fails", async () => {
    invokeMock.mockResolvedValue({
      success: false,
      error: { detail: "Object type Product not found" },
    });

    await expect(
      saveMapping({
        workspaceId: "workspace-123",
        importId: "import-xyz",
        schemaId: "schema-abc",
      }),
    ).rejects.toThrow("Object type Product not found");
  });
});
