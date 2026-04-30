/**
 * Tests for validate-object-type.ts script
 *
 * These tests verify that the validation script correctly identifies:
 * - All 7 required attributes present with correct types
 * - Missing attributes
 * - Case-sensitive name mismatches
 * - Type mismatches (e.g., Text vs Number)
 */

import { describe, expect, it } from "vitest";
import {
  type ObjectTypeAttribute,
  REQUIRED_ATTRIBUTES,
  validateAttributes,
} from "../../src/scripts/validate-object-type-logic";

describe("Object Type Validation", () => {
  describe("happy path - all attributes present and correct", () => {
    it("should pass when all 7 attributes are present with correct types", () => {
      const attributes: ObjectTypeAttribute[] = [
        {
          id: "attr-1",
          name: "Name",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-2",
          name: "Description",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-3",
          name: "Price",
          defaultType: { id: 1, name: "Number" },
        },
        {
          id: "attr-4",
          name: "Category",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-5",
          name: "Brand",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-6",
          name: "Rating",
          defaultType: { id: 1, name: "Number" },
        },
        {
          id: "attr-7",
          name: "Stock",
          defaultType: { id: 1, name: "Number" },
        },
      ];

      const results = validateAttributes(attributes);

      // All attributes should be found
      expect(results.filter((r) => r.found)).toHaveLength(7);

      // No type mismatches
      expect(results.filter((r) => r.typeMismatch)).toHaveLength(0);

      // No case mismatches
      expect(results.filter((r) => r.caseMismatch)).toHaveLength(0);
    });
  });

  describe("missing attributes", () => {
    it("should fail when Name attribute is missing", () => {
      const attributes: ObjectTypeAttribute[] = [
        {
          id: "attr-2",
          name: "Description",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-3",
          name: "Price",
          defaultType: { id: 1, name: "Number" },
        },
        {
          id: "attr-4",
          name: "Category",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-5",
          name: "Brand",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-6",
          name: "Rating",
          defaultType: { id: 1, name: "Number" },
        },
        {
          id: "attr-7",
          name: "Stock",
          defaultType: { id: 1, name: "Number" },
        },
      ];

      const results = validateAttributes(attributes);
      const nameResult = results.find((r) => r.attribute === "Name");

      expect(nameResult?.found).toBe(false);
      expect(nameResult?.caseMismatch).toBeUndefined();
    });

    it("should fail when multiple attributes are missing", () => {
      const attributes: ObjectTypeAttribute[] = [
        {
          id: "attr-1",
          name: "Name",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-2",
          name: "Description",
          defaultType: { id: 0, name: "Text" },
        },
        // Missing: Price, Category, Brand, Rating, Stock
      ];

      const results = validateAttributes(attributes);
      const missing = results.filter((r) => !r.found);

      expect(missing).toHaveLength(5);
      expect(missing.map((r) => r.attribute)).toContain("Price");
      expect(missing.map((r) => r.attribute)).toContain("Category");
      expect(missing.map((r) => r.attribute)).toContain("Brand");
      expect(missing.map((r) => r.attribute)).toContain("Rating");
      expect(missing.map((r) => r.attribute)).toContain("Stock");
    });

    it("should fail when all attributes are missing", () => {
      const attributes: ObjectTypeAttribute[] = [];

      const results = validateAttributes(attributes);

      expect(results.filter((r) => r.found)).toHaveLength(0);
      expect(results).toHaveLength(7);
    });
  });

  describe("case sensitivity", () => {
    it("should fail when attribute name has wrong case (e.g., 'name' instead of 'Name')", () => {
      const attributes: ObjectTypeAttribute[] = [
        {
          id: "attr-1",
          name: "name", // Wrong case!
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-2",
          name: "Description",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-3",
          name: "Price",
          defaultType: { id: 1, name: "Number" },
        },
        {
          id: "attr-4",
          name: "Category",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-5",
          name: "Brand",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-6",
          name: "Rating",
          defaultType: { id: 1, name: "Number" },
        },
        {
          id: "attr-7",
          name: "Stock",
          defaultType: { id: 1, name: "Number" },
        },
      ];

      const results = validateAttributes(attributes);
      const nameResult = results.find((r) => r.attribute === "Name");

      expect(nameResult?.found).toBe(false);
      expect(nameResult?.caseMismatch).toBe(true);
      expect(nameResult?.actualType).toBe("Text");
    });

    it("should detect case mismatch for all attributes", () => {
      const attributes: ObjectTypeAttribute[] = [
        {
          id: "attr-1",
          name: "name",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-2",
          name: "description",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-3",
          name: "price",
          defaultType: { id: 1, name: "Number" },
        },
        {
          id: "attr-4",
          name: "category",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-5",
          name: "brand",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-6",
          name: "rating",
          defaultType: { id: 1, name: "Number" },
        },
        {
          id: "attr-7",
          name: "stock",
          defaultType: { id: 1, name: "Number" },
        },
      ];

      const results = validateAttributes(attributes);
      const caseMismatches = results.filter((r) => r.caseMismatch);

      expect(caseMismatches).toHaveLength(7);
      expect(results.filter((r) => r.found)).toHaveLength(0);
    });
  });

  describe("type validation", () => {
    it("should fail when Price attribute has wrong type (Text instead of Number)", () => {
      const attributes: ObjectTypeAttribute[] = [
        {
          id: "attr-1",
          name: "Name",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-2",
          name: "Description",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-3",
          name: "Price",
          defaultType: { id: 0, name: "Text" }, // Wrong type!
        },
        {
          id: "attr-4",
          name: "Category",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-5",
          name: "Brand",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-6",
          name: "Rating",
          defaultType: { id: 1, name: "Number" },
        },
        {
          id: "attr-7",
          name: "Stock",
          defaultType: { id: 1, name: "Number" },
        },
      ];

      const results = validateAttributes(attributes);
      const priceResult = results.find((r) => r.attribute === "Price");

      expect(priceResult?.found).toBe(true);
      expect(priceResult?.typeMismatch).toBe(true);
      expect(priceResult?.actualType).toBe("Text");
      expect(priceResult?.expectedType).toBe("Number");
    });

    it("should fail when multiple numeric attributes have wrong type", () => {
      const attributes: ObjectTypeAttribute[] = [
        {
          id: "attr-1",
          name: "Name",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-2",
          name: "Description",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-3",
          name: "Price",
          defaultType: { id: 0, name: "Text" }, // Wrong type!
        },
        {
          id: "attr-4",
          name: "Category",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-5",
          name: "Brand",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-6",
          name: "Rating",
          defaultType: { id: 0, name: "Text" }, // Wrong type!
        },
        {
          id: "attr-7",
          name: "Stock",
          defaultType: { id: 0, name: "Text" }, // Wrong type!
        },
      ];

      const results = validateAttributes(attributes);
      const typeMismatches = results.filter((r) => r.typeMismatch);

      expect(typeMismatches).toHaveLength(3);
      expect(typeMismatches.map((r) => r.attribute)).toContain("Price");
      expect(typeMismatches.map((r) => r.attribute)).toContain("Rating");
      expect(typeMismatches.map((r) => r.attribute)).toContain("Stock");
    });

    it("should accept Textarea as equivalent to Text", () => {
      const attributes: ObjectTypeAttribute[] = [
        {
          id: "attr-1",
          name: "Name",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-2",
          name: "Description",
          defaultType: { id: 7, name: "Textarea" }, // Acceptable alternative to Text
        },
        {
          id: "attr-3",
          name: "Price",
          defaultType: { id: 1, name: "Number" },
        },
        {
          id: "attr-4",
          name: "Category",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-5",
          name: "Brand",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-6",
          name: "Rating",
          defaultType: { id: 1, name: "Number" },
        },
        {
          id: "attr-7",
          name: "Stock",
          defaultType: { id: 1, name: "Number" },
        },
      ];

      const results = validateAttributes(attributes);
      const descriptionResult = results.find(
        (r) => r.attribute === "Description",
      );

      expect(descriptionResult?.found).toBe(true);
      expect(descriptionResult?.typeMismatch).toBe(false);
      expect(descriptionResult?.actualType).toBe("Textarea");
    });
  });

  describe("edge cases", () => {
    it("should handle empty attributes array", () => {
      const attributes: ObjectTypeAttribute[] = [];

      const results = validateAttributes(attributes);

      expect(results).toHaveLength(7);
      expect(results.every((r) => !r.found)).toBe(true);
    });

    it("should handle attributes with extra fields", () => {
      const attributes: ObjectTypeAttribute[] = [
        {
          id: "attr-1",
          name: "Name",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-2",
          name: "Description",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-3",
          name: "Price",
          defaultType: { id: 1, name: "Number" },
        },
        {
          id: "attr-4",
          name: "Category",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-5",
          name: "Brand",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-6",
          name: "Rating",
          defaultType: { id: 1, name: "Number" },
        },
        {
          id: "attr-7",
          name: "Stock",
          defaultType: { id: 1, name: "Number" },
        },
        // Extra attributes that aren't required
        {
          id: "attr-8",
          name: "CreatedDate",
          defaultType: { id: 3, name: "Date" },
        },
        {
          id: "attr-9",
          name: "UpdatedDate",
          defaultType: { id: 3, name: "Date" },
        },
      ];

      const results = validateAttributes(attributes);

      // Should still validate all 7 required attributes
      expect(results).toHaveLength(7);
      expect(results.filter((r) => r.found)).toHaveLength(7);
      expect(results.filter((r) => r.typeMismatch)).toHaveLength(0);
    });

    it("should handle combination of missing, case-mismatch, and type-mismatch", () => {
      const attributes: ObjectTypeAttribute[] = [
        {
          id: "attr-1",
          name: "name", // Case mismatch
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-2",
          name: "Description",
          defaultType: { id: 0, name: "Text" },
        },
        {
          id: "attr-3",
          name: "Price",
          defaultType: { id: 0, name: "Text" }, // Type mismatch
        },
        {
          id: "attr-4",
          name: "Category",
          defaultType: { id: 0, name: "Text" },
        },
        // Missing: Brand
        {
          id: "attr-6",
          name: "Rating",
          defaultType: { id: 1, name: "Number" },
        },
        {
          id: "attr-7",
          name: "Stock",
          defaultType: { id: 1, name: "Number" },
        },
      ];

      const results = validateAttributes(attributes);

      const nameResult = results.find((r) => r.attribute === "Name");
      const priceResult = results.find((r) => r.attribute === "Price");
      const brandResult = results.find((r) => r.attribute === "Brand");

      expect(nameResult?.caseMismatch).toBe(true);
      expect(priceResult?.typeMismatch).toBe(true);
      expect(brandResult?.found).toBe(false);

      expect(results.filter((r) => r.found && !r.typeMismatch)).toHaveLength(4);
    });
  });

  describe("required attributes constant", () => {
    it("should have exactly 7 required attributes", () => {
      expect(Object.keys(REQUIRED_ATTRIBUTES)).toHaveLength(7);
    });

    it("should have correct attribute names and types", () => {
      expect(REQUIRED_ATTRIBUTES).toEqual({
        Name: "Text",
        Description: "Text",
        Price: "Number",
        Category: "Text",
        Brand: "Text",
        Rating: "Number",
        Stock: "Number",
      });
    });

    it("should have 4 text attributes and 3 number attributes", () => {
      const textAttrs = Object.values(REQUIRED_ATTRIBUTES).filter(
        (t) => t === "Text",
      );
      const numberAttrs = Object.values(REQUIRED_ATTRIBUTES).filter(
        (t) => t === "Number",
      );

      expect(textAttrs).toHaveLength(4);
      expect(numberAttrs).toHaveLength(3);
    });
  });
});
