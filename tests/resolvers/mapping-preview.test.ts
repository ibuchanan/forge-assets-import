/**
 * Tests for the mapping preview resolver, which the frontend calls to render
 * the field-mapping table instead of hardcoding it (see src/assets/product-mapping.ts
 * for the single source of truth on Product field mappings).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BuildMappingRequest } from "../../src/resolvers/mapping-resolver";
import { buildMappingPreviewBackend } from "../../src/resolvers/mapping-resolver";

const requestJiraMock = vi.hoisted(() => vi.fn());

vi.mock("@forge/api", () => ({
  default: {
    asApp: vi.fn(() => ({
      requestJira: requestJiraMock,
    })),
  },
  route: (strings: TemplateStringsArray, ...values: unknown[]) => {
    return strings.reduce((acc, str, i) => acc + str + (values[i] || ""), "");
  },
  assumeTrustedRoute: (url: string) => url,
}));

const buildOkResponse = (payload: unknown) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  headers: { get: vi.fn().mockReturnValue(null) },
  text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
  json: vi.fn().mockResolvedValue(payload),
});

describe("buildMappingPreviewBackend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const request: BuildMappingRequest = {
    payload: {
      workspaceId: "workspace-123",
      schemaId: "schema-abc",
      importId: "import-xyz",
    },
  };

  it("returns preview rows for the Product object type, marking mapped and unmapped attributes", async () => {
    requestJiraMock.mockResolvedValueOnce(
      buildOkResponse({
        schema: {
          objectSchema: {
            name: "Products",
            description: "Product schema",
            objectTypes: [
              {
                externalId: "product-type",
                name: "Product",
                attributes: [
                  { externalId: "attr-key", name: "Key" },
                  { externalId: "attr-name", name: "Name" },
                  { externalId: "attr-description", name: "Description" },
                  { externalId: "attr-price", name: "Price" },
                  { externalId: "attr-category", name: "Category" },
                  { externalId: "attr-rating", name: "Rating" },
                  { externalId: "attr-stock", name: "Stock" },
                  // Brand intentionally omitted
                ],
              },
            ],
          },
        },
      }),
    );

    const result = await buildMappingPreviewBackend(request);

    expect(result.success).toBe(true);
    const rows = result.data ?? [];
    expect(rows).toHaveLength(8);

    const brandRow = rows.find((row) => row.assetsField === "Brand");
    expect(brandRow?.mapped).toBe(false);

    const nameRow = rows.find((row) => row.assetsField === "Name");
    expect(nameRow?.mapped).toBe(true);
  });

  it("returns an error when the Product object type is not found in the schema", async () => {
    requestJiraMock.mockResolvedValueOnce(
      buildOkResponse({
        schema: {
          objectSchema: {
            name: "Products",
            description: "Product schema",
            objectTypes: [],
          },
        },
      }),
    );

    const result = await buildMappingPreviewBackend(request);

    expect(result.success).toBe(false);
    expect(result.error?.status).toBe(404);
  });
});
