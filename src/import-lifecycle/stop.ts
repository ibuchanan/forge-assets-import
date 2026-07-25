/**
 * Import Stop Lifecycle Function
 * Triggered when user cancels an active import in Assets UI
 */

import { cancelExecution, cancelExecutionByUrl } from "../assets/import-client";
import type { AssetsImportContext, ImportResult } from "../assets/types";
import { logContext, logStructured } from "../forge/logging";
import { controllerQueue } from "../resolvers/controller-resolver";
import { clearActiveRunState, getActiveRunState } from "./run-state";

export async function stopImport(
  context: AssetsImportContext,
): Promise<ImportResult> {
  logContext(context, "stopImport");
  const { importId, workspaceId } = context;

  const activeRunState = await getActiveRunState(importId);

  if (activeRunState) {
    await cancelExecutionByUrl(activeRunState.cancelUrl);

    try {
      const jobProgress = controllerQueue.getJob(
        activeRunState.controllerJobId,
      );
      await jobProgress.cancel();
    } catch (error) {
      logStructured("warn", "stopImport", "Failed to cancel job", {
        importsourceId: importId,
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await clearActiveRunState(importId);

    logStructured("info", "stopImport", "Import stopped", {
      importsourceId: importId,
      workspaceId,
      jobCancelled: true,
      executionCancelled: true,
      executionId: activeRunState.executionId,
    });

    return {
      result: "stop import",
    };
  }

  // No stored active run state - fall back to reconstructing the cancel
  // request from context.extension, if available.
  const executionId = context.context?.extension?.executionId;

  if (executionId && workspaceId) {
    await cancelExecution(workspaceId, importId, executionId);
  }

  logStructured("info", "stopImport", "Import stopped", {
    importsourceId: importId,
    workspaceId,
    jobCancelled: false,
    executionCancelled: !!executionId,
    executionId,
  });

  return {
    result: "stop import",
  };
}
