/**
 * Worker Queue Tests - Forge wiring only
 *
 * The worker resolver is a thin Forge queue adapter: unpack the event body,
 * call the batch engine with the DummyJSON source adapter, and dispatch on
 * the result. Batch orchestration behavior (chaining, progress, retry
 * classification) is covered by tests/import-lifecycle/batch-engine.test.ts.
 */

import type { AsyncEvent } from "@forge/events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const processWorkItemMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/import-lifecycle/batch-engine", async (importOriginal) => ({
  ...(await importOriginal()),
  processWorkItem: processWorkItemMock,
}));

const dummyJsonProductAdapterStub = vi.hoisted(() => ({
  marker: "dummyjson-product-adapter",
}));

vi.mock("../../src/external/dummyjson-client", () => ({
  dummyJsonProductAdapter: dummyJsonProductAdapterStub,
}));

const workerQueuePushMock = vi.hoisted(() => vi.fn());

vi.mock("@forge/events", () => ({
  Queue: class {
    push = workerQueuePushMock;
  },
}));

import { handler } from "../../src/resolvers/worker-resolver";

const baseWorkItem = {
  importConfigurationId: "import-123",
  workspaceId: "workspace-456",
  executionId: "execution-789",
  skip: 0,
  limit: 25,
  total: 60,
  submitResultsUrl: "https://api.atlassian.com/imports/data",
  submitProgressUrl: "https://api.atlassian.com/imports/progress",
  getExecutionStatusUrl: "https://api.atlassian.com/imports/status",
  cancelUrl: "https://api.atlassian.com/imports/cancel",
};

describe("Worker Queue - Forge wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the batch engine with the event body and the DummyJSON adapter", async () => {
    processWorkItemMock.mockResolvedValue({ type: "completed" });

    await handler({ body: baseWorkItem } as AsyncEvent);

    expect(processWorkItemMock).toHaveBeenCalledWith(
      baseWorkItem,
      dummyJsonProductAdapterStub,
    );
  });

  it("does nothing when the event has no work item", async () => {
    await handler({ body: undefined } as unknown as AsyncEvent);

    expect(processWorkItemMock).not.toHaveBeenCalled();
  });

  it("enqueues the next work item when the engine says enqueue-next", async () => {
    const nextWorkItem = { ...baseWorkItem, skip: 25 };
    processWorkItemMock.mockResolvedValue({
      type: "enqueue-next",
      nextWorkItem,
    });

    await handler({ body: baseWorkItem } as AsyncEvent);

    expect(workerQueuePushMock).toHaveBeenCalledWith({ body: nextWorkItem });
  });

  it("does not enqueue when the engine reports completed", async () => {
    processWorkItemMock.mockResolvedValue({ type: "completed" });

    await handler({ body: baseWorkItem } as AsyncEvent);

    expect(workerQueuePushMock).not.toHaveBeenCalled();
  });

  it("does not enqueue when the engine reports the work item is invalid", async () => {
    processWorkItemMock.mockResolvedValue({
      type: "invalid",
      missingFields: ["executionId"],
    });

    await expect(
      handler({ body: baseWorkItem } as AsyncEvent),
    ).resolves.toBeUndefined();

    expect(workerQueuePushMock).not.toHaveBeenCalled();
  });

  it("does not enqueue and does not throw when the engine reports a non-retriable error", async () => {
    processWorkItemMock.mockResolvedValue({
      type: "non-retriable-error",
      error: new Error("404 Not Found"),
    });

    await expect(
      handler({ body: baseWorkItem } as AsyncEvent),
    ).resolves.toBeUndefined();

    expect(workerQueuePushMock).not.toHaveBeenCalled();
  });

  it("rethrows when the engine throws a retriable error, so Forge retries the queue consumer", async () => {
    processWorkItemMock.mockRejectedValue(
      new Error("500 Internal Server Error"),
    );

    await expect(handler({ body: baseWorkItem } as AsyncEvent)).rejects.toThrow(
      "500 Internal Server Error",
    );
  });
});
