/**
 * Forge KVS storage key helpers
 *
 * Centralises the construction of KVS storage keys so that all modules
 * that read or write the same key use an identical format.
 */

/**
 * Returns the KVS key used to track the active controller queue job ID
 * for a given import source.  Stored by `startImport` and consumed by
 * `stopImport` to cancel in-flight queue jobs.
 */
export function getJobIdStorageKey(importId: string): string {
  return `import:${importId}:jobId`;
}
