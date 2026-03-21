/**
 * Mock Factories for Common Test Patterns
 *
 * Shared factories for creating mock implementations that follow Test Desiderata principles:
 * - Composable: Mix and match factories to build complex mocks
 * - Reusable: Use across different test suites
 * - Predictable: Consistent mock behavior across all tests
 * - Type-safe: Full TypeScript support
 */

import { vi } from "vitest";

/**
 * Create a mock for @forge/api with asUser() and asApp() methods.
 * Returns requestJira and requestConfluence methods.
 *
 * @example
 * const { api, requestJira, asUser } = createMockForgeApi();
 * expect(asUser).toHaveBeenCalled();
 * expect(requestJira).toHaveBeenCalledWith("/rest/api/2/issue");
 */
export function createMockForgeApi() {
  const requestJira = vi.fn().mockResolvedValue({
    status: 200,
    json: async () => ({ id: "ISSUE-123" }),
  });

  const requestConfluence = vi.fn().mockResolvedValue({
    status: 200,
    json: async () => ({ id: "page-123" }),
  });

  const asUser = vi.fn(() => ({
    requestJira,
    requestConfluence,
  }));

  const asApp = vi.fn(() => ({
    requestJira,
    requestConfluence,
  }));

  return {
    api: { asUser, asApp },
    asUser,
    asApp,
    requestJira,
    requestConfluence,
  };
}

/**
 * Create a mock for Assets REST API responses.
 * Returns configurable mock for execution and status endpoints.
 *
 * @example
 * const { mockExecution, mockStatus } = createMockAssetsApi();
 * const exec = mockExecution.mockResolvedValueOnce({ id: "exec-1" });
 */
export function createMockAssetsApi() {
  const mockExecution = vi.fn().mockResolvedValue({
    id: "test-execution-id",
    status: "RUNNING",
    createdAt: new Date().toISOString(),
  });

  const mockStatus = vi.fn().mockResolvedValue({
    configurationStatus: "IDLE",
    lastUpdated: new Date().toISOString(),
  });

  return {
    mockExecution,
    mockStatus,
  };
}

/**
 * Create a mock for queue operations.
 * Returns push, delete, and get methods.
 *
 * @example
 * const { push, mockQueue } = createMockQueue();
 * await mockQueue.push("work-item");
 * expect(push).toHaveBeenCalledWith("work-item");
 */
export function createMockQueue() {
  const push = vi.fn().mockResolvedValue(undefined);
  const deleteMessage = vi.fn().mockResolvedValue(undefined);
  const get = vi.fn().mockResolvedValue(null);

  return {
    push,
    delete: deleteMessage,
    get,
    mockQueue: { push, delete: deleteMessage, get },
  };
}

/**
 * Create a mock for asset schema operations.
 * Returns fetch, create, and update methods.
 *
 * @example
 * const { schema, fetchObjectType } = createMockAssetSchema();
 * const objectType = await fetchObjectType("1");
 */
export function createMockAssetSchema() {
  const fetchObjectType = vi.fn().mockResolvedValue({
    id: "1",
    name: "Test Object Type",
    attributes: [],
  });

  const fetchObjectSchema = vi.fn().mockResolvedValue({
    id: "schema-1",
    name: "Test Schema",
    objectTypes: [],
  });

  const createObject = vi.fn().mockResolvedValue({
    id: "obj-1",
    objectTypeId: "1",
  });

  return {
    fetchObjectType,
    fetchObjectSchema,
    createObject,
    schema: {
      fetchObjectType,
      fetchObjectSchema,
      createObject,
    },
  };
}

/**
 * Create a mock requestJira for lifecycle tests.
 * Handles Assets API responses with proper HATEOAS links.
 *
 * @example
 * const mockRequestJira = createMockRequestJiraForLifecycle();
 * // Use in vi.mock("@forge/api")
 *
 * @example
 * // Customize for specific test
 * const mockRequestJira = createMockRequestJiraForLifecycle({
 *   executionId: "custom-exec-id"
 * });
 */
export function createMockRequestJiraForLifecycle(options?: {
  executionId?: string;
  workspaceId?: string;
  importId?: string;
}) {
  const executionId = options?.executionId ?? "exec-test-id-123";
  const workspaceId = options?.workspaceId ?? "workspace-123";
  const importId = options?.importId ?? "import-123";

  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      links: {
        submitResults: `/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/executions/${executionId}/data`,
        submitProgress: `/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/executions/${executionId}/progress`,
        getExecutionStatus: `/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/executions/${executionId}`,
        cancel: `/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/executions/${executionId}/cancel`,
      },
    }),
    text: async () => "",
  });
}

/**
 * Create a mock for @forge/api module suitable for vi.mock().
 * Returns the complete module mock with route and asApp helpers.
 *
 * @example
 * const mockRequestJira = vi.fn();
 * vi.mock("@forge/api", () => createForgeApiModuleMock(mockRequestJira));
 *
 * @example
 * // Use the helper to create both
 * const { mockRequestJira, forgeMock } = createLifecycleForgeApiMock();
 * vi.mock("@forge/api", () => forgeMock);
 */
export function createForgeApiModuleMock(
  mockRequestJira: ReturnType<typeof vi.fn>,
) {
  return {
    route: (strings: TemplateStringsArray, ...values: unknown[]) => {
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
  };
}

/**
 * Create complete Forge API mock setup for lifecycle tests.
 * Returns both the mock requestJira and the module mock.
 *
 * @example
 * const { mockRequestJira, forgeMock } = createLifecycleForgeApiMock();
 * vi.mock("@forge/api", () => forgeMock);
 * // Now you can control mockRequestJira in tests
 * mockRequestJira.mockResolvedValueOnce({...});
 */
export function createLifecycleForgeApiMock(options?: {
  executionId?: string;
  workspaceId?: string;
  importId?: string;
}) {
  const mockRequestJira = createMockRequestJiraForLifecycle(options);
  const forgeMock = createForgeApiModuleMock(mockRequestJira);

  return {
    mockRequestJira,
    forgeMock,
  };
}

/**
 * Create a mock for @forge/kvs module suitable for vi.mock().
 *
 * @example
 * vi.mock("@forge/kvs", () => createKvsModuleMock());
 */
export function createKvsModuleMock() {
  return {
    kvs: {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
}

/**
 * Create a mock for controller queue module suitable for vi.mock().
 *
 * @example
 * const { push, queueMock } = createControllerQueueMock();
 * vi.mock("../../src/resolvers/controller-resolver", () => queueMock);
 * expect(push).toHaveBeenCalledWith({...});
 */
export function createControllerQueueMock(jobId = "mock-job-id-123") {
  const push = vi.fn().mockResolvedValue({ jobId });
  const mockJobProgress = {
    cancel: vi.fn().mockResolvedValue(undefined),
  };
  const getJob = vi.fn().mockReturnValue(mockJobProgress);

  return {
    push,
    getJob,
    mockJobProgress,
    queueMock: {
      controllerQueue: {
        push,
        getJob,
      },
    },
  };
}

/**
 * Create a complete mock context for lifecycle handlers.
 * Includes Forge API, Assets API, and Queue mocks.
 *
 * @example
 * const mocks = createCompleteMockContext();
 * // All mocks ready to use
 * expect(mocks.api.asUser).toHaveBeenCalled();
 */
export function createCompleteMockContext() {
  const forgeApi = createMockForgeApi();
  const assetsApi = createMockAssetsApi();
  const queue = createMockQueue();
  const schema = createMockAssetSchema();

  return {
    api: forgeApi.api,
    requestJira: forgeApi.requestJira,
    requestConfluence: forgeApi.requestConfluence,
    asUser: forgeApi.asUser,
    asApp: forgeApi.asApp,
    mockExecution: assetsApi.mockExecution,
    mockStatus: assetsApi.mockStatus,
    queuePush: queue.push,
    queueDelete: queue.delete,
    queueGet: queue.get,
    fetchObjectType: schema.fetchObjectType,
    fetchObjectSchema: schema.fetchObjectSchema,
    createObject: schema.createObject,
    // Helpers to reset all mocks
    clearAllMocks: () => {
      forgeApi.asUser.mockClear();
      forgeApi.asApp.mockClear();
      forgeApi.requestJira.mockClear();
      forgeApi.requestConfluence.mockClear();
      assetsApi.mockExecution.mockClear();
      assetsApi.mockStatus.mockClear();
      queue.push.mockClear();
      queue.deleteMessage.mockClear();
      queue.get.mockClear();
      schema.fetchObjectType.mockClear();
      schema.fetchObjectSchema.mockClear();
      schema.createObject.mockClear();
    },
  };
}
