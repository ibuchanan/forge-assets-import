/**
 * Tests to validate that the hardcoded mapping configuration
 * matches the actual structure of DummyJSON product data.
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
 * Local reference: src/resolvers/mapping-resolver.ts, docs/assets/mapping-configuration-guide.md
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIELD_TO_ATTRIBUTE_MAP } from "../../src/resolvers/mapping-resolver";
import dummyjsonProducts from "../data/external/dummyjson-products.json";

/**
 * Use the source-of-truth mapping from mapping-resolver.ts
 * This ensures tests verify the actual configuration used in production.
 */
const EXPECTED_FIELD_MAPPING = FIELD_TO_ATTRIBUTE_MAP;

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
    it("should verify all mapped fields exist in DummyJSON product data", async () => {
      // Fetch returns mocked test data
      const response = await fetch(
        "https://dummyjson.com/products?limit=1&skip=0",
      );
      expect(response.ok).toBe(true);

      const data = (await response.json()) as {
        products: Array<Record<string, unknown>>;
      };
      expect(data.products).toBeDefined();
      expect(data.products.length).toBeGreaterThan(0);

      const sampleProduct = data.products[0];

      // Verify each field in the mapping exists in the actual data
      const mappedFields = Object.keys(EXPECTED_FIELD_MAPPING);
      const missingFields: string[] = [];

      for (const field of mappedFields) {
        if (!(field in sampleProduct)) {
          missingFields.push(field);
        }
      }

      expect(
        missingFields,
        `The following fields are in FIELD_TO_ATTRIBUTE_MAP but don't exist in DummyJSON products: ${missingFields.join(", ")}. ` +
          `Available fields: ${Object.keys(sampleProduct).join(", ")}`,
      ).toEqual([]);
    });

    it("should verify the Key field (unique identifier) exists in data", async () => {
      const response = await fetch(
        "https://dummyjson.com/products?limit=1&skip=0",
      );
      const data = (await response.json()) as {
        products: Array<Record<string, unknown>>;
      };
      const sampleProduct = data.products[0];

      // Find which field is mapped to "Key" (the unique identifier)
      const keyField = Object.entries(EXPECTED_FIELD_MAPPING).find(
        ([_field, attribute]) => attribute === "Key",
      )?.[0];

      expect(keyField).toBeDefined();
      expect(
        sampleProduct,
        `The unique identifier field "${keyField}" must exist in DummyJSON products`,
      ).toHaveProperty(keyField as string);
    });

    it("should verify all mapped fields have non-null values in sample data", async () => {
      const response = await fetch(
        "https://dummyjson.com/products?limit=5&skip=0",
      );
      const data = (await response.json()) as {
        products: Array<Record<string, unknown>>;
      };

      const mappedFields = Object.keys(EXPECTED_FIELD_MAPPING);
      const fieldsWithNullValues = new Set<string>();

      // Check multiple products to see if any required fields are sometimes null
      for (const product of data.products) {
        for (const field of mappedFields) {
          if (product[field] === null || product[field] === undefined) {
            fieldsWithNullValues.add(field);
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
      const sampleProduct = data.products[0];

      // Verify types for known fields
      expect(typeof sampleProduct.id).toBe("number");
      expect(typeof sampleProduct.title).toBe("string");
      expect(typeof sampleProduct.description).toBe("string");
      expect(typeof sampleProduct.price).toBe("number");
      expect(typeof sampleProduct.category).toBe("string");
      expect(typeof sampleProduct.brand).toBe("string");
      expect(typeof sampleProduct.rating).toBe("number");
      expect(typeof sampleProduct.stock).toBe("number");
    });

    it("should verify the unique identifier field is suitable for use as external ID", async () => {
      const response = await fetch(
        "https://dummyjson.com/products?limit=10&skip=0",
      );
      const data = (await response.json()) as {
        products: Array<Record<string, unknown>>;
      };

      // Find which field is mapped to "Key"
      const keyField = Object.entries(EXPECTED_FIELD_MAPPING).find(
        ([_field, attribute]) => attribute === "Key",
      )?.[0] as string;

      const keyValues = data.products.map((p) => p[keyField]);

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

      const expectedAttributes = Object.values(EXPECTED_FIELD_MAPPING);

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
