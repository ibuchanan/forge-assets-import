/**
 * Shared types for async queue events and processing
 */

/**
 * Work item payload for controller and worker queues
 *
 * Represents a single unit of work in the import lifecycle:
 * - Controller queue: Fetches initial batch and determines total count
 * - Worker queue: Processes batches and submits data to Assets
 *
 * Uses self-referential pagination pattern where each item includes
 * the information needed to process the next batch if not complete.
 */
export interface WorkItem {
  importConfigurationId: string;
  workspaceId: string;
  executionId: string;
  skip: number;
  limit: number;
  total: number;
  // HATEOAS links from Assets execution creation response
  submitResultsUrl: string;
  submitProgressUrl: string;
  getExecutionStatusUrl: string;
  cancelUrl: string;
  [key: string]: unknown;
}
