/**
 * Type definitions for Assets Import lifecycle functions
 */

/**
 * Assets Import Context passed to all lifecycle functions
 * Contains import-specific data and general Forge context
 */
export interface AssetsImportContext {
  contextToken: string; // identifies invocation of this lifecycle extension point
  importId: string; // distinguishes between different import jobs, allowing multiple imports from the same data source type
  workspaceId: string; // Identifies which Assets workspace/schema collection contains the target object types
  schemaId: string; // Identifies the specific object type where imported data will be stored as objects
  context: ForgeContext; // This substructure is common for back-end functions, but is not necessary for Asset Imports
}

/**
 * Standard Forge context structure available in backend functions
 */
export interface ForgeContext {
  accountId: string;
  cloudId: string;
  localId: string;
  moduleKey: string;
  extension: Extension;
  userAccess: UserAccess;
}

/**
 * Extension context with import-specific data
 */
export interface Extension {
  importId: string;
  workspaceId: string;
  schemaId: string;
  executionId: string;
  type: string;
}

/**
 * User access permissions
 */
export interface UserAccess {
  enabled: boolean;
  hasAccess: boolean;
}

/**
 * Standard result returned by lifecycle functions (onDeleteImport, startImport, stopImport)
 *
 * Lifecycle functions should:
 * - Return Promise<ImportResult> (not ResultAsync or Result types)
 * - Throw errors for validation failures (do not return error Results)
 * - Handle async operations with try/catch and throw on failure
 *
 * @example
 * ```typescript
 * export async function startImport(context: AssetsImportContext): Promise<ImportResult> {
 *   if (!context.workspaceId) {
 *     throw new Error("workspaceId is required");
 *   }
 *   return { result: "start import" };
 * }
 * ```
 */
export interface ImportResult {
  result: string;
}

/**
 * Import configuration status values
 * Returned by Assets REST API getStatus endpoint
 * Indicates the current state of the import source configuration
 */
export enum ImportConfigurationStatus {
  /** Import source is ready and an import can be started */
  IDLE = "IDLE",
  /** An import is currently running */
  RUNNING = "RUNNING",
  /** Customer has disabled this import source */
  DISABLED = "DISABLED",
  /** No mapping configuration has been submitted yet */
  MISSING_MAPPING = "MISSING_MAPPING",
}

/**
 * Import execution status values
 * Returned by Assets REST API getExecutionStatus endpoint
 * Indicates the current state of a specific import execution
 */
export enum ImportExecutionStatus {
  /** Import execution is currently accepting data chunks */
  INGESTING = "INGESTING",
  /** Import execution is processing submitted data chunks */
  PROCESSING = "PROCESSING",
  /** Import execution has completed successfully */
  DONE = "DONE",
  /** Import execution has been cancelled */
  CANCELLED = "CANCELLED",
}

/**
 * Forge lifecycle importStatus return values
 * Simplified status values returned by the Forge importStatus lifecycle function
 * Note: Official Forge docs currently only document NOT_CONFIGURED and READY
 */
export enum ForgeImportStatus {
  /** No mapping configuration has been submitted */
  NOT_CONFIGURED = "NOT_CONFIGURED",
  /** Import is configured and ready */
  READY = "READY",
}

/**
 * Status result returned by importStatus lifecycle function
 * Should return one of the ForgeImportStatus enum values
 *
 * The importStatus function should:
 * - Return Promise<ImportStatusResult> (not ResultAsync or Result types)
 * - Never throw errors; return { status: "NOT_CONFIGURED" } as safe default
 * - Gracefully handle API failures by returning NOT_CONFIGURED
 * - Log warnings for debugging but don't propagate errors to the user
 *
 * @example
 * ```typescript
 * export async function importStatus(context: AssetsImportContext): Promise<ImportStatusResult> {
 *   try {
 *     const status = await fetchConfigStatus(context.workspaceId, context.importId);
 *     return { status: status === "IDLE" ? "READY" : "NOT_CONFIGURED" };
 *   } catch (error) {
 *     console.warn(`Failed to fetch status: ${error}`);
 *     return { status: "NOT_CONFIGURED" }; // Safe default
 *   }
 * }
 * ```
 */
export interface ImportStatusResult {
  status: ForgeImportStatus | string;
}
