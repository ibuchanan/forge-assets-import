/**
 * Lifecycle Extension Point Tests: startImport
 *
 * Validates the `startImport` lifecycle handler for the Assets Import Type module.
 *
 * @see {@link https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-service-management-assets-import-type/|jiraServiceManagement:assetsImportType Module}
 * @see {@link https://developer.atlassian.com/platform/forge/assets-import-app/|Assets Import App Guide}
 * @see {@link https://developer.atlassian.com/cloud/assets/imports-rest-api-guide/|Assets Imports REST API Guide}
 * @see {@link https://developer.atlassian.com/platform/forge/use-async-events/|Async Events API}
 *
 * Local reference: docs/forge/jira-service-management-assets-import-type.md
 *
 * Behaviors under test:
 * 1. Validates workspaceId is present (returns error if missing)
 * 2. Validates importId is present (returns error if missing)
 * 3. Creates a new execution via Assets API
 * 4. Extracts executionId from the API response
 * 5. Pushes to controller queue with correct structure
 * 6. Returns { result: "start import" } on success
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetsImportContext } from "../../src/assets/types";
import { startImport } from "../../src/import-lifecycle/start";

// Load test context data
import startImportContext from "../data/context/startImport.json";

// Create a mock for requestJira that can be controlled in tests
const mockRequestJira = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    links: {
      submitResults:
        "/jsm/assets/workspace/workspace-123/v1/importsource/import-123/executions/exec-test-id-123/data",
      submitProgress:
        "/jsm/assets/workspace/workspace-123/v1/importsource/import-123/executions/exec-test-id-123/progress",
      getExecutionStatus:
        "/jsm/assets/workspace/workspace-123/v1/importsource/import-123/executions/exec-test-id-123",
      cancel:
        "/jsm/assets/workspace/workspace-123/v1/importsource/import-123/executions/exec-test-id-123/cancel",
    },
  }),
});

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

// Mock the controller queue
vi.mock("../../src/resolvers/controller-resolver", () => ({
  controllerQueue: {
    push: vi.fn().mockResolvedValue({ jobId: "mock-job-id-123" }),
  },
}));

describe("startImport - Lifecycle Extension Point", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock to default successful response
    mockRequestJira.mockResolvedValue({
      ok: true,
      json: async () => ({
        links: {
          submitResults:
            "/jsm/assets/workspace/workspace-123/v1/importsource/import-123/executions/exec-test-id-123/data",
          submitProgress:
            "/jsm/assets/workspace/workspace-123/v1/importsource/import-123/executions/exec-test-id-123/progress",
          getExecutionStatus:
            "/jsm/assets/workspace/workspace-123/v1/importsource/import-123/executions/exec-test-id-123",
          cancel:
            "/jsm/assets/workspace/workspace-123/v1/importsource/import-123/executions/exec-test-id-123/cancel",
        },
      }),
    });
  });

  describe("context validation", () => {
    it("should accept valid context with all required fields", async () => {
      const validContext: AssetsImportContext = {
        contextToken: "test-token",
        importId: "test-import-id",
        workspaceId: "test-workspace-id",
        schemaId: "test-schema-id",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: {
            importId: "test-import-id",
            workspaceId: "test-workspace-id",
            schemaId: "test-schema-id",
            executionId: "test-execution-id",
            type: "jiraServiceManagement:assetsImportType",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      const result = await startImport(validContext);

      expect(result).toEqual({ result: "start import" });
    });

    it("should return error if workspaceId is missing", async () => {
      const invalidContext: AssetsImportContext = {
        contextToken: "test-token",
        importId: "test-import-id",
        workspaceId: "", // Empty workspaceId
        schemaId: "test-schema-id",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: {
            importId: "test-import-id",
            workspaceId: "test-workspace-id",
            schemaId: "test-schema-id",
            executionId: "test-execution-id",
            type: "test-type",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      await expect(startImport(invalidContext)).rejects.toThrow(
        /workspaceId is required/,
      );
    });

    it("should return error if importId is missing", async () => {
      const invalidContext: AssetsImportContext = {
        contextToken: "test-token",
        importId: "", // Empty importId
        workspaceId: "test-workspace-id",
        schemaId: "test-schema-id",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: {
            importId: "test-import-id",
            workspaceId: "test-workspace-id",
            schemaId: "test-schema-id",
            executionId: "test-execution-id",
            type: "test-type",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      await expect(startImport(invalidContext)).rejects.toThrow(
        /importId is required/,
      );
    });
  });

  describe("Assets API integration", () => {
    it("should call Assets API to create new execution", async () => {
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
            executionId: "execution-abc",
            type: "test-type",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      const result = await startImport(context);

      expect(result).toEqual({ result: "start import" });
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining("workspace-456"),
        { method: "POST" },
      );
    });

    it("should extract executionId from API response", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-456",
        workspaceId: "workspace-789",
        schemaId: "schema-123",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: {
            importId: "import-456",
            workspaceId: "workspace-789",
            schemaId: "schema-123",
            executionId: "execution-old",
            type: "test-type",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      const { controllerQueue } = await import(
        "../../src/resolvers/controller-resolver"
      );

      const result = await startImport(context);

      expect(result).toEqual({ result: "start import" });
      expect(controllerQueue.push).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            executionId: "exec-test-id-123", // From mock API response
          }),
        }),
      );
    });

    it("should throw error if API call fails", async () => {
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
            executionId: "execution-abc",
            type: "test-type",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      // Override mock to return error response
      mockRequestJira.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      await expect(startImport(context)).rejects.toThrow(
        /Failed to create import execution/,
      );
    });
  });

  describe("controller queue integration", () => {
    it("should push event to controller queue with correct structure", async () => {
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
            executionId: "execution-abc",
            type: "test-type",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      const { controllerQueue } = await import(
        "../../src/resolvers/controller-resolver"
      );

      const result = await startImport(context);

      expect(result).toEqual({ result: "start import" });
      expect(controllerQueue.push).toHaveBeenCalledWith({
        body: {
          importConfigurationId: "import-123",
          workspaceId: "workspace-456",
          executionId: "exec-test-id-123",
          skip: 0,
          limit: 30,
          total: 0,
          submitResultsUrl: expect.stringContaining(
            "/executions/exec-test-id-123/data",
          ),
          submitProgressUrl: expect.any(String),
          getExecutionStatusUrl: expect.any(String),
          cancelUrl: expect.any(String),
        },
      });
    });

    it("should use importId as importConfigurationId in queue event", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "my-import-source-id",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: {
            importId: "my-import-source-id",
            workspaceId: "workspace-456",
            schemaId: "schema-789",
            executionId: "execution-abc",
            type: "test-type",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      const { controllerQueue } = await import(
        "../../src/resolvers/controller-resolver"
      );

      const result = await startImport(context);

      expect(result).toEqual({ result: "start import" });
      expect(controllerQueue.push).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            importConfigurationId: "my-import-source-id",
          }),
        }),
      );
    });

    it("should receive jobId from controller queue", async () => {
      const context = startImportContext as unknown as AssetsImportContext;
      const { controllerQueue } = await import(
        "../../src/resolvers/controller-resolver"
      );

      const result = await startImport(context);

      expect(result).toEqual({ result: "start import" });
      // Verify the mock was called (jobId is logged but not returned)
      expect(controllerQueue.push).toHaveBeenCalled();
      const mockPush = vi.mocked(controllerQueue.push);
      expect(mockPush).toHaveReturned();
    });
  });

  describe("return value", () => {
    it("should return object with result: 'start import'", async () => {
      const context = startImportContext as unknown as AssetsImportContext;

      const result = await startImport(context);

      expect(result).toEqual({ result: "start import" });
    });

    it("should return result even when queue push succeeds", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "test-import-id",
        workspaceId: "test-workspace-id",
        schemaId: "test-schema-id",
        context: {
          accountId: "test-account",
          cloudId: "test-cloud",
          localId: "test-local",
          moduleKey: "test-module",
          extension: {
            importId: "test-import-id",
            workspaceId: "test-workspace-id",
            schemaId: "test-schema-id",
            executionId: "test-execution-id",
            type: "test-type",
          },
          userAccess: {
            enabled: true,
            hasAccess: true,
          },
        },
      };

      const result = await startImport(context);

      expect(result).toEqual({ result: "start import" });
      expect(typeof result.result).toBe("string");
    });
  });

  describe("real context from test data", () => {
    it("should work with real context structure from startImport.json", async () => {
      const context = startImportContext as unknown as AssetsImportContext;

      // Verify the context matches expected structure
      expect(context.importId).toBeDefined();
      expect(context.workspaceId).toBeDefined();
      expect(context.schemaId).toBeDefined();

      const result = await startImport(context);

      expect(result).toEqual({ result: "start import" });
    });
  });
});
