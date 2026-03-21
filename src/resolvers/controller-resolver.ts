import type { AsyncEvent, PushResult } from "@forge/events";
import { Queue } from "@forge/events";
import { fetchProductsBatch } from "../external/dummyjson-client";
import { logStructured } from "../forge/logging";
import type { WorkItem } from "../types/queue";
import { workerQueue } from "./worker-resolver";

// The responsibility of the controller queue is to start the import ingestion
// by fetching the first batch to determine the total count, then pushing
// the initial work item to the worker queue.
export const controllerQueue = new Queue({ key: "import-controller-queue" });

export function handler(event: AsyncEvent<WorkItem>): Promise<void> {
  return handleControllerEvent(event.body);
}

const handleControllerEvent = async (eventBody: WorkItem): Promise<void> => {
  const importConfigurationId = eventBody.importConfigurationId;
  const workspaceId = eventBody.workspaceId;
  const executionId = eventBody.executionId;
  const skip = eventBody.skip || 0;
  const limit = 30; // Batch size for products
  const submitResultsUrl = eventBody.submitResultsUrl;
  const submitProgressUrl = eventBody.submitProgressUrl;
  const getExecutionStatusUrl = eventBody.getExecutionStatusUrl;
  const cancelUrl = eventBody.cancelUrl;

  // Validate required fields
  if (!importConfigurationId || !workspaceId || !executionId) {
    logStructured("error", "handleControllerEvent", "Invalid event body", {
      importsourceId: importConfigurationId,
      workspaceId,
      executionId,
      missingFields: [
        !importConfigurationId && "importConfigurationId",
        !workspaceId && "workspaceId",
        !executionId && "executionId",
      ].filter(Boolean),
    });
    // Don't re-throw to avoid infinite retry loops. Log and return gracefully.
    return;
  }

  try {
    // Fetch the first batch to get the total count
    const batch = await fetchProductsBatch(skip, limit);
    const { total } = batch;

    // Push the first work item to worker queue.
    // Pass along HATEOAS links so the worker can use the execution-provided URLs directly.
    const workItem: WorkItem = {
      importConfigurationId,
      workspaceId,
      executionId,
      skip: 0,
      limit,
      total,
      submitResultsUrl,
      submitProgressUrl,
      getExecutionStatusUrl,
      cancelUrl,
    };

    const pushResult: PushResult = await workerQueue.push({
      body: workItem,
    });

    logStructured(
      "info",
      "handleControllerEvent",
      "Started processing import",
      {
        importsourceId: importConfigurationId,
        workspaceId,
        executionId,
        total,
        jobId: pushResult.jobId,
      },
    );
  } catch (error) {
    logStructured("error", "handleControllerEvent", "Error handling import", {
      importsourceId: importConfigurationId,
      workspaceId,
      executionId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
