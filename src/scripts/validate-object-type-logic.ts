/**
 * Shared validation logic for object type validation
 *
 * This module contains the core validation logic used by both:
 * - scripts/validate-object-type.ts (CLI script)
 * - tests/scripts/validate-object-type.test.ts (tests)
 */

export interface ObjectTypeAttribute {
  id: string;
  name: string;
  defaultType: {
    id: number;
    name: string;
  };
}

export interface ValidationResult {
  attribute: string;
  expectedType: string;
  found: boolean;
  actualType?: string;
  caseMismatch?: boolean;
  typeMismatch?: boolean;
}

/**
 * Required attributes for the DummyJSON Products import
 * From: docs/object-type-setup-guide.md
 */
export const REQUIRED_ATTRIBUTES: Record<string, string> = {
  Name: "Text",
  Description: "Text",
  Price: "Number",
  Category: "Text",
  Brand: "Text",
  Rating: "Number",
  Stock: "Number",
};

/**
 * Assets API type IDs for attribute types
 */
export const ASSETS_TYPE_IDS: Record<number, string> = {
  0: "Text",
  1: "Number",
  2: "Boolean",
  3: "Date",
  4: "DateTime",
  5: "URL",
  6: "Email",
  7: "Textarea",
  8: "Select",
  9: "IP Address",
  10: "Reference",
  11: "User",
  12: "Group",
  13: "Version",
  14: "Project",
  15: "Status",
};

/**
 * Validate attributes against requirements
 */
export function validateAttributes(
  attributes: ObjectTypeAttribute[],
): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const [requiredName, expectedType] of Object.entries(
    REQUIRED_ATTRIBUTES,
  )) {
    // Find exact match (case-sensitive)
    const exactMatch = attributes.find((attr) => attr.name === requiredName);

    if (exactMatch) {
      const actualType =
        ASSETS_TYPE_IDS[exactMatch.defaultType.id] || "Unknown";
      const typesMatch =
        actualType === expectedType ||
        (expectedType === "Number" && actualType === "Integer") ||
        (expectedType === "Text" && actualType === "Textarea");

      results.push({
        attribute: requiredName,
        expectedType,
        found: true,
        actualType,
        typeMismatch: !typesMatch,
      });
    } else {
      // Check for case-insensitive match
      const caseInsensitiveMatch = attributes.find(
        (attr) => attr.name.toLowerCase() === requiredName.toLowerCase(),
      );

      if (caseInsensitiveMatch) {
        results.push({
          attribute: requiredName,
          expectedType,
          found: false,
          actualType: ASSETS_TYPE_IDS[caseInsensitiveMatch.defaultType.id],
          caseMismatch: true,
        });
      } else {
        results.push({
          attribute: requiredName,
          expectedType,
          found: false,
        });
      }
    }
  }

  return results;
}
