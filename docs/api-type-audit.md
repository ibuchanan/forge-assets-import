# Assets API type audit (Iteration Zero, ticket 06)

Evidence-based comparison between this repo's local Assets Import API types
and the packaged `@forge-ahead/atlassian-api-types` (added as a dev
dependency, pinned to `v0.1.2`, purely for this inspection — no source file
imports it). No runtime behavior changed as part of this audit.

## Finding 0: the audited file is dead code

Before comparing shapes, a more basic problem: **nothing in `src/` imports
`src/types/assets-api.ts`.**

```
grep -rn "from.*types/assets-api" src/ tests/
# only hit: src/types/README.md's own usage example (a doc comment, not code)
```

The actual Assets Import response handling in this app is done with a
different, uncoordinated set of local types:

| Live usage | Where | Relationship to `assets-api.ts` |
| --- | --- | --- |
| `SchemaAndMappingResponse` | `src/resolvers/mapping-resolver.ts:96` (private, unexported) | Near-duplicate of `assets-api.ts`'s exported interface of the same name — but missing the `iconSchema` field, so the two have silently drifted. |
| `ExecutionStatus` | `src/import-lifecycle/status.ts:27` (exported) | Unrelated shape; `assets-api.ts` has no equivalent for the execution-status endpoint's actual response fields (`progressResult`, `entriesCreated`, etc. — it only has the unused `StartExecutionResponse`/`DeleteExecutionResponse` stubs). |
| Execution-create response (`newlyCreatedExecutionJson.links.*`) | `src/import-lifecycle/start.ts:64-86` | **Untyped.** `.json()` result is used directly with no cast and no interface — not even `StartExecutionResponse`. This is a real type-safety gap independent of this audit. |
| Config status | `src/assets/types.ts`'s `ImportConfigurationStatus` enum | Unrelated to `assets-api.ts`'s `ConfigStatusResponse` (which is a `{ status: string }` wrapper never constructed anywhere). |

So the seven interfaces in `assets-api.ts` (`SchemaAndMappingResponse`,
`ConfigStatusResponse`, `MappingRequest`, `MappingResponse`,
`StartExecutionRequest`, `StartExecutionResponse`,
`DeleteExecutionResponse`) are all currently unreferenced by any source file.
This matters for ticket 07: retiring or consolidating this file is not a
"replace with packaged types" decision so much as a "this file doesn't match
what the code actually does" decision. That's a real finding, but fixing the
drift (e.g. consolidating `mapping-resolver.ts`'s private interface with this
file, or typing `start.ts`'s response) is a runtime source change, out of
scope for this audit per the Iteration Zero "no runtime refactor" rule.

## Finding 1: the packaged types hit the same OpenAPI spec gap

For every Assets Import endpoint this app calls, `@forge-ahead/atlassian-api-types`
(`src/assets/types.ts` in that package, ~8,900 lines, generated from the same
underlying Atlassian OpenAPI spec) types the JSON request/response body as
`unknown` — identical to the limitation documented in this repo's own stale
`assets-api-generated.d.ts`. Verified directly against the package source
(cloned to inspect, not installed as a runtime dependency):

| Endpoint | Packaged operation | Packaged body type |
| --- | --- | --- |
| `GET .../schema-and-mapping` | `"Get schema and mapping of Import configuration"` | `"application/json": unknown` |
| `GET .../configstatus` | `"Status of Import configuration"` | `"application/json": unknown` |
| `PUT .../mapping` | `"Submit schema and mapping configuration"` | request body `"application/json": unknown` |
| `POST .../executions` | `"Start data ingestion"` | `"application/json": unknown` |
| `DELETE .../executions/{id}` | `"Cancel Import"` | `content?: never` (no body at all — see Finding 2) |
| `PUT .../executions/{id}/progress` | `"Submit progress"` | request body `"application/json": unknown` |
| `POST .../executions/{id}/data` | `"Submit data for ingestion"` | request body `"application/json": unknown` |
| `GET .../executions/{id}/status` | `"Status of Import Execution"` | `"application/json": unknown` |

Every one of these operations has a rich `@example` JSDoc block (the package
clearly documents real response shapes), but the actual compiler-checked
`content` type is `unknown` in every case, because the source OpenAPI spec
never declares a JSON Schema for these bodies — only free-form examples. This
is an upstream spec gap, not a shortcoming of either type-generation tool.
**Conclusion: the packaged types provide zero precision improvement over
hand-written types for any Assets Import response or request body used by
this app.** None of the seven `assets-api.ts` interfaces should be replaced
by packaged types — there is nothing more precise to replace them with.

## Finding 2: one real shape disagreement, moot because it's unused

`assets-api.ts`'s `DeleteExecutionResponse` assumes the cancel-execution
response might carry an arbitrary-keyed body (`{ [key: string]: unknown }`).
The packaged types say the same endpoint (`"Cancel Import"`, `DELETE
.../executions/{id}`) has `content?: never` for its `200` — i.e., no body.
Since `DeleteExecutionResponse` is unused (Finding 0), this disagreement has
no live impact, but should inform whichever future change actually types the
cancel-execution call: prefer "no body" per the packaged/spec type over the
local assumption.

## Finding 3: what the packaged types add that local types don't have

The packaged types are not worthless — they're just not a body-precision
upgrade. They do add, for every operation above, compiler-checked:
- **Path/query parameter types**: `importSourceId`, `importExecutionId`,
  `resourceId` as `string`; the `async` query flag on `PUT .../mapping` as
  `boolean`. No local type in this repo currently types path parameters at
  all — call sites build routes with `route\`...\`` template literals with no
  parameter typing.
- **Named documented error responses**: `components["responses"]["trait_requireAuthentication_401"]`
  and `..._500"]` on every operation, versus this app's current pattern of
  checking `response.ok`/`response.status` ad hoc per call site.

Adopting either of these would touch actual resolver/lifecycle function
signatures — a runtime source change. Recording it here as a legitimate
future improvement, not doing it now.

## Recommendation for ticket 07

- **Do not replace any interface in `assets-api.ts` with a packaged type.**
  There is no packaged type more precise than the hand-written ones for any
  endpoint this app uses (Finding 1).
- **The real decision for ticket 07 isn't packaged-vs-local, it's
  dead-vs-live.** `assets-api.ts` is currently unused (Finding 0). Retiring
  `generate:types`/`openapi-typescript` doesn't lose any type-safety this app
  actually has today, because the app doesn't consume either generated file's
  types or `assets-api.ts`'s hand-written types — it consumes its own
  scattered, partially-untyped local interfaces instead.
- Keep this discrepancy visible in `src/types/README.md` rather than quietly
  deleting `assets-api.ts` without comment — a future contributor fixing the
  `mapping-resolver.ts`/`status.ts`/`start.ts` type gaps should know this file
  exists as a starting point, even though it isn't wired up today.
- The packaged types' parameter and error-response typing (Finding 3) is a
  legitimate future improvement, but it's a resolver/lifecycle-function
  change, not a type-file change — track it separately from Iteration Zero.
