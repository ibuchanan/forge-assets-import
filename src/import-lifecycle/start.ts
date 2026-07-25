/**
 * Import Start Lifecycle Function
 * Triggered when user clicks "Import data" button in Assets UI
 */

/**
 * Import Start Lifecycle Function
 * Triggered when user clicks "Import data" button in Assets UI
 */

import type { PushResult } from "@forge/events";
import { kvs } from "@forge/kvs";
import { startExecution } from "../assets/import-client";
import type { AssetsImportContext, ImportResult } from "../assets/types";
import { logContext, logStructured } from "../forge/logging";
import { getJobIdStorageKey } from "../forge/storage";
import { controllerQueue } from "../resolvers/controller-resolver";

export async function startImport(
  context: AssetsImportContext,
): Promise<ImportResult> {
  logContext(context, "startImport");
  const { workspaceId, importId } = context;

  // Validate required configuration
  if (!workspaceId) {
    throw new Error("Import configuration incomplete: workspaceId is required");
  }

  if (!importId) {
    throw new Error("Import configuration incomplete: importId is required");
  }

  try {
    // Create a new execution via Assets API
    const {
      executionId,
      submitResultsUrl,
      submitProgressUrl,
      getExecutionStatusUrl,
      cancelUrl,
    } = await startExecution(workspaceId, importId);

    // Push event onto controller queue to start data ingestion process.
    // Include HATEOAS links from Assets so queue handlers don't need to reconstruct URLs.
    // The importConfigurationId doubles as the import source ID for the
    // Assets Import execution lifecycle.
    const eventBody = {
      importConfigurationId: importId,
      workspaceId,
      executionId,
      skip: 0, // Start at beginning
      limit: 30, // Will be overridden by controller, but needed for queue schema
      total: 0, // Will be determined by controller, but needed for queue schema
      // HATEOAS links from execution creation response
      submitResultsUrl,
      submitProgressUrl,
      getExecutionStatusUrl,
      cancelUrl,
    };

    const pushResult: PushResult = await controllerQueue.push({
      body: eventBody,
    });

    // Store the jobId so stopImport can cancel it if needed
    await kvs.set(getJobIdStorageKey(importId), pushResult.jobId);

    logStructured("info", "startImport", "Import queued to controller", {
      importsourceId: importId,
      workspaceId,
      executionId,
      jobId: pushResult.jobId,
      api: { method: "POST", path: `/executions` },
    });

    return {
      result: "start import",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStructured("error", "startImport", "Failed to start import", {
      importsourceId: importId,
      workspaceId,
      error: errorMessage,
      api: { method: "POST", path: `/importsource/${importId}/executions` },
    });
    throw new Error(`Failed to start import: ${errorMessage}`);
  }
}
