# Development

This covers the inner development loop for this repo: structure, local
quality checks, and scripted Forge operations. See [`README.md`](README.md)
for what the app does and the interactive path to deploy and install it.

## Repository structure

```text
src/
  assets/            Forge-platform-only domain types and context (AssetsImportContext, status enums)
  external/          DummyJSON HTTP client (external HTTP only)
  forge/             Forge platform utilities — logging, storage, api-path (Forge APIs only)
  frontend/          UI Kit configuration UI (no backend imports)
  import-lifecycle/  startImport/stopImport/importStatus/onDeleteImport handlers
  resolvers/         mapping, controller queue, and worker queue resolvers
  scripts/           dev-time validation scripts (not part of the deployed app)
  types/             hand-written Assets API and queue types — see src/types/README.md
  util/              shared error/Result helpers
tests/
  data/              JSON fixtures and schemas used across tests
  external/, forge/, import-lifecycle/, resolvers/, scripts/, helpers/
                     mirror the src/ layout above
```

`tests/project-architecture.test.ts` (via [`archunit`](https://www.npmjs.com/package/archunit))
enforces the module dependency rules that structure implies, so drift shows
up as a failing test rather than silent coupling:

```text
frontend         →  (no backend imports)
resolvers        →  assets, external, forge, import-lifecycle
import-lifecycle →  assets, forge, resolvers
assets           →  (Forge platform APIs only)
external         →  (external HTTP only)
forge            →  (Forge platform APIs only)
```

It also asserts that backend code uses `api.asApp()`, never `.asUser()` — see
that test file's header comment for the reasoning.

## Local quality workflow

`npm run check` is the root quality gate: format check, lint (Forge prelint,
Biome lint, typecheck, `forge lint`), and tests. Everything below either
implements pieces of that gate or is additional opt-in discipline that
`npm run check` intentionally doesn't include.

```sh
npm run check
```

Running `forge lint` as part of `lint` means the Forge CLI must be installed
and authenticated (`forge login`) before `npm run check` can pass — this
isn't just a deploy-time requirement.

### Git hooks (Lefthook)

`lefthook.yml` is the single source of truth for which checks make up the
lint pass and the pre-push gate — `npm run lint` and `npm run check` delegate
to it (`lefthook run lint` and `lefthook run pre-push --force`) instead of
re-listing the same commands in `package.json`.

`npm install` runs the `prepare` script (`lefthook install`), which wires up
this repo's local [Lefthook](https://lefthook.dev/) hooks:

- **pre-commit** runs a `gitleaks` secret scan, plus `npm run format:check`
  and `npm run lint:check` against changed files.
- **pre-push** runs `npm run format:check`, the full `lint` group (Forge
  prelint, Biome lint, typecheck, `forge lint`), and `npm run test`. `npm run
  check` runs this same pre-push group directly, so there's no separate gate
  to keep in sync.

Prerequisites:

- The Forge CLI must be installed and authenticated (`forge login`) for the
  `forge lint` step.
- The `@forge-ahead/prelint` dev dependency must resolve during `npm install`
  for the `lint:prelint` (`ast-grep`) step.
- [`gitleaks`](https://github.com/gitleaks/gitleaks) must be installed and on
  `PATH` for the pre-commit secret scan.

You can run any hook group manually without committing or pushing:

```sh
npx lefthook run pre-commit
npx lefthook run pre-push --force
npx lefthook run lint
```

### Bundle size checks

```sh
npm run size
```

This builds the app (`tsc`) and then runs [size-limit](https://github.com/ai/size-limit)
against the compiled `dist/` output, using `@size-limit/file` to measure the
gzip size of two groups declared under `size-limit` in `package.json`:

- **Backend** (`dist/**/*.js`, excluding `dist/frontend/`) — budgeted at 40 KB
  gzip, roughly double the current compiled size, to leave room to grow
  before failing.
- **Frontend** (`dist/frontend/index.js`) — budgeted at 10 KB gzip.

These budgets measure the `tsc`-compiled output checked into `dist/`, not the
final webpack bundle Forge produces at `forge deploy` time — there's no local
way to reproduce Forge's own bundler here. Treat a failure as a signal that a
change meaningfully grew the compiled backend or frontend module graph (a new
dependency, a large generated file, etc.), not as a guarantee about the exact
deployed artifact size. To inspect what grew, run `npm run build` and compare
file sizes under `dist/` (e.g. `find dist -name '*.js' -exec wc -c {} \;`), or
temporarily raise a `limit` in `package.json` to see how far over budget the
build is before deciding whether to trim the code or adjust the budget.

`npm run size` is not part of `npm run check` — it's an opt-in discipline
check you run when you want to verify bundle growth, not a blocking gate.

### Type sources

Assets API TypeScript types live in `src/types/`. There's no type generator
in this repo — see [`src/types/README.md`](src/types/README.md) for the
current hand-written types and their status, and
[`docs/api-type-audit.md`](docs/api-type-audit.md) for why generated types
(from this repo or from the packaged `@forge-ahead/atlassian-api-types`)
wouldn't be more precise for the Assets Import endpoints this app calls.

### Additional scripts

- `npm run todo` — lists all TODO comments in the source tree.
- `npm run changelog` — generates a changelog from git history using [git-cliff](https://git-cliff.org/).

## Opt-in, scripted Forge operations

The interactive `forge register`/`forge deploy`/`forge install` commands in
the [README](README.md#quick-start) are fine for a single developer working
by hand. This repo also has non-interactive,
[SecretSpec](https://secretspec.dev/)-backed equivalents for scripted or
repeatable use — none of them run as part of `npm run check`:

```sh
npm run forge:register        # forge register (no secrets needed)
npm run forge:deploy          # forge deploy --non-interactive --environment "$FORGE_ENVIRONMENT"
npm run forge:install         # forge install --site "$FORGE_SITE" --product "$FORGE_PRODUCT" --environment "$FORGE_ENVIRONMENT" --non-interactive
npm run forge:upgrade         # forge install --upgrade ... --non-interactive
npm run forge:uninstall       # forge uninstall --site "$FORGE_SITE" --product "$FORGE_PRODUCT"
npm run forge:variables:set   # push app-level runtime secrets to Forge (none declared today)
```

`forge:deploy`, `forge:install`, `forge:upgrade`, and `forge:uninstall` read
`FORGE_SITE`, `FORGE_PRODUCT`, and `FORGE_ENVIRONMENT` from
[`secretspec.toml`](secretspec.toml) via `secretspec run --provider dotenv`.
Before running them:

1. Install the [SecretSpec CLI](https://secretspec.dev/).
2. Set the required value(s) with the `dotenv` provider, e.g.
   `secretspec set FORGE_SITE --provider dotenv --reason "local setup"`
   (`FORGE_PRODUCT` and `FORGE_ENVIRONMENT` have defaults of `jira` and
   `development` and don't need to be set unless you want different values).
   This writes to a local, gitignored `.env` file.
3. Run the script, e.g. `npm run forge:install`.

`forge:variables:set` runs [`scripts/forge-vars-from-secretspec.js`](scripts/forge-vars-from-secretspec.js),
which pushes app-level runtime secrets (via `forge variables set`) for any
keys listed in its `APP_VARIABLE_KEYS` array. That list is empty today —
the DummyJSON sample source needs no authentication — so running it just
prints an explanatory message. Add a key there and to `secretspec.toml` if
a future external source needs a real credential.
