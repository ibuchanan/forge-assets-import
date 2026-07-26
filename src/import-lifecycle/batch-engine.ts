/**
 * Batch Engine
 *
 * Source-agnostic orchestration for paginated import batches: validate a
 * work item, fetch/transform a batch from a BatchSourceAdapter, submit it to
 * Assets, report progress, and decide what happens next. Controller/worker
 * queue consumers are thin Forge wiring around this engine.
 *
 * Architecture: Sans-I/O pattern
 * - Pure business logic functions: batch calculations, work item creation, error classification
 * - I/O: submitData/submitProgress (Assets), adapter.fetchBatch (source), saveLatestOutcome (KVS)
 */

import {
  submitData as submitDataToAssets,
  submitProgress,
} from "../assets/import-client";
import type { WorkItem } from "../types/queue";
import { saveLatestOutcome } from "./run-state";

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
 * Pure function: Default retry policy - determine if an error should trigger a retry
 *
 * Classifies errors into retriable (temporary failures) vs non-retriable (permanent failures).
 * A BatchSourceAdapter may override this via shouldRetrySourceError when its
 * source has different error semantics.
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
 * Pure function: List which required work item fields are missing, for
 * diagnostic logging by the queue consumer that owns the work item.
 */
export function getMissingWorkItemFields(workItem: WorkItem): string[] {
  return (
    [
      !workItem.importConfigurationId && "importConfigurationId",
      !workItem.workspaceId && "workspaceId",
      !workItem.executionId && "executionId",
      !workItem.submitResultsUrl && "submitResultsUrl",
      !workItem.submitProgressUrl && "submitProgressUrl",
      !workItem.getExecutionStatusUrl && "getExecutionStatusUrl",
      !workItem.cancelUrl && "cancelUrl",
    ] as Array<string | false>
  ).filter((field): field is string => Boolean(field));
}

/**
 * A source-agnostic supplier of batch records. Adapters translate a
 * source-specific API (DummyJSON, or any future source) into the shape the
 * batch engine needs, and normalize raw records into the flat Assets record
 * shape expected by the mapping configuration.
 */
export interface BatchSourceAdapter<TRecord> {
  fetchBatch(params: {
    skip: number;
    limit: number;
  }): Promise<{ records: TRecord[]; total: number }>;
  transform(records: TRecord[]): Array<Record<string, unknown>>;
  /**
   * Override the default retry policy for errors surfaced while submitting
   * this source's data to Assets. Falls back to shouldRetryError when absent.
   */
  shouldRetrySourceError?(error: Error): boolean;
}

export type BatchEngineResult =
  | { type: "invalid"; missingFields: string[] }
  | { type: "enqueue-next"; nextWorkItem: WorkItem }
  | { type: "completed" }
  | { type: "non-retriable-error"; error: Error };

/**
 * Orchestrate one batch of a paginated import: validate the work item, fetch
 * and transform a batch from the adapter, submit it to Assets, report
 * progress, and decide what should happen next. Throws on retriable Assets
 * errors so the Forge queue consumer's automatic retry kicks in.
 */
export async function processWorkItem<TRecord>(
  workItem: WorkItem,
  adapter: BatchSourceAdapter<TRecord>,
): Promise<BatchEngineResult> {
  if (!isValidWorkItem(workItem)) {
    return {
      type: "invalid",
      missingFields: getMissingWorkItemFields(workItem),
    };
  }

  const {
    importConfigurationId,
    skip,
    limit,
    total,
    submitResultsUrl,
    submitProgressUrl,
  } = workItem;

  const { records } = await adapter.fetchBatch({ skip, limit });
  const assetsRecords = adapter.transform(records);

  const { nextSkip, isLastBatch } = calculateBatchProgress(skip, limit, total);

  const submitResult = await submitDataToAssets(
    submitResultsUrl,
    assetsRecords,
    `batch-${skip}-${limit}`,
    isLastBatch,
  );

  if (submitResult.isErr()) {
    const error = new Error(submitResult.error.detail);
    const retry = adapter.shouldRetrySourceError
      ? adapter.shouldRetrySourceError(error)
      : shouldRetryError(error);

    if (retry) {
      throw error;
    }

    return { type: "non-retriable-error", error };
  }

  if (isLastBatch) {
    await saveLatestOutcome(importConfigurationId, {
      outcome: "submission-complete",
      recordedAt: new Date().toISOString(),
    });

    return { type: "completed" };
  }

  await submitProgress(submitProgressUrl, total, skip + records.length);

  return {
    type: "enqueue-next",
    nextWorkItem: createNextWorkItem(workItem, nextSkip),
  };
}
