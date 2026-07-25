/**
 * Tests for the structured Product field mapping definition and the
 * UI-preview row builder derived from it.
 */

import { describe, expect, it } from "vitest";
import {
  buildAttributesMapping,
  buildMappingRows,
  PRODUCT_FIELD_MAPPINGS,
  validateProductMapping,
} from "../../src/assets/product-mapping";

describe("PRODUCT_FIELD_MAPPINGS", () => {
  it("expects the same Assets attribute types as the real Product object schema", () => {
    // Known-good values from tests/data/payload/mapping-configuration.json,
    // a captured real Assets schema response for the Product object type.
    const expectedAssetsTypeBySourceField: Record<string, string> = {
      key: "text",
      name: "text",
      description: "text",
      price: "double",
      category: "text",
      brand: "text",
      rating: "double",
      stock: "integer",
    };

    for (const fieldMapping of PRODUCT_FIELD_MAPPINGS) {
      expect(fieldMapping.expectedAssetsType).toBe(
        expectedAssetsTypeBySourceField[fieldMapping.sourceField],
      );
    }
  });
});

describe("buildMappingRows", () => {
  it("returns one row per field mapping, copying its display fields and marking it mapped when the attribute exists", () => {
    const objectType = {
      name: "Product",
      attributes: PRODUCT_FIELD_MAPPINGS.map((fieldMapping) => ({
        name: fieldMapping.assetsField,
        externalId: `attr-${fieldMapping.assetsField}`,
      })),
    };

    const rows = buildMappingRows(objectType);

    expect(rows).toHaveLength(PRODUCT_FIELD_MAPPINGS.length);
    rows.forEach((row, index) => {
      const fieldMapping = PRODUCT_FIELD_MAPPINGS[index];
      expect(row.sourceField).toBe(fieldMapping.sourceField);
      expect(row.assetsField).toBe(fieldMapping.assetsField);
      expect(row.type).toBe(fieldMapping.expectedAssetsType);
      expect(row.description).toBe(fieldMapping.description);
      expect(row.mapped).toBe(true);
    });
  });

  it("marks a row unmapped when its Assets attribute is absent from the object type", () => {
    const objectType = {
      name: "Product",
      attributes: [{ name: "Name", externalId: "attr-Name" }],
    };

    const rows = buildMappingRows(objectType);

    const brandRow = rows.find((row) => row.assetsField === "Brand");
    expect(brandRow?.mapped).toBe(false);

    const nameRow = rows.find((row) => row.assetsField === "Name");
    expect(nameRow?.mapped).toBe(true);
  });
});

describe("validateProductMapping", () => {
  it("reports a missing-product-type issue and is invalid when no Product object type is given", () => {
    const report = validateProductMapping(undefined);

    expect(report.valid).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ type: "missing-product-type" }),
    );
  });

  it("reports a missing-required-attribute issue per missing required attribute, but not for missing Brand", () => {
    const objectType = {
      name: "Product",
      attributes: [{ name: "Key", externalId: "attr-Key" }],
    };

    const report = validateProductMapping(objectType);

    expect(report.valid).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        type: "missing-required-attribute",
        field: "Name",
      }),
    );
    expect(report.issues).not.toContainEqual(
      expect.objectContaining({ field: "Brand" }),
    );
  });

  it("reports every missing required attribute together in one report, rather than stopping at the first", () => {
    const objectType = {
      name: "Product",
      attributes: [{ name: "Key", externalId: "attr-Key" }],
    };

    const report = validateProductMapping(objectType);

    const missingFields = report.issues
      .filter((issue) => issue.type === "missing-required-attribute")
      .map((issue) => issue.field);

    expect(missingFields).toEqual(
      expect.arrayContaining([
        "Name",
        "Description",
        "Price",
        "Category",
        "Rating",
        "Stock",
      ]),
    );
    expect(missingFields).not.toContain("Brand");
  });

  it("reports a missing-external-id issue when a matched attribute has no externalId", () => {
    const objectType = {
      name: "Product",
      attributes: PRODUCT_FIELD_MAPPINGS.map((fieldMapping) => ({
        name: fieldMapping.assetsField,
        externalId:
          fieldMapping.assetsField === "Key"
            ? undefined
            : `attr-${fieldMapping.assetsField}`,
      })),
    };

    const report = validateProductMapping(objectType);

    expect(report.valid).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        type: "missing-external-id",
        field: "Key",
      }),
    );
  });

  it("does not report a missing-external-id issue for an optional Brand attribute that has no externalId", () => {
    const objectType = {
      name: "Product",
      attributes: PRODUCT_FIELD_MAPPINGS.map((fieldMapping) => ({
        name: fieldMapping.assetsField,
        externalId:
          fieldMapping.assetsField === "Brand"
            ? undefined
            : `attr-${fieldMapping.assetsField}`,
      })),
    };

    const report = validateProductMapping(objectType);

    expect(report.valid).toBe(true);
    expect(report.issues).not.toContainEqual(
      expect.objectContaining({ field: "Brand" }),
    );
  });

  it("reports a non-blocking type-warning when a matched attribute's type disagrees with the expected Assets type", () => {
    const objectType = {
      name: "Product",
      attributes: PRODUCT_FIELD_MAPPINGS.map((fieldMapping) => ({
        name: fieldMapping.assetsField,
        externalId: `attr-${fieldMapping.assetsField}`,
        type:
          fieldMapping.assetsField === "Price"
            ? "Text"
            : fieldMapping.expectedAssetsType,
      })),
    };

    const report = validateProductMapping(objectType);

    expect(report.valid).toBe(true);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ type: "type-warning", field: "Price" }),
    );
  });
});

describe("buildAttributesMapping", () => {
  it("builds one attributesMapping entry per matched attribute, using its externalId, locator, and externalIdPart flag", () => {
    const objectType = {
      name: "Product",
      attributes: PRODUCT_FIELD_MAPPINGS.map((fieldMapping) => ({
        name: fieldMapping.assetsField,
        externalId: `attr-${fieldMapping.assetsField}`,
      })),
    };

    const { attributesMapping, report } = buildAttributesMapping(objectType);

    expect(report.valid).toBe(true);
    expect(attributesMapping).toHaveLength(PRODUCT_FIELD_MAPPINGS.length);

    const keyEntry = attributesMapping.find(
      (entry) => entry.attributeName === "Key",
    );
    expect(keyEntry).toEqual({
      attributeExternalId: "attr-Key",
      attributeName: "Key",
      attributeLocators: ["key"],
      externalIdPart: true,
    });

    const nameEntry = attributesMapping.find(
      (entry) => entry.attributeName === "Name",
    );
    expect(nameEntry).toEqual({
      attributeExternalId: "attr-Name",
      attributeName: "Name",
      attributeLocators: ["name"],
      externalIdPart: false,
    });
  });

  it("omits Brand from attributesMapping when it is unavailable, without affecting validity", () => {
    const objectType = {
      name: "Product",
      attributes: PRODUCT_FIELD_MAPPINGS.filter(
        (fieldMapping) => fieldMapping.assetsField !== "Brand",
      ).map((fieldMapping) => ({
        name: fieldMapping.assetsField,
        externalId: `attr-${fieldMapping.assetsField}`,
      })),
    };

    const { attributesMapping, report } = buildAttributesMapping(objectType);

    expect(report.valid).toBe(true);
    expect(
      attributesMapping.some((entry) => entry.attributeName === "Brand"),
    ).toBe(false);
    expect(attributesMapping).toHaveLength(PRODUCT_FIELD_MAPPINGS.length - 1);
  });

  it("omits a required-but-missing attribute from attributesMapping and reports it invalid", () => {
    const objectType = {
      name: "Product",
      attributes: PRODUCT_FIELD_MAPPINGS.filter(
        (fieldMapping) => fieldMapping.assetsField !== "Name",
      ).map((fieldMapping) => ({
        name: fieldMapping.assetsField,
        externalId: `attr-${fieldMapping.assetsField}`,
      })),
    };

    const { attributesMapping, report } = buildAttributesMapping(objectType);

    expect(report.valid).toBe(false);
    expect(
      attributesMapping.some((entry) => entry.attributeName === "Name"),
    ).toBe(false);
  });
});
