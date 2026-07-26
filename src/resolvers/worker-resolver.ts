import type { AsyncEvent } from "@forge/events";
import { Queue } from "@forge/events";
import { dummyJsonProductAdapter } from "../external/dummyjson-client";
import { logStructured } from "../forge/logging";
import {
  processWorkItem,
  shouldRetryError,
} from "../import-lifecycle/batch-engine";
import type { WorkItem } from "../types/queue";

/**
 * Forge queue adapter: unpacks the queue event, delegates all batch
 * orchestration to the source-agnostic batch engine (wired to the
 * DummyJSON adapter), and translates the engine's result into queue
 * actions. See ../import-lifecycle/batch-engine for the actual logic.
 */
export const workerQueue = new Queue({ key: "import-worker-queue" });

export function handler(event: AsyncEvent<WorkItem>): Promise<void> {
  return handleWork(event.body);
}

const handleWork = async (workItem: WorkItem): Promise<void> => {
  if (!workItem) {
    logStructured("warn", "handleWork", "No work item found", {});
    return;
  }

  const { importConfigurationId, workspaceId, executionId } = workItem;

  try {
    const result = await processWorkItem(workItem, dummyJsonProductAdapter);

    switch (result.type) {
      case "invalid":
        logStructured("error", "handleWork", "Invalid work item", {
          importsourceId: importConfigurationId,
          workspaceId,
          executionId,
          missingFields: result.missingFields,
        });
        return;
      case "non-retriable-error":
        logStructured(
          "error",
          "handleWork",
          "Non-retriable error submitting batch",
          {
            importsourceId: importConfigurationId,
            workspaceId,
            executionId,
            error: result.error.message,
          },
        );
        return;
      case "completed":
        logStructured("info", "handleWork", "Completed import", {
          importsourceId: importConfigurationId,
          workspaceId,
          executionId,
        });
        return;
      case "enqueue-next":
        await workerQueue.push({ body: result.nextWorkItem });
        return;
    }
  } catch (error) {
    if (error instanceof Error && !shouldRetryError(error)) {
      logStructured("warn", "handleWork", "Execution no longer exists", {
        importsourceId: importConfigurationId,
        workspaceId,
        executionId,
      });
      // Don't re-throw non-retriable errors - the import was likely deleted
      return;
    }

    logStructured("error", "handleWork", "Error processing work item", {
      importsourceId: importConfigurationId,
      workspaceId,
      executionId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
