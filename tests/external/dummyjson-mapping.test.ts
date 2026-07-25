/**
 * Tests to validate that the structured Product field mapping configuration
 * matches the actual structure of normalized DummyJSON product data.
 *
 * These tests catch configuration errors at development time
 * rather than discovering them at runtime when data fails to import.
 *
 * @see {@link https://developer.atlassian.com/cloud/assets/imports-rest-api-guide/|Assets Imports REST API Guide}
 * @see {@link https://dummyjson.com|DummyJSON API Documentation}
 *
 * NOTE: Uses mocked DummyJSON responses from tests/data/external/dummyjson-products.json
 * to ensure fast, deterministic tests that work offline without external API calls.
 *
 * Local reference: src/assets/product-mapping.ts, src/external/dummyjson-client.ts,
 * docs/assets/mapping-configuration-guide.md
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRODUCT_FIELD_MAPPINGS } from "../../src/assets/product-mapping";
import { toProductRecord } from "../../src/external/dummyjson-client";
import dummyjsonProducts from "../data/external/dummyjson-products.json";

describe("DummyJSON Mapping Configuration", () => {
  beforeEach(() => {
    // Mock fetch to return test data instead of calling real API
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => dummyjsonProducts,
          }) as Response,
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("field existence validation", () => {
    it("should verify every mapped sourceField exists on the normalized product record", async () => {
      const response = await fetch(
        "https://dummyjson.com/products?limit=1&skip=0",
      );
      expect(response.ok).toBe(true);

      const data = (await response.json()) as {
        products: Array<Record<string, unknown>>;
      };
      expect(data.products).toBeDefined();
      expect(data.products.length).toBeGreaterThan(0);

      // biome-ignore lint/suspicious/noExplicitAny: raw DummyJSON fixture shape
      const normalized = toProductRecord(data.products[0] as any);

      const missingFields: string[] = [];
      for (const fieldMapping of PRODUCT_FIELD_MAPPINGS) {
        if (!(fieldMapping.sourceField in normalized)) {
          missingFields.push(fieldMapping.sourceField);
        }
      }

      expect(
        missingFields,
        `The following sourceFields are in PRODUCT_FIELD_MAPPINGS but missing from the normalized product record: ${missingFields.join(", ")}. ` +
          `Available fields: ${Object.keys(normalized).join(", ")}`,
      ).toEqual([]);
    });

    it("should verify the Key field (unique identifier) exists in normalized data", async () => {
      const response = await fetch(
        "https://dummyjson.com/products?limit=1&skip=0",
      );
      const data = (await response.json()) as {
        products: Array<Record<string, unknown>>;
      };
      // biome-ignore lint/suspicious/noExplicitAny: raw DummyJSON fixture shape
      const normalized = toProductRecord(data.products[0] as any);

      const keyField = PRODUCT_FIELD_MAPPINGS.find(
        (fieldMapping) => fieldMapping.assetsField === "Key",
      )?.sourceField;

      expect(keyField).toBeDefined();
      expect(
        normalized,
        `The unique identifier field "${keyField}" must exist in the normalized product record`,
      ).toHaveProperty(keyField as string);
    });

    it("should verify all mapped fields have non-null values in sample data", async () => {
      const response = await fetch(
        "https://dummyjson.com/products?limit=5&skip=0",
      );
      const data = (await response.json()) as {
        products: Array<Record<string, unknown>>;
      };

      const normalizedProducts = data.products.map((product) =>
        // biome-ignore lint/suspicious/noExplicitAny: raw DummyJSON fixture shape
        toProductRecord(product as any),
      );
      const fieldsWithNullValues = new Set<string>();

      for (const product of normalizedProducts) {
        for (const fieldMapping of PRODUCT_FIELD_MAPPINGS) {
          const value = (product as Record<string, unknown>)[
            fieldMapping.sourceField
          ];
          if (value === null || value === undefined) {
            fieldsWithNullValues.add(fieldMapping.sourceField);
          }
        }
      }

      expect(
        Array.from(fieldsWithNullValues),
        `The following mapped fields have null/undefined values in some products: ${Array.from(fieldsWithNullValues).join(", ")}. ` +
          `This may cause import failures.`,
      ).toEqual([]);
    });
  });

  describe("field type validation", () => {
    it("should verify field types match expected Assets attribute types", async () => {
      const response = await fetch(
        "https://dummyjson.com/products?limit=1&skip=0",
      );
      const data = (await response.json()) as {
        products: Array<Record<string, unknown>>;
      };
      // biome-ignore lint/suspicious/noExplicitAny: raw DummyJSON fixture shape
      const normalized = toProductRecord(data.products[0] as any) as Record<
        string,
        unknown
      >;

      for (const fieldMapping of PRODUCT_FIELD_MAPPINGS) {
        const expectedJsType =
          fieldMapping.sourceType === "number" ? "number" : "string";
        expect(typeof normalized[fieldMapping.sourceField]).toBe(
          expectedJsType,
        );
      }
    });

    it("should verify the unique identifier field is suitable for use as external ID", async () => {
      const response = await fetch(
        "https://dummyjson.com/products?limit=10&skip=0",
      );
      const data = (await response.json()) as {
        products: Array<Record<string, unknown>>;
      };

      const keyField = PRODUCT_FIELD_MAPPINGS.find(
        (fieldMapping) => fieldMapping.assetsField === "Key",
      )?.sourceField as string;

      const keyValues = data.products.map(
        (product) =>
          (toProductRecord(product as never) as Record<string, unknown>)[
            keyField
          ],
      );

      // Check all values are truthy
      const emptyValues = keyValues.filter((v) => !v);
      expect(
        emptyValues,
        `Key field "${keyField}" has empty values which cannot be used as unique identifier`,
      ).toEqual([]);

      // Check all values are unique
      const uniqueValues = new Set(keyValues);
      expect(
        uniqueValues.size,
        `Key field "${keyField}" has duplicate values: found ${keyValues.length} products but only ${uniqueValues.size} unique values`,
      ).toBe(keyValues.length);
    });
  });

  describe("schema compatibility", () => {
    it("should document the expected Product object type schema", () => {
      // This test documents what the Product object type schema should contain
      // The actual schema is created manually in Assets, but this serves as documentation

      const expectedAttributes = PRODUCT_FIELD_MAPPINGS.map(
        (fieldMapping) => fieldMapping.assetsField,
      );

      expect(expectedAttributes).toEqual([
        "Key", // Unique identifier (externalIdPart: true)
        "Name",
        "Description",
        "Price",
        "Category",
        "Brand",
        "Rating",
        "Stock",
      ]);

      // Reminder: The Product object type in Assets must have attributes
      // with these exact names (case-sensitive) for the mapping to work
    });
  });
});
