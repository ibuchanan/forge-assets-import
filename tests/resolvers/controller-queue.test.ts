/**
 * Controller Queue Integration Tests
 *
 * Tests the controller queue behavior:
 * - Validates required event fields
 * - Fetches initial batch with configured batch size
 * - Pushes work item to worker queue with correct metadata
 */

import type { AsyncEvent } from "@forge/events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchBatchMock = vi.hoisted(() => vi.fn());
const workerQueuePushMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/external/dummyjson-client", () => ({
  dummyJsonProductAdapter: {
    fetchBatch: fetchBatchMock,
  },
}));

vi.mock("../../src/resolvers/worker-resolver", () => ({
  workerQueue: {
    push: workerQueuePushMock,
  },
}));

import { handler } from "../../src/resolvers/controller-resolver";

const baseEventBody = {
  importConfigurationId: "import-123",
  workspaceId: "workspace-456",
  executionId: "execution-789",
  submitResultsUrl: "https://api.atlassian.com/imports/data",
  submitProgressUrl: "https://api.atlassian.com/imports/progress",
  getExecutionStatusUrl: "https://api.atlassian.com/imports/status",
  cancelUrl: "https://api.atlassian.com/imports/cancel",
};

describe("Controller Queue - Behavior Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches the first batch with the configured batch size and enqueues a work item", async () => {
    fetchBatchMock.mockResolvedValue({
      records: [],
      total: 120,
    });
    workerQueuePushMock.mockResolvedValue({ jobId: "job-123" });

    await handler({ body: baseEventBody } as AsyncEvent);

    expect(fetchBatchMock).toHaveBeenCalledWith({ skip: 0, limit: 30 });
    expect(workerQueuePushMock).toHaveBeenCalledWith({
      body: expect.objectContaining({
        skip: 0,
        limit: 30,
        total: 120,
        submitResultsUrl: baseEventBody.submitResultsUrl,
      }),
    });
  });

  it("honors skip in the event body when fetching the initial batch", async () => {
    fetchBatchMock.mockResolvedValue({
      records: [],
      total: 60,
    });
    workerQueuePushMock.mockResolvedValue({ jobId: "job-456" });

    await handler({ body: { ...baseEventBody, skip: 60 } } as AsyncEvent);

    expect(fetchBatchMock).toHaveBeenCalledWith({ skip: 60, limit: 30 });
  });

  it("does not enqueue work when required identifiers are missing", async () => {
    await handler({
      body: { ...baseEventBody, executionId: "" },
    } as AsyncEvent);

    expect(fetchBatchMock).not.toHaveBeenCalled();
    expect(workerQueuePushMock).not.toHaveBeenCalled();
  });
});
