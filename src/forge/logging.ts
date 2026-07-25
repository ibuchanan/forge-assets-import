/**
 * Logging Module
 *
 * Backend logging for this app is a compatibility adapter over
 * `@forge-ahead/logging`'s `ForgeLogger`. `logStructured()` and
 * `logContext()` keep their existing call-site signatures; internally they
 * delegate to the shared package for JSON structuring, redaction of
 * sensitive fields (contextToken, headers, tokens, secrets), Forge event
 * summarization, and LOG_LEVEL-gated debug output — replacing this
 * module's previous bespoke `truncateEvents()` implementation.
 *
 * @see {@link https://github.com/ibuchanan/forge-ahead-logging | @forge-ahead/logging}
 */

import { createForgeLogger, type ForgeLogger } from "@forge-ahead/logging";

/**
 * Root logger for this app. Prefer `logStructured`/`logContext` at existing
 * call sites; use `rootLogger` (or `rootLogger.child({...})`) directly for
 * new code that wants the package's native helpers
 * (`forgeInvocation`, `result`, `errorResult`, `probe`).
 */
export const rootLogger: ForgeLogger = createForgeLogger({
  name: "forge-assets-import",
});

/**
 * Log Forge event context information for debugging
 *
 * Delegates to `rootLogger.forgeInvocation()`, which summarizes the event
 * through `FORGE_EVENT_SUMMARY_POLICY`: `contextToken` is reduced to a
 * preview, `headers`/`body` are reported as omitted shapes rather than
 * logged raw, and `cloudId`/`moduleKey` are pulled from the nested Forge
 * `context`. Logged at `debug`, so it only appears when `LOG_LEVEL` enables
 * `debug` or `trace`.
 *
 * @param context - The InstallContext or EventContext from the handler
 * @param label - Optional label to prefix the log message
 */
export function logContext(context: unknown, label?: string): void {
  rootLogger.forgeInvocation(context, label ? `${label} context` : "Context", {
    level: "debug",
  });
}

/**
 * Structured logging helper for consistent JSON log output
 *
 * Logs `details` as-is via a `rootLogger.child({ function: functionName })`
 * so `function` and every detail field (workspaceId, importsourceId, etc.)
 * appear at the top level of the JSON record alongside the package's
 * standard fields. Sensitive fields matching the package's default redact
 * list (contextToken, tokens, secrets, authorization headers, ...) are
 * censored automatically.
 *
 * @param level - Log level (info, debug, warn, error)
 * @param functionName - Name of the current function
 * @param message - Brief summary message (<100 chars)
 * @param details - Additional structured details (workspaceId, importId, etc.)
 *
 * @example
 * ```typescript
 * logStructured("info", "startImport", "Import started successfully", {
 *   workspaceId: "ws-123",
 *   importsourceId: "import-456",
 *   executionId: "exec-789",
 *   api: { method: "POST", path: "/executions" }
 * });
 * ```
 */
export function logStructured(
  level: "info" | "debug" | "warn" | "error",
  functionName: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  rootLogger.child({ function: functionName })[level](
    details ?? {},
    message.slice(0, 100), // Enforce <100 char limit
  );
}
