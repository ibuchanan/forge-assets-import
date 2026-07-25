import {
  err,
  errAsync,
  isProblemDetails,
  ok,
  okAsync,
  type ProblemDetails,
  type Result,
  ResultAsync,
  ShellExitCodes,
  StandardError,
  toErrorMessage,
} from "@forge-ahead/errors";

// Re-export so consumers only need to import from this module
export {
  err,
  errAsync,
  ok,
  okAsync,
  type ProblemDetails,
  type Result,
  ResultAsync,
  ShellExitCodes,
  StandardError,
};

/**
 * Build a ProblemDetails object for a status/message pair.
 *
 * StandardError.error() always returns Err (its Ok type is `never`), so
 * unwrapping via _unsafeUnwrapErr() here is safe and avoids a throwaway
 * Result.match() at every call site that just wants the ProblemDetails value.
 */
export function problemDetails(
  status: number,
  message: string,
): ProblemDetails {
  return StandardError.getOrDefault(status).error(message)._unsafeUnwrapErr();
}

/**
 * Extract ProblemDetails from a caught error, or build one from it
 *
 * @param error - The caught error (unknown type)
 * @param context - Context string for error message (e.g., "fetching schema")
 * @returns ProblemDetails object
 */
export function extractOrCreateProblemDetails(
  error: unknown,
  context: string,
): ProblemDetails {
  if (isProblemDetails(error)) {
    return error;
  }
  return problemDetails(
    502,
    `Network error while ${context}: ${toErrorMessage(error)}`,
  );
}

/**
 * Minimal shape shared by the Web API Response and Forge API Response types,
 * covering the methods validateHttpResponse needs.
 */
interface HttpLikeResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
  json(): Promise<unknown>;
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
  response: HttpLikeResponse,
  context: string,
): ResultAsync<HttpLikeResponse, ProblemDetails> {
  if (response.ok) {
    return okAsync(response);
  }

  return ResultAsync.fromPromise(
    response.text(),
    (error: unknown): ProblemDetails =>
      extractOrCreateProblemDetails(error, `validating ${context}`),
  ).andThen((errorText) =>
    errAsync(
      problemDetails(
        response.status,
        `Failed to ${context}: ${response.status} ${response.statusText} - ${errorText}`,
      ),
    ),
  );
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
