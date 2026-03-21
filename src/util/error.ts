import { err, ok, okAsync, type Result, ResultAsync } from "neverthrow";

// Re-export neverthrow essentials so consumers don't need dual imports
export { err, ok, okAsync, ResultAsync, type Result };

/**
 * Extract ProblemDetails from a thrown neverthrow Result or convert errors
 *
 * When StandardError.error() is thrown, it becomes a neverthrow Result with _unsafeUnwrapErr.
 * This helper extracts the ProblemDetails or creates a network error for other error types.
 *
 * @param error - The caught error (unknown type)
 * @param context - Context string for error message (e.g., "fetching schema")
 * @returns ProblemDetails object
 */
export function extractOrCreateProblemDetails(
  error: unknown,
  context: string,
): ProblemDetails {
  // Check if the error is a neverthrow Result with _unsafeUnwrapErr method
  if (
    error &&
    typeof error === "object" &&
    "_unsafeUnwrapErr" in error &&
    typeof (error as Record<string, unknown>)._unsafeUnwrapErr === "function"
  ) {
    // Extract the ProblemDetails from the Result
    return (
      error as { _unsafeUnwrapErr: () => ProblemDetails }
    )._unsafeUnwrapErr();
  }

  // For regular errors, create a network error
  if (error instanceof Error) {
    return StandardError.getOrDefault(502)
      .error(`Network error while ${context}: ${error.message}`)
      .match(
        () => {
          throw new Error("Unexpected success in error handler");
        },
        (e) => e,
      );
  }

  // For unknown errors, create a generic network error
  return StandardError.getOrDefault(502)
    .error(`Network error while ${context}: ${String(error)}`)
    .match(
      () => {
        throw new Error("Unexpected success in error handler");
      },
      (e) => e,
    );
}

/**
 * Validate HTTP response and handle errors using Results (never throw)
 *
 * Checks if response is ok, and if not, reads the error text and returns
 * an error Result with appropriate status code. This is a generic utility
 * for any HTTP response validation in Result-based code.
 *
 * Accepts both Web API Response and Forge API Response types, which have
 * compatible interfaces for the methods we use (ok, status, statusText, text()).
 *
 * @param response - HTTP response object (Web API or Forge API Response)
 * @param context - Context string for error message (e.g., "fetch schema")
 * @returns ResultAsync with ok(response) if successful, or err(ProblemDetails) if response is not ok
 */
export function validateHttpResponse(
  response: {
    ok: boolean;
    status: number;
    statusText: string;
    text(): Promise<string>;
    json(): Promise<unknown>;
  },
  context: string,
): ResultAsync<
  {
    ok: boolean;
    status: number;
    statusText: string;
    text(): Promise<string>;
    json(): Promise<unknown>;
  },
  ProblemDetails
> {
  return ResultAsync.fromPromise(
    (async () => {
      if (!response.ok) {
        const errorText = await response.text();
        return StandardError.getOrDefault(response.status).error(
          `Failed to ${context}: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }
      return ok(response);
    })(),
    (error: unknown): ProblemDetails =>
      extractOrCreateProblemDetails(error, `validating ${context}`),
  ).andThen((result) => result);
}

/**
 * RFC 9457: Problem Details for HTTP APIs
 * https://www.rfc-editor.org/rfc/rfc9457.html
 *
 * This format allows APIs to provide consistent, machine-readable error responses
 * that can be easily consumed by clients while remaining human-readable.
 * Although many Forge errors aren't caused by HTTP directly,
 * this format is still strong for logging,
 * and for complex cases that eventually surface through HTTP.
 */
export interface ProblemDetails {
  type: string; // URI reference identifying the problem type (e.g., https://httpstatuses.io/404)
  title: string; // Human-readable summary of the problem type (e.g., "Not Found")
  status: number; // HTTP status code (e.g., 404)
  detail: string; // Human-readable explanation specific to this occurrence
  timestamp: string; // ISO 8601 timestamp
  instance?: string; // Optional URI reference identifying this specific occurrence
}

/**
 * Standard HTTP error class that creates RFC 9457 compliant error responses
 * wrapped in neverthrow Results.
 *
 * This class maintains a registry of standard HTTP error types and provides
 * methods to create error Results with consistent ProblemDetails formatting.
 *
 * @example
 * ```typescript
 * // Create an error Result
 * return StandardError.getOrDefault(404).error("File not found");
 *
 * // Extract ProblemDetails from Result for logging
 * const result = StandardError.getOrDefault(500).error("Server error");
 * console.error(result.error);
 * ```
 */
export class StandardError {
  /**
   * The HTTP status code for this error type (e.g., 404, 500)
   * @readonly
   */
  readonly status: number;

  /**
   * Human-readable title for this error type (e.g., "Not Found", "Internal Server Error")
   * @readonly
   */
  readonly title: string;

  /**
   * Static registry of pre-registered error types mapped by status code
   * @static
   */
  static types = new Map<number, StandardError>();

  /**
   * Create a new StandardError instance
   *
   * @param status - HTTP status code
   * @param title - Human-readable error title
   */
  constructor(status: number, title: string) {
    this.status = status;
    this.title = title;
  }

  /**
   * Register a new error type in the static registry
   *
   * @param status - HTTP status code to register
   * @param title - Human-readable title for this error type
   *
   * @example
   * ```typescript
   * StandardError.add(404, "Not Found");
   * StandardError.add(500, "Internal Server Error");
   * ```
   */
  static add(status: number, title: string) {
    StandardError.types.set(status, new StandardError(status, title));
  }

  /**
   * Get a registered error type by status code, or default to 500 if not found
   *
   * This method is safe to call with any status code. If the code is not
   * registered, it returns a 500 Internal Server Error instance.
   *
   * @param statusCode - HTTP status code to look up
   * @returns StandardError instance for the given code or 500 default
   *
   * @example
   * ```typescript
   * // Get registered error
   * const notFound = StandardError.getOrDefault(404);
   *
   * // Get unregistered error (returns 500)
   * const teapot = StandardError.getOrDefault(418); // Returns 500 error
   * ```
   */
  static getOrDefault(statusCode: number): StandardError {
    return (
      StandardError.types.get(statusCode) ??
      StandardError.types.get(500) ??
      new StandardError(500, "Internal Server Error")
    );
  }

  /**
   * Map HTTP status code to appropriate shell exit code
   *
   * Any error (4xx or 5xx) results in exit code 1, indicating the CLI
   * encountered an error condition that prevented successful completion.
   * Success (2xx) should not use this method.
   *
   * @param _statusCode - HTTP status code (for future use; currently all errors map to 1)
   * @returns Shell exit code 1 for any error
   *
   * @example
   * ```typescript
   * const result = StandardError.getOrDefault(404).error("Not found");
   * if (result.isErr()) {
   *   process.exit(StandardError.toExitCode(result.error.status));
   * }
   * ```
   */
  static toExitCode(_statusCode: number): number {
    return 1;
  }

  /**
   * Get the RFC 9457 type URI for this error
   *
   * Returns a URI reference to httpstatuses.io for the error's status code.
   * This provides a stable, machine-readable identifier for the error type.
   *
   * @returns URI string in format `https://httpstatuses.io/{status}`
   *
   * @example
   * ```typescript
   * const error = StandardError.getOrDefault(404);
   * console.log(error.type); // "https://httpstatuses.io/404"
   * ```
   */
  public get type() {
    return `https://httpstatuses.io/${this.status}`;
  }
  /**
   * Create a Result containing an error with RFC 9457 ProblemDetails
   *
   * This is the primary method for creating error Results in this project.
   * It wraps a ProblemDetails object in a neverthrow Result.err().
   *
   * @param message - Human-readable explanation specific to this error occurrence
   * @param timestamp - Optional ISO 8601 timestamp (defaults to current time if not provided)
   * @param instance - Optional URI reference identifying this specific error occurrence
   * @returns Result.err containing ProblemDetails with all error information
   *
   * @example
   * ```typescript
   * // Basic error
   * return StandardError.getOrDefault(404).error("File not found");
   *
   * // Error with instance URI for tracing
   * return StandardError.getOrDefault(404).error(
   *   "User not found",
   *   undefined,
   *   "/api/users/123"
   * );
   *
   * // Error with custom timestamp
   * const customTime = "2024-01-15T10:30:00.000Z";
   * return StandardError.getOrDefault(500).error("Server error", customTime);
   * ```
   */
  error(
    message: string,
    timestamp?: string,
    instance?: string,
  ): Result<never, ProblemDetails> {
    const problemDetails: ProblemDetails = {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: message,
      instance: instance,
      timestamp: timestamp ?? new Date().toISOString(),
    };
    return err(problemDetails);
  }
}

// Create the standard errors needed for this project
// Mapped to Assets Import domain error conditions from mapping-configuration-behavior.md

// 4xx Client Errors - User/Configuration Issues

// 400 Bad Request
// When the user submits an invalid mapping structure or incomplete configuration
// Examples: malformed mapping JSON, missing required field in mapping submission
StandardError.add(400, "Bad Request");

// 401 Unauthorized
// When the user lacks authentication or tokens have expired
// Examples: Missing Forge scopes, invalid refresh token, session timeout
StandardError.add(401, "Unauthorized");

// 403 Forbidden
// When the user has authenticated but lacks permission to access the resource
// Examples: User cannot access workspace, no permission to modify schema attributes
StandardError.add(403, "Forbidden");

// 404 Not Found
// When a required resource no longer exists or is unavailable
// Examples:
//   - Import execution deleted mid-processing (worker batch cannot submit)
//   - Object Type "Product" not found in schema (user didn't create it)
//   - Import source disappeared (user deleted import connection)
//   - Workspace schema no longer exists
StandardError.add(404, "Not Found");

// 416 Range Not Satisfiable
// When required attributes or configuration are missing from the schema
// Examples:
//   - Required attribute "Name" missing from Object Type
//   - Required attribute "Price" missing from Object Type
//   - Object Type has no attributes defined
//   - Batch parameters (skip/limit) are invalid for data size
StandardError.add(416, "Range Not Satisfiable");

// 422 Unprocessable Entity
// When the mapping is semantically invalid or incompatible with the schema
// Examples:
//   - DummyJSON field "title" cannot map to any schema attribute (name mismatch)
//   - Attribute name case mismatch ("name" vs "Name" - Assets is case-sensitive)
//   - Mapping references attribute that was deleted from schema
//   - External ID part designated but field doesn't exist in source data
StandardError.add(422, "Unprocessable Entity");

// 5xx Server Errors - Platform/Service Issues

// 500 Internal Server Error
// When an unexpected error occurs during import processing
// Examples:
//   - Unhandled exception during batch processing
//   - Unexpected state in queue processing
//   - Unexpected error during mapping submission to Assets
StandardError.add(500, "Internal Server Error");

// 502 Bad Gateway
// When external services are unreachable or returning errors
// Examples:
//   - DummyJSON API is down or returning 5xx errors
//   - Network connectivity lost to external data source
//   - Assets API temporarily unavailable
StandardError.add(502, "Bad Gateway");

// 503 Service Unavailable
// When Assets or Forge services are temporarily degraded or rate-limiting
// Examples:
//   - Assets service under maintenance
//   - Forge runtime temporarily degraded
//   - Rate limiting from Atlassian APIs (too many requests)
//   - Assets import queue is backed up
StandardError.add(503, "Service Unavailable");

/**
 * Standard shell exit codes
 * https://tldp.org/LDP/abs/html/exitcodes.html
 *
 * For our CLI applications:
 * - Exit with 0 on success
 * - Exit with 1 for any error (4xx or 5xx - prevents shell script continuation)
 *
 * This map documents standard POSIX shell exit codes for reference.
 */
export const ShellExitCodes = new Map<number, string>([
  [0, "Success"],
  [1, "Catchall for general errors"],
  [2, "Misuse of shell builtins"],
  [126, "Command invoked cannot execute"],
  [127, "Command not found"],
  [128, "Invalid argument to exit"],
  [130, "Script terminated by Control-C"],
  // 128+n, Fatal error signal "n": $PPID of script returns 137 (128 + 9)
  // 255*, Exit status out of range: exit takes only integer args in the range 0 - 255
]);
