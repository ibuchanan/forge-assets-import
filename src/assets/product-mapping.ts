/**
 * Structured mapping between normalized Product records and Assets attributes.
 *
 * This is the single source of truth for how DummyJSON products map onto the
 * Product object type in Assets, used to build both the UI preview and the
 * Assets Import mapping request body.
 */

export interface FieldMappingDefinition {
  sourceField: string;
  assetsField: string;
  sourceType: "string" | "number";
  expectedAssetsType: string;
  required: boolean;
  description: string;
  externalIdPart?: boolean;
}

export const PRODUCT_FIELD_MAPPINGS: FieldMappingDefinition[] = [
  {
    sourceField: "key",
    assetsField: "Key",
    sourceType: "number",
    expectedAssetsType: "Integer",
    required: true,
    description: "Unique product identifier (used as external ID)",
    externalIdPart: true,
  },
  {
    sourceField: "name",
    assetsField: "Name",
    sourceType: "string",
    expectedAssetsType: "Text",
    required: true,
    description: "Product name/title",
  },
  {
    sourceField: "description",
    assetsField: "Description",
    sourceType: "string",
    expectedAssetsType: "Textarea",
    required: true,
    description: "Detailed product description",
  },
  {
    sourceField: "price",
    assetsField: "Price",
    sourceType: "number",
    expectedAssetsType: "Float",
    required: true,
    description: "Product price in USD",
  },
  {
    sourceField: "category",
    assetsField: "Category",
    sourceType: "string",
    expectedAssetsType: "Text",
    required: true,
    description: "Product category",
  },
  {
    sourceField: "brand",
    assetsField: "Brand",
    sourceType: "string",
    expectedAssetsType: "Text",
    required: false,
    description: "Product brand/manufacturer",
  },
  {
    sourceField: "rating",
    assetsField: "Rating",
    sourceType: "number",
    expectedAssetsType: "Integer",
    required: true,
    description: "Product rating (0-5)",
  },
  {
    sourceField: "stock",
    assetsField: "Stock",
    sourceType: "number",
    expectedAssetsType: "Integer",
    required: true,
    description: "Available stock quantity",
  },
];

export interface MappingRow {
  sourceField: string;
  assetsField: string;
  type: string;
  description: string;
  required: boolean;
  mapped: boolean;
}

interface ObjectTypeLike {
  name: string;
  attributes?: Array<{
    externalId?: string;
    name: string;
    type?: string;
  }>;
}

export interface ValidationIssue {
  type:
    | "missing-product-type"
    | "missing-required-attribute"
    | "missing-external-id"
    | "type-warning";
  field?: string;
  message: string;
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
}

export function validateProductMapping(
  productObjectType: ObjectTypeLike | undefined,
): ValidationReport {
  if (!productObjectType) {
    return {
      valid: false,
      issues: [
        {
          type: "missing-product-type",
          message: 'Object type "Product" not found in schema.',
        },
      ],
    };
  }

  const attributes = productObjectType.attributes || [];
  const issues: ValidationIssue[] = [];

  for (const fieldMapping of PRODUCT_FIELD_MAPPINGS) {
    const attribute = attributes.find(
      (attr) => attr.name === fieldMapping.assetsField,
    );

    if (!attribute) {
      if (fieldMapping.required) {
        issues.push({
          type: "missing-required-attribute",
          field: fieldMapping.assetsField,
          message: `Required attribute '${fieldMapping.assetsField}' not found in object type '${productObjectType.name}'.`,
        });
      }
      continue;
    }

    if (fieldMapping.required && !attribute.externalId) {
      issues.push({
        type: "missing-external-id",
        field: fieldMapping.assetsField,
        message: `Attribute '${fieldMapping.assetsField}' has no externalId.`,
      });
    }

    if (attribute.type && attribute.type !== fieldMapping.expectedAssetsType) {
      issues.push({
        type: "type-warning",
        field: fieldMapping.assetsField,
        message: `Attribute '${fieldMapping.assetsField}' has type '${attribute.type}', expected '${fieldMapping.expectedAssetsType}'.`,
      });
    }
  }

  const blockingIssues = issues.filter(
    (issue) => issue.type !== "type-warning",
  );
  return { valid: blockingIssues.length === 0, issues };
}

export interface AttributeMapping {
  attributeExternalId: string;
  attributeName: string;
  attributeLocators: string[];
  externalIdPart?: boolean;
}

export function buildAttributesMapping(
  productObjectType: ObjectTypeLike | undefined,
): { attributesMapping: AttributeMapping[]; report: ValidationReport } {
  const report = validateProductMapping(productObjectType);
  const attributes = productObjectType?.attributes || [];

  const attributesMapping: AttributeMapping[] = [];

  for (const fieldMapping of PRODUCT_FIELD_MAPPINGS) {
    const attribute = attributes.find(
      (attr) => attr.name === fieldMapping.assetsField,
    );

    if (!attribute?.externalId) {
      continue;
    }

    attributesMapping.push({
      attributeExternalId: attribute.externalId,
      attributeName: fieldMapping.assetsField,
      attributeLocators: [fieldMapping.sourceField],
      externalIdPart: fieldMapping.externalIdPart ?? false,
    });
  }

  return { attributesMapping, report };
}

export function buildMappingRows(objectType: ObjectTypeLike): MappingRow[] {
  const attributes = objectType.attributes || [];

  return PRODUCT_FIELD_MAPPINGS.map((fieldMapping) => ({
    sourceField: fieldMapping.sourceField,
    assetsField: fieldMapping.assetsField,
    type: fieldMapping.expectedAssetsType,
    description: fieldMapping.description,
    required: fieldMapping.required,
    mapped: attributes.some((attr) => attr.name === fieldMapping.assetsField),
  }));
}
