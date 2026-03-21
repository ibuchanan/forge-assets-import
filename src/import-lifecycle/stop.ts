/**
 * Import Stop Lifecycle Function
 * Triggered when user cancels an active import in Assets UI
 */

import api, { route } from "@forge/api";
import { kvs } from "@forge/kvs";
import type { AssetsImportContext, ImportResult } from "../assets/types";
import { logContext, logStructured } from "../forge/logging";
import { controllerQueue } from "../resolvers/controller-resolver";

/**
 * Storage key for tracking the active job ID for an import
 */
function getJobIdStorageKey(importId: string): string {
  return `import:${importId}:jobId`;
}

/**
 * Cancel an active import execution via the Assets API.
 *
 * This calls the cancel endpoint to stop the import and transition
 * the execution to CANCELLED state.
 *
 * @param workspaceId - The Assets workspace ID
 * @param importId - The import source ID
 * @param executionId - The execution ID to cancel
 */
async function cancelExecution(
  workspaceId: string,
  importId: string,
  executionId: string,
): Promise<void> {
  try {
    // Note: We don't have the cancel URL from HATEOAS here because stop lifecycle
    // doesn't receive it. We have to construct it from the context.
    const cancelEndpoint = route`/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/executions/${executionId}/cancel`;

    const response = await api.asApp().requestJira(cancelEndpoint, {
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
        api: {
          method: "DELETE",
          path: `/importsource/${importId}/executions/${executionId}/cancel`,
        },
      });
      // Don't throw - cancellation is best-effort
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
    // Don't throw - allow the lifecycle to complete even if cancellation fails
  }
}

export async function stopImport(
  context: AssetsImportContext,
): Promise<ImportResult> {
  logContext(context, "stopImport");
  const { importId, workspaceId } = context;

  // Check if there's an active execution to cancel
  // The context may include executionId in the extension object
  const executionId = context.context?.extension?.executionId;

  if (executionId && workspaceId) {
    await cancelExecution(workspaceId, importId, executionId);
  }

  // Cancel the queued jobs to prevent pending events from being processed
  try {
    const jobId = await kvs.get(getJobIdStorageKey(importId));
    if (jobId) {
      const jobProgress = controllerQueue.getJob(jobId as string);
      await jobProgress.cancel();
      await kvs.delete(getJobIdStorageKey(importId));
      logStructured("info", "stopImport", "Import stopped", {
        importsourceId: importId,
        workspaceId,
        jobCancelled: true,
        executionCancelled: !!executionId,
        executionId,
      });
    } else {
      logStructured("info", "stopImport", "Import stopped", {
        importsourceId: importId,
        workspaceId,
        jobCancelled: false,
        executionCancelled: !!executionId,
        executionId,
      });
    }
  } catch (error) {
    logStructured("warn", "stopImport", "Failed to cancel job", {
      importsourceId: importId,
      workspaceId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't re-throw - we still want to complete the lifecycle even if job cancellation fails
  }

  return {
    result: "stop import",
  };
}
