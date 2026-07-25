# Assets API Types

This directory contains hand-written TypeScript types for a subset of the
Atlassian Assets Import API.

## Files

- **`assets-api.ts`** — Hand-written types for the Assets Import endpoints
  this app calls, based on actual observed API responses.
- **`queue.ts`** — Types for this app's own controller/worker queue event
  payloads (not Assets-API-derived).

There is no generated-types file and no `npm run generate:types` script.
Both were removed: the Assets Import OpenAPI spec declares no JSON Schema for
these endpoints' bodies (only free-form examples), so a generated file could
only ever type every response and request body as `unknown` — no more
precise than the hand-written types below. See
[`docs/api-type-audit.md`](../../docs/api-type-audit.md) at the repo root for
the full comparison, including against the packaged
`@forge-ahead/atlassian-api-types`, which hits the identical spec gap.

## Current status: not wired into the app

As of the audit linked above, **nothing in `src/` imports `assets-api.ts`.**
Real Assets Import response handling currently lives in separate, uncoordinated
local interfaces:
- `SchemaAndMappingResponse` — a private, unexported interface in
  `src/resolvers/mapping-resolver.ts` that has drifted from the one below
  (missing `iconSchema`).
- `ExecutionStatus` — in `src/import-lifecycle/status.ts`.
- The execution-create response in `src/import-lifecycle/start.ts` is
  **untyped** — accessed directly off `.json()` with no interface at all.

This file is kept as a documented reference shape for whoever consolidates
that drift, not because it's currently exercised by the app. If you're
fixing one of the gaps above, start here rather than writing a fourth
almost-duplicate shape.

## Usage

Once wired up, types would be imported like:

```typescript
import type { ConfigStatusResponse, SchemaAndMappingResponse } from '../types/assets-api';

// Type-safe response handling
const statusData = await response.json() as ConfigStatusResponse;
const status = statusData.status; // TypeScript knows this exists!
```

## Adding or updating endpoint types

1. Base the shape on actual API responses — from local testing or Forge logs
   — not on the OpenAPI spec alone, since its schemas are largely absent for
   these endpoints.
2. Add the interface to `assets-api.ts` with a JSDoc comment noting the
   endpoint (method + path) it corresponds to.
3. If you're also fixing the drift noted above, prefer importing from here
   over adding another private, near-duplicate interface at the call site.
