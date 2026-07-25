/**
 * Tests to validate that the mapping configuration and data submission format
 * are compatible and follow the Assets API contract.
 */

import type { AsyncEvent } from "@forge/events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProductsBatch } from "../../src/external/dummyjson-client";
import type { BuildMappingRequest } from "../../src/resolvers/mapping-resolver";
import { buildMappingBackend } from "../../src/resolvers/mapping-resolver";
import { handler as workerHandler } from "../../src/resolvers/worker-resolver";

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

vi.mock("@forge/events", () => ({
  Queue: class {
    push = vi.fn().mockResolvedValue({ jobId: "worker-job" });
  },
}));

vi.mock("../../src/external/dummyjson-client", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchProductsBatch: vi.fn(),
}));

const buildOkResponse = (payload: unknown) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  headers: {
    get: vi.fn().mockReturnValue(null),
  },
  text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
  json: vi.fn().mockResolvedValue(payload),
});

describe("Mapping and Data Submission Contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds mapping and submits data that align on selector and payload", async () => {
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
      .mockResolvedValue(buildOkResponse({}));

    const buildRequest: BuildMappingRequest = {
      payload: {
        workspaceId: "workspace-123",
        schemaId: "schema-abc",
        importId: "import-xyz",
      },
    };

    const mappingResult = await buildMappingBackend(buildRequest);

    expect(mappingResult.success).toBe(true);
    const mappingPayload = mappingResult.data as {
      mapping: {
        objectTypeMappings: Array<{ selector: string }>;
      };
    };

    const selector = mappingPayload.mapping.objectTypeMappings[0].selector;
    expect(selector).toBe("products");

    (fetchProductsBatch as ReturnType<typeof vi.fn>).mockResolvedValue({
      products: [
        {
          id: 1,
          title: "Product 1",
          description: "A product",
          price: 9.99,
          category: "widgets",
          brand: "Acme",
          rating: 4.5,
          stock: 10,
        },
      ],
      total: 1,
      skip: 0,
      limit: 30,
    });

    await workerHandler({
      body: {
        importConfigurationId: "import-xyz",
        workspaceId: "workspace-123",
        executionId: "execution-123",
        skip: 0,
        limit: 30,
        total: 1,
        submitResultsUrl: "/submit",
        submitProgressUrl: "/progress",
        getExecutionStatusUrl: "/status",
        cancelUrl: "/cancel",
      },
    } as AsyncEvent);

    const submitCall = requestJiraMock.mock.calls.find(
      ([, options]) => options?.method === "POST",
    );
    const submittedBody = JSON.parse(submitCall?.[1]?.body as string);

    expect(submitCall?.[0]).toBe("/submit");
    expect(submittedBody).toMatchObject({
      data: {
        products: [
          {
            key: 1,
            name: "Product 1",
            description: "A product",
            price: 9.99,
            category: "widgets",
            brand: "Acme",
            rating: 4.5,
            stock: 10,
          },
        ],
      },
      clientGeneratedId: "batch-0-30",
      completed: true,
    });

    expect(submittedBody.data).toHaveProperty(selector);
    expect(Array.isArray(submittedBody.data[selector])).toBe(true);
  });

  it("returns an error when required Product attributes are missing", async () => {
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

    const result = await buildMappingBackend({
      payload: {
        workspaceId: "workspace-123",
        schemaId: "schema-abc",
        importId: "import-xyz",
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    if (result.error) {
      expect(result.error.status).toBe(416);
    }
  });

  it("skips progress updates after the final batch is submitted", async () => {
    (fetchProductsBatch as ReturnType<typeof vi.fn>).mockResolvedValue({
      products: [{ id: 1 }],
      total: 1,
      skip: 0,
      limit: 30,
    });

    requestJiraMock.mockResolvedValue(buildOkResponse({}));

    await workerHandler({
      body: {
        importConfigurationId: "import-xyz",
        workspaceId: "workspace-123",
        executionId: "execution-123",
        skip: 0,
        limit: 30,
        total: 1,
        submitResultsUrl: "/submit",
        submitProgressUrl: "/progress",
        getExecutionStatusUrl: "/status",
        cancelUrl: "/cancel",
      },
    } as AsyncEvent);

    const progressCall = requestJiraMock.mock.calls.find(
      ([, options]) => options?.method === "PUT",
    );

    expect(progressCall).toBeUndefined();
  });
});
