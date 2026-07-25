/**
 * Tests for normalizing raw DummyJSON product records into the normalized
 * Product record shape (key, name, description, price, category, brand,
 * rating, stock) that src/assets/product-mapping.ts attribute locators expect.
 */

import { describe, expect, it } from "vitest";
import { toProductRecord } from "../../src/external/dummyjson-client";

describe("toProductRecord", () => {
  it("maps raw DummyJSON fields to normalized Product field names", () => {
    const raw = {
      id: 1,
      title: "Essence Mascara Lash Princess",
      description: "A popular mascara.",
      price: 9.99,
      discountPercentage: 7.17,
      rating: 4.94,
      stock: 5,
      brand: "Essence",
      category: "beauty",
      thumbnail: "https://example.com/thumb.png",
      images: ["https://example.com/image.png"],
    };

    expect(toProductRecord(raw)).toEqual({
      key: "1",
      name: "Essence Mascara Lash Princess",
      description: "A popular mascara.",
      price: 9.99,
      category: "beauty",
      brand: "Essence",
      rating: 4.94,
      stock: 5,
    });
  });

  it("omits brand from the normalized record when the raw product has no brand", () => {
    const raw = {
      id: 2,
      title: "Generic Widget",
      description: "A widget with no brand.",
      price: 4.99,
      discountPercentage: 0,
      rating: 3.5,
      stock: 12,
      category: "widgets",
      thumbnail: "https://example.com/thumb.png",
      images: ["https://example.com/image.png"],
    };

    expect(toProductRecord(raw)).toEqual({
      key: "2",
      name: "Generic Widget",
      description: "A widget with no brand.",
      price: 4.99,
      category: "widgets",
      rating: 3.5,
      stock: 12,
    });
    expect(toProductRecord(raw)).not.toHaveProperty("brand");
  });
});
