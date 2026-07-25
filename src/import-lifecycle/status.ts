/**
 * Import Status Lifecycle Function
 * Executed when Assets UI loads to display the status of the import
 */

import api, { assumeTrustedRoute, route } from "@forge/api";
import {
  type AssetsImportContext,
  ForgeImportStatus,
  ImportConfigurationStatus,
  type ImportStatusResult,
} from "../assets/types";
import { toRelativePath } from "../forge/api-path";
import { logStructured } from "../forge/logging";
import {
  err,
  ok,
  problemDetails,
  type ProblemDetails,
  type Result,
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

export function mapConfigurationStatus(
  configurationStatus: ImportConfigurationStatus | string | undefined,
): ForgeImportStatus {
  // Map each documented API status to appropriate Forge status
  // TypeScript ensures we handle all enum values
  switch (configurationStatus) {
    case ImportConfigurationStatus.IDLE:
    case ImportConfigurationStatus.RUNNING:
    case ImportConfigurationStatus.DISABLED:
      return ForgeImportStatus.READY;
    case ImportConfigurationStatus.MISSING_MAPPING:
      return ForgeImportStatus.NOT_CONFIGURED;
    default:
      // Handle undefined, null, empty string, or any future unknown values
      return ForgeImportStatus.NOT_CONFIGURED;
  }
}

async function fetchConfigurationStatus(
  workspaceId: string,
  importId: string,
): Promise<Result<string | undefined, ProblemDetails>> {
  try {
    const endpoint = route`/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/configstatus`;
    const statusResponse = await api.asApp().requestJira(endpoint, {
      headers: {
        Accept: "application/json",
      },
    });
    // Validate HTTP response (returns ResultAsync, need to await)
    const validationResult = await validateHttpResponse(
      statusResponse,
      "fetch import configuration status",
    );
    if (validationResult.isErr()) {
      // validationResult is Err<response, ProblemDetails>, extract the error
      return err(validationResult.error);
    }
    // Extract status from response
    const statusData = (await statusResponse.json()) as Record<string, unknown>;
    // Note: API returns "status" field, not "configurationStatus"
    const configurationStatus = statusData["status"] as string | undefined;

    return ok(configurationStatus);
  } catch (error) {
    // Handle network errors, timeouts, etc.
    const errorMessage = error instanceof Error ? error.message : String(error);
    return err(
      problemDetails(
        500,
        `Failed to fetch configuration status: ${errorMessage}`,
      ),
    );
  }
}

/**
 * Get the status of an active import execution.
 *
 * This queries the execution status endpoint to check if the import is:
 * - INGESTING: Still accepting data chunks
 * - PROCESSING: Processing submitted data
 * - DONE: Import complete
 * - CANCELLED: Import was cancelled
 *
 * @param workspaceId - The Assets workspace ID
 * @param importId - The import source ID
 * @param executionId - The execution ID to check
 * @returns The execution status, or null if not found
 */
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

    const executionStatus = (await response.json()) as ExecutionStatus;

    return executionStatus;
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

/**
 * Get the status of an import execution using a HATEOAS URL.
 *
 * This is a convenience wrapper around getExecutionStatus that accepts
 * the getExecutionStatusUrl from the HATEOAS response.
 *
 * @param getExecutionStatusUrl - The HATEOAS URL for checking execution status
 * @returns The execution status, or null if not found
 */
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

    const executionStatus = (await response.json()) as ExecutionStatus;

    return executionStatus;
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

export async function importStatus(
  context: AssetsImportContext,
): Promise<ImportStatusResult> {
  // logContext(context, "importStatus");
  const { importId, workspaceId } = context;
  const statusResult = await fetchConfigurationStatus(workspaceId, importId);
  if (statusResult.isErr()) {
    logStructured("debug", "importStatus", "Could not query status", {
      importsourceId: importId,
      workspaceId,
      error: statusResult.error.detail,
    });
    return {
      status: ForgeImportStatus.NOT_CONFIGURED,
    };
  }
  const configurationStatus = statusResult.value;
  const status = mapConfigurationStatus(configurationStatus);
  return { status };
}
