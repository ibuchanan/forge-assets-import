/**
 * Worker Queue Tests - Behavior-focused integration checks
 *
 * Validates async queue processing for importing data in batches.
 */

import type { AsyncEvent } from "@forge/events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidWorkItem } from "../../src/resolvers/worker-resolver";

const fetchProductsBatchMock = vi.hoisted(() => vi.fn());
const requestJiraMock = vi.hoisted(() => vi.fn());
const workerQueuePushMock = vi.hoisted(() => vi.fn());

vi.mock("@forge/api", () => ({
  default: {
    asApp: () => ({
      requestJira: requestJiraMock,
    }),
  },
  assumeTrustedRoute: (url: string) => url,
}));

vi.mock("@forge/events", () => ({
  Queue: class {
    push = workerQueuePushMock;
  },
}));

vi.mock("../../src/external/dummyjson-client", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchProductsBatch: fetchProductsBatchMock,
}));

const saveLatestOutcomeMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/import-lifecycle/run-state", () => ({
  saveLatestOutcome: saveLatestOutcomeMock,
}));

import { handler } from "../../src/resolvers/worker-resolver";

const baseWorkItem = {
  importConfigurationId: "import-123",
  workspaceId: "workspace-456",
  executionId: "execution-789",
  submitResultsUrl: "https://api.atlassian.com/imports/data",
  submitProgressUrl: "https://api.atlassian.com/imports/progress",
  getExecutionStatusUrl: "https://api.atlassian.com/imports/status",
  cancelUrl: "https://api.atlassian.com/imports/cancel",
};

const makeOkResponse = () => ({
  ok: true,
  status: 200,
  statusText: "OK",
  text: async () => "",
  json: async () => ({}),
  headers: {
    get: () => null,
  },
});

describe("Worker Queue - Behavior Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestJiraMock.mockResolvedValue(makeOkResponse());
    saveLatestOutcomeMock.mockResolvedValue(undefined);
  });

  it("submits data using the work item batch size and enqueues the next batch", async () => {
    fetchProductsBatchMock.mockResolvedValue({
      products: [{ id: 1 }, { id: 2 }],
      total: 60,
      skip: 0,
      limit: 25,
    });
    workerQueuePushMock.mockResolvedValue({ jobId: "job-789" });

    await handler({
      body: {
        ...baseWorkItem,
        skip: 0,
        limit: 25,
        total: 60,
      },
    } as AsyncEvent);

    expect(fetchProductsBatchMock).toHaveBeenCalledWith(0, 25);

    const [submitUrl, submitOptions] = requestJiraMock.mock.calls[0];
    const submitPayload = JSON.parse(submitOptions.body as string);
    expect(submitUrl).toBe("/imports/data");
    expect(submitPayload.clientGeneratedId).toBe("batch-0-25");
    expect(submitPayload.completed).toBe(false);

    expect(workerQueuePushMock).toHaveBeenCalledWith({
      body: expect.objectContaining({
        skip: 25,
        limit: 25,
        total: 60,
      }),
    });
  });

  it("marks the final batch as completed, skips progress updates, and does not enqueue another work item", async () => {
    fetchProductsBatchMock.mockResolvedValue({
      products: [{ id: 1 }],
      total: 40,
      skip: 30,
      limit: 25,
    });

    await handler({
      body: {
        ...baseWorkItem,
        skip: 30,
        limit: 25,
        total: 40,
      },
    } as AsyncEvent);

    const [, submitOptions] = requestJiraMock.mock.calls[0];
    const submitPayload = JSON.parse(submitOptions.body as string);
    expect(submitPayload.completed).toBe(true);

    const progressCall = requestJiraMock.mock.calls.find(
      ([, options]) => options?.method === "PUT",
    );
    expect(progressCall).toBeUndefined();

    expect(workerQueuePushMock).not.toHaveBeenCalled();
  });

  it("records a submission-complete outcome when the final batch submits successfully", async () => {
    fetchProductsBatchMock.mockResolvedValue({
      products: [{ id: 1 }],
      total: 40,
      skip: 30,
      limit: 25,
    });

    await handler({
      body: {
        ...baseWorkItem,
        skip: 30,
        limit: 25,
        total: 40,
      },
    } as AsyncEvent);

    expect(saveLatestOutcomeMock).toHaveBeenCalledWith(
      baseWorkItem.importConfigurationId,
      expect.objectContaining({
        outcome: "submission-complete",
        recordedAt: expect.any(String),
      }),
    );
  });

  it("skips processing when required work item fields are missing", async () => {
    const invalidWorkItem = {
      ...baseWorkItem,
      executionId: "",
      skip: 0,
      limit: 25,
      total: 60,
    };

    expect(isValidWorkItem(invalidWorkItem)).toBe(false);

    await handler({
      body: invalidWorkItem,
    } as AsyncEvent);

    expect(fetchProductsBatchMock).not.toHaveBeenCalled();
    expect(requestJiraMock).not.toHaveBeenCalled();
    expect(workerQueuePushMock).not.toHaveBeenCalled();
  });
});
