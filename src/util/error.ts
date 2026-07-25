import {
  err,
  errAsync,
  ok,
  okAsync,
  type ProblemDetails,
  problemDetails,
  type Result,
  ResultAsync,
  ShellExitCodes,
  StandardError,
  toProblemDetails,
  validateHttpResponse,
} from "@forge-ahead/errors";

// Re-export so consumers only need to import from this module
export {
  err,
  errAsync,
  ok,
  okAsync,
  type ProblemDetails,
  problemDetails,
  type Result,
  ResultAsync,
  ShellExitCodes,
  StandardError,
  toProblemDetails,
  validateHttpResponse,
};

/**
 * Extract ProblemDetails from a caught error, or build one from it.
 *
 * Thin alias over @forge-ahead/errors' toProblemDetails, defaulting to a
 * 502 (network/upstream failure) since this project's call sites use it
 * exclusively for errors thrown while making an outbound HTTP request.
 *
 * @param error - The caught error (unknown type)
 * @param context - Context string for error message (e.g., "fetching schema")
 * @returns ProblemDetails object
 */
export function extractOrCreateProblemDetails(
  error: unknown,
  context: string,
): ProblemDetails {
  return toProblemDetails(error, 502, context);
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
