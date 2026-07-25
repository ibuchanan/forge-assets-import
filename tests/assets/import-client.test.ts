/**
 * import-client Tests
 *
 * Validates the generic Assets Import REST client: response normalization
 * (especially execution ID extraction) and the request/response shape for
 * each Assets Import endpoint.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const requestJiraMock = vi.hoisted(() => vi.fn());

vi.mock("@forge/api", () => ({
  route: (strings: TemplateStringsArray, ...values: unknown[]) => {
    let result = strings[0];
    values.forEach((value, i) => {
      result += String(value) + strings[i + 1];
    });
    return result;
  },
  assumeTrustedRoute: (url: string) => url,
  default: {
    asApp: () => ({
      requestJira: requestJiraMock,
    }),
  },
}));

import {
  cancelExecution,
  cancelExecutionByUrl,
  getConfigStatus,
  getExecutionStatus,
  getExecutionStatusByUrl,
  getSchemaAndMapping,
  normalizeStartedExecution,
  startExecution,
  submitData,
  submitMapping,
  submitProgress,
} from "../../src/assets/import-client";

describe("normalizeStartedExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the id field directly when present", () => {
    const result = normalizeStartedExecution({
      id: "exec-from-id-field",
      links: {
        submitResults:
          "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-from-links/data",
        submitProgress:
          "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-from-links/progress",
        getExecutionStatus:
          "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-from-links",
        cancel:
          "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-from-links/cancel",
      },
    });

    expect(result.executionId).toBe("exec-from-id-field");
  });

  it("falls back to parsing the id out of links.submitResults when id is absent", () => {
    const result = normalizeStartedExecution({
      links: {
        submitResults:
          "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-from-links/data",
        submitProgress:
          "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-from-links/progress",
        getExecutionStatus:
          "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-from-links",
        cancel:
          "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-from-links/cancel",
      },
    });

    expect(result.executionId).toBe("exec-from-links");
  });

  it("throws when id is absent and submitResults has no path segment to parse", () => {
    expect(() =>
      normalizeStartedExecution({
        links: {
          submitResults: "",
          submitProgress: "",
          getExecutionStatus: "",
          cancel: "",
        },
      }),
    ).toThrow(/Failed to extract executionId/);
  });
});

describe("startExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POSTs to the executions endpoint and returns the normalized execution", async () => {
    requestJiraMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        links: {
          submitResults:
            "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-123/data",
          submitProgress:
            "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-123/progress",
          getExecutionStatus:
            "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-123",
          cancel:
            "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-123/cancel",
        },
      }),
    });

    const result = await startExecution("workspace-1", "import-1");

    expect(requestJiraMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions",
      ),
      { method: "POST" },
    );
    expect(result).toEqual({
      executionId: "exec-123",
      submitResultsUrl:
        "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-123/data",
      submitProgressUrl:
        "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-123/progress",
      getExecutionStatusUrl:
        "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-123",
      cancelUrl:
        "/jsm/assets/workspace/workspace-1/v1/importsource/import-1/executions/exec-123/cancel",
    });
  });

  it("throws when the executions endpoint responds with an error", async () => {
    requestJiraMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(startExecution("workspace-1", "import-1")).rejects.toThrow(
      /Failed to create import execution/,
    );
  });
});

describe("getConfigStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok with the status field from the response body", async () => {
    requestJiraMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
      json: async () => ({ status: "IDLE" }),
    });

    const result = await getConfigStatus("workspace-1", "import-1");

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe("IDLE");
  });

  it("returns an error result when the response is not ok", async () => {
    requestJiraMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "not found",
      json: async () => ({}),
    });

    const result = await getConfigStatus("workspace-1", "import-1");

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().status).toBe(404);
  });
});

describe("getExecutionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the parsed execution status on success", async () => {
    requestJiraMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "PROCESSING" }),
      text: async () => "",
    });

    const result = await getExecutionStatus(
      "workspace-1",
      "import-1",
      "exec-1",
    );

    expect(result).toEqual({ status: "PROCESSING" });
  });

  it("returns null when the execution is not found", async () => {
    requestJiraMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "not found",
    });

    const result = await getExecutionStatus(
      "workspace-1",
      "import-1",
      "exec-1",
    );

    expect(result).toBeNull();
  });
});

describe("getExecutionStatusByUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests the HATEOAS URL directly and returns the parsed status", async () => {
    requestJiraMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "DONE" }),
      text: async () => "",
    });

    const result = await getExecutionStatusByUrl(
      "https://api.atlassian.com/imports/status",
    );

    expect(requestJiraMock).toHaveBeenCalledWith(
      "/imports/status",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
    expect(result).toEqual({ status: "DONE" });
  });

  it("returns null when the execution is not found", async () => {
    requestJiraMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "not found",
    });

    const result = await getExecutionStatusByUrl(
      "https://api.atlassian.com/imports/status",
    );

    expect(result).toBeNull();
  });
});

describe("cancelExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a DELETE to the cancel endpoint", async () => {
    requestJiraMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    });

    await cancelExecution("workspace-1", "import-1", "exec-1");

    expect(requestJiraMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "/importsource/import-1/executions/exec-1/cancel",
      ),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("resolves without throwing when the cancel request fails", async () => {
    requestJiraMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "server error",
    });

    await expect(
      cancelExecution("workspace-1", "import-1", "exec-1"),
    ).resolves.toBeUndefined();
  });
});

describe("cancelExecutionByUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a DELETE to the normalized HATEOAS cancel URL", async () => {
    requestJiraMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    });

    await cancelExecutionByUrl(
      "https://api.atlassian.com/jsm/assets/workspace/ws/v1/importsource/import-1/executions/exec-1/cancel",
    );

    expect(requestJiraMock).toHaveBeenCalledWith(
      "/jsm/assets/workspace/ws/v1/importsource/import-1/executions/exec-1/cancel",
      expect.objectContaining({
        method: "DELETE",
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("resolves without throwing when the cancel request fails", async () => {
    requestJiraMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "server error",
    });

    await expect(
      cancelExecutionByUrl("/executions/exec-1/cancel"),
    ).resolves.toBeUndefined();
  });
});

describe("getSchemaAndMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok with the parsed schema-and-mapping body", async () => {
    const body = {
      schema: { objectSchema: { name: "Products", objectTypes: [] } },
      mapping: { objectTypeMappings: [] },
    };
    requestJiraMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
      json: async () => body,
    });

    const result = await getSchemaAndMapping("workspace-1", "import-1");

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(body);
  });

  it("returns an error result when the response is not ok", async () => {
    requestJiraMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "forbidden",
      json: async () => ({}),
    });

    const result = await getSchemaAndMapping("workspace-1", "import-1");

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().status).toBe(403);
  });
});

describe("submitMapping", () => {
  const mapping = {
    schema: { objectSchema: { name: "Products", objectTypes: [] } },
    mapping: { objectTypeMappings: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PUTs the mapping and returns ok on success", async () => {
    requestJiraMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
      json: async () => ({}),
    });

    const result = await submitMapping("workspace-1", "import-1", mapping);

    expect(requestJiraMock).toHaveBeenCalledWith(
      expect.stringContaining("/importsource/import-1/mapping"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify(mapping),
      }),
    );
    expect(result.isOk()).toBe(true);
  });

  it("returns an error result with the Assets validation detail on failure", async () => {
    requestJiraMock.mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      text: async () => "",
      json: async () => ({ message: "attribute mismatch" }),
    });

    const result = await submitMapping("workspace-1", "import-1", mapping);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().status).toBe(422);
  });
});

describe("submitProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PUTs the progress payload to the HATEOAS URL", async () => {
    requestJiraMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    });

    await submitProgress("https://api.atlassian.com/imports/progress", 60, 25);

    expect(requestJiraMock).toHaveBeenCalledWith(
      "/imports/progress",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ objects: { total: 60, processed: 25 } }),
      }),
    );
  });

  it("resolves without throwing when the request fails", async () => {
    requestJiraMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "server error",
    });

    await expect(
      submitProgress("https://api.atlassian.com/imports/progress", 60, 25),
    ).resolves.toBeUndefined();
  });
});

describe("submitData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POSTs the batch payload to the HATEOAS URL and returns ok on success", async () => {
    requestJiraMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
    });

    const products = [{ id: 1 }, { id: 2 }];
    const result = await submitData(
      "https://api.atlassian.com/imports/data",
      products,
      "batch-0-25",
      false,
    );

    expect(requestJiraMock).toHaveBeenCalledWith(
      "/imports/data",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          data: { products },
          clientGeneratedId: "batch-0-25",
          completed: false,
        }),
      }),
    );
    expect(result.isOk()).toBe(true);
  });

  it("returns an error result carrying the response status when the request fails", async () => {
    requestJiraMock.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "unavailable",
    });

    const result = await submitData(
      "https://api.atlassian.com/imports/data",
      [{ id: 1 }],
      "batch-0-25",
      true,
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().status).toBe(503);
  });
});
