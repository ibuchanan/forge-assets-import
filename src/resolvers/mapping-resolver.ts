/**
 * Backend resolver for building mapping configuration
 *
 * This resolver handles the mapping configuration logic in the backend
 * where we have proper logging and can debug Assets API responses.
 */

import { getSchemaAndMapping, submitMapping } from "../assets/import-client";
import { logStructured } from "../forge/logging";
import type { ProblemDetails } from "../util/error";
import {
  errAsync,
  okAsync,
  problemDetails,
  type ResultAsync,
} from "../util/error";

/**
 * Request payload from frontend for building mapping
 */
export interface BuildMappingRequest {
  payload: {
    workspaceId: string;
    schemaId: string;
    importId: string;
  };
  context?: unknown;
}

/**
 * Request payload from frontend for submitting mapping
 */
export interface SubmitMappingRequest {
  payload: {
    workspaceId: string;
    importId: string;
    mapping: {
      schema: {
        objectSchema: {
          name: string;
          description: string;
          objectTypes: Array<{
            externalId: string;
            name: string;
            description: string;
            attributes: Array<{
              externalId: string;
              name: string;
              description: string;
              type: string;
              minimumCardinality: number;
              maximumCardinality: number;
              unique: boolean;
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
    };
  };
  context?: unknown;
}

/**
 * Mapping between DummyJSON product fields and Assets attributes
 */
export const FIELD_TO_ATTRIBUTE_MAP: Record<string, string> = {
  id: "Key", // Product ID as unique identifier
  title: "Name",
  description: "Description",
  price: "Price",
  category: "Category",
  brand: "Brand",
  rating: "Rating",
  stock: "Stock",
};

/**
 * Build attribute mappings using existing external IDs from Assets
 */
function buildAttributesMappings(objectType: {
  externalId?: string;
  name: string;
  attributes?: Array<{
    externalId?: string;
    name: string;
  }>;
}): ResultAsync<
  Array<{
    attributeExternalId: string;
    attributeName: string;
    attributeLocators: string[];
    externalIdPart?: boolean;
  }>,
  ProblemDetails
> {
  const attributes = objectType.attributes || [];

  if (attributes.length === 0) {
    return errAsync(
      problemDetails(
        416,
        `Object type '${objectType.name}' has no attributes. Please add the following attributes: Name, Description, Price, Category, Brand, Rating, Stock.`,
      ),
    );
  }

  const mappings = [];

  for (const [dummyJsonField, assetAttributeName] of Object.entries(
    FIELD_TO_ATTRIBUTE_MAP,
  )) {
    const attribute = attributes.find(
      (attr) => attr.name === assetAttributeName,
    );

    if (!attribute) {
      logStructured(
        "error",
        "buildAttributesMappings",
        "Required attribute not found",
        {
          attributeName: assetAttributeName,
          objectTypeName: objectType.name,
        },
      );
      return errAsync(
        problemDetails(
          416,
          `Required attribute '${assetAttributeName}' not found in object type. ` +
            `Please add this attribute with the exact name '${assetAttributeName}' (case-sensitive). ` +
            `Required attributes: Name, Description, Price, Category, Brand, Rating, Stock.`,
        ),
      );
    }

    // Use the external ID that Assets has already assigned
    if (!attribute.externalId) {
      logStructured(
        "error",
        "buildAttributesMappings",
        "Attribute missing externalId",
        {
          attributeName: assetAttributeName,
          objectTypeName: objectType.name,
        },
      );
      return errAsync(
        problemDetails(
          416,
          `Attribute '${assetAttributeName}' has no externalId. This should not happen - Assets should assign external IDs automatically.`,
        ),
      );
    }

    mappings.push({
      attributeExternalId: attribute.externalId,
      attributeName: assetAttributeName,
      attributeLocators: [dummyJsonField],
      externalIdPart: assetAttributeName === "Key", // Use product ID as the unique external identifier
    });
  }

  logStructured("info", "buildAttributesMappings", "Built attribute mappings", {
    count: mappings.length,
  });
  return okAsync(mappings);
}

/**
 * Main resolver function for building mapping
 */
export async function buildMappingBackend(
  req: BuildMappingRequest,
): Promise<{ success: boolean; data?: unknown; error?: ProblemDetails }> {
  const { workspaceId, importId } = req.payload;

  if (!workspaceId || !importId) {
    logStructured(
      "error",
      "buildMappingBackend",
      "Missing required parameters",
      {
        hasWorkspaceId: !!workspaceId,
        hasImportId: !!importId,
      },
    );
    return {
      success: false,
      error: problemDetails(
        400,
        "Missing required parameters: workspaceId and importId",
      ),
    };
  }

  try {
    const result = await getSchemaAndMapping(workspaceId, importId)
      .andThen((schemaAndMapping) => {
        // Find the Product object type in the schema
        const objectTypes =
          schemaAndMapping.schema?.objectSchema?.objectTypes || [];
        const productObjectType = objectTypes.find(
          (ot) => ot.name === "Product",
        );

        if (!productObjectType) {
          const availableTypes =
            objectTypes.map((ot) => ot.name).join(", ") || "none";
          logStructured(
            "error",
            "buildMappingBackend",
            "Product object type not found",
            {
              workspaceId,
              importId,
              availableTypes,
            },
          );

          return errAsync(
            problemDetails(
              404,
              `Object type "Product" not found in schema. Available object types: ${availableTypes}. Please ensure the schema contains an object type named "Product" (case-sensitive).`,
            ),
          );
        }

        logStructured(
          "info",
          "buildMappingBackend",
          "Found Product object type",
          {
            workspaceId,
            importId,
            objectTypeExternalId: productObjectType.externalId,
            attributeCount: productObjectType.attributes?.length || 0,
          },
        );

        // Log all attributes returned from Assets
        if (
          productObjectType.attributes &&
          productObjectType.attributes.length > 0
        ) {
          logStructured(
            "debug",
            "buildMappingBackend",
            "Product attributes from Assets",
            {
              workspaceId,
              importId,
              attributes: productObjectType.attributes.map((attr) => ({
                name: attr.name,
                externalId: attr.externalId,
              })),
            },
          );
        } else {
          logStructured(
            "warn",
            "buildMappingBackend",
            "Product object type has no attributes",
            {
              workspaceId,
              importId,
            },
          );
        }

        return okAsync({ schemaAndMapping, productObjectType });
      })
      .andThen(({ schemaAndMapping, productObjectType }) => {
        return buildAttributesMappings(productObjectType).map(
          (attributesMapping) => ({
            schemaAndMapping,
            productObjectType,
            attributesMapping,
          }),
        );
      })
      .map(({ schemaAndMapping, productObjectType, attributesMapping }) => {
        // NOTE: Schema version mismatch:
        // - OpenAPI spec (docs/assets/openapi.json) references schema version: 2021_09_15
        // - Production API validates against schema version: 2023_10_19
        // The newer schema version has stricter validation requiring:
        // 1. "schema" property at root level (not optional)
        // 2. "description" field in each objectTypeMapping (required)
        // This code includes both to satisfy the production API validation.
        //
        // IMPORTANT: We use the externalId values that Assets has already assigned
        // to the Product object type and its attributes. These were fetched from
        // the schema-and-mapping endpoint.
        // See docs/assets/external-identifiers.md for details.

        // Build schema from the fetched schemaAndMapping, but remove empty iconSchema
        // The iconSchema validation requires at least 1 icon, so we omit it if empty
        const schema = schemaAndMapping.schema
          ? JSON.parse(JSON.stringify(schemaAndMapping.schema))
          : {
              objectSchema: {
                name: "Products",
                description: "Product schema for DummyJSON imports",
                objectTypes: [],
              },
            };

        // Remove iconSchema if it exists and has no icons
        if (schema && typeof schema === "object" && "iconSchema" in schema) {
          const iconSchema = schema.iconSchema as
            | { icons?: unknown[] }
            | undefined;
          if (!iconSchema?.icons || iconSchema.icons.length === 0) {
            delete schema.iconSchema;
          }
        }

        const mapping = {
          schema,
          mapping: {
            objectTypeMappings: [
              {
                objectTypeExternalId: productObjectType.externalId || "",
                objectTypeName: productObjectType.name,
                selector: "products",
                description: "Mapping for Product objects from DummyJSON API",
                attributesMapping,
              },
            ],
          },
        };

        logStructured(
          "debug",
          "buildMappingBackend",
          "Complete mapping configuration",
          {
            workspaceId,
            importId,
            mapping,
          },
        );

        // Log summary of what we're mapping
        const firstMapping = mapping.mapping.objectTypeMappings[0];
        if (firstMapping) {
          const externalIdParts = firstMapping.attributesMapping.filter(
            (am) => am.externalIdPart,
          );

          logStructured("info", "buildMappingBackend", "Mapping summary", {
            workspaceId,
            importId,
            selector: firstMapping.selector,
            externalIdPartCount: externalIdParts.length,
          });

          // Validate that we have exactly one externalIdPart
          if (externalIdParts.length === 0) {
            logStructured(
              "warn",
              "buildMappingBackend",
              "No externalIdPart defined",
              {
                workspaceId,
                importId,
              },
            );
          } else if (externalIdParts.length > 1) {
            logStructured(
              "warn",
              "buildMappingBackend",
              "Multiple externalIdParts defined",
              {
                workspaceId,
                importId,
                externalIdPartCount: externalIdParts.length,
              },
            );
          } else {
            const firstExternalIdPart = externalIdParts[0];
            if (firstExternalIdPart) {
              logStructured(
                "info",
                "buildMappingBackend",
                "External ID part configured",
                {
                  workspaceId,
                  importId,
                  externalIdPartAttribute: firstExternalIdPart.attributeName,
                },
              );
            }
          }
        }
        return mapping;
      });

    if (result.isErr()) {
      logStructured("error", "buildMappingBackend", "Error building mapping", {
        workspaceId,
        importId,
        errorDetails: result.error,
      });
      const error = result.error as ProblemDetails;
      return {
        success: false,
        error,
      };
    }

    return {
      success: true,
      data: result.value,
    };
  } catch (error) {
    logStructured(
      "error",
      "buildMappingBackend",
      "Unexpected error in buildMapping",
      {
        workspaceId,
        importId,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    );
    return {
      success: false,
      error: problemDetails(
        500,
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      ),
    };
  }
}

/**
 * Submit mapping configuration to Assets Import API
 *
 * This resolver handles the submission of the mapping to the Assets API
 * with proper logging for observability.
 */
export async function submitMappingBackend(
  req: SubmitMappingRequest,
): Promise<{ success: boolean; error?: ProblemDetails }> {
  const { workspaceId, importId, mapping } = req.payload;

  if (!workspaceId || !importId || !mapping) {
    logStructured(
      "error",
      "submitMappingBackend",
      "Missing required parameters",
      {
        hasWorkspaceId: !!workspaceId,
        hasImportId: !!importId,
        hasMapping: !!mapping,
      },
    );
    return {
      success: false,
      error: problemDetails(
        400,
        "Missing required parameters: workspaceId, importId, and mapping",
      ),
    };
  }

  const objectTypeMappings = mapping.mapping.objectTypeMappings;

  logStructured(
    "info",
    "submitMappingBackend",
    "Submitting mapping to Assets",
    {
      workspaceId,
      importId,
      objectTypeMappingCount: objectTypeMappings.length,
      api: {
        method: "PUT",
        path: `/jsm/assets/workspace/${workspaceId}/v1/importsource/${importId}/mapping`,
      },
    },
  );

  try {
    const result = await submitMapping(workspaceId, importId, mapping).map(
      () => {
        logStructured(
          "info",
          "submitMappingBackend",
          "Mapping submitted successfully",
          {
            workspaceId,
            importId,
          },
        );
        return true;
      },
    );

    if (result.isErr()) {
      logStructured(
        "error",
        "submitMappingBackend",
        "Final error submitting mapping",
        {
          workspaceId,
          importId,
          errorDetails: result.error,
        },
      );
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    logStructured(
      "error",
      "submitMappingBackend",
      "Unexpected error in submitMapping",
      {
        workspaceId,
        importId,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    );
    return {
      success: false,
      error: problemDetails(
        500,
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      ),
    };
  }
}
