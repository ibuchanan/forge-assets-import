/**
 * Assets API Types (Subset)
 *
 * Manually defined types for the Assets Import API endpoints we use.
 * These are based on docs/assets/openapi.json but defined manually
 * because the OpenAPI spec doesn't provide sufficient type information.
 *
 * Note: The generated types in assets-api-generated.d.ts mostly use `unknown`
 * due to missing schema definitions in the OpenAPI spec, so we define these
 * types manually based on the actual API responses we've observed.
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
