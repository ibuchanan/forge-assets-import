# Modernizing `forge-assets-import`

## Purpose

This note analyzes how to modernize the standalone general Assets Import
reference implementation in this repository, relative to the newer GitHub and
Bitbucket ingestion apps that exist in the related monorepo.

The goal is not to turn this repository into a third `component-info.yaml`
ingestion app or to pretend the DummyJSON product scenario is a realistic
production integration. The app is a maintained reference app: it should keep a
high level of code quality, verification, and Forge convention alignment while
preserving its value as a small, generic Assets Import sample.

## Current Shape

The example is a standalone Forge app. It demonstrates the key Assets Import
lifecycle:

- a `jiraServiceManagement:assetsImportType` module;
- a native UI Kit configuration resource;
- lifecycle hooks for `startImport`, `stopImport`, `importStatus`, and
  `onDeleteImport`;
- a controller queue that starts ingestion work;
- a worker queue that fetches DummyJSON product batches and submits them to the
  Assets execution endpoint; and
- mapping logic for a `Product` object type.

The newer GitHub and Bitbucket apps in the related monorepo are independently
deployable Forge apps under `apps/*`. They share extracted packages for
reusable behaviors:

- `assets-import-client`: Assets import execution, mapping, progress, status,
  object lookup, and object update helpers.
- `sync-lifecycle`: start, stop, status, delete, job cancellation, and run
  outcome behavior.
- `sync-engine`: controller and worker orchestration for repo discovery and
  batched imports.
- `discovery-scope`: admin configuration, per-scope secrets, health checks, and
  install/upgrade/uninstall lifecycle.
- `run-outcome`: current run, latest run outcome, and active import-source
  reference storage.
- `connection-status` and `get-started`: reusable admin UX for setup and
  operational state.

The example predates most of those shared packages. As a result, it duplicates
some platform plumbing that the maintained apps now centralize.

## Main Gaps

### 1. The example is a standalone repository

The original monorepo analysis assumed the example lived under
`specs/examples/forge-assets-import`, outside a root workspace whose
`package.json` included only:

```json
"workspaces": [
  "apps/*",
  "packages/*"
]
```

In this checkout, that assumption is wrong: the example repository itself is
the package root. It is not covered by the related monorepo's Turborepo task
ordering, dependency hygiene, root `npm run check`, or maintained app package
scripts because those files are not present here.

The repository has its own `package.json`, dependencies, `biome.json`,
`vitest.config.ts`, and scripts, but it does not have the same modern script
surface as the maintained app packages. In particular, it lacks:

- a `size` script and bundle budget;
- `lint:prelint` using the repo's Forge prelint ast-grep rules;
- a `tsconfig.typecheck.json` with stricter no-emit checks;
- SecretSpec-backed Forge command scripts; and
- root-level Turbo integration.

### 2. The Assets client boundary is duplicated

The example hand-rolls Assets API calls in local modules:

- `src/resolvers/mapping-resolver.ts` fetches schema-and-mapping and submits
  mapping.
- `src/import-lifecycle/start.ts` starts executions and extracts the execution
  ID.
- `src/import-lifecycle/status.ts` queries config status and execution status.
- `src/import-lifecycle/stop.ts` constructs a cancel endpoint.
- `src/resolvers/worker-resolver.ts` submits progress and data batches.

The maintained apps now centralize much of that in `packages/assets-import-client`.
However, the current `assets-import-client` is not fully generic: its
`submitData` helper is hardcoded to `data.components` and imports
`component-info` types. That makes it useful to the GitHub and Bitbucket apps
but awkward for a generic Product import example.

### 3. Lifecycle behavior has improved in the newer apps

The example stores only the controller queue job ID after starting an import.
Its stop flow tries to cancel the execution using an execution ID from context,
then cancels the queued controller job through `controllerQueue.getJob(jobId)`.

The newer `sync-lifecycle` package stores both the queue job ID and the
HATEOAS `cancelUrl`, uses the generic Assets cancel helper, and records current
and completed run outcomes through `run-outcome`. It also clears active
import-source state on delete.

The example would benefit from those lifecycle semantics even if it remains a
generic DummyJSON sample.

### 4. The status story should stay inside the reference-app surface

The example manifest only declares:

- the Assets import type;
- two queue consumers;
- one UI resource; and
- the lifecycle functions.

The newer apps add:

- a Configure admin page;
- a Get Started page;
- a Connection Status page;
- installed and upgraded triggers; and
- pre-uninstall cleanup.

For this reference app, do not copy those admin pages into the first
modernization scope. The DummyJSON product import is intentionally artificial,
so adding product-like operational chrome would make the sample look more
production-shaped than it is. Keep operational clarity in the native Assets
import configuration surface, lifecycle behavior, tests, and README/docs.

### 5. Mapping preview and mapping payload can drift

The example hardcodes field mappings in both backend and frontend code:

- backend `FIELD_TO_ATTRIBUTE_MAP` maps DummyJSON fields to Assets attributes;
- frontend `fieldMappings` renders a separate table for the user.

The maintained apps use a `BuiltMapping` object with both preview rows and the
request body. That pattern prevents the UI preview from silently drifting away
from the submitted mapping.

The Product sample should adopt the same shape: one Product mapping builder
should return both the preview rows and the request body.
The current frontend preview labels `Rating` as `Integer`, while DummyJSON
ratings are decimal values and the committed sample mapping payload uses an
Assets `double` attribute. The mapping builder should treat `Rating` as a
floating-point value and eliminate that preview/payload drift.
Expected numeric Assets attribute types are:

- `Price`: `double`
- `Rating`: `double`
- `Stock`: `integer`

Expected identity/string Assets attribute types are:

- `Key`: `text`
- `Name`: `text`
- `Description`: `text`
- `Category`: `text`
- `Brand`: `text` when present

Because the app maps into a customer-owned Assets schema, the mapping builder
should perform strict validation before submission:

- require a `Product` object type by exact name;
- require every required Product attribute by exact name;
- require an `externalId` for the object type and each mapped attribute;
- report all missing or mismatched pieces in one actionable validation report;
  and
- never auto-create or mutate the customer's schema.

Also compare expected and actual Assets attribute types in the validation
report. Treat type mismatches as warnings in the first modernization rather
than blockers, because Assets type naming can be quirky and should be verified
before making type checks fatal. Missing required names and missing required
external IDs should still block submission.

Treat `Brand` as optional. Map it when DummyJSON provides brand values and the
customer-owned schema has a `Brand` attribute with an external ID, but do not
block mapping submission when the source record or schema omits it.
When an optional mapped field cannot be resolved against the customer-owned
schema, include it in the validation report as optional/missing but omit it
from the submitted mapping request body.

Do not add attribute aliases or configurable field mappings in the first
modernization. Exact names keep the reference app understandable while still
demonstrating how code can validate and map into a customer-owned schema.

### 6. The example declares a broader scope set than the newer apps

The example declares:

- `storage:app`
- `import:import-configuration:cmdb`
- `read:cmdb-object:jira`
- `write:cmdb-object:jira`
- `read:cmdb-schema:jira`
- `read:cmdb-type:jira`
- `read:cmdb-attribute:jira`

The newer GitHub and Bitbucket apps declare only:

- `import:import-configuration:cmdb`
- `read:cmdb-object:jira`
- `write:cmdb-object:jira`
- `storage:app`

Some of the example's extra scopes may be needed because the app intentionally
maps into a customer-owned Assets schema by reading the existing
schema-and-mapping state. Forge lint can add missing scopes, but redundant
scopes need to be removed manually after the local Assets client boundary makes
the API call surface easy to audit.

### 7. The type-generation story is stale

The example has a broken local generation script:

```json
"generate:types": "openapi-typescript docs/jsm-assets-docs/content/cloud/assets/swagger.json -o src/types/assets-api-generated.d.ts"
```

The referenced `docs/jsm-assets-docs/...` path is not present in the example.
The local `src/types/README.md` also describes generated types that are not
committed.

Replace the stale generation story in a deliberate order:

1. Add `@forge-ahead/atlassian-api-types` as the candidate source for packaged
   pre-generated Atlassian API types.
2. Audit every type currently defined in `src/types/assets-api.ts` against the
   packaged types.
3. Replace local types only where the packaged type covers the same contract at
   equal or better precision.
4. Keep local hand-written types for gaps that were created to overcome weak or
   incomplete OpenAPI-generated shapes.
5. Remove the stale `generate:types` script and `openapi-typescript` only after
   the audit proves the script is no longer part of the supported type story.

## Recommended Workstreams

### Iteration Zero: Tooling and package hygiene

Before broader architecture or code changes, make the example look and behave
like the maintained Forge app packages from a tooling standpoint. This reduces
noise in later refactors and makes failures easier to compare across the repo.

This iteration should be limited to tooling, package metadata, verification
scripts, README setup notes, and the API type audit. Do not refactor runtime
lifecycle or mapping behavior until this baseline is passing.

#### Package scripts

Update the root `package.json` toward this script shape:

```json
{
  "build": "tsc -p tsconfig.json",
  "check": "npm run format:check && npm run lint && npm run typecheck && npm run test",
  "clean": "rm -rf ./dist",
  "format": "biome format --write .",
  "format:check": "biome format .",
  "lint": "npm run lint:prelint && npm run lint:check && npm run lint:forge",
  "lint:check": "biome lint .",
  "lint:fix": "biome lint --write .",
  "lint:forge": "forge lint",
  "lint:prelint": "ast-grep scan --config node_modules/tool-forge-prelint-ast-grep/sgconfig.ecosol.yml --globs '!node_modules/**'",
  "size": "npm run build && size-limit",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage",
  "test:watch": "vitest watch",
  "todo": "rg -n \"TODO\" --glob '!package.json' . || echo \"No TODOs found!\"",
  "typecheck": "tsc -p tsconfig.typecheck.json --noEmit"
}
```

Specific changes from the current example:

- rename `dev:todo` to the repo-conventional `todo`;
- split `lint` into `lint:check`, `lint:forge`, and `lint:prelint`;
- make `lint` compose all read-only lint checks;
- use `tsc -p tsconfig.json` for build;
- use a separate `tsconfig.typecheck.json` for stricter local no-emit checks;
- add a `size` script and bundle budget; and
- keep `check` as the package-level verification pipeline.

`npm run check` should include `forge lint` through the normal lint pipeline.
Forge CLI setup requirements belong in the README rather than outside the
quality gate.

The `lint:prelint` path should be local to this standalone repository. Because
the goal is to demonstrate the full quality toolchain, add any supporting local
dev dependencies and config needed to make the prelint rule set usable here.
If the example later moves under another workspace, re-evaluate that path
during the move rather than encoding the future monorepo layout now.

#### Lefthook integration

The related monorepo uses Lefthook as the local quality-gate orchestrator. Its
root `package.json` exposes:

```json
{
  "check": "lefthook run pre-push --force",
  "lint": "lefthook run lint",
  "prepare": "lefthook install"
}
```

The root `lefthook.yml` has:

- a generic `lint` group that runs root `lint:prelint`, `lint:check`,
  `lint:forge`, and `typecheck`;
- app-specific groups for `lint-github-import` and `lint-bitbucket-import`;
- a `pre-commit` hook that runs `gitleaks` and formats staged changes; and
- a `pre-push` hook that runs `format:check`, `lint`, and `test`.

Adopt Lefthook locally as part of the full quality toolchain. The standalone
repo should carry its own `lefthook.yml` rather than depending on the related
monorepo's file. If this example is later moved into the monorepo, add an
app-specific group mirroring the two maintained apps:

```yaml
lint-forge-assets-import-example:
  parallel: true
  commands:
    prelint:
      root: specs/examples/forge-assets-import
      run: npm run lint:prelint
    biome:
      root: specs/examples/forge-assets-import
      run: npm run lint:check
    forge:
      root: specs/examples/forge-assets-import
      run: npm run lint:forge
    typecheck:
      root: specs/examples/forge-assets-import
      run: npm run typecheck
```

For the standalone repository, decide whether `lint` should call direct npm
composition or a local Lefthook group after the local `lefthook.yml` shape is
known. Either way, root `npm run check` must exercise the full toolchain.

#### Forge scripts

Add the Forge script family used by the maintained apps, adjusted for this
standalone repo and the repo's non-interactive deploy convention:

```json
{
  "forge:register": "forge register",
  "forge:deploy": "secretspec run --reason \"npm run forge:deploy\" -- sh -c 'forge deploy --non-interactive --environment \"$FORGE_ENVIRONMENT\"'",
  "forge:install": "secretspec run --reason \"npm run forge:install\" -- sh -c 'forge install --site \"$FORGE_SITE\" --product \"$FORGE_PRODUCT\" --environment \"$FORGE_ENVIRONMENT\" --non-interactive'",
  "forge:upgrade": "secretspec run --reason \"npm run forge:upgrade\" -- sh -c 'forge install --upgrade --site \"$FORGE_SITE\" --product \"$FORGE_PRODUCT\" --environment \"$FORGE_ENVIRONMENT\" --non-interactive'",
  "forge:uninstall": "secretspec run --reason \"npm run forge:uninstall\" -- sh -c 'forge uninstall --site \"$FORGE_SITE\" --product \"$FORGE_PRODUCT\"'",
  "forge:variables:set": "node scripts/forge-vars-from-secretspec.js"
}
```

Also add a local `secretspec.toml` modeled on the app packages:

```toml
[project]
name = "forge-assets-import-example"
revision = "1.0"

[profiles.default]
FORGE_SITE = { description = "Forge site hostname, e.g. example.atlassian.net", required = true }
FORGE_PRODUCT = { description = "Forge product (jira, confluence, compass, jsm)", default = "jira" }
FORGE_ENVIRONMENT = { description = "Forge environment name", default = "development" }
```

These scripts are opt-in operational helpers. Do not include deploy, install,
upgrade, uninstall, or variable mutation in `npm run check`. The quality gate
should prove the code and manifest are healthy; the Forge scripts should prove
there is a disciplined path when someone chooses to try the reference app on a
site.

#### Dev dependencies

Because the example is currently standalone, add the dev dependencies needed
for the full quality toolchain:

```json
{
  "@ast-grep/cli": "^0.44",
  "@biomejs/biome": "2.5.4",
  "@size-limit/file": "^12.1",
  "@types/node": "24",
  "archunit": "^2.3",
  "git-cliff": "^2.13",
  "size-limit": "^12.1",
  "tool-forge-prelint-ast-grep": "github:ibuchanan/tool-forge-prelint-ast-grep",
  "typescript": "^5.9",
  "vitest": "^4.1",
  "yaml": "^2.9"
}
```

Keep `yaml`; the Forge manifest tests use it. Add
`@forge-ahead/atlassian-api-types`, then audit coverage before removing
`openapi-typescript` or narrowing `src/types/assets-api.ts`. Keep the existing
`neverthrow`-style `Result` flow for the first runtime refactor so the local
Assets Import client boundary can be reviewed on behavior rather than
error-library churn. Evaluate `@forge-ahead/errors` as a later migration.

#### Package metadata and TypeScript config

Add the repo's Node version convention:

```json
{
  "engines": {
    "node": "24.x"
  }
}
```

Add `tsconfig.typecheck.json` beside the deploy-time `tsconfig.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "noUncheckedSideEffectImports": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Keep the deploy-time `tsconfig.json` compatible with the Forge bundler. Avoid
`moduleResolution: "bundler"` there; use the stricter typecheck config for
local verification instead.

Do not copy `dev: "tsdown --watch"` from the maintained apps unless the
example actually adopts `tsdown`. A plain `tsc -p tsconfig.json --watch` is a
better default for this example if a `dev` script is needed.

### Workstream A: Decide whether the example is maintained source

Treat the example as a maintained reference app. Keep it self-contained and
make root-level `npm run check` in this repository pass reliably. The app does
not need to model a realistic production integration, but it should model the
quality bar expected of a current Forge Assets Import implementation.

### Workstream B: Add a local Assets Import client boundary

Create a local Assets Import client boundary in this repository before
considering shared-package extraction. A good starting point is
`src/assets/import-client.ts`, covering the API calls this app currently
spreads across lifecycle handlers and resolvers:

- start an execution;
- fetch schema-and-mapping;
- submit mapping;
- fetch import configuration status;
- fetch execution status;
- cancel an execution;
- submit progress; and
- submit data batches.

The client boundary should also normalize execution-create responses. Prefer an
explicit execution `id` from the response when Assets returns one, and fall back
to extracting the execution ID from the submit-results link when links are the
only reliable source. Cover both response shapes in tests.

Candidate API:

```ts
export async function submitImportData(input: {
  submitResultsUrl: string;
  selector: string;
  records: Array<Record<string, unknown>>;
  clientGeneratedId: string;
  completed: boolean;
}): Promise<void>;
```

The Product example should use the generic helper with `selector: "products"`.
If the related monorepo later needs this behavior, extract the local boundary
into `packages/assets-import-client` after this repository has a clean,
well-tested client shape.

### Workstream C: Introduce a local batch import engine

The existing `sync-engine` in the related monorepo is intentionally
SCM-specific. It knows about repos, catalog paths, credentials, normalization,
sync health, and archived repository behavior.

Do not force the DummyJSON example through that abstraction. Instead, keep a
local batch import engine in scope and place it after the local Assets client,
mapping contract, and lifecycle baseline. The engine should be generic over
source fetching and record transformation so the teaching point is "given a
paginated source, submit bounded chunks through Assets", not "call DummyJSON".
It should demonstrate the queue-based chunking pattern recommended by the Forge
Assets async events guide for imports that may exceed normal invocation
limits:

- controller starts with source metadata and total count;
- source adapter fetches one batch;
- source adapter transforms source records into mapping-compatible records;
- worker submits records to Assets;
- worker submits progress;
- worker re-enqueues until complete.

The example's existing `calculateBatchProgress`, `createNextWorkItem`, and
retry classification functions are a good starting point. The goal is not to
publish a package yet; the goal is to make the queue orchestration explicit,
testable, and source-agnostic inside this standalone repository.

The batch engine should own the default retry policy for queue processing,
Assets submission, and progress reporting. Source adapters may provide an
override only for source-specific failure semantics that the default policy
cannot classify correctly.

Candidate source adapter shape:

```ts
interface BatchSourceAdapter<TSourceRecord, TAssetsRecord> {
  fetchBatch(input: {
    skip: number;
    limit: number;
  }): Promise<{
    records: TSourceRecord[];
    total: number;
  }>;
  transform(records: TSourceRecord[]): TAssetsRecord[];
  shouldRetrySourceError?(error: unknown): boolean;
}
```

The DummyJSON implementation should be one adapter, not the batch engine
itself.

The DummyJSON adapter should submit normalized Product records rather than raw
DummyJSON product payloads. Even when fields currently map one-to-one, the
reference app should demonstrate the transform step and submit only fields used
by the mapping definition.

Normalized Product field names should be domain/Assets-oriented rather than
DummyJSON-oriented:

- `key`
- `name`
- `description`
- `price`
- `category`
- `brand` (optional)
- `rating`
- `stock`

The DummyJSON adapter is responsible for translating source fields such as
`id` and `title` into this normalized shape. The Product mapping definition
then maps normalized Product fields to Assets attributes.

`key` should be a string identity field derived with `String(id)`, not a
numeric quantity. This keeps external identity semantics clear in the
normalized record and in Assets mapping tests.

When optional fields are missing from source data, omit them from the
normalized Product record instead of sending `null` or empty-string
placeholders. Required fields should still be validated before submission.

### Workstream D: Add minimal lifecycle and run outcome storage

Keep this local to the standalone repository. Do not adapt `sync-lifecycle`
directly in the first pass because that package is not present here and is tied
to discovery-scope readiness.

The Product example needs:

- start execution;
- push the initial controller event;
- store queue job ID and Assets-provided cancel link;
- cancel execution and queue work on stop;
- clear stored job state;
- map Assets config status to Forge import status;
- record current and latest run outcome; and
- clear active import-source reference on delete.

Run outcome storage should be minimal and lifecycle-focused. Store enough to
make start, stop, delete, worker completion, and status behavior testable:

- active execution ID;
- controller queue job ID;
- Assets-provided cancel link;
- started, stopped, completed, or failed timestamps where applicable;
- terminal state; and
- basic processed/created/updated/failed counts when Assets returns them.

Do not overclaim success when the worker submits the final batch. Treat final
batch acceptance with `completed: true` as `submission complete`. Treat the
import as `processing result confirmed` only after Assets execution status
returns a terminal processing result and any available counts.

The `importStatus` lifecycle function should opportunistically reconcile the
stored run outcome from Assets execution status. If the active execution has
reached a terminal Assets state such as `DONE` or `CANCELLED`, update the
latest confirmed result and clear active execution state. This reconciliation
should be best-effort; status display should not become fragile because outcome
storage could not be updated.

For stop behavior, prefer the stored Assets-provided cancel link, but do not
pass raw absolute HATEOAS URLs directly to `requestJira`. Normalize stored
execution links with the same `toRelativePath(...)` plus `assumeTrustedRoute(...)`
pattern used for submit-results, progress, and execution-status links.
Reconstruct the cancel endpoint only as a documented fallback when stored
execution state is missing or unusable.

Do not build a full operational dashboard around this state. If the related
monorepo later needs the same behavior, extract the local implementation after
its storage contract is clear.

### Workstream E: Modernize the configuration UI contract

Keep the customer-owned schema-and-mapping flow. The reference app should show
how code can help customers map external data into an Assets schema they
already created, which is a different teaching goal from a Marketplace-ready
app that provisions its own out-of-the-box schema.

Replace separate frontend/backend mapping constants with one mapping builder
that uses the existing Assets schema details returned by the
schema-and-mapping endpoint.

Target shape:

```ts
interface BuiltMapping {
  objectTypeName: string;
  rows: Array<{
    sourceField: string;
    assetsField: string;
    sourceType?: string;
    description?: string;
  }>;
  requestBody: MappingRequestBody;
}
```

The frontend should render intended mapping rows immediately from the
code-owned mapping definition. Once Forge context and schema-and-mapping data
are available, the UI should annotate those same rows with validation state,
such as matched, missing attribute, or missing external ID. The submit resolver
should submit `requestBody`. This keeps the preview honest and gives tests one
obvious contract to assert.
Optional mappings such as `Brand` should remain visible in the preview even
when missing from the customer schema. Mark them as optional/missing and omit
them from the submitted mapping payload.

Expose one backend `configureMapping` resolver for the save action. It should
fetch schema-and-mapping, validate the customer-owned schema, build the mapping
request body, and submit it in one operation. The frontend may request preview
rows from the same mapping definition, but it should not stitch together a
separate `buildMapping` plus `submitMapping` flow with client-side casts.

Keep including the sanitized existing schema object in the submitted mapping
request body unless live verification proves a mapping-only payload is accepted.
The current implementation records a production validation quirk: the API
expects a root `schema` property, while an empty `iconSchema` must be omitted to
pass validation.

The resolver should fail before submission when the customer-owned schema does
not satisfy the mapping definition. Failures should tell the user exactly which
object type or attributes need to be created or renamed in Assets, collecting
all discovered problems in one response rather than failing fast.

Prevent README/schema docs from drifting away from the mapping definition.
Prefer generating the README Product schema table from the same structured
mapping source, or add a focused test that verifies the documented schema rows
match the code-owned mapping definition.

Also consider returning resolver results in the newer `{ ok: true } | { ok:
false; error: string }` style rather than the example's `{ success, data,
error }` shape, unless the sample intentionally wants to teach problem-details
responses.

### Workstream F: Keep admin pages out of the first scope

Do not add Get Started or Connection Status pages as part of the first
modernization. The reference app should stay centered on the Assets Import
module and its native configuration UI. Use README/docs to explain setup and
verification, and use lifecycle status/tests to demonstrate operational
behavior.

Install, upgrade, and pre-uninstall handlers are also out of scope unless a
later workstream introduces persistent state that needs explicit seeding or
cleanup.

### Workstream G: Align scripts, TypeScript, and quality gates

Bring the example closer to the app packages:

- add `engines.node: "24.x"`;
- add `tsconfig.typecheck.json`;
- switch `typecheck` to `tsc -p tsconfig.typecheck.json --noEmit`;
- add `lint:prelint`;
- make `lint` run Biome, Forge lint, and prelint;
- add a `size` script and bundle limit;
- add local Lefthook wiring;
- add opt-in SecretSpec-backed Forge scripts;
- use pinned root-style dev dependency versions where practical;
- defer any `@forge-ahead/errors` migration until after the local Assets Import
  client boundary is in place;
- audit `src/types/assets-api.ts` against `@forge-ahead/atlassian-api-types`;
- replace local types only where the packaged types are equally or more useful;
- remove stale `generate:types` after the audit proves it is obsolete.

### Workstream H: Revalidate scopes and manifest shape

After refactoring, run:

```sh
npm run lint:forge
```

Then manually review the manifest scopes. In particular, decide whether the
example still needs:

- `read:cmdb-schema:jira`
- `read:cmdb-type:jira`
- `read:cmdb-attribute:jira`

If the modernized mapping approach no longer calls the endpoints protected by
those scopes, remove them.

Also add the same manifest wiring guardrails used by the maintained apps for:

- module resolver exports;
- lifecycle hook function exports;
- queue key to consumer declaration alignment;
- frontend `invoke()` names to resolver definitions; and
- backend storage scope requirements.

## Proposed Sequence

0. Run Iteration Zero: align scripts, dev dependencies, Node engines,
   typecheck config, Forge command scripts, Lefthook/prelint, size checks, and
   the `@forge-ahead/atlassian-api-types` audit.
1. Add a local Assets Import client boundary.
2. Replace the example's local execution/progress/data/cancel REST calls with
   that boundary.
3. Replace duplicated mapping constants with a Product mapping builder that
   returns preview rows and request body.
4. Add minimal lifecycle/run outcome storage.
5. Extract the current controller/worker pagination flow into a local batch
   import engine.
6. Update README/docs to explain the maintained-reference-app quality bar, the
   intentionally artificial DummyJSON scenario, and exact customer-owned
   Product schema setup steps.
7. Revalidate manifest scopes with Forge lint and manual pruning.
8. Run the full standalone repository checks. If the example later joins the
   related monorepo, separately verify the monorepo root checks include it.

## Suggested Acceptance Criteria

- The repository clearly states whether it is maintained by its root checks.
- The example no longer duplicates generic Assets execution, progress, cancel,
  and config-status API code.
- Product mapping preview rows and Product mapping request body come from one
  source of truth.
- The example records current run and latest run outcome, or explicitly
  documents why it does not.
- The manifest declares only required scopes and egress.
- `npm run check` passes from the repository root.
- If later added to the related monorepo, monorepo root `npm run check`
  includes the example.
- The README quick start uses the same non-interactive Forge deployment and
  installation conventions as the rest of the repo.
- The README tells users exactly which `Product` object type and attributes to
  create in Assets, which fields are optional, and which validation findings
  block mapping submission.
- Automated coverage prevents the README-documented Product schema from
  drifting away from the code-owned mapping definition.

## Non-goals

- Converting the DummyJSON sample into a GitHub or Bitbucket importer.
- Adding OAuth or SCM Discovery Scope configuration to the generic sample.
- Building a generic field-mapping designer.
- Adding scheduled imports.
- Sharing runtime storage between the example and the production apps.

## Open Questions

- When, if ever, should the local Assets client, batch engine, and run outcome
  storage be extracted into shared packages in the related monorepo?
- Should resolver results switch from `{ success, data, error }` to the newer
  `{ ok: true } | { ok: false; error: string }` style?
