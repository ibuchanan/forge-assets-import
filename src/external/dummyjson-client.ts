/**
 * DummyJSON API client for fetching product data
 * API Documentation: https://dummyjson.com/docs/products
 *
 * NOTE: Uses api.fetch() from @forge/api to ensure external calls work in Forge queue consumers
 */

import api from "@forge/api";

interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  brand?: string;
  category: string;
  thumbnail: string;
  images: string[];
  url?: string; // Product detail URL (computed field)
}

interface ProductsResponse {
  products: Product[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * Normalized Product record, matching the attribute locators declared in
 * src/assets/product-mapping.ts.
 */
export interface ProductRecord {
  key: string;
  name: string;
  description: string;
  price: number;
  category: string;
  brand?: string;
  rating: number;
  stock: number;
}

/**
 * Normalize a raw DummyJSON product into the Product record shape expected
 * by the Assets mapping's attribute locators (key, name, description, price,
 * category, brand, rating, stock). Brand is omitted when the source product
 * has none, matching the mapping's optional Brand attribute.
 */
export function toProductRecord(product: Product): ProductRecord {
  const record: ProductRecord = {
    key: String(product.id),
    name: product.title,
    description: product.description,
    price: product.price,
    category: product.category,
    rating: product.rating,
    stock: product.stock,
  };

  if (product.brand) {
    record.brand = product.brand;
  }

  return record;
}

/**
 * Fetch a single batch of products
 * @param skip - Number of products to skip
 * @param limit - Number of products to fetch
 * @returns Batch of products with metadata
 */
export async function fetchProductsBatch(
  skip: number = 0,
  limit: number = 30,
): Promise<ProductsResponse> {
  const url = new URL("https://dummyjson.com/products");
  url.searchParams.append("limit", limit.toString());
  url.searchParams.append("skip", skip.toString());

  const response = await api.fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `Failed to fetch products from DummyJSON: ${response.statusText}`,
    );
  }

  return (await response.json()) as ProductsResponse;
}
