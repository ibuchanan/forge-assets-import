# Forge Assets Import

This context defines the project-specific language for the Forge Assets Import reference app.

## Language

**Maintained reference app**:
A working example app that is kept passing its local quality gates and current with repository conventions, even when its source-system scenario is intentionally small or artificial.
_Avoid_: Production app, archival sample

**DummyJSON product import**:
The sample import scenario that pulls product records from DummyJSON to demonstrate the Forge Assets Import lifecycle.
_Avoid_: Realistic production integration, SCM import

**Customer-owned Assets schema**:
An Assets schema and object type structure created and maintained by the customer before or outside this app, which the app maps external data into.
_Avoid_: App-owned schema, generated demo schema

**Mapping definition**:
The code-owned description of how external source fields map onto an Assets object type and its attributes.
_Avoid_: Field list, UI import template

**Required Product field**:
A normalized Product field that must exist in source data and have a matching Assets attribute before the mapping can be submitted.
_Avoid_: Displayed field, optional field

**Optional Product field**:
A normalized Product field that the app can map when source data and the customer-owned Assets schema support it, but whose absence should not block configuration.
_Avoid_: Required field

**Mapping validation**:
The pre-submission check that confirms the customer-owned Assets schema contains the exact object type, attributes, and external IDs required by the mapping definition.
_Avoid_: Schema repair, schema provisioning

**Validation report**:
A complete list of mapping validation problems found in one pass, written so a customer can fix their Assets schema without repeated save attempts.
_Avoid_: First error, exception message

**Run outcome**:
The persisted summary of an import run's active or terminal state, including enough execution metadata, timestamps, and counts to explain lifecycle behavior.
_Avoid_: Dashboard status, audit log

**Submission complete**:
The run state reached when the app has submitted the final data batch to Assets with `completed: true`.
_Avoid_: Import complete, successful import

**Processing result confirmed**:
The run state reached when Assets execution status confirms the terminal processing result and any available create, update, failure, or processed counts.
_Avoid_: Submission complete

**Full quality toolchain**:
The repository-local set of formatting, linting, Forge prelint, Forge lint, typecheck, test, bundle size, and deployment helper checks used to demonstrate a high-quality Forge app maintenance workflow.
_Avoid_: Minimal local checks, monorepo-only tooling

**Batch import engine**:
The reusable local orchestration model for importing paginated external data through Forge async event queues in bounded chunks.
_Avoid_: DummyJSON loop, worker helper

**Source adapter**:
The source-specific fetch and transform behavior that lets the batch import engine process a particular external system without knowing that system's API shape.
_Avoid_: Batch engine, Assets client

**Normalized Product record**:
The smaller app-owned record shape submitted to Assets after transforming a DummyJSON product, containing only fields used by the Product mapping definition.
_Avoid_: Raw DummyJSON product, full source payload

**Assets HATEOAS link**:
A platform-provided URL returned by the Assets Import API for a specific execution action, such as submitting data, reporting progress, checking status, or cancelling.
_Avoid_: Raw requestJira URL, reconstructed endpoint
