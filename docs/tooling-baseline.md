# Tooling baseline (Iteration Zero, ticket 01)

Snapshot of the repository's maintenance surface before the Iteration Zero
toolchain work. Captured by inspection only — `node_modules/` is not installed
in the environment this was written in, so no scripts below were executed;
behavior is inferred from script definitions, config files, and doc claims.

## Current package scripts

From `package.json`:

| Script | Command | Notes |
| --- | --- | --- |
| `build` | `tsc` | Emits per `tsconfig.json` (`outDir: dist`). |
| `changelog` | `git cliff` | Requires `git-cliff` on PATH; not a dev dependency. |
| `check` | `format:check && lint && typecheck && test` | The root quality gate. Does **not** run `build`. |
| `clean` | `rm -rf ./dist` | |
| `format` | `biome format --write` | |
| `format:check` | `biome format` | Check-only, no `--write`. |
| `generate:types` | `openapi-typescript docs/jsm-assets-docs/content/cloud/assets/swagger.json -o src/types/assets-api-generated.d.ts` | **Broken**: `docs/jsm-assets-docs/` does not exist in this repo. See below. |
| `lint` | `npm run lint:check` | Alias. |
| `lint:check` | `biome lint && forge lint` | Already invokes Forge lint, but nothing in the repo installs/configures Forge prelint locally (ticket 03). |
| `lint:fix` | `biome lint --write` | |
| `test` | `vitest run` | |
| `test:coverage` | `vitest run --coverage` | Thresholds (80% lines/functions/branches/statements) set in `vitest.config.ts`. |
| `test:watch` | `vitest watch` | |
| `dev:todo` | `grep -rn 'TODO' ...` | Ad hoc name; ticket 02 wants a `todo` script name. |
| `typecheck` | `tsc --noEmit` | Reuses the deploy `tsconfig.json` (`noEmit: false` is overridden by the CLI flag, not a separate stricter config — ticket 02 wants a dedicated no-emit config). |

Scripts referenced in `README.md` but not present in `package.json`: none —
README's "Additional scripts" section matches `dev:todo` and `changelog`.

No `lint:forge` script exists yet (ticket 02 target name); Forge lint is
currently folded into `lint:check` only.

## Current dev dependencies

```
@biomejs/biome ^2.5
@types/node ^24
@vitest/coverage-v8 ^4.1
archunit ^2.1
openapi-typescript ^7.13
typescript ^5.9
vitest ^4.1
yaml ^2.9
```

Runtime dependencies (`@forge/*`, `neverthrow`, `react`) are unaffected by
this ticket set.

No `engines` field is declared in `package.json`. The environment used for
this inventory runs Node v24.18.0; `@types/node` is pinned to `^24`, implying
an intended Node 24.x baseline, but it is not enforced anywhere (`.nvmrc` does
not exist).

## Missing or broken commands

- **`generate:types` is broken.** It points at
  `docs/jsm-assets-docs/content/cloud/assets/swagger.json`, but this repo has
  no `docs/jsm-assets-docs/` directory at all (only `docs/adr/`). The
  generated output file it would produce
  (`src/types/assets-api-generated.d.ts`) is gitignored but currently exists
  on disk (8,663 lines) as a stale artifact from a prior run/environment —
  it cannot be regenerated from this checkout.
- **`src/types/README.md` disagrees with `package.json`** on the spec
  location: the README says types come from `docs/assets/openapi.json` (also
  absent), while the script uses the `jsm-assets-docs` path. Neither exists.
  This is a documentation/script mismatch to resolve in ticket 07.
- **`changelog` (`git cliff`) has no corresponding dev dependency** and isn't
  installed via npm; it depends on a globally available `git-cliff` binary.
  Out of scope for these tickets but worth noting as a pre-existing gap in
  "declared vs. actual" tooling.
- **No Lefthook, SecretSpec, or bundle-size configuration exists** anywhere in
  the repo (no `lefthook.yml`, no `secretspec.toml`-equivalent, no
  `size-limit`/`bundlesize` config) — confirms tickets 03, 04, and 05 are
  starting from zero, not migrating existing config.
- **No CI workflow directory** (`.github/workflows/`) exists, so `npm run
  check` is not currently enforced by any pipeline — it is a local-only gate
  today.
- **`node_modules/` is not present** in this inventory environment, so no
  script was actually executed to confirm runtime behavior; all findings here
  are static.

## `npm run check` behavior and prerequisites

`check` = `format:check && lint && typecheck && test`, where `lint` = `lint:check` = `biome lint && forge lint`.

Prerequisites to run it successfully, as currently written:
1. `npm install` (dependencies are declared but not vendored in this
   environment).
2. A working `forge` CLI on PATH, logged in (`forge login`), because
   `lint:check` unconditionally runs `forge lint` — there is no guard or
   opt-out if Forge prelint/CLI isn't set up. In the sandbox used to write
   this inventory, invoking `forge` failed outright (process spawn denied by
   sandbox policy), so `npm run check` cannot currently be verified end-to-end
   here. This is exactly the "Forge lint through the normal lint flow" gap
   ticket 02/03 need to close cleanly (clear failure messaging, documented
   setup) rather than an unexplained hard dependency.
3. `vitest` coverage thresholds (80% across the board) apply only to
   `test:coverage`, not plain `test`, so `check` does not enforce coverage.

## Current local Assets API types (for the ticket 06 audit)

`src/types/`:
- **`assets-api.ts`** (156 lines) — hand-written, the file actually imported
  by app code (per its own doc comment and `src/types/README.md`). Exports
  types such as `SchemaAndMappingResponse` and `ConfigStatusResponse` for the
  handful of Assets Import API endpoints this app calls. Written because the
  OpenAPI spec's schemas are largely untyped (`unknown`).
- **`assets-api-generated.d.ts`** (8,663 lines) — gitignored, stale generated
  output from `openapi-typescript`; not regeneratable from this checkout (see
  above). Described in its own README as "reference documentation" more than
  a real source of types, since most fields resolve to `unknown`.
- **`queue.ts`** (28 lines) — small hand-written types for the
  controller/worker queue payloads; not Assets-API-derived, out of scope for
  the ticket 06 audit but noted for completeness.
- **`README.md`** (53 lines) — documents the two-file split and regeneration
  flow; its regeneration instructions are currently inaccurate (wrong spec
  path, see above) and will need updating alongside ticket 07.

Ticket 06 should treat `assets-api.ts`'s exported interfaces as the
comparison set against `@forge-ahead/atlassian-api-types`, since that's the
file real code imports. `assets-api-generated.d.ts` is a candidate for
removal/replacement rather than comparison, pending ticket 07.

## Other observations relevant to later tickets

- `biome.json` already enables VCS-aware ignoring and the `recommended` lint
  preset; no changes needed for ticket 02's lint scripts beyond wiring names.
- `tsconfig.json` is a single deploy-oriented config (`noEmit: false`,
  `outDir: dist`) reused for both `build` and `typecheck` (via the `--noEmit`
  flag). Ticket 02 wants a second, stricter, dedicated no-emit config
  alongside it.
- `tests/project-architecture.test.ts` uses `archunit` to enforce the
  module-layering rules described in its own header comment; unaffected by
  this ticket set but confirms `archunit` is a real, in-use dependency (not
  dead weight).
- No `.forgeignore`, Forge prelint config, or `.editorconfig`-adjacent hook
  config exists yet — ticket 03 starts from a clean slate.
