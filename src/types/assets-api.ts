/**
 * Assets API Types (Subset)
 *
 * Hand-written types for the Assets Import API endpoints this app calls,
 * based on actual API responses observed during development. The Assets
 * Import OpenAPI spec doesn't declare JSON Schemas for these bodies (only
 * examples), so generated types — whether from this repo's own
 * `openapi-typescript` run or the packaged `@forge-ahead/atlassian-api-types`
 * — can only type these bodies as `unknown`. See docs/api-type-audit.md for
 * the full comparison.
 *
 * Note: as of the audit, none of the interfaces below are actually imported
 * by application code — see docs/api-type-audit.md, Finding 0. Real Assets
 * Import response handling currently lives in scattered local interfaces in
 * `src/resolvers/mapping-resolver.ts` and `src/import-lifecycle/status.ts`
 * (and is untyped entirely in `src/import-lifecycle/start.ts`). This file is
 * kept as a documented reference shape for whoever consolidates that drift,
 * not as code currently wired into the app.
 */

// ============================================================================
// Schema and Mapping Endpoint
// ============================================================================

/**
 * GET /importsource/{importSourceId}/schema-and-mapping
 * Returns the complete schema with auto-assigned external IDs
 */
export interface SchemaAndMappingResponse {
  schema?: {
    objectSchema?: {
      name?: string;
      description?: string;
      objectTypes?: Array<{
        externalId?: string;
        name: string;
        description?: string;
        attributes?: Array<{
          externalId?: string;
          name: string;
          description?: string;
          type?: string;
          minimumCardinality?: number;
          maximumCardinality?: number;
          unique?: boolean;
        }>;
      }>;
    };
    iconSchema?: {
      icons?: Array<unknown>;
    };
  };
  mapping?: {
    objectTypeMappings?: Array<{
      objectTypeExternalId?: string;
      objectTypeName?: string;
      selector?: string;
      description?: string;
      attributesMapping?: Array<{
        attributeExternalId?: string;
        attributeName?: string;
        attributeLocators?: string[];
        externalIdPart?: boolean;
      }>;
    }>;
  };
}

// ============================================================================
// Configuration Status Endpoint
// ============================================================================

/**
 * GET /importsource/{importSourceId}/configstatus
 * Returns the current configuration status of the import source
 *
 * Possible status values: "IDLE", "DISABLED", "MISSING_MAPPING", "RUNNING"
 */
export interface ConfigStatusResponse {
  status: string;
}

// ============================================================================
// Mapping Configuration Endpoint
// ============================================================================

/**
 * PUT /importsource/{importSourceId}/mapping
 * Request body for submitting or updating mapping configuration
 */
export interface MappingRequest {
  schema?: {
    objectSchema?: {
      name?: string;
      description?: string;
      objectTypes?: Array<{
        externalId?: string;
        name: string;
        description?: string;
        attributes?: Array<{
          externalId?: string;
          name: string;
          description?: string;
          type?: string;
          minimumCardinality?: number;
          maximumCardinality?: number;
          unique?: boolean;
        }>;
      }>;
    };
  };
  mapping: {
    objectTypeMappings: Array<{
      objectTypeExternalId: string;
      objectTypeName: string;
      selector: string;
      description: string;
      attributesMapping: Array<{
        attributeExternalId: string;
        attributeName: string;
        attributeLocators: string[];
        externalIdPart?: boolean;
      }>;
    }>;
  };
}

/**
 * PUT /importsource/{importSourceId}/mapping
 * Response from submitting mapping (typically empty on success)
 */
export interface MappingResponse {
  [key: string]: unknown;
}

// ============================================================================
// Import Executions Endpoint
// ============================================================================

/**
 * POST /importsource/{importSourceId}/executions
 * Request body for starting a new import execution
 */
export interface StartExecutionRequest {
  [key: string]: unknown;
}

/**
 * POST /importsource/{importSourceId}/executions
 * Response after starting a new import execution
 */
export interface StartExecutionResponse {
  id?: string;
  status?: string;
  [key: string]: unknown;
}

/**
 * DELETE /importsource/{importSourceId}/executions/{importExecutionId}
 * Response after cancelling/deleting an execution
 */
export interface DeleteExecutionResponse {
  [key: string]: unknown;
}
