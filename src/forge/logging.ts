/**
 * Logging Module
 *
 * This module provides utilities for safely logging Forge event data.
 * It helps prevent accidentally exposing sensitive information like tokens
 * and authorization headers in application logs.
 *
 * Key Features:
 * - Automatic truncation of contextToken values
 * - Masking of HTTP headers
 * - Recursive processing of nested objects and arrays
 * - Preserves original data structure
 *
 * @example
 * ```typescript
 * import { truncateEvents } from "./logging";
 *
 * export const handler = (request, context) => {
 *   // Safe logging - sensitive data is masked
 *   console.log("Request:", JSON.stringify(truncateEvents(request)));
 *
 *   // Process the request...
 * };
 * ```
 */

// Type definitions for JSON values
type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: unknown };

/**
 * Truncates sensitive information from event objects for safe logging
 *
 * This function recursively processes objects and arrays to mask sensitive data
 * while preserving the overall structure for debugging purposes. It's designed
 * to be used with Forge event objects (webtrigger events, lifecycle events, etc.)
 * before logging them.
 *
 * **What gets truncated:**
 * - `contextToken`: Shows only first 3 and last 3 characters (e.g., "abc...xyz")
 * - `headers`: Completely replaced with `{ "...": "..." }` placeholder
 *
 * **What gets preserved:**
 * - All other fields and values
 * - Object and array structure
 * - Nested objects and arrays (recursively processed)
 *
 * **Why truncate?**
 * - `contextToken` can be used to impersonate your app's installation
 * - `headers` may contain Authorization tokens, API keys, session cookies
 * - Logs may be stored in systems with different security levels
 * - Prevents accidental credential leaks in debugging output
 *
 * @param obj - A JSON-serializable object from a Forge event (request, context, etc.)
 * @returns A new object with the same structure but with sensitive data masked
 *
 * @example
 * ```typescript
 * // Basic usage with webtrigger event
 * export const webtriggerHandler: WebtriggerFunction = (request, context) => {
 *   console.debug("Request received:", JSON.stringify(truncateEvents(request)));
 *
 *   // Original request still has all data
 *   const token = request.contextToken; // Full token available
 *
 *   return buildSuccessResponse({ message: "OK" });
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Before truncation:
 * const event = {
 *   method: "POST",
 *   contextToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   headers: {
 *     "authorization": ["Bearer secret-token"],
 *     "user-agent": ["Mozilla/5.0..."]
 *   },
 *   body: '{"data": "public"}'
 * };
 *
 * // After truncation:
 * const safe = truncateEvents(event);
 * // {
 * //   method: "POST",
 * //   contextToken: "eyJ...VCJ9",
 * //   headers: { "...": "..." },
 * //   body: '{"data": "public"}'
 * // }
 * ```
 *
 * @example
 * ```typescript
 * // Works with nested objects and arrays
 * const complexEvent = {
 *   data: [
 *     { id: 1, contextToken: "secret123456789" },
 *     { id: 2, contextToken: "token987654321" }
 *   ],
 *   metadata: {
 *     headers: { "auth": ["Bearer xyz"] }
 *   }
 * };
 *
 * const safe = truncateEvents(complexEvent);
 * // {
 * //   data: [
 * //     { id: 1, contextToken: "sec...789" },
 * //     { id: 2, contextToken: "tok...321" }
 * //   ],
 * //   metadata: {
 * //     headers: { "...": "..." }
 * //   }
 * // }
 * ```
 *
 * @see {@link https://developer.atlassian.com/platform/forge/runtime-reference/storage-api-security/ | Forge Security Best Practices}
 */
export function truncateEvents(obj: JSONValue): JSONValue {
  // Primitive values are returned as-is
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  // Arrays are recursively processed and returned as arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => truncateEvents(item as JSONValue));
  }

  // Objects are processed key by key, with special handling for sensitive fields
  const newObj: { [key: string]: unknown } = {};
  for (const key in obj) {
    const value = (obj as { [key: string]: unknown })[key];
    if (key === "contextToken") {
      // Truncate context tokens to hide the sensitive middle portion
      if (typeof value === "string") {
        newObj[key] = `${value.slice(0, 3)}...${value.slice(-3)}`;
      } else if (value !== undefined) {
        newObj[key] = value;
      }
    } else if (key === "headers") {
      // Replace headers object entirely to prevent exposing authorization details
      newObj[key] = { "...": "..." };
    } else {
      // Recursively process other values
      if (value !== undefined && typeof value === "object") {
        newObj[key] = truncateEvents(value as JSONValue);
      } else {
        newObj[key] = value;
      }
    }
  }
  return newObj as JSONValue;
}

/**
 * Log Forge event context information for debugging
 *
 * Safely logs event context with automatic truncation of sensitive data
 * (contextToken, headers). Useful for debugging trigger handlers, tracking
 * which module/cloud is being invoked, and troubleshooting event routing.
 *
 * **What Gets Logged:**
 * - `cloudId` - Which Atlassian site triggered the event
 * - `moduleKey` - Which module in your app was invoked
 * - `userAccess` - Whether user context is available
 * - `contextToken` - Truncated for security (first 3 + last 3 chars)
 * - Other context fields - As provided by the platform
 *
 * **Why Use This?**
 * - Consistent context logging across all handlers
 * - Automatic sensitive data truncation (contextToken, headers)
 * - Clear pattern for troubleshooting event routing
 * - Simple single-line debugging
 *
 * **Common Use Cases:**
 * - Debugging which module is being called
 * - Tracking installations across different sites
 * - Understanding user context availability
 * - Troubleshooting event routing issues
 *
 * @param context - The InstallContext or EventContext from the handler
 * @param label - Optional label to prefix the log message
 *
 * @example
 * ```typescript
 * // Basic usage in any handler
 * export const handler = async (event, context) => {
 *   logContext(context);
 *   // Debug: Context: {"cloudId":"...", "moduleKey":"my-trigger"}
 *
 *   // Your handler logic...
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Lifecycle event with label
 * export const install: LifecycleFunction = async (request, context) => {
 *   logContext(context, "Installation");
 *   // Debug: Installation context: {...}
 *
 *   await setupApp();
 * };
 * ```
 *
 * @example
 * ```typescript
 * // WebTrigger with method and path
 * export const webhook: WebtriggerFunction = async (request, context) => {
 *   logContext(context, `${request.method} ${request.path}`);
 *   // Debug: POST /webhook context: {...}
 *
 *   return buildSuccessResponse({ received: true });
 * };
 * ```
 *
 * @see {@link https://developer.atlassian.com/platform/forge/runtime-reference/fetch-api/#context | Forge Context}
 */
export function logContext(context: unknown, label?: string): void {
  const prefix = label ? `${label} context` : "Context";
  if (typeof context === "object" && context !== null) {
    const truncated = truncateEvents(context as JSONValue);
    console.debug(`${prefix}:`, JSON.stringify(truncated));
  } else {
    console.debug(`${prefix}:`, context);
  }
}

/**
 * Coordinates for structured logging (workspaceId, importId, etc.)
 * These are the common identifiers that appear in nearly every log
 */
export interface LogCoordinates {
  workspaceId?: string;
  importId?: string;
  importsourceId?: string;
  executionId?: string;
  jobId?: string;
  [key: string]: string | undefined;
}

/**
 * Structured logging helper for consistent JSON log output
 *
 * Creates a JSON log entry following the LOGGING.md guidelines:
 * 1. Log as JSON objects
 * 2. Message with <100 character summary
 * 3. Current function name
 * 4. Important coordinates like workspaceId & importsourceId
 * 5. Details available in context (API request method & path)
 *
 * Automatically filters out undefined coordinate values to reduce duplication.
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
 * // Outputs: {"function":"startImport","message":"Import started successfully","workspaceId":"ws-123","importsourceId":"import-456","executionId":"exec-789","api":{"method":"POST","path":"/executions"}}
 * ```
 */
export function logStructured(
  level: "info" | "debug" | "warn" | "error",
  functionName: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  // Extract coordinates and filter out undefined values
  const coordinates: LogCoordinates = {};
  const otherDetails: Record<string, unknown> = {};

  if (details) {
    for (const [key, value] of Object.entries(details)) {
      // Check if this is a known coordinate field
      if (
        key === "workspaceId" ||
        key === "importId" ||
        key === "importsourceId" ||
        key === "executionId" ||
        key === "jobId"
      ) {
        if (value !== undefined) {
          coordinates[key] = value as string;
        }
      } else {
        otherDetails[key] = value;
      }
    }
  }

  const logEntry = {
    function: functionName,
    message: message.slice(0, 100), // Enforce <100 char limit
    ...coordinates,
    ...otherDetails,
  };

  const logMethod = console[level];
  logMethod(JSON.stringify(logEntry));
}
