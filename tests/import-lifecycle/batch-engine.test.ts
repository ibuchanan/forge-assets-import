/**
 * Tests for the batch engine's pure business logic (sans-I/O)
 *
 * These functions are source-agnostic: they know nothing about DummyJSON
 * or any other BatchSourceAdapter. No mocking required.
 *
 * Local reference: src/import-lifecycle/batch-engine.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const requestJiraMock = vi.hoisted(() => vi.fn());

vi.mock("@forge/api", () => ({
  default: {
    asApp: () => ({
      requestJira: requestJiraMock,
    }),
  },
  assumeTrustedRoute: (url: string) => url,
}));

const saveLatestOutcomeMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/import-lifecycle/run-state", () => ({
  saveLatestOutcome: saveLatestOutcomeMock,
}));

import {
  calculateBatchProgress,
  createNextWorkItem,
  isValidWorkItem,
  processWorkItem,
  shouldRetryError,
} from "../../src/import-lifecycle/batch-engine";

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
});

function makeAdapter(
  overrides: Partial<{
    fetchBatch: ReturnType<typeof vi.fn>;
    transform: ReturnType<typeof vi.fn>;
    shouldRetrySourceError: (error: Error) => boolean;
  }> = {},
) {
  return {
    fetchBatch: vi
      .fn()
      .mockResolvedValue({ records: [{ id: 1 }, { id: 2 }], total: 60 }),
    transform: vi.fn((records: Array<{ id: number }>) =>
      records.map((r) => ({ mapped: r.id })),
    ),
    ...overrides,
  };
}

describe("batch-engine - pure business logic (no mocking needed)", () => {
  describe("calculateBatchProgress", () => {
    it("should calculate nextSkip correctly", () => {
      const result = calculateBatchProgress(0, 30, 100);
      expect(result.nextSkip).toBe(30);
    });

    it("should detect last batch when nextSkip >= total", () => {
      const result = calculateBatchProgress(90, 30, 100);
      expect(result.isLastBatch).toBe(true);
      expect(result.nextSkip).toBe(120);
    });

    it("should detect last batch when nextSkip equals total", () => {
      const result = calculateBatchProgress(90, 30, 120);
      expect(result.isLastBatch).toBe(true);
      expect(result.nextSkip).toBe(120);
    });

    it("should detect not last batch when nextSkip < total", () => {
      const result = calculateBatchProgress(0, 30, 100);
      expect(result.isLastBatch).toBe(false);
      expect(result.nextSkip).toBe(30);
    });

    it("should handle various batch scenarios", () => {
      const testCases = [
        {
          skip: 0,
          limit: 30,
          total: 100,
          expectedNext: 30,
          expectedLast: false,
        },
        {
          skip: 30,
          limit: 30,
          total: 100,
          expectedNext: 60,
          expectedLast: false,
        },
        {
          skip: 60,
          limit: 30,
          total: 100,
          expectedNext: 90,
          expectedLast: false,
        },
        {
          skip: 90,
          limit: 30,
          total: 100,
          expectedNext: 120,
          expectedLast: true,
        },
        {
          skip: 70,
          limit: 30,
          total: 100,
          expectedNext: 100,
          expectedLast: true,
        },
      ];

      for (const tc of testCases) {
        const result = calculateBatchProgress(tc.skip, tc.limit, tc.total);
        expect(result.nextSkip).toBe(tc.expectedNext);
        expect(result.isLastBatch).toBe(tc.expectedLast);
      }
    });

    it("should handle edge case: zero products", () => {
      const result = calculateBatchProgress(0, 30, 0);
      expect(result.nextSkip).toBe(30);
      expect(result.isLastBatch).toBe(true);
    });

    it("should handle edge case: single product", () => {
      const result = calculateBatchProgress(0, 30, 1);
      expect(result.nextSkip).toBe(30);
      expect(result.isLastBatch).toBe(true);
    });

    it("should handle edge case: exactly limit products", () => {
      const result = calculateBatchProgress(0, 30, 30);
      expect(result.nextSkip).toBe(30);
      expect(result.isLastBatch).toBe(true);
    });

    it("should handle large batch counts", () => {
      const result = calculateBatchProgress(999970, 30, 1000000);
      expect(result.nextSkip).toBe(1000000);
      expect(result.isLastBatch).toBe(true);
    });

    it("should iterate through all batches until completion", () => {
      const total = 100;
      const limit = 30;
      let skip = 0;
      const batches: Array<{ skip: number; isLastBatch: boolean }> = [];

      while (skip < total) {
        const { nextSkip, isLastBatch } = calculateBatchProgress(
          skip,
          limit,
          total,
        );
        batches.push({ skip, isLastBatch });
        skip = nextSkip;
      }

      expect(batches).toHaveLength(4);
      expect(batches[batches.length - 1].isLastBatch).toBe(true);
    });
  });

  describe("createNextWorkItem", () => {
    it("should create next work item with updated skip", () => {
      const currentItem = {
        importConfigurationId: "import-123",
        workspaceId: "workspace-456",
        executionId: "execution-789",
        skip: 0,
        limit: 30,
        total: 100,
      };

      const nextItem = createNextWorkItem(currentItem, 30);

      expect(nextItem).toEqual({
        importConfigurationId: "import-123",
        workspaceId: "workspace-456",
        executionId: "execution-789",
        skip: 30,
        limit: 30,
        total: 100,
      });
    });

    it("should preserve all IDs and metadata", () => {
      const currentItem = {
        importConfigurationId: "import-abc",
        workspaceId: "ws-xyz",
        executionId: "exec-123",
        skip: 60,
        limit: 50,
        total: 200,
      };

      const nextItem = createNextWorkItem(currentItem, 110);

      expect(nextItem.importConfigurationId).toBe("import-abc");
      expect(nextItem.workspaceId).toBe("ws-xyz");
      expect(nextItem.executionId).toBe("exec-123");
      expect(nextItem.skip).toBe(110);
      expect(nextItem.limit).toBe(50);
      expect(nextItem.total).toBe(200);
    });

    it("should not mutate original work item", () => {
      const currentItem = {
        importConfigurationId: "import-123",
        workspaceId: "workspace-456",
        executionId: "execution-789",
        skip: 0,
        limit: 30,
        total: 100,
      };

      const originalSkip = currentItem.skip;
      createNextWorkItem(currentItem, 30);

      expect(currentItem.skip).toBe(originalSkip);
    });
  });

  describe("shouldRetryError", () => {
    it("should not retry 404 errors", () => {
      const error = new Error("Failed to submit import data: 404 Not Found");
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should retry 500 errors", () => {
      const error = new Error("Failed to submit import data: 500 Server Error");
      expect(shouldRetryError(error)).toBe(true);
    });

    it("should retry network errors", () => {
      const error = new Error("Network timeout");
      expect(shouldRetryError(error)).toBe(true);
    });

    it("should retry generic errors", () => {
      const error = new Error("Something went wrong");
      expect(shouldRetryError(error)).toBe(true);
    });

    it("should not retry errors containing 404 anywhere in message", () => {
      const error = new Error(
        "Request failed: 404 Not Found - /api/v1/importsource/.../executions/xyz/data",
      );
      expect(shouldRetryError(error)).toBe(false);
    });
  });

  describe("isValidWorkItem", () => {
    it("should return true for valid work item", () => {
      const workItem = {
        importConfigurationId: "import-123",
        workspaceId: "workspace-456",
        executionId: "execution-789",
        skip: 0,
        limit: 30,
        total: 100,
        submitResultsUrl: "https://api.atlassian.com/.../data",
        submitProgressUrl: "https://api.atlassian.com/.../progress",
        getExecutionStatusUrl: "https://api.atlassian.com/.../status",
        cancelUrl: "https://api.atlassian.com/.../cancel",
      };

      expect(isValidWorkItem(workItem)).toBe(true);
    });

    it("should return false when importConfigurationId is missing", () => {
      const workItem = {
        importConfigurationId: "",
        workspaceId: "workspace-456",
        executionId: "execution-789",
        skip: 0,
        limit: 30,
        total: 100,
      };

      expect(isValidWorkItem(workItem)).toBe(false);
    });

    it("should return false when workspaceId is missing", () => {
      const workItem = {
        importConfigurationId: "import-123",
        workspaceId: "",
        executionId: "execution-789",
        skip: 0,
        limit: 30,
        total: 100,
      };

      expect(isValidWorkItem(workItem)).toBe(false);
    });

    it("should return false when executionId is missing", () => {
      const workItem = {
        importConfigurationId: "import-123",
        workspaceId: "workspace-456",
        executionId: "",
        skip: 0,
        limit: 30,
        total: 100,
      };

      expect(isValidWorkItem(workItem)).toBe(false);
    });

    it("should return false when multiple fields are missing", () => {
      const workItem = {
        importConfigurationId: "",
        workspaceId: "",
        executionId: "",
        skip: 0,
        limit: 30,
        total: 100,
      };

      expect(isValidWorkItem(workItem)).toBe(false);
    });
  });
});

describe("processWorkItem - source-agnostic batch orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestJiraMock.mockResolvedValue(makeOkResponse());
    saveLatestOutcomeMock.mockResolvedValue(undefined);
  });

  it("reports invalid when the work item is missing required fields", async () => {
    const adapter = makeAdapter();
    const invalidWorkItem = {
      ...baseWorkItem,
      executionId: "",
      skip: 0,
      limit: 25,
      total: 60,
    };

    const result = await processWorkItem(invalidWorkItem, adapter);

    expect(result).toEqual({
      type: "invalid",
      missingFields: ["executionId"],
    });
    expect(adapter.fetchBatch).not.toHaveBeenCalled();
  });

  it("fetches and transforms the batch via the adapter, then enqueues the next work item", async () => {
    const adapter = makeAdapter();

    const result = await processWorkItem(
      { ...baseWorkItem, skip: 0, limit: 25, total: 60 },
      adapter,
    );

    expect(adapter.fetchBatch).toHaveBeenCalledWith({ skip: 0, limit: 25 });
    expect(adapter.transform).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }]);

    const [submitUrl, submitOptions] = requestJiraMock.mock.calls[0];
    const submitPayload = JSON.parse(submitOptions.body as string);
    expect(submitUrl).toBe("/imports/data");
    expect(submitPayload.data.products).toEqual([{ mapped: 1 }, { mapped: 2 }]);
    expect(submitPayload.completed).toBe(false);

    expect(result).toEqual({
      type: "enqueue-next",
      nextWorkItem: expect.objectContaining({ skip: 25, total: 60 }),
    });
  });

  it("reports progress for non-final batches", async () => {
    const adapter = makeAdapter();

    await processWorkItem(
      { ...baseWorkItem, skip: 0, limit: 25, total: 60 },
      adapter,
    );

    const progressCall = requestJiraMock.mock.calls.find(
      ([, options]) => options?.method === "PUT",
    );
    expect(progressCall).toBeDefined();
    const [progressUrl, progressOptions] = progressCall as [
      string,
      { body: string },
    ];
    expect(progressUrl).toBe("/imports/progress");
    expect(JSON.parse(progressOptions.body)).toEqual({
      objects: { total: 60, processed: 2 },
    });
  });

  it("marks the final batch as completed, records submission-complete, and does not enqueue or report progress", async () => {
    const adapter = makeAdapter();

    const result = await processWorkItem(
      { ...baseWorkItem, skip: 30, limit: 25, total: 32 },
      adapter,
    );

    const [, submitOptions] = requestJiraMock.mock.calls[0];
    const submitPayload = JSON.parse(submitOptions.body as string);
    expect(submitPayload.completed).toBe(true);

    const progressCall = requestJiraMock.mock.calls.find(
      ([, options]) => options?.method === "PUT",
    );
    expect(progressCall).toBeUndefined();

    expect(saveLatestOutcomeMock).toHaveBeenCalledWith(
      "import-123",
      expect.objectContaining({
        outcome: "submission-complete",
        recordedAt: expect.any(String),
      }),
    );
    expect(result).toEqual({ type: "completed" });
  });

  it("throws when Assets submission fails with a retriable error", async () => {
    const adapter = makeAdapter();
    requestJiraMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "server error",
      json: async () => ({}),
    });

    await expect(
      processWorkItem(
        { ...baseWorkItem, skip: 0, limit: 25, total: 60 },
        adapter,
      ),
    ).rejects.toThrow();
  });

  it("returns non-retriable-error without throwing when Assets submission fails with a 4xx error", async () => {
    const adapter = makeAdapter();
    requestJiraMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "execution not found",
      json: async () => ({}),
    });

    const result = await processWorkItem(
      { ...baseWorkItem, skip: 0, limit: 25, total: 60 },
      adapter,
    );

    expect(result.type).toBe("non-retriable-error");
    if (result.type === "non-retriable-error") {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it("uses the adapter's shouldRetrySourceError override instead of the default policy", async () => {
    const adapter = makeAdapter({
      shouldRetrySourceError: () => false,
    });
    requestJiraMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "server error",
      json: async () => ({}),
    });

    const result = await processWorkItem(
      { ...baseWorkItem, skip: 0, limit: 25, total: 60 },
      adapter,
    );

    expect(result.type).toBe("non-retriable-error");
  });
});
