/**
 * Lifecycle Extension Point Tests: importStatus
 *
 * Validates the `importStatus` lifecycle handler for the Assets Import Type module.
 *
 * @see {@link https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-service-management-assets-import-type/|jiraServiceManagement:assetsImportType Module}
 * @see {@link https://developer.atlassian.com/platform/forge/assets-import-app/|Assets Import App Guide}
 * @see {@link https://developer.atlassian.com/cloud/assets/imports-rest-api-guide/|Assets Imports REST API Guide}
 *
 * Local reference: docs/forge/jira-service-management-assets-import-type.md
 *
 * Behaviors under test:
 * 1. Fetches configuration status from Assets API endpoint
 * 2. Maps Assets status to Forge import status correctly
 * 3. Returns NOT_CONFIGURED for MISSING_MAPPING, undefined, null, or empty status
 * 4. Returns READY for IDLE, RUNNING, DISABLED, and other valid status values
 * 5. Handles API failures gracefully (safe default: NOT_CONFIGURED)
 * 6. Validates context has required fields (importId, workspaceId)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AssetsImportContext,
  ForgeImportStatus,
} from "../../src/assets/types";
import {
  importStatus,
  mapConfigurationStatus,
} from "../../src/import-lifecycle/status";

// Load test context data
import importStatusContext from "../data/context/importStatus.json";

// Mock @forge/api
vi.mock("@forge/api", () => ({
  default: {
    asApp: vi.fn(() => ({
      requestJira: vi.fn(),
    })),
  },
  route: (strings: TemplateStringsArray, ...values: unknown[]) => {
    // Mock route template function
    return strings.reduce((acc, str, i) => acc + str + (values[i] || ""), "");
  },
  assumeTrustedRoute: (url: string) => url,
}));

vi.mock("../../src/import-lifecycle/run-state", () => ({
  getActiveRunState: vi.fn().mockResolvedValue(null),
  saveLatestOutcome: vi.fn().mockResolvedValue(undefined),
}));

describe("importStatus - Lifecycle Extension Point", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("mapConfigurationStatus - pure business logic (no mocking needed)", () => {
    it("should return NOT_CONFIGURED for MISSING_MAPPING", () => {
      const result = mapConfigurationStatus("MISSING_MAPPING");
      expect(result).toBe(ForgeImportStatus.NOT_CONFIGURED);
    });

    it("should return READY for IDLE status", () => {
      const result = mapConfigurationStatus("IDLE");
      expect(result).toBe(ForgeImportStatus.READY);
    });

    it("should return READY for RUNNING status", () => {
      const result = mapConfigurationStatus("RUNNING");
      expect(result).toBe(ForgeImportStatus.READY);
    });

    it("should return READY for DISABLED status", () => {
      const result = mapConfigurationStatus("DISABLED");
      expect(result).toBe(ForgeImportStatus.READY);
    });

    it("should return NOT_CONFIGURED for undefined status", () => {
      const result = mapConfigurationStatus(undefined);
      expect(result).toBe(ForgeImportStatus.NOT_CONFIGURED);
    });

    it("should return NOT_CONFIGURED for empty string", () => {
      const result = mapConfigurationStatus("");
      expect(result).toBe(ForgeImportStatus.NOT_CONFIGURED);
    });

    it("should return NOT_CONFIGURED for unknown status values", () => {
      const result = mapConfigurationStatus("UNKNOWN_STATUS");
      expect(result).toBe(ForgeImportStatus.NOT_CONFIGURED);
    });

    it("should only map documented statuses (IDLE, RUNNING, DISABLED) to READY", () => {
      const undocumentedStatuses = [
        "NEW_STATUS",
        "PENDING",
        "PROCESSING",
        "CUSTOM_VALUE",
      ];

      for (const status of undocumentedStatuses) {
        const result = mapConfigurationStatus(status);
        expect(result).toBe(ForgeImportStatus.NOT_CONFIGURED);
      }
    });
  });

  describe("API endpoint and authentication", () => {
    it("should call Assets API with correct endpoint format", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: undefined,
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn().mockResolvedValue({
          status: "IDLE",
        }),
        text: vi.fn().mockResolvedValue(""),
      };

      const api = await import("@forge/api");
      const mockRequestJira = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(api.default.asApp).mockReturnValue({
        requestJira: mockRequestJira,
      } as never);

      await importStatus(context);

      // Verify endpoint format: /jsm/assets/workspace/{id}/v1/importsource/{id}/configstatus
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining(
          "/jsm/assets/workspace/workspace-456/v1/importsource/import-123/configstatus",
        ),
        expect.any(Object),
      );
    });

    it("should set Accept header to application/json", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: undefined,
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn().mockResolvedValue({
          status: "IDLE",
        }),
        text: vi.fn().mockResolvedValue(""),
      };

      const api = await import("@forge/api");
      const mockRequestJira = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(api.default.asApp).mockReturnValue({
        requestJira: mockRequestJira,
      } as never);

      await importStatus(context);

      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/json",
          }),
        }),
      );
    });

    it("should use asApp() for authentication", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: undefined,
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn().mockResolvedValue({
          status: "IDLE",
        }),
        text: vi.fn().mockResolvedValue(""),
      };

      const api = await import("@forge/api");
      const mockAsApp = vi.mocked(api.default.asApp);
      mockAsApp.mockReturnValue({
        requestJira: vi.fn().mockResolvedValue(mockResponse),
      } as never);

      await importStatus(context);

      // Verify asApp() was called
      expect(mockAsApp).toHaveBeenCalled();
    });
  });

  describe("status mapping and return value", () => {
    it("should return NOT_CONFIGURED when API returns MISSING_MAPPING", async () => {
      const context = importStatusContext as unknown as AssetsImportContext;

      // Mock successful API response with MISSING_MAPPING status
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn().mockResolvedValue({
          status: "MISSING_MAPPING",
        }),
        text: vi.fn().mockResolvedValue(""),
      };

      const api = await import("@forge/api");
      const mockRequestJira = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(api.default.asApp).mockReturnValue({
        requestJira: mockRequestJira,
      } as never);

      const result = await importStatus(context);

      expect(result).toEqual({ status: ForgeImportStatus.NOT_CONFIGURED });
    });

    it("should return READY when API returns IDLE status", async () => {
      const context = importStatusContext as unknown as AssetsImportContext;

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn().mockResolvedValue({
          status: "IDLE",
        }),
        text: vi.fn().mockResolvedValue(""),
      };

      const api = await import("@forge/api");
      const mockRequestJira = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(api.default.asApp).mockReturnValue({
        requestJira: mockRequestJira,
      } as never);

      const result = await importStatus(context);

      expect(result).toEqual({ status: ForgeImportStatus.READY });
    });

    it("should return READY when API returns RUNNING status", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: undefined,
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn().mockResolvedValue({
          status: "RUNNING",
        }),
        text: vi.fn().mockResolvedValue(""),
      };

      const api = await import("@forge/api");
      const mockRequestJira = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(api.default.asApp).mockReturnValue({
        requestJira: mockRequestJira,
      } as never);

      const result = await importStatus(context);

      expect(result).toEqual({ status: ForgeImportStatus.READY });
    });

    it("should return READY when API returns DISABLED status", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: undefined,
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn().mockResolvedValue({
          status: "DISABLED",
        }),
        text: vi.fn().mockResolvedValue(""),
      };

      const api = await import("@forge/api");
      const mockRequestJira = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(api.default.asApp).mockReturnValue({
        requestJira: mockRequestJira,
      } as never);

      const result = await importStatus(context);

      expect(result).toEqual({ status: ForgeImportStatus.READY });
    });

    it("should return result with status property", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: undefined,
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn().mockResolvedValue({
          status: "IDLE",
        }),
        text: vi.fn().mockResolvedValue(""),
      };

      const api = await import("@forge/api");
      const mockRequestJira = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(api.default.asApp).mockReturnValue({
        requestJira: mockRequestJira,
      } as never);

      const result = await importStatus(context);

      expect(result).toHaveProperty("status");
      expect(typeof result.status).toBe("string");
    });
  });

  describe("error handling - API failures", () => {
    it("should return NOT_CONFIGURED status when API call fails (safe default)", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: undefined,
      };

      // Mock API failure
      const api = await import("@forge/api");
      const mockRequestJira = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));
      vi.mocked(api.default.asApp).mockReturnValue({
        requestJira: mockRequestJira,
      } as never);

      const result = await importStatus(context);

      // Falls back to NOT_CONFIGURED (safe default) when API call fails
      expect(result).toEqual({ status: ForgeImportStatus.NOT_CONFIGURED });
    });

    it("should handle various network errors gracefully", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: undefined,
      };

      const networkErrors = [
        "Network error",
        "ECONNREFUSED",
        "ETIMEDOUT",
        "Socket hang up",
        "DNS lookup failed",
      ];

      for (const errorMsg of networkErrors) {
        vi.clearAllMocks();

        const api = await import("@forge/api");
        const mockRequestJira = vi.fn().mockRejectedValue(new Error(errorMsg));
        vi.mocked(api.default.asApp).mockReturnValue({
          requestJira: mockRequestJira,
        } as never);

        const result = await importStatus(context);

        expect(result).toEqual({ status: ForgeImportStatus.NOT_CONFIGURED });
      }
    });

    it("should return a valid Forge import status in all cases", async () => {
      const validStatuses = Object.values(ForgeImportStatus);
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: undefined,
      };

      // Mock API failure
      const api = await import("@forge/api");
      const mockRequestJira = vi
        .fn()
        .mockRejectedValue(new Error("Test error"));
      vi.mocked(api.default.asApp).mockReturnValue({
        requestJira: mockRequestJira,
      } as never);

      const result = await importStatus(context);

      expect(validStatuses).toContain(result.status);
    });

    it("should not throw when API call fails", async () => {
      const context: AssetsImportContext = {
        contextToken: "test-token",
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
        context: undefined,
      };

      const api = await import("@forge/api");
      const mockRequestJira = vi
        .fn()
        .mockRejectedValue(new Error("API is down"));
      vi.mocked(api.default.asApp).mockReturnValue({
        requestJira: mockRequestJira,
      } as never);

      // Should not throw
      await expect(importStatus(context)).resolves.toBeDefined();
    });
  });

  describe("terminal execution reconciliation", () => {
    const context: AssetsImportContext = {
      contextToken: "test-token",
      importId: "import-123",
      workspaceId: "workspace-456",
      schemaId: "schema-789",
      context: undefined,
    };

    const activeRunState = {
      executionId: "exec-1",
      controllerJobId: "job-1",
      cancelUrl: "/executions/exec-1/cancel",
      getExecutionStatusUrl: "/executions/exec-1",
      startedAt: "2026-07-25T00:00:00.000Z",
      state: "running" as const,
    };

    async function mockRequestJiraFor(executionStatusBody: unknown) {
      const api = await import("@forge/api");
      const mockRequestJira = vi.fn(async (endpoint: string) => {
        if (endpoint.includes("configstatus")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ status: "IDLE" }),
            text: async () => "",
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => executionStatusBody,
          text: async () => "",
        };
      });
      vi.mocked(api.default.asApp).mockReturnValue({
        requestJira: mockRequestJira,
      } as never);
      return mockRequestJira;
    }

    it("promotes a DONE execution status to a confirmed-done outcome with counts", async () => {
      const { getActiveRunState, saveLatestOutcome } = await import(
        "../../src/import-lifecycle/run-state"
      );
      vi.mocked(getActiveRunState).mockResolvedValueOnce(activeRunState);
      await mockRequestJiraFor({
        status: "DONE",
        progressResult: {
          entriesCreated: 5,
          entriesUpdated: 2,
          entriesFailed: 0,
          entriesProcessed: 7,
        },
      });

      await importStatus(context);

      expect(saveLatestOutcome).toHaveBeenCalledWith(
        "import-123",
        expect.objectContaining({
          outcome: "confirmed-done",
          recordedAt: expect.any(String),
          counts: {
            entriesCreated: 5,
            entriesUpdated: 2,
            entriesFailed: 0,
            entriesProcessed: 7,
          },
        }),
      );
    });

    it("promotes a CANCELLED execution status to a confirmed-cancelled outcome", async () => {
      const { getActiveRunState, saveLatestOutcome } = await import(
        "../../src/import-lifecycle/run-state"
      );
      vi.mocked(getActiveRunState).mockResolvedValueOnce(activeRunState);
      await mockRequestJiraFor({ status: "CANCELLED" });

      await importStatus(context);

      expect(saveLatestOutcome).toHaveBeenCalledWith(
        "import-123",
        expect.objectContaining({ outcome: "confirmed-cancelled" }),
      );
    });

    it("does not record an outcome for non-terminal execution status", async () => {
      const { getActiveRunState, saveLatestOutcome } = await import(
        "../../src/import-lifecycle/run-state"
      );
      vi.mocked(getActiveRunState).mockResolvedValueOnce(activeRunState);
      await mockRequestJiraFor({ status: "INGESTING" });

      await importStatus(context);

      expect(saveLatestOutcome).not.toHaveBeenCalled();
    });

    it("does not attempt reconciliation when there is no active run state", async () => {
      const { getActiveRunState, saveLatestOutcome } = await import(
        "../../src/import-lifecycle/run-state"
      );
      vi.mocked(getActiveRunState).mockResolvedValueOnce(null);
      const mockRequestJira = await mockRequestJiraFor({ status: "DONE" });

      await importStatus(context);

      expect(saveLatestOutcome).not.toHaveBeenCalled();
      expect(mockRequestJira).not.toHaveBeenCalledWith(
        expect.stringContaining("/executions/exec-1"),
        expect.any(Object),
      );
    });

    it("does not throw when the execution status lookup fails (best-effort)", async () => {
      const { getActiveRunState, saveLatestOutcome } = await import(
        "../../src/import-lifecycle/run-state"
      );
      vi.mocked(getActiveRunState).mockResolvedValueOnce(activeRunState);
      const api = await import("@forge/api");
      const configStatusMock = vi.fn(async (endpoint: string) => {
        if (endpoint.includes("configstatus")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ status: "IDLE" }),
            text: async () => "",
          };
        }
        throw new Error("network error");
      });
      vi.mocked(api.default.asApp).mockReturnValue({
        requestJira: configStatusMock,
      } as never);

      await expect(importStatus(context)).resolves.toEqual({
        status: ForgeImportStatus.READY,
      });
      expect(saveLatestOutcome).not.toHaveBeenCalled();
    });
  });

  describe("context validation", () => {
    it("should handle minimal context with required fields", async () => {
      const minimalContext: AssetsImportContext = {
        contextToken: "test-token",
        importId: "status-check-import",
        workspaceId: "workspace-1",
        schemaId: "schema-1",
        context: undefined,
      };

      // Mock API failure
      const api = await import("@forge/api");
      const mockRequestJira = vi
        .fn()
        .mockRejectedValue(new Error("Test error"));
      vi.mocked(api.default.asApp).mockReturnValue({
        requestJira: mockRequestJira,
      } as never);

      const result = await importStatus(minimalContext);

      // Falls back to NOT_CONFIGURED (safe default) when API call fails
      expect(result).toEqual({ status: ForgeImportStatus.NOT_CONFIGURED });
    });

    it("should work with real context from importStatus.json", async () => {
      const context = importStatusContext as unknown as AssetsImportContext;

      // Verify context has required fields
      expect(context.importId).toBeDefined();
      expect(context.workspaceId).toBeDefined();

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn().mockResolvedValue({
          status: "IDLE",
        }),
        text: vi.fn().mockResolvedValue(""),
      };

      const api = await import("@forge/api");
      const mockRequestJira = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(api.default.asApp).mockReturnValue({
        requestJira: mockRequestJira,
      } as never);

      const result = await importStatus(context);

      expect(result).toEqual({ status: ForgeImportStatus.READY });
    });
  });
});
