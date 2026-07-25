/**
 * Import Stop Lifecycle Function
 * Triggered when user cancels an active import in Assets UI
 */

import { kvs } from "@forge/kvs";
import { cancelExecution } from "../assets/import-client";
import type { AssetsImportContext, ImportResult } from "../assets/types";
import { logContext, logStructured } from "../forge/logging";
import { getJobIdStorageKey } from "../forge/storage";
import { controllerQueue } from "../resolvers/controller-resolver";

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
