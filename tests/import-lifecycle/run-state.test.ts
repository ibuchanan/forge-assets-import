/**
 * Unit tests: src/import-lifecycle/run-state.ts
 *
 * Validates the KVS-backed storage of active import execution state and
 * the latest confirmed run outcome, keyed by importId.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockKvsStore = new Map<string, unknown>();

vi.mock("@forge/kvs", () => ({
  kvs: {
    set: vi.fn((key: string, value: unknown) => {
      mockKvsStore.set(key, value);
      return Promise.resolve();
    }),
    get: vi.fn((key: string) => Promise.resolve(mockKvsStore.get(key) ?? null)),
    delete: vi.fn((key: string) => {
      mockKvsStore.delete(key);
      return Promise.resolve();
    }),
  },
}));

import {
  clearActiveRunState,
  clearLatestOutcome,
  getActiveRunState,
  getLatestOutcome,
  saveActiveRunState,
  saveLatestOutcome,
} from "../../src/import-lifecycle/run-state";

describe("run-state - active run state", () => {
  beforeEach(() => {
    mockKvsStore.clear();
    vi.clearAllMocks();
  });

  it("returns null when no active run state has been saved", async () => {
    const result = await getActiveRunState("import-123");

    expect(result).toBeNull();
  });

  it("returns the saved active run state for the given importId", async () => {
    const state = {
      executionId: "exec-1",
      controllerJobId: "job-1",
      cancelUrl:
        "/jsm/assets/workspace/ws/v1/importsource/import-123/executions/exec-1/cancel",
      getExecutionStatusUrl:
        "/jsm/assets/workspace/ws/v1/importsource/import-123/executions/exec-1",
      startedAt: "2026-07-25T00:00:00.000Z",
      state: "running" as const,
    };

    await saveActiveRunState("import-123", state);
    const result = await getActiveRunState("import-123");

    expect(result).toEqual(state);
  });

  it("keeps active run state isolated per importId", async () => {
    const stateA = {
      executionId: "exec-a",
      controllerJobId: "job-a",
      cancelUrl: "cancel-a",
      getExecutionStatusUrl: "status-a",
      startedAt: "2026-07-25T00:00:00.000Z",
      state: "running" as const,
    };

    await saveActiveRunState("import-a", stateA);
    const resultB = await getActiveRunState("import-b");

    expect(resultB).toBeNull();
  });

  it("clears the active run state for the given importId", async () => {
    const state = {
      executionId: "exec-1",
      controllerJobId: "job-1",
      cancelUrl: "cancel-url",
      getExecutionStatusUrl: "status-url",
      startedAt: "2026-07-25T00:00:00.000Z",
      state: "running" as const,
    };

    await saveActiveRunState("import-123", state);
    await clearActiveRunState("import-123");
    const result = await getActiveRunState("import-123");

    expect(result).toBeNull();
  });
});

describe("run-state - latest run outcome", () => {
  beforeEach(() => {
    mockKvsStore.clear();
    vi.clearAllMocks();
  });

  it("returns null when no outcome has been recorded", async () => {
    const result = await getLatestOutcome("import-123");

    expect(result).toBeNull();
  });

  it("returns the saved outcome for the given importId", async () => {
    const outcome = {
      outcome: "submission-complete" as const,
      recordedAt: "2026-07-25T00:00:00.000Z",
    };

    await saveLatestOutcome("import-123", outcome);
    const result = await getLatestOutcome("import-123");

    expect(result).toEqual(outcome);
  });

  it("clears the saved outcome for the given importId", async () => {
    const outcome = {
      outcome: "submission-complete" as const,
      recordedAt: "2026-07-25T00:00:00.000Z",
    };

    await saveLatestOutcome("import-123", outcome);
    await clearLatestOutcome("import-123");
    const result = await getLatestOutcome("import-123");

    expect(result).toBeNull();
  });
});
