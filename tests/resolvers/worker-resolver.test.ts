/**
 * Tests for worker-resolver pure functions (sans-I/O)
 *
 * These tests validate the business logic extracted from the worker resolver.
 * No mocking required - all pure functions!
 *
 * @see {@link https://developer.atlassian.com/platform/forge/runtime-reference/forge-resolver/|Forge Resolver}
 * @see {@link https://developer.atlassian.com/platform/forge/use-a-long-running-function/|Long-running Functions}
 * @see {@link https://developer.atlassian.com/cloud/assets/imports-rest-api-guide/|Assets Imports REST API Guide}
 *
 * Local reference: src/resolvers/worker-resolver.ts, docs/forge/queue-events-with-async-events-api-to-import-assets.md
 */

import { describe, expect, it } from "vitest";
import {
  calculateBatchProgress,
  createNextWorkItem,
  isValidWorkItem,
  shouldRetryError,
} from "../../src/resolvers/worker-resolver";

describe("worker-resolver - pure business logic (no mocking needed)", () => {
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
        // HATEOAS links required for valid work item
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
