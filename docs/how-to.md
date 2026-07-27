# How-to: Replace DummyJSON with another paginated source

This guide shows how to adapt the reference app from DummyJSON products
to another paginated external source.

## Prerequisites

- A source API that can return records in bounded pages.
- A target Assets object type with stable attribute external IDs.
- A normalized record shape for the fields submitted to Assets.

## Add the source client

Create or replace a client under `src/external/`.

Expose a source adapter with this shape:

```ts
export const sourceAdapter = {
  async fetchBatch({
    skip,
    limit,
  }: {
    skip: number;
    limit: number;
  }): Promise<{ records: SourceRecord[]; total: number }> {
    // fetch one page from the external API
  },

  transform(records: SourceRecord[]): Array<Record<string, unknown>> {
    // return flat records whose keys match the mapping attribute locators
  },
};
```

Assuming the new source uses a domain other than DummyJSON,
you will want to update `permissions.external.fetch.backend` in `manifest.yml`.

## Update the mapping definition

Edit `src/assets/product-mapping.ts`
or replace it with an equivalent mapping module for the new object type.

For each submitted field, define:

- `sourceField`: the key in the normalized record submitted to Assets.
- `assetsField`: the exact Assets attribute name.
- `sourceType`: the normalized source value type.
- `expectedAssetsType`: the expected Assets attribute type.
- `required`: whether configuration should fail when the attribute is absent.
- `description`: the row description displayed in the configuration UI.
- `externalIdPart`: whether the attribute participates in the object's external ID.

Keep at least one external ID part for stable object identity.

## Update mapping construction

In `src/resolvers/mapping-resolver.ts`,
update the object type lookup and mapping payload:

- Replace the hard-coded `Product` object type lookup with the target object type name.
- Replace the object type mapping description.
- Keep `selector` aligned with the top-level array key submitted by `submitData`.
- Keep the fetched Assets external IDs in the submitted mapping.

In `src/assets/import-client.ts`,
update `submitData` if the top-level submitted data key changes:

```ts
const payload = {
  data: {
    records,
  },
  clientGeneratedId,
  completed,
};
```

The mapping `selector` must match the key inside `data`.

## Wire the adapter into the queues

Replace `dummyJsonProductAdapter` imports in:

- `src/resolvers/controller-resolver.ts`
- `src/resolvers/worker-resolver.ts`

Use the new adapter in the controller's first-batch fetch
and the worker's `processWorkItem` call.

Keep the controller responsible for determining `total`
and the worker responsible for batch submission.

## Update the configuration UI text

Edit `src/frontend/index.tsx` so
the heading,
informational message,
and success message
name the new source and target object type.

Keep the preview table driven by the backend resolver.

## Update tests and fixtures

Update or replace fixtures under `tests/data/` for:

- Source API responses.
- Assets schema and mapping responses.
- Mapping payloads.
- Data submission payloads.

Update tests under:

- `tests/assets/`
- `tests/external/`
- `tests/resolvers/`
- `tests/import-lifecycle/`
- `tests/frontend/`

Keep `tests/docs/readme-product-schema.test.ts` aligned with any README table that documents the target schema.

## Check the change

Run:

```sh
npm run check
```

Run the bundle size check when the new source client adds dependencies:

```sh
npm run size
```

Deploy and install the app again when `manifest.yml` changes:

```sh
forge deploy
forge install --upgrade
```
