/**
 * Assets Import REST client
 *
 * Generic, product-agnostic wrappers around the Assets Import REST API:
 * start/cancel an execution, check configuration/execution status,
 * fetch schema-and-mapping, and submit mapping/progress/data.
 */

import api, { assumeTrustedRoute, route } from "@forge/api";
import { toRelativePath } from "../forge/api-path";
import { logStructured } from "../forge/logging";
import {
  err,
  errAsync,
  extractOrCreateProblemDetails,
  ok,
  okAsync,
  type ProblemDetails,
  problemDetails,
  type Result,
  ResultAsync,
  StandardError,
  validateHttpResponse,
} from "../util/error";

/**
 * Execution status as returned by Assets API
 */
export interface ExecutionStatus {
  status: "INGESTING" | "PROCESSING" | "DONE" | "CANCELLED";
  progressResult?: {
    type: string;
    id: number;
    started: string;
    ended?: string;
    objectSchemaId: number;
    result: string;
    status: string;
    entriesCreated: number;
    entriesUpdated: number;
    entriesFailed: number;
    entriesProcessed: number;
  };
}

/**
 * Schema and Mapping response from Assets Import API
 */
export interface SchemaAndMappingResponse {
  schema?: {
    objectSchema?: {
      name?: string;
      description?: string;
      objectTypes?: Array<{
        externalId?: string;
        name: string;
        description?: string;
        attributes?: Array<{
          externalId?: string;
          name: string;
          description?: string;
          type?: string;
          minimumCardinality?: number;
          maximumCardinality?: number;
          unique?: boolean;
        }>;
      }>;
    };
  };
  mapping?: {
    objectTypeMappings?: Array<{
      objectTypeExternalId?: string;
      objectTypeName?: string;
      selector?: string;
      description?: string;
      attributesMapping?: Array<{
        attributeExternalId?: string;
        attributeName?: string;
        attributeLocators?: string[];
        externalIdPart?: boolean;
      }>;
    }>;
  };
}

/**
 * Mapping payload accepted by the Assets Import mapping endpoint
 */
export interface MappingPayload {
  schema?: unknown;
  mapping: {
    objectTypeMappings: Array<{
      objectTypeExternalId: string;
      objectTypeName: string;
      selector: string;
      description: string;
      attributesMapping: Array<{
        attributeExternalId: string;
        attributeName: string;
        attributeLocators: string[];
        externalIdPart?: boolean;
      }>;
    }>;
  };
}

export interface StartedExecution {
  executionId: string;
  submitResultsUrl: string;
  submitProgressUrl: string;
  getExecutionStatusUrl: string;
  cancelUrl: string;
}

function extractExecutionIdFromUrl(submitResultsUrl: string): string {
  const urlParts = submitResultsUrl.split("/");
  // The execution ID is located before '/data' in the URL path
  const executionId = urlParts[urlParts.length - 2];
  if (!executionId) {
    throw new Error(
      `Failed to extract executionId from URL: ${submitResultsUrl}`,
    );
  }
  return executionId;
}

interface StartedExecutionLinks {
  submitResults: string;
  submitProgress: string;
  getExecutionStatus: string;
  cancel: string;
}

export function normalizeStartedExecution(
  body: Record<string, unknown>,
): StartedExecution {
  const links = body["links"] as StartedExecutionLinks;
  const executionId =
    (body["id"] as string | undefined) ??
    extractExecutionIdFromUrl(links.submitResults);

  return {
    executionId,
    submitResultsUrl: links.submitResults,
    submitProgressUrl: links.submitProgress,
    getExecutionStatusUrl: links.getExecutionStatus,
    cancelUrl: links.cancel,
  };
}

export async function startExecution(
  workspaceId: string,
  importId: string,
): Promise<StartedExecution> {
  const endpoint = route`/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/executions`;
  const response = await api.asApp().requestJira(endpoint, {
    method: "POST",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create import execution: ${response.status} ${errorText}`,
    );
  }

  const body = await response.json();
  return normalizeStartedExecution(body);
}

export async function getConfigStatus(
  workspaceId: string,
  importId: string,
): Promise<Result<string | undefined, ProblemDetails>> {
  try {
    const endpoint = route`/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/configstatus`;
    const response = await api.asApp().requestJira(endpoint, {
      headers: {
        Accept: "application/json",
      },
    });

    const validationResult = await validateHttpResponse(
      response,
      "fetch import configuration status",
    );
    if (validationResult.isErr()) {
      return err(validationResult.error);
    }

    const statusData = (await response.json()) as Record<string, unknown>;
    return ok(statusData["status"] as string | undefined);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return err(
      problemDetails(
        500,
        `Failed to fetch configuration status: ${errorMessage}`,
      ),
    );
  }
}

export async function getExecutionStatus(
  workspaceId: string,
  importId: string,
  executionId: string,
): Promise<ExecutionStatus | null> {
  try {
    const endpoint = route`/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/executions/${executionId}`;

    const response = await api.asApp().requestJira(endpoint, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }

      const errorText = await response.text();
      logStructured(
        "debug",
        "getExecutionStatus",
        "Failed to get execution status",
        {
          executionId,
          importsourceId: importId,
          workspaceId,
          statusCode: response.status,
          error: errorText,
          api: {
            method: "GET",
            path: `/importsource/${importId}/executions/${executionId}`,
          },
        },
      );
      return null;
    }

    return (await response.json()) as ExecutionStatus;
  } catch (error) {
    logStructured(
      "debug",
      "getExecutionStatus",
      "Error checking execution status",
      {
        executionId,
        importsourceId: importId,
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return null;
  }
}

export async function cancelExecution(
  workspaceId: string,
  importId: string,
  executionId: string,
): Promise<void> {
  try {
    const endpoint = route`/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/executions/${executionId}/cancel`;

    const response = await api.asApp().requestJira(endpoint, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logStructured("warn", "cancelExecution", "Failed to cancel execution", {
        importsourceId: importId,
        workspaceId,
        executionId,
        statusCode: response.status,
        error: errorText,
        api: {
          method: "DELETE",
          path: `/importsource/${importId}/executions/${executionId}/cancel`,
        },
      });
      return;
    }

    logStructured("info", "cancelExecution", "Cancelled execution", {
      importsourceId: importId,
      workspaceId,
      executionId,
      api: {
        method: "DELETE",
        path: `/importsource/${importId}/executions/${executionId}/cancel`,
      },
    });
  } catch (error) {
    logStructured("warn", "cancelExecution", "Error cancelling execution", {
      importsourceId: importId,
      workspaceId,
      executionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function getSchemaAndMapping(
  workspaceId: string,
  importId: string,
): ResultAsync<SchemaAndMappingResponse, ProblemDetails> {
  const endpoint = route`/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/schema-and-mapping`;

  return ResultAsync.fromPromise(
    api.asApp().requestJira(endpoint, {
      headers: {
        Accept: "application/json",
      },
    }),
    (error: unknown): ProblemDetails =>
      extractOrCreateProblemDetails(error, "fetching schema and mapping"),
  )
    .andThen((response) =>
      validateHttpResponse(response, "fetch schema and mapping"),
    )
    .andThen((validatedResponse) =>
      ResultAsync.fromPromise(
        validatedResponse.json() as Promise<SchemaAndMappingResponse>,
        (error: unknown): ProblemDetails =>
          extractOrCreateProblemDetails(
            error,
            "parsing schema and mapping JSON",
          ),
      ),
    );
}

export function submitMapping(
  workspaceId: string,
  importId: string,
  mapping: MappingPayload,
): ResultAsync<true, ProblemDetails> {
  const endpoint = route`/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/mapping`;

  return ResultAsync.fromPromise(
    api.asApp().requestJira(endpoint, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mapping),
    }),
    (error: unknown): ProblemDetails =>
      extractOrCreateProblemDetails(error, "submitting mapping"),
  ).andThen((response) => {
    if (response.ok) {
      return okAsync(true as const);
    }

    return ResultAsync.fromPromise(
      (async () => {
        try {
          const errorData = await response.json();
          return `${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`;
        } catch {
          const errorText = await response.text();
          return `${response.status} ${response.statusText} - ${errorText}`;
        }
      })(),
      (error: unknown): ProblemDetails =>
        extractOrCreateProblemDetails(error, "parsing mapping response"),
    ).andThen((detail) =>
      errAsync(
        StandardError.getOrDefault(response.status)
          .error(`Failed to submit mapping: ${detail}`)
          ._unsafeUnwrapErr(),
      ),
    );
  });
}

export async function submitProgress(
  submitProgressUrl: string,
  total: number,
  processed: number,
): Promise<void> {
  try {
    const response = await api
      .asApp()
      .requestJira(assumeTrustedRoute(toRelativePath(submitProgressUrl)), {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          objects: {
            total,
            processed,
          },
        }),
      });

    if (!response.ok) {
      const errorText = await response.text();
      logStructured("warn", "submitProgress", "Failed to report progress", {
        processed,
        total,
        statusCode: response.status,
        error: errorText,
        api: { method: "PUT", path: "/progress" },
      });
    }
  } catch (error) {
    logStructured("warn", "submitProgress", "Error reporting progress", {
      processed,
      total,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function submitData(
  submitResultsUrl: string,
  products: Array<Record<string, unknown>>,
  clientGeneratedId: string,
  completed: boolean,
): ResultAsync<true, ProblemDetails> {
  const payload = {
    data: {
      products,
    },
    clientGeneratedId,
    completed,
  };

  return ResultAsync.fromPromise(
    api
      .asApp()
      .requestJira(assumeTrustedRoute(toRelativePath(submitResultsUrl)), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    (error: unknown): ProblemDetails =>
      extractOrCreateProblemDetails(error, "submitting import data"),
  )
    .andThen((response) => validateHttpResponse(response, "submit import data"))
    .map(() => true as const);
}

export async function getExecutionStatusByUrl(
  getExecutionStatusUrl: string,
): Promise<ExecutionStatus | null> {
  try {
    const response = await api
      .asApp()
      .requestJira(assumeTrustedRoute(toRelativePath(getExecutionStatusUrl)), {
        headers: {
          Accept: "application/json",
        },
      });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }

      const errorText = await response.text();
      logStructured(
        "debug",
        "getExecutionStatusByUrl",
        "Failed to get execution status",
        {
          statusCode: response.status,
          url: getExecutionStatusUrl,
          error: errorText,
        },
      );
      return null;
    }

    return (await response.json()) as ExecutionStatus;
  } catch (error) {
    logStructured(
      "debug",
      "getExecutionStatusByUrl",
      "Error checking execution status",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return null;
  }
}
