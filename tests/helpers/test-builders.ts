/**
 * Test Builders and Utilities
 *
 * Reusable test utilities following Test Desiderata principles:
 * - Composable: Build complex test data from simple primitives
 * - Minimal Data: Only include required fields by default
 * - Easy to Write: Reduce boilerplate in tests
 * - Easy to Read: Clear, intention-revealing builders
 */

import type { AssetsImportContext } from "../../src/assets/types";

/**
 * Build a minimal AssetsImportContext with required fields only.
 * Use overrides to customize specific fields for test scenarios.
 *
 * @example
 * // Minimal context
 * const context = buildContext();
 *
 * // Override specific fields
 * const context = buildContext({ importId: "custom-id" });
 *
 * // Add full extension details
 * const context = buildContext({}, { withExtension: true });
 */
export function buildContext(
  overrides: Partial<AssetsImportContext> = {},
  options: {
    withExtension?: boolean;
    withExecutionId?: boolean;
  } = {},
): AssetsImportContext {
  const base: AssetsImportContext = {
    contextToken: "test-token",
    importId: "test-import-id",
    workspaceId: "test-workspace-id",
    schemaId: "test-schema-id",
    context: undefined,
  };

  // Add extension context if requested
  if (options.withExtension) {
    base.context = {
      accountId: "test-account",
      cloudId: "test-cloud",
      localId: "test-local",
      moduleKey: "test-module",
      extension: {
        importId: base.importId,
        workspaceId: base.workspaceId,
        schemaId: base.schemaId,
        type: "jiraServiceManagement:assetsImportType",
        ...(options.withExecutionId
          ? { executionId: "test-execution-id" }
          : {}),
      },
      userAccess: {
        enabled: true,
        hasAccess: true,
      },
    };
  }

  return {
    ...base,
    ...overrides,
  };
}

/**
 * Build a context with full extension details.
 * Convenience wrapper around buildContext.
 *
 * @example
 * const context = buildFullContext({ importId: "my-import" });
 */
export function buildFullContext(
  overrides: Partial<AssetsImportContext> = {},
): AssetsImportContext {
  return buildContext(overrides, {
    withExtension: true,
    withExecutionId: true,
  });
}

/**
 * Build a context specifically for testing validation errors.
 * Creates contexts with missing or invalid required fields.
 *
 * @example
 * const context = buildInvalidContext({ workspaceId: "" });
 * const context = buildInvalidContext({ importId: "" });
 */
export function buildInvalidContext(
  invalidFields: Partial<
    Pick<AssetsImportContext, "importId" | "workspaceId" | "schemaId">
  >,
): AssetsImportContext {
  return buildContext(invalidFields, { withExtension: true });
}

/**
 * Mock fetch responses for testing external API integrations.
 *
 * @example
 * // Mock successful response
 * global.fetch = mockFetch({ executionId: "exec-123" });
 *
 * // Mock error response
 * global.fetch = mockFetch(null, { ok: false, status: 404 });
 *
 * // Mock network error
 * global.fetch = mockFetch(null, { throwError: new Error("Network failed") });
 */
export function mockFetch(
  responseData: unknown = {},
  options: {
    ok?: boolean;
    status?: number;
    throwError?: Error;
  } = {},
): typeof fetch {
  return async () => {
    if (options.throwError) {
      throw options.throwError;
    }

    return {
      ok: options.ok ?? true,
      status: options.status ?? 200,
      json: async () => responseData,
      text: async () => JSON.stringify(responseData),
    } as Response;
  };
}

/**
 * Create a mock Assets API response for the execution endpoint.
 *
 * @example
 * const response = buildExecutionResponse("exec-123");
 * global.fetch = mockFetch(response);
 */
export function buildExecutionResponse(executionId: string) {
  return {
    id: executionId,
    status: "RUNNING",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a mock Assets API response for the configuration status endpoint.
 *
 * @example
 * const response = buildConfigStatusResponse("IDLE");
 * global.fetch = mockFetch(response);
 */
export function buildConfigStatusResponse(
  status: "IDLE" | "RUNNING" | "COMPLETED" | "FAILED" = "IDLE",
) {
  return {
    configurationStatus: status,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Build a queue work item for controller queue.
 * Represents the initial work item pushed to the controller queue from startImport.
 *
 * @example
 * const workItem = buildControllerWorkItem({ executionId: "exec-123" });
 */
export function buildControllerWorkItem(
  overrides: {
    executionId?: string;
    workspaceId?: string;
    importId?: string;
    schemaId?: string;
    cloudId?: string;
    contextToken?: string;
  } = {},
) {
  return {
    executionId: overrides.executionId ?? "test-execution-id",
    workspaceId: overrides.workspaceId ?? "test-workspace-id",
    importId: overrides.importId ?? "test-import-id",
    schemaId: overrides.schemaId ?? "test-schema-id",
    cloudId: overrides.cloudId ?? "test-cloud-id",
    contextToken: overrides.contextToken ?? "test-context-token",
  };
}

/**
 * Build a queue work item for worker queue.
 * Represents work items pushed from controller to worker queue for batch processing.
 *
 * @example
 * const workItem = buildWorkerWorkItem({ batch: 1, offset: 0 });
 */
export function buildWorkerWorkItem(
  overrides: {
    executionId?: string;
    workspaceId?: string;
    importId?: string;
    schemaId?: string;
    cloudId?: string;
    contextToken?: string;
    batch?: number;
    offset?: number;
    batchSize?: number;
  } = {},
) {
  return {
    executionId: overrides.executionId ?? "test-execution-id",
    workspaceId: overrides.workspaceId ?? "test-workspace-id",
    importId: overrides.importId ?? "test-import-id",
    schemaId: overrides.schemaId ?? "test-schema-id",
    cloudId: overrides.cloudId ?? "test-cloud-id",
    contextToken: overrides.contextToken ?? "test-context-token",
    batch: overrides.batch ?? 1,
    offset: overrides.offset ?? 0,
    batchSize: overrides.batchSize ?? 100,
  };
}

/**
 * Build a mapping configuration for testing.
 * Minimal mapping that satisfies the Assets API contract.
 *
 * @example
 * const mapping = buildMappingConfiguration();
 */
export function buildMappingConfiguration(
  overrides: {
    objectTypeId?: string;
    attributes?: Array<{ name: string; selector: string }>;
  } = {},
) {
  return {
    objectTypeId: overrides.objectTypeId ?? "1",
    attributes: overrides.attributes ?? [
      { name: "Name", selector: "$.name" },
      { name: "ID", selector: "$.id" },
    ],
  };
}

/**
 * Build external data items for testing.
 * Represents data fetched from external source.
 *
 * @example
 * const data = buildExternalDataItems(3);
 */
export function buildExternalDataItems(count: number = 1) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Test Item ${i + 1}`,
    description: `Description for item ${i + 1}`,
  }));
}
