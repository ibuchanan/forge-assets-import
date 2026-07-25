/**
 * Import Lifecycle Run State
 *
 * KVS-backed storage for a single import source's active execution state
 * and its latest confirmed run outcome. Replaces the single jobId key
 * previously tracked in src/forge/storage.ts.
 */

import { kvs } from "@forge/kvs";

export interface ActiveRunState {
  executionId: string;
  controllerJobId: string;
  cancelUrl: string;
  getExecutionStatusUrl: string;
  startedAt: string;
  state: "running" | "stopped";
}

export interface RunCounts {
  entriesCreated?: number;
  entriesUpdated?: number;
  entriesFailed?: number;
  entriesProcessed?: number;
}

export interface RunOutcome {
  outcome: "submission-complete" | "confirmed-done" | "confirmed-cancelled";
  recordedAt: string;
  counts?: RunCounts;
}

function getActiveRunStateKey(importId: string): string {
  return `import:${importId}:activeRun`;
}

function getLatestOutcomeKey(importId: string): string {
  return `import:${importId}:latestOutcome`;
}

export async function saveActiveRunState(
  importId: string,
  state: ActiveRunState,
): Promise<void> {
  await kvs.set(getActiveRunStateKey(importId), state);
}

export async function getActiveRunState(
  importId: string,
): Promise<ActiveRunState | null> {
  const state = await kvs.get(getActiveRunStateKey(importId));
  return (state as ActiveRunState | undefined) ?? null;
}

export async function clearActiveRunState(importId: string): Promise<void> {
  await kvs.delete(getActiveRunStateKey(importId));
}

export async function saveLatestOutcome(
  importId: string,
  outcome: RunOutcome,
): Promise<void> {
  await kvs.set(getLatestOutcomeKey(importId), outcome);
}

export async function getLatestOutcome(
  importId: string,
): Promise<RunOutcome | null> {
  const outcome = await kvs.get(getLatestOutcomeKey(importId));
  return (outcome as RunOutcome | undefined) ?? null;
}

export async function clearLatestOutcome(importId: string): Promise<void> {
  await kvs.delete(getLatestOutcomeKey(importId));
}
