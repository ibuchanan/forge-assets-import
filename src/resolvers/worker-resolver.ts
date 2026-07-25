import type { AsyncEvent } from "@forge/events";
import { Queue } from "@forge/events";
import {
  submitData as submitDataToAssets,
  submitProgress,
} from "../assets/import-client";
import { fetchProductsBatch } from "../external/dummyjson-client";
import { logStructured } from "../forge/logging";
import type { WorkItem } from "../types/queue";

/**
 * Architecture: Sans-I/O pattern
 * - Pure business logic functions: batch calculations, work item creation, error classification
 * - I/O functions: submitData, fetchProductsBatch
 * - Orchestration: handleWork
 */

// The responsibility of the worker queue is to fetch data from the external system
// and submit that data to Assets via the import execution data endpoint.
// Since data is fetched in batches, the worker keeps pushing to itself until
// all data has been submitted, marking the final batch as completed.
export const workerQueue = new Queue({ key: "import-worker-queue" });

export function handler(event: AsyncEvent<WorkItem>): Promise<void> {
  return handleWork(event.body);
}

/**
 * Pure function: Calculate batch progress and determine if this is the final batch
 *
 * @param skip - Current skip offset
 * @param limit - Batch size
 * @param total - Total number of items
 * @returns Object with nextSkip and isLastBatch flag
 */
export function calculateBatchProgress(
  skip: number,
  limit: number,
  total: number,
): { nextSkip: number; isLastBatch: boolean } {
  const nextSkip = skip + limit;
  const isLastBatch = nextSkip >= total;
  return { nextSkip, isLastBatch };
}

/**
 * Pure function: Create next work item for pagination
 *
 * @param currentItem - Current work item being processed
 * @param nextSkip - Skip value for next batch
 * @returns New work item for next batch
 */
export function createNextWorkItem(
  currentItem: WorkItem,
  nextSkip: number,
): WorkItem {
  return {
    importConfigurationId: currentItem.importConfigurationId,
    workspaceId: currentItem.workspaceId,
    executionId: currentItem.executionId,
    skip: nextSkip,
    limit: currentItem.limit,
    total: currentItem.total,
    submitResultsUrl: currentItem.submitResultsUrl,
    submitProgressUrl: currentItem.submitProgressUrl,
    getExecutionStatusUrl: currentItem.getExecutionStatusUrl,
    cancelUrl: currentItem.cancelUrl,
  };
}

/**
 * Pure function: Determine if an error should trigger a retry
 *
 * Classifies errors into retriable (temporary failures) vs non-retriable (permanent failures).
 *
 * @param error - Error object from failed operation
 * @returns true if should retry, false if should stop gracefully
 */
export function shouldRetryError(error: Error): boolean {
  const message = error.message;

  // Don't retry client errors (4xx) - these indicate problems with our request
  // that won't be fixed by retrying
  if (message.includes("400")) return false; // Bad Request
  if (message.includes("401")) return false; // Unauthorized
  if (message.includes("403")) return false; // Forbidden
  if (message.includes("404")) return false; // Not Found (import deleted)
  if (message.includes("409")) return false; // Conflict
  if (message.includes("422")) return false; // Unprocessable Entity

  // Retry server errors (5xx) and network errors - these are often temporary
  if (message.includes("500")) return true; // Internal Server Error
  if (message.includes("502")) return true; // Bad Gateway
  if (message.includes("503")) return true; // Service Unavailable
  if (message.includes("504")) return true; // Gateway Timeout

  // Retry network/timeout errors
  if (message.toLowerCase().includes("network")) return true;
  if (message.toLowerCase().includes("timeout")) return true;
  if (message.toLowerCase().includes("econnreset")) return true;
  if (message.toLowerCase().includes("econnrefused")) return true;

  // Default: retry for unknown errors (conservative approach)
  return true;
}

/**
 * Pure function: Validate work item has all required fields
 *
 * @param workItem - Work item to validate
 * @returns true if valid, false otherwise
 */
export function isValidWorkItem(workItem: WorkItem): boolean {
  return !!(
    workItem.importConfigurationId &&
    workItem.workspaceId &&
    workItem.executionId &&
    workItem.submitResultsUrl &&
    workItem.submitProgressUrl &&
    workItem.getExecutionStatusUrl &&
    workItem.cancelUrl
  );
}

/**
 * Submit a batch of raw product data to the Assets Import execution.
 *
 * Assets applies the mapping (configured during the frontend phase) server-side,
 * so the worker only needs to submit the raw data from the external source.
 *
 * @param submitResultsUrl - The HATEOAS URL for submitting data (from Assets execution response)
 * @param products - Raw product data from DummyJSON
 * @param clientGeneratedId - Unique identifier for this data submission
 * @param completed - Whether this is the final batch
 */
async function submitData(
  submitResultsUrl: string,
  products: Array<Record<string, unknown>>,
  clientGeneratedId: string,
  completed: boolean,
): Promise<void> {
  const result = await submitDataToAssets(
    submitResultsUrl,
    products,
    clientGeneratedId,
    completed,
  );

  if (result.isErr()) {
    // At Forge boundary - decide whether to retry based on error type
    const error = new Error(result.error.detail);
    if (shouldRetryError(error)) {
      // Retriable error (5xx, network, timeout) - throw to trigger Forge retry
      throw error;
    } else {
      // Non-retriable error (4xx) - log and return gracefully
      logStructured(
        "error",
        "submitData",
        "Non-retriable error submitting batch",
        {
          clientGeneratedId,
          error: result.error.detail,
          api: { method: "POST", path: "/data" },
        },
      );
      return;
    }
  }

  // Only log completion or errors - don't log every batch to reduce noise
  if (completed) {
    logStructured("debug", "submitData", "Submitted final batch", {
      productCount: products.length,
      clientGeneratedId,
    });
  }
}

const handleWork = async (workItem: WorkItem): Promise<void> => {
  if (!workItem) {
    logStructured("warn", "handleWork", "No work item found", {});
    return;
  }

  const {
    importConfigurationId,
    workspaceId,
    executionId,
    skip,
    limit,
    total,
    submitResultsUrl,
    submitProgressUrl,
  } = workItem;

  // Validate required fields using pure function
  if (!isValidWorkItem(workItem)) {
    logStructured("error", "handleWork", "Invalid work item", {
      importsourceId: importConfigurationId,
      workspaceId,
      executionId,
      submitResultsUrl,
      missingFields: [
        !importConfigurationId && "importConfigurationId",
        !workspaceId && "workspaceId",
        !executionId && "executionId",
        !submitResultsUrl && "submitResultsUrl",
      ].filter(Boolean),
    });
    // Don't re-throw to avoid infinite retry loops. Log and return gracefully.
    return;
  }

  try {
    // Fetch the batch of products from DummyJSON
    const batch = await fetchProductsBatch(skip, limit);
    const { products } = batch;

    // Calculate batch progress using pure function
    const { nextSkip, isLastBatch } = calculateBatchProgress(
      skip,
      limit,
      total,
    );

    // Submit raw product data to Assets Import execution.
    // Assets applies the mapping that was configured during the frontend phase.
    // Use the HATEOAS URL fetched from Assets instead of storing it in queue.
    await submitData(
      submitResultsUrl,
      products as unknown as Array<Record<string, unknown>>,
      `batch-${skip}-${limit}`,
      isLastBatch,
    );

    const processedCount = skip + products.length;

    if (!isLastBatch) {
      // Report progress for non-final batches (best-effort, doesn't block if it fails)
      await submitProgress(submitProgressUrl, total, processedCount);

      // Create next work item using pure function
      const nextWorkItem = createNextWorkItem(workItem, nextSkip);

      await workerQueue.push({
        body: nextWorkItem,
      });

      // Don't log every batch - only completion and errors to reduce log noise
    } else {
      logStructured("info", "handleWork", "Completed import", {
        importsourceId: importConfigurationId,
        workspaceId,
        executionId,
        batch: { skip, count: products.length, totalProducts: total },
      });
    }
  } catch (error) {
    // Check if this is a 404 (execution no longer exists) or other client error
    if (error instanceof Error) {
      // Use pure function to determine retry strategy
      if (!shouldRetryError(error)) {
        logStructured("warn", "handleWork", "Execution no longer exists", {
          importsourceId: importConfigurationId,
          workspaceId,
          executionId,
        });
        // Don't re-throw 404 errors - the import was likely deleted
        return;
      }
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
