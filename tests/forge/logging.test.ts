/**
 * Logging Module Boundary Tests
 *
 * Validates that logStructured() and logContext() (src/forge/logging.ts) -
 * a compatibility adapter over @forge-ahead/logging's ForgeLogger - still
 * produce the structured JSON call sites depend on, while delegating
 * redaction and LOG_LEVEL gating to the shared package.
 *
 * Behaviors under test:
 * 1. logStructured emits function name, message, and details as structured JSON
 * 2. logStructured truncates the message to <100 characters
 * 3. logStructured routes each level to its matching console method
 * 4. logStructured's default redaction censors contextToken in details
 * 5. logContext summarizes cloudId/moduleKey from a nested Forge context
 * 6. logContext never logs raw contextToken, headers, or body
 * 7. Debug-level output (logStructured("debug", ...) and logContext) is
 *    gated by LOG_LEVEL, off by default and on when LOG_LEVEL=debug
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { logContext, logStructured } from "../../src/forge/logging";

type LoggingModule = {
  logStructured: typeof logStructured;
  logContext: typeof logContext;
};

async function importLoggingWithEnv(
  env: Record<string, string>,
): Promise<LoggingModule> {
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  return await import("../../src/forge/logging");
}

function lastLoggedRecord(
  spy: ReturnType<typeof vi.spyOn>,
): Record<string, unknown> {
  const call = spy.mock.calls.at(-1);
  if (!call) {
    throw new Error("Expected console method to have been called");
  }
  return JSON.parse(call[0] as string) as Record<string, unknown>;
}

describe("logging", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("logStructured", () => {
    it("logs function name, message, and details as structured JSON", async () => {
      const { logStructured } = await importLoggingWithEnv({
        LOG_LEVEL: "info",
      });

      logStructured("info", "startImport", "Import started", {
        workspaceId: "ws-123",
        importsourceId: "import-456",
      });

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const record = lastLoggedRecord(consoleInfoSpy);
      expect(record).toMatchObject({
        function: "startImport",
        msg: "Import started",
        workspaceId: "ws-123",
        importsourceId: "import-456",
      });
    });

    it("truncates the message to 100 characters", async () => {
      const { logStructured } = await importLoggingWithEnv({
        LOG_LEVEL: "info",
      });
      const longMessage = "x".repeat(150);

      logStructured("info", "startImport", longMessage);

      const record = lastLoggedRecord(consoleInfoSpy);
      expect(record.msg).toHaveLength(100);
    });

    it("routes warn and error levels to their matching console method", async () => {
      const { logStructured } = await importLoggingWithEnv({
        LOG_LEVEL: "info",
      });

      logStructured("warn", "handleWork", "retrying");
      logStructured("error", "handleWork", "failed");

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(lastLoggedRecord(consoleWarnSpy)).toMatchObject({
        function: "handleWork",
        msg: "retrying",
      });
      expect(lastLoggedRecord(consoleErrorSpy)).toMatchObject({
        function: "handleWork",
        msg: "failed",
      });
    });

    it("redacts contextToken in details", async () => {
      const { logStructured } = await importLoggingWithEnv({
        LOG_LEVEL: "info",
      });

      logStructured("info", "startImport", "Import started", {
        contextToken: "super-secret-token-value",
      });

      const record = lastLoggedRecord(consoleInfoSpy);
      expect(record.contextToken).toBe("[redacted]");
    });

    it("does not emit debug logs when LOG_LEVEL is info (the default)", async () => {
      const { logStructured } = await importLoggingWithEnv({
        LOG_LEVEL: "info",
      });

      logStructured("debug", "submitData", "Submitted final batch");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it("emits debug logs when LOG_LEVEL is debug", async () => {
      const { logStructured } = await importLoggingWithEnv({
        LOG_LEVEL: "debug",
      });

      logStructured("debug", "submitData", "Submitted final batch");

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      expect(lastLoggedRecord(consoleDebugSpy)).toMatchObject({
        function: "submitData",
        msg: "Submitted final batch",
      });
    });
  });

  describe("logContext", () => {
    const fakeContext = {
      contextToken: "abcdefghijklmnopqrstuvwxyz",
      context: { cloudId: "cloud-1", moduleKey: "assets-import-type" },
      headers: { authorization: ["Bearer super-secret"] },
      body: "raw request body that should never be logged",
    };

    it("does not log at the default LOG_LEVEL (info)", async () => {
      const { logContext } = await importLoggingWithEnv({
        LOG_LEVEL: "info",
      });

      logContext(fakeContext, "startImport");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it("summarizes cloudId/moduleKey from the nested context when LOG_LEVEL is debug", async () => {
      const { logContext } = await importLoggingWithEnv({
        LOG_LEVEL: "debug",
      });

      logContext(fakeContext, "startImport");

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      const record = lastLoggedRecord(consoleDebugSpy);
      expect(record).toMatchObject({
        msg: "startImport context",
        cloudId: "cloud-1",
        moduleKey: "assets-import-type",
      });
    });

    it("never logs raw contextToken, headers, or body", async () => {
      const { logContext } = await importLoggingWithEnv({
        LOG_LEVEL: "debug",
      });

      logContext(fakeContext, "startImport");

      const record = lastLoggedRecord(consoleDebugSpy);
      const loggedText = JSON.stringify(record);

      expect(loggedText).not.toContain(fakeContext.contextToken);
      expect(loggedText).not.toContain("Bearer super-secret");
      expect(loggedText).not.toContain(fakeContext.body);
      expect(record.contextToken).toBe("[redacted]");
      expect(record.headers).toEqual({ omitted: true, keys: 1 });
      expect(record.body).toEqual({
        omitted: true,
        length: fakeContext.body.length,
      });
    });

    it("defaults the label to 'Context' when none is given", async () => {
      const { logContext } = await importLoggingWithEnv({
        LOG_LEVEL: "debug",
      });

      logContext(fakeContext);

      const record = lastLoggedRecord(consoleDebugSpy);
      expect(record.msg).toBe("Context");
    });
  });
});
