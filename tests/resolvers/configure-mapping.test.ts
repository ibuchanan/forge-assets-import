/**
 * Tests for the configureMapping resolver, which combines building the
 * Product attribute mapping and submitting it to Assets into one backend
 * operation, so the frontend no longer builds or casts the mapping itself.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BuildMappingRequest } from "../../src/resolvers/mapping-resolver";
import { configureMappingBackend } from "../../src/resolvers/mapping-resolver";

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

const request: BuildMappingRequest = {
  payload: {
    workspaceId: "workspace-123",
    schemaId: "schema-abc",
    importId: "import-xyz",
  },
};

describe("configureMappingBackend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds the mapping from the schema and submits it to Assets in one call", async () => {
    requestJiraMock
      .mockResolvedValueOnce(
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
                    { externalId: "attr-brand", name: "Brand" },
                    { externalId: "attr-rating", name: "Rating" },
                    { externalId: "attr-stock", name: "Stock" },
                  ],
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(buildOkResponse({}));

    const result = await configureMappingBackend(request);

    expect(result.success).toBe(true);

    const submitCall = requestJiraMock.mock.calls.find(
      ([, options]) => options?.method === "PUT",
    );
    expect(submitCall).toBeDefined();

    const submittedMapping = JSON.parse(submitCall?.[1]?.body as string);
    const objectTypeMapping = submittedMapping.mapping.objectTypeMappings[0];
    expect(objectTypeMapping.selector).toBe("products");

    const keyAttributeMapping = objectTypeMapping.attributesMapping.find(
      (entry: { attributeName: string }) => entry.attributeName === "Key",
    );
    expect(keyAttributeMapping).toMatchObject({
      attributeExternalId: "attr-key",
      attributeLocators: ["key"],
      externalIdPart: true,
    });
  });

  it("does not submit to Assets when required Product attributes are missing", async () => {
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
                attributes: [{ externalId: "attr-key", name: "Key" }],
              },
            ],
          },
        },
      }),
    );

    const result = await configureMappingBackend(request);

    expect(result.success).toBe(false);
    expect(result.error?.status).toBe(416);

    const submitCall = requestJiraMock.mock.calls.find(
      ([, options]) => options?.method === "PUT",
    );
    expect(submitCall).toBeUndefined();
  });
});
