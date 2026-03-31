/**
 * Import Start Lifecycle Function
 * Triggered when user clicks "Import data" button in Assets UI
 */

/**
 * Import Start Lifecycle Function
 * Triggered when user clicks "Import data" button in Assets UI
 */

import api, { route } from "@forge/api";
import type { PushResult } from "@forge/events";
import { kvs } from "@forge/kvs";
import type { AssetsImportContext, ImportResult } from "../assets/types";
import { logContext, logStructured } from "../forge/logging";
import { getJobIdStorageKey } from "../forge/storage";
import { controllerQueue } from "../resolvers/controller-resolver";

/**
 * Extracts the execution ID from the submitResults URL
 * The URL format is: /jsm/assets/workspace/{workspaceId}/v1/importsource/{importId}/executions/{executionId}/data
 */
function extractExecutionId(submitResultsUrl: string): string {
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
    const endpoint = route`/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/executions`;
    const newlyCreatedExecution = await api.asApp().requestJira(endpoint, {
      method: "POST",
    });

    if (!newlyCreatedExecution.ok) {
      const errorText = await newlyCreatedExecution.text();
      throw new Error(
        `Failed to create import execution: ${newlyCreatedExecution.status} ${errorText}`,
      );
    }

    const newlyCreatedExecutionJson = await newlyCreatedExecution.json();

    // Extract the execution ID from the response
    const executionId = extractExecutionId(
      newlyCreatedExecutionJson.links.submitResults,
    );

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
      submitResultsUrl: newlyCreatedExecutionJson.links.submitResults,
      submitProgressUrl: newlyCreatedExecutionJson.links.submitProgress,
      getExecutionStatusUrl: newlyCreatedExecutionJson.links.getExecutionStatus,
      cancelUrl: newlyCreatedExecutionJson.links.cancel,
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
