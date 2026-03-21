/**
 * Lifecycle Extension Point Tests: onDeleteImport
 *
 * Validates the `onDeleteImport` lifecycle handler for the Assets Import Type module.
 *
 * @see {@link https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-service-management-assets-import-type/|jiraServiceManagement:assetsImportType Module}
 * @see {@link https://developer.atlassian.com/platform/forge/assets-import-app/|Assets Import App Guide}
 *
 * Local reference: docs/forge/jira-service-management-assets-import-type.md
 *
 * Uses test builders from tests/helpers/test-builders.ts for:
 * - Minimal data (only required fields)
 * - Composability (easy to customize)
 * - Readability (clear test intent)
 *
 * Behaviors under test:
 * 1. Accepts context with minimal required fields
 * 2. Returns { result: "on delete import" }
 * 3. Handles cleanup of transient state (currently none needed)
 * 4. Handles context correctly
 */

import { describe, expect, it } from "vitest";
import type { AssetsImportContext } from "../../src/assets/types";
import { onDeleteImport } from "../../src/import-lifecycle/delete";
// Load test context data for integration testing
import onDeleteContext from "../data/context/onDelete.json";
import { buildContext, buildFullContext } from "../helpers/test-builders";

describe("onDeleteImport - Lifecycle Extension Point", () => {
  describe("context acceptance", () => {
    it("should handle import deletion successfully", async () => {
      const context = onDeleteContext as unknown as AssetsImportContext;

      const result = await onDeleteImport(context);

      expect(result).toEqual({ result: "on delete import" });
    });

    it("should accept minimal context with required fields", async () => {
      const context = buildContext();

      const result = await onDeleteImport(context);

      expect(result).toEqual({ result: "on delete import" });
    });

    it("should accept context with full extension details", async () => {
      const context = buildFullContext();

      const result = await onDeleteImport(context);

      expect(result).toEqual({ result: "on delete import" });
    });
  });

  describe("return value", () => {
    it("should return result object with 'on delete import' message", async () => {
      const context = onDeleteContext as unknown as AssetsImportContext;

      const result = await onDeleteImport(context);

      expect(result.result).toBe("on delete import");
    });

    it("should return correct result structure", async () => {
      const context = buildContext();

      const result = await onDeleteImport(context);

      expect(result).toHaveProperty("result");
      expect(typeof result.result).toBe("string");
      expect(result).toEqual({ result: "on delete import" });
    });
  });

  describe("cleanup behavior", () => {
    it("should complete successfully without errors", async () => {
      const context = buildContext({
        importId: "import-to-delete",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
      });

      // Should not throw - cleanup is successful
      await expect(onDeleteImport(context)).resolves.toBeDefined();
    });

    it("should handle deletion when no state exists", async () => {
      const context = buildContext({
        importId: "never-started-import",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
      });

      // Per implementation: "No cleanup needed - all state is transient"
      const result = await onDeleteImport(context);

      expect(result).toEqual({ result: "on delete import" });
    });

    it("should handle deletion for import with execution context", async () => {
      const context = buildFullContext({
        importId: "import-123",
        workspaceId: "workspace-456",
        schemaId: "schema-789",
      });

      const result = await onDeleteImport(context);

      expect(result).toEqual({ result: "on delete import" });
    });
  });
});
