# Assets API Types

This directory contains TypeScript types for the Atlassian Assets Import API.

## Files

- **`assets-api.ts`** - Manually curated subset of types for endpoints we actually use
- **`assets-api-generated.d.ts`** - Auto-generated types from OpenAPI spec (gitignored)

## Usage

Import types from `assets-api.ts` in your code:

```typescript
import type { ConfigStatusResponse, SchemaAndMappingResponse } from '../types/assets-api';

// Type-safe response handling
const statusData = await response.json() as ConfigStatusResponse;
const status = statusData.status; // TypeScript knows this exists!
```

## Regenerating Types

When the OpenAPI spec (`docs/assets/openapi.json`) is updated:

```bash
npm run generate:types
```

This regenerates `assets-api-generated.d.ts` from the spec. The subset file (`assets-api.ts`) is manually maintained.

## Why Two Files?

1. **`assets-api-generated.d.ts`** - Full generated types from the OpenAPI spec (often incomplete with `unknown` types)
2. **`assets-api.ts`** - Hand-crafted types based on actual API responses we've observed

We use manual types because:
- The OpenAPI spec is missing detailed schema definitions (most responses are `unknown`)
- We only need types for a few endpoints, not the entire API
- We can add JSDoc comments and examples to our manual types
- The generated file serves as reference documentation

## Adding New Endpoints

When you need types for a new endpoint:

1. Check `assets-api-generated.d.ts` to see if useful types exist
2. If not, add manual type definitions to `assets-api.ts` based on:
   - The OpenAPI spec examples
   - Actual API responses from testing
   - Forge logs showing the response structure

3. Document the endpoint and provide examples in JSDoc comments
