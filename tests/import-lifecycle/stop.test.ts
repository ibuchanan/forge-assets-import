/**
 * Lifecycle Extension Point Tests: stopImport
 *
 * Validates the `stopImport` lifecycle handler for the Assets Import Type module.
 *
 * @see {@link https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-service-management-assets-import-type/|jiraServiceManagement:assetsImportType Module}
 * @see {@link https://developer.atlassian.com/platform/forge/assets-import-app/|Assets Import App Guide}
 * @see {@link https://developer.atlassian.com/cloud/assets/imports-rest-api-guide/|Assets Imports REST API Guide}
 *
 * Local reference: docs/forge/jira-service-management-assets-import-type.md
 *
 * Behaviors under test:
 * 1. Cancels active execution when executionId is present
 * 2. Skips cancellation when executionId is missing
 * 3. Skips cancellation when workspaceId is missing
 * 4. Always returns { result: "stop import" } regardless of cancellation outcome
 * 5. Handles cancellation failures gracefully (best-effort)
 * 6. Calls correct cancel endpoint with DELETE method
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetsImportContext } from "../../src/assets/types";
import { stopImport } from "../../src/import-lifecycle/stop";

// Load test context data
import stopImportContext from "../data/context/stopImport.json";

// Create a mock for requestJira that can be controlled in tests
const mockRequestJira = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  text: async () => "",
});

// Create hoisted mock for job progress
const mockJobProgress = vi.hoisted(() => ({
  cancel: vi.fn().mockResolvedValue(undefined),
}));

// Mock the Forge API
vi.mock("@forge/api", () => ({
  route: (strings: TemplateStringsArray, ...values: unknown[]) => {
    // Simple template string handler
    let result = strings[0];
    values.forEach((value, i) => {
      result += String(value) + strings[i + 1];
    });
    return result;
  },
  assumeTrustedRoute: (url: string) => url,
  default: {
    asApp: () => ({
      requestJira: mockRequestJira,
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

// Mock the controller queue for job cancellation
vi.mock("../../src/resolvers/controller-resolver", () => ({
  controllerQueue: {
    getJob: vi.fn().mockReturnValue(mockJobProgress),
  },
}));

// Mock the run-state module so tests control what stored state looks like
vi.mock("../../src/import-lifecycle/run-state", () => ({
  getActiveRunState: vi.fn().mockResolvedValue(null),
  clearActiveRunState: vi.fn().mockResolvedValue(undefined),
}));

describe("stopImport - Lifecycle Extension Point", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default successful response
    mockRequestJira.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    });
    // Silence console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("stored active run state", () => {
    it("cancels via the stored cancelUrl and controller job even without context executionId", async () => {
      const { getActiveRunState, clearActiveRunState } = await import(
        "../../src/import-lifecycle/run-state"
      );
      vi.mocked(getActiveRunState).mockResolvedValueOnce({
        executionId: "exec-stored-1",
        controllerJobId: "job-stored-1",
        cancelUrl:
          "/jsm/assets/workspace/workspace-456/v1/importsource/import-123/executions/exec-stored-1/cancel",
        getExecutionStatusUrl:
          "/jsm/assets/workspace/workspace-456/v1/importsource/import-123/executions/exec-stored-1",
        startedAt: "2026-07-25T00:00:00.000Z",
        state: "running",
      });

      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        // No context.extension.executionId available
        context: undefined,
      };

      const { controllerQueue } = await import(
        "../../src/resolvers/controller-resolver"
      );

      const result = await stopImport(context);

      expect(result).toEqual({ result: "stop import" });
      expect(mockRequestJira).toHaveBeenCalledWith(
        "/jsm/assets/workspace/workspace-456/v1/importsource/import-123/executions/exec-stored-1/cancel",
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(controllerQueue.getJob).toHaveBeenCalledWith("job-stored-1");
      expect(mockJobProgress.cancel).toHaveBeenCalled();
      expect(clearActiveRunState).toHaveBeenCalledWith("import-123");
    });

    it("falls back to context-reconstructed cancel when no active run state is stored", async () => {
      const { getActiveRunState, clearActiveRunState } = await import(
        "../../src/import-lifecycle/run-state"
      );
      vi.mocked(getActiveRunState).mockResolvedValueOnce(null);

      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: {
            importId: "import-123",
            workspaceId: "workspace-456",
            schemaId: "schema-789",
            executionId: "exec-abc-123",
            type: "jiraServiceManagement:assetsImportType",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      const result = await stopImport(context);

      expect(result).toEqual({ result: "stop import" });
      expect(mockRequestJira).toHaveBeenCalledWith(
        "/jsm/assets/workspace/workspace-456/v1/importsource/import-123/executions/exec-abc-123/cancel",
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(clearActiveRunState).not.toHaveBeenCalled();
    });
  });

  describe("cancellation behavior", () => {
    it("should call cancel endpoint when executionId is present", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: {
            importId: "import-123",
            workspaceId: "workspace-456",
            schemaId: "schema-789",
            executionId: "exec-abc-123",
            type: "jiraServiceManagement:assetsImportType",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      const result = await stopImport(context);

      expect(result).toEqual({ result: "stop import" });
      expect(mockRequestJira).toHaveBeenCalledWith(
        "/jsm/assets/workspace/workspace-456/v1/importsource/import-123/executions/exec-abc-123/cancel",
        expect.objectContaining({
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        }),
      );
    });

    it("should not call cancel endpoint when executionId is missing", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: undefined,
      };

      const result = await stopImport(context);

      expect(result).toEqual({ result: "stop import" });
      expect(mockRequestJira).not.toHaveBeenCalled();
    });

    it("should not call cancel endpoint when context.extension is missing", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: undefined,
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      const result = await stopImport(context);

      expect(result).toEqual({ result: "stop import" });
      expect(mockRequestJira).not.toHaveBeenCalled();
    });

    it("should not call cancel endpoint when workspaceId is missing", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "", // Missing workspaceId
        schemaId: "schema-789",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: {
            importId: "import-123",
            workspaceId: "workspace-456",
            schemaId: "schema-789",
            executionId: "exec-abc-123",
            type: "jiraServiceManagement:assetsImportType",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      const result = await stopImport(context);

      expect(result).toEqual({ result: "stop import" });
      expect(mockRequestJira).not.toHaveBeenCalled();
    });
  });

  describe("error handling - best-effort cancellation", () => {
    it("should return success even when cancel returns non-OK response", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: {
            importId: "import-123",
            workspaceId: "workspace-456",
            schemaId: "schema-789",
            executionId: "exec-abc-123",
            type: "jiraServiceManagement:assetsImportType",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      // Mock API error response (e.g., 404 execution not found)
      mockRequestJira.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Execution not found",
      });

      const result = await stopImport(context);

      // Should still return success (best-effort cancellation)
      expect(result).toEqual({ result: "stop import" });
      expect(mockRequestJira).toHaveBeenCalled();
    });

    it("should return success even when cancel throws an error", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: {
            importId: "import-123",
            workspaceId: "workspace-456",
            schemaId: "schema-789",
            executionId: "exec-abc-123",
            type: "jiraServiceManagement:assetsImportType",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      // Mock network error
      mockRequestJira.mockRejectedValueOnce(new Error("Network timeout"));

      const result = await stopImport(context);

      // Should still return success (cancellation is best-effort)
      expect(result).toEqual({ result: "stop import" });
      expect(mockRequestJira).toHaveBeenCalled();
    });

    it("should handle various HTTP error codes gracefully", async () => {
      const errorStatuses = [400, 401, 403, 404, 500, 502, 503];

      for (const status of errorStatuses) {
        vi.clearAllMocks();

        const context: AssetsImportContext = {
          contextToken: "test-token",
          importId: "import-123",
          workspaceId: "workspace-456",
          schemaId: "schema-789",
          context: {
            accountId: "test-account",
            cloudId: "test-cloud",
            localId: "test-local",
            moduleKey: "test-module",
            extension: {
              importId: "import-123",
              workspaceId: "workspace-456",
              schemaId: "schema-789",
              executionId: "exec-abc-123",
              type: "jiraServiceManagement:assetsImportType",
            },
            userAccess: {
              enabled: true,
              hasAccess: true,
            },
          },
        };

        mockRequestJira.mockResolvedValueOnce({
          ok: false,
          status,
          text: async () => `Error ${status}`,
        });

        const result = await stopImport(context);

        expect(result).toEqual({ result: "stop import" });
      }
    });
  });

  describe("return value", () => {
    it("should always return { result: 'stop import' }", async () => {
      const context = stopImportContext as unknown as AssetsImportContext;

      const result = await stopImport(context);

      expect(result).toEqual({ result: "stop import" });
    });

    it("should return correct result structure with minimal context", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "test-import-id",
        workspaceId: "test-workspace-id",
        schemaId: "test-schema-id",
        context: undefined,
      };

      const result = await stopImport(context);

      expect(result).toHaveProperty("result");
      expect(typeof result.result).toBe("string");
      expect(result).toEqual({ result: "stop import" });
    });

    it("should return success even when cancellation succeeds", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: {
            importId: "import-123",
            workspaceId: "workspace-456",
            schemaId: "schema-789",
            executionId: "exec-abc-123",
            type: "jiraServiceManagement:assetsImportType",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      // Mock successful cancellation
      mockRequestJira.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "",
      });

      const result = await stopImport(context);

      expect(result).toEqual({ result: "stop import" });
    });
  });

  describe("endpoint construction", () => {
    it("should construct cancel endpoint with correct IDs", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "my-custom-import",
        workspaceId: "ws-xyz-789",
        schemaId: "schema-789",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: {
            importId: "my-custom-import",
            workspaceId: "ws-xyz-789",
            schemaId: "schema-789",
            executionId: "exec-custom-999",
            type: "jiraServiceManagement:assetsImportType",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      const result = await stopImport(context);

      expect(result).toEqual({ result: "stop import" });
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining("/jsm/assets/workspace/ws-xyz-789"),
        expect.any(Object),
      );
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining("/importsource/my-custom-import"),
        expect.any(Object),
      );
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining("/executions/exec-custom-999/cancel"),
        expect.any(Object),
      );
    });

    it("should use DELETE method for cancellation", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: {
            importId: "import-123",
            workspaceId: "workspace-456",
            schemaId: "schema-789",
            executionId: "exec-abc-123",
            type: "jiraServiceManagement:assetsImportType",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      await stopImport(context);

      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });

    it("should set Accept header to application/json", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: {
            importId: "import-123",
            workspaceId: "workspace-456",
            schemaId: "schema-789",
            executionId: "exec-abc-123",
            type: "jiraServiceManagement:assetsImportType",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      await stopImport(context);

      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            Accept: "application/json",
          },
        }),
      );
    });
  });
});
