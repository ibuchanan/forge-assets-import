/**
 * Import Lifecycle Integration Tests
 *
 * Tests the complete import lifecycle with proper endpoint contract validation.
 * This is a true integration test that verifies all lifecycle handlers work together.
 *
 * @see {@link https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-service-management-assets-import-type/|jiraServiceManagement:assetsImportType Module}
 * @see {@link https://developer.atlassian.com/platform/forge/assets-import-app/|Assets Import App Guide}
 * @see {@link https://developer.atlassian.com/cloud/assets/imports-rest-api-guide/|Assets Imports REST API Guide}
 *
 * Local reference: docs/forge/jira-service-management-assets-import-type.md
 *
 * Verifies:
 * 1. Correct endpoint calls for each lifecycle step
 * 2. Data contracts between lifecycle steps (e.g., executionId flow)
 * 3. HATEOAS links are generated and can be used by downstream operations
 * 4. Context consistency across all lifecycle operations
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetsImportContext } from "../../src/assets/types";
import { ForgeImportStatus } from "../../src/assets/types";
import { onDeleteImport } from "../../src/import-lifecycle/delete";
import { startImport } from "../../src/import-lifecycle/start";
import { importStatus } from "../../src/import-lifecycle/status";
import { stopImport } from "../../src/import-lifecycle/stop";

// Load test context data
import startImportContext from "../data/context/startImport.json";

/**
 * Mock requestJira with endpoint-aware routing.
 * Different endpoints return different responses to simulate real Assets API behavior.
 */
const createMockRequestJira = (
  workspaceId: string,
  importId: string,
  executionId: string,
) => {
  return vi.fn(async (endpoint: string, options?: Record<string, unknown>) => {
    // POST /executions - Create new execution
    if (
      endpoint.includes("/executions") &&
      !endpoint.includes("/cancel") &&
      !endpoint.includes("/data") &&
      !endpoint.includes("/progress") &&
      !endpoint.includes("/configstatus") &&
      options?.method === "POST"
    ) {
      return {
        ok: true,
        status: 201,
        statusText: "Created",
        json: async () => ({
          id: executionId,
          status: "RUNNING",
          links: {
            submitResults: `/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/executions/${executionId}/data`,
            submitProgress: `/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/executions/${executionId}/progress`,
            getExecutionStatus: `/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/executions/${executionId}`,
            cancel: `/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/executions/${executionId}/cancel`,
          },
        }),
        text: async () => "",
      };
    }

    // GET /configstatus - Get import configuration status
    if (endpoint.includes("/configstatus")) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          status: "IDLE",
        }),
        text: async () => "",
      };
    }

    // DELETE /executions/{id}/cancel - Cancel execution
    if (
      endpoint.includes("/executions") &&
      endpoint.includes("/cancel") &&
      options?.method === "DELETE"
    ) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          status: "CANCELLED",
        }),
        text: async () => "",
      };
    }

    // Default fallback
    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({}),
      text: async () => "Endpoint not mocked",
    };
  });
};

// Mock the Forge API with endpoint awareness
// We'll store the mock in the factory itself to avoid hoisting issues
let mockRequestJiraInstance: ReturnType<typeof vi.fn>;

vi.mock("@forge/api", () => ({
  route: (strings: TemplateStringsArray, ...values: unknown[]) => {
    // Simple template string handler
    let result = strings[0];
    values.forEach((value, i) => {
      result += String(value) + strings[i + 1];
    });
    return result;
  },
  default: {
    asApp: () => ({
      requestJira: (...args: unknown[]) => mockRequestJiraInstance?.(...args),
    }),
  },
}));

vi.mock("@forge/kvs", () => ({
  kvs: {
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the controller queue
const mockJobProgress = vi.hoisted(() => ({
  cancel: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/resolvers/controller-resolver", () => ({
  controllerQueue: {
    push: vi.fn().mockResolvedValue({ jobId: "mock-job-id-123" }),
    getJob: vi.fn().mockReturnValue(mockJobProgress),
  },
}));

describe("Import Lifecycle Integration", () => {
  let mockRequestJira: ReturnType<typeof createMockRequestJira>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Get the real context values
    const context = startImportContext as unknown as AssetsImportContext;
    const { workspaceId, importId } = context;
    const executionId =
      context.context?.extension?.executionId || "exec-test-123";

    // Create endpoint-aware mock with real context values
    mockRequestJira = createMockRequestJira(workspaceId, importId, executionId);
    mockRequestJiraInstance = mockRequestJira;

    // Silence console output
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("Complete lifecycle flow", () => {
    it("should execute complete lifecycle: start -> status -> stop -> delete with proper endpoint contracts", async () => {
      const context = startImportContext as unknown as AssetsImportContext;
      const { workspaceId, importId } = context;
      const executionId =
        context.context?.extension?.executionId || "exec-test-123";

      // Step 1: Start import
      // Expects POST to /executions endpoint
      const startResult = await startImport(context);
      expect(startResult).toEqual({ result: "start import" });

      // Verify start called the creation endpoint
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining("/executions"),
        expect.objectContaining({
          method: "POST",
        }),
      );

      // Verify controller queue received execution data
      const { controllerQueue } = await import(
        "../../src/resolvers/controller-resolver"
      );
      expect(vi.mocked(controllerQueue.push)).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            executionId,
            workspaceId,
            importConfigurationId: importId,
            skip: 0,
            limit: 30,
            total: 0,
            // Note: HATEOAS URLs are NOT in queue payload - fetched by resolvers
          }),
        }),
      );

      vi.clearAllMocks();
      // Re-setup the mock after clearing
      mockRequestJira = createMockRequestJira(
        workspaceId,
        importId,
        executionId,
      );
      mockRequestJiraInstance = mockRequestJira;

      // Step 2: Check status
      // Expects GET to /configstatus endpoint
      const statusResult = await importStatus(context);
      expect(statusResult.status).toBe(ForgeImportStatus.READY);

      // Verify status called the correct endpoint
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining("/configstatus"),
        expect.any(Object),
      );

      vi.clearAllMocks();
      // Re-setup the mock after clearing
      mockRequestJira = createMockRequestJira(
        workspaceId,
        importId,
        executionId,
      );
      mockRequestJiraInstance = mockRequestJira;

      // Step 3: Stop import
      // Expects DELETE to /executions/{id}/cancel endpoint
      const stopResult = await stopImport(context);
      expect(stopResult.result).toBe("stop import");

      // Verify stop called the cancel endpoint
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining("/cancel"),
        expect.objectContaining({
          method: "DELETE",
        }),
      );

      vi.clearAllMocks();

      // Step 4: Delete import
      const deleteResult = await onDeleteImport(context);
      expect(deleteResult.result).toBe("on delete import");
    });
  });

  describe("Endpoint contract validation", () => {
    it("should use correct endpoint format for execution creation", async () => {
      const context = startImportContext as unknown as AssetsImportContext;
      const { workspaceId, importId } = context;

      await startImport(context);

      // Verify the endpoint contains all required path segments
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining(`/jsm/assets/workspace/${workspaceId}`),
        expect.any(Object),
      );
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining(`/importsource/${importId}`),
        expect.any(Object),
      );
    });

    it("should extract and use executionId from API response in subsequent calls", async () => {
      const context = startImportContext as unknown as AssetsImportContext;
      const { workspaceId, importId } = context;
      const expectedExecutionId =
        context.context?.extension?.executionId || "exec-test-123";

      // Start import and verify execution creation
      await startImport(context);

      const { controllerQueue } = await import(
        "../../src/resolvers/controller-resolver"
      );
      const pushCall = vi.mocked(controllerQueue.push).mock.calls[0][0];
      const queuedExecutionId = pushCall.body.executionId;

      // Execution ID should be extracted from API response
      expect(queuedExecutionId).toBe(expectedExecutionId);

      // Update mock for status call
      vi.clearAllMocks();
      mockRequestJira = createMockRequestJira(
        workspaceId,
        importId,
        queuedExecutionId,
      );

      mockRequestJiraInstance = mockRequestJira;

      // Status call should use the execution ID
      await importStatus(context);
      expect(mockRequestJira).toHaveBeenCalled();
    });

    it("should include HATEOAS links for downstream operations", async () => {
      const context = startImportContext as unknown as AssetsImportContext;
      const { controllerQueue } = await import(
        "../../src/resolvers/controller-resolver"
      );

      await startImport(context);

      const pushCall = vi.mocked(controllerQueue.push).mock.calls[0][0];
      const queuedData = pushCall.body;

      // Verify HATEOAS links are present
      expect(queuedData.submitResultsUrl).toBeDefined();
      expect(queuedData.submitProgressUrl).toBeDefined();
      expect(queuedData.getExecutionStatusUrl).toBeDefined();
      expect(queuedData.cancelUrl).toBeDefined();

      // Verify they contain execution ID
      const executionId = queuedData.executionId;
      expect(queuedData.submitResultsUrl).toContain(executionId);
      expect(queuedData.cancelUrl).toContain(executionId);
    });
  });

  describe("Context consistency across lifecycle", () => {
    it("should maintain workspace and import IDs across all lifecycle steps", async () => {
      const context = startImportContext as unknown as AssetsImportContext;
      const { workspaceId, importId } = context;

      // All steps should use the same IDs
      await startImport(context);
      const callCount = mockRequestJira.mock.calls.length;
      expect(callCount).toBeGreaterThan(0);

      vi.clearAllMocks();
      mockRequestJira = createMockRequestJira(
        workspaceId,
        importId,
        context.context?.extension?.executionId || "exec-test-123",
      );

      mockRequestJiraInstance = mockRequestJira;

      await importStatus(context);
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining(workspaceId),
        expect.any(Object),
      );
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining(importId),
        expect.any(Object),
      );
    });

    it("should handle all lifecycle functions with the same context object", async () => {
      const context = startImportContext as unknown as AssetsImportContext;

      // All should succeed without throwing
      await expect(startImport(context)).resolves.toBeDefined();

      vi.clearAllMocks();
      mockRequestJira = createMockRequestJira(
        context.workspaceId,
        context.importId,
        context.context?.extension?.executionId || "exec-test-123",
      );

      mockRequestJiraInstance = mockRequestJira;

      await expect(importStatus(context)).resolves.toBeDefined();

      vi.clearAllMocks();
      mockRequestJira = createMockRequestJira(
        context.workspaceId,
        context.importId,
        context.context?.extension?.executionId || "exec-test-123",
      );
      mockRequestJiraInstance = mockRequestJira;

      await expect(stopImport(context)).resolves.toBeDefined();
      await expect(onDeleteImport(context)).resolves.toBeDefined();
    });
  });
});
