# Iteration Zero Tooling Tickets

These tickets cover only Iteration Zero from the modernization spec: tooling,
package metadata, verification scripts, README setup notes, and the API type
audit. They intentionally avoid runtime lifecycle, mapping, UI, and batch engine
refactors.

Work the frontier: any ticket whose blockers are complete can start. For this
set, ticket 01 starts immediately.

## 01 — Inventory the current tooling baseline

**What to build:** A concise baseline of the repository's current maintenance
surface so the full quality toolchain work starts from evidence. The baseline
should identify existing scripts, current tool versions, missing or broken
commands, Forge CLI assumptions, stale type-generation behavior, and current
Assets API type usage.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Current package scripts and dev dependencies are documented.
- [ ] Broken or stale commands are identified, including type generation.
- [ ] Current `npm run check` behavior and prerequisites are recorded.
- [ ] Current local Assets API types are inventoried for the later type audit.

## 02 — Normalize package metadata and core scripts

**What to build:** A conventional root package script surface for a maintained
reference app. The repository should have clear script names for build,
formatting, linting, typechecking, tests, TODO scanning, and the root quality
gate, without changing runtime import behavior.

**Blocked by:** 01 — Inventory the current tooling baseline.

**Status:** ready-for-agent

- [ ] The package declares the repository's expected Node version.
- [ ] `build`, `check`, `format`, `format:check`, `lint`, `lint:check`,
  `lint:forge`, `test`, `test:coverage`, `test:watch`, `todo`, and
  `typecheck` have clear responsibilities.
- [ ] A stricter no-emit typecheck configuration exists beside the deploy-time
  TypeScript configuration.
- [ ] The root `check` pipeline includes Forge lint through the normal lint
  flow.
- [ ] Existing tests and runtime behavior are not refactored as part of this
  ticket.

## 03 — Add Forge prelint and local Lefthook wiring

**What to build:** Repository-local hook and prelint wiring that demonstrates
the full quality toolchain used by maintained Forge apps. The app should not
depend on a related monorepo's hook configuration.

**Blocked by:** 02 — Normalize package metadata and core scripts.

**Status:** ready-for-agent

- [ ] Forge prelint can run from this standalone repository.
- [ ] Required prelint dependencies and configuration are local to the repo.
- [ ] Local Lefthook wiring runs the intended quality groups.
- [ ] The README or tooling docs explain any setup needed before hook commands
  can run.
- [ ] The resulting hook workflow preserves the root `check` pipeline as the
  authoritative verification path.

## 04 — Add bundle size checks

**What to build:** A runnable bundle-size check and budget so the reference app
can demonstrate deployable Forge app maintenance discipline beyond tests and
typechecking.

**Blocked by:** 02 — Normalize package metadata and core scripts.

**Status:** ready-for-agent

- [ ] Bundle size tooling is added as a local dev dependency.
- [ ] A size budget exists and is appropriate for the current Forge app shape.
- [ ] The size check can be run independently from the repository root.
- [ ] Size-check documentation explains what failure means and how to inspect
  it.

## 05 — Add opt-in SecretSpec Forge operations

**What to build:** A disciplined, non-interactive operational path for people
who choose to deploy or install the reference app, without making deployability
part of the default quality gate.

**Blocked by:** 02 — Normalize package metadata and core scripts.

**Status:** ready-for-agent

- [ ] SecretSpec configuration declares the Forge site, product, and
  environment inputs.
- [ ] Forge register, deploy, install, upgrade, uninstall, and variable helper
  scripts exist where they are supported by local scripts.
- [ ] Deploy, install, upgrade, uninstall, and variable mutation commands remain
  opt-in and are not included in `npm run check`.
- [ ] README setup notes explain the required Forge CLI and SecretSpec
  prerequisites.

## 06 — Audit packaged Atlassian API type coverage

**What to build:** An evidence-based comparison between the local Assets API
types and `@forge-ahead/atlassian-api-types`, so type migration happens only
where packaged types cover the same contracts at equal or better precision.

**Blocked by:** 01 — Inventory the current tooling baseline.

**Status:** ready-for-agent

- [ ] `@forge-ahead/atlassian-api-types` is added or otherwise made available
  for inspection.
- [ ] Every local Assets API type is compared against the packaged type
  coverage.
- [ ] The audit identifies which local types can be replaced, which must remain,
  and why.
- [ ] Known OpenAPI-generated gaps remain documented rather than erased.
- [ ] No runtime behavior is refactored as part of the audit.

## 07 — Retire stale type generation safely

**What to build:** A cleaned-up type story based on the API type audit. Broken
or misleading generated-type commands should be removed only after the audit
proves they are obsolete or superseded.

**Blocked by:** 06 — Audit packaged Atlassian API type coverage.

**Status:** ready-for-agent

- [ ] The stale type-generation script is removed or explicitly retained with a
  working source of truth.
- [ ] `openapi-typescript` is removed only if it no longer supports the
  documented type workflow.
- [ ] Local type docs describe the actual supported source of API types.
- [ ] Local hand-written types remain for contracts that packaged types do not
  cover precisely enough.
- [ ] Typecheck passes after the type-story cleanup.

## 08 — Document the full local quality workflow

**What to build:** README guidance that makes the maintained reference app
quality bar usable by a new contributor. The docs should explain how to install
tools, run the local quality gate, satisfy Forge CLI prerequisites, and use
opt-in Forge operations.

**Blocked by:** 03 — Add Forge prelint and local Lefthook wiring; 04 — Add
bundle size checks; 05 — Add opt-in SecretSpec Forge operations; 07 — Retire
stale type generation safely.

**Status:** ready-for-agent

- [ ] README setup instructions match the actual local scripts and toolchain.
- [ ] Forge CLI prerequisites for `forge lint` are explicit.
- [ ] The difference between `npm run check` and opt-in Forge deploy/install
  scripts is clear.
- [ ] Type-source documentation reflects the audit outcome.
- [ ] The maintained-reference-app quality goal is stated without implying the
  DummyJSON scenario is production-realistic.

## 09 — Verify Iteration Zero end to end

**What to build:** A final verification pass proving Iteration Zero is complete
and the standalone repository has a reliable full quality gate before runtime
modernization begins.

**Blocked by:** 03 — Add Forge prelint and local Lefthook wiring; 04 — Add
bundle size checks; 07 — Retire stale type generation safely; 08 — Document the
full local quality workflow.

**Status:** ready-for-agent

- [ ] The root quality gate runs from the repository root.
- [ ] Bundle size checks run successfully or have documented environment
  prerequisites.
- [ ] Forge lint runs as part of the normal lint pipeline or clearly reports
  documented setup prerequisites.
- [ ] README instructions match the verified commands.
- [ ] Runtime lifecycle, mapping, UI, and batch engine refactors remain deferred
  until after this baseline.
