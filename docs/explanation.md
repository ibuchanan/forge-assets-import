# Explanation: Why the reference app is structured this way

Forge Assets Import is a maintained reference app,
demonstrating the lifecycle surfaces every Assets import integration needs:
configuration,
mapping submission,
import execution,
progress reporting,
cancellation,
and run status.

For the simplest of REST APIs,
like DummyJSON (fake data),
a Forge app is overkill.
Assets has out-of-the-box [import facilities](https://support.atlassian.com/assets/docs/import-objects-into-asset-in-jira-service-management/)
that can [import JSON](https://support.atlassian.com/assets/docs/import-a-json-into-assets/).
However, we use the simple case here
so we can focus on the "bones" of more complicated import apps.
You would typically use Forge when you need more control over the import lifecycle:

- Advanced Auth & Security:
  Handle complex OAuth2 flows,
  dynamic token refreshes,
  and API keys securely using Forge secrets.
- Payload Transformation:
  Flatten nested JSON,
  sanitize data,
  and reformat values in serverless JavaScript
  before sending records to Assets.
- Paginated API Ingestion:
  Fetch and stream large enterprise datasets across paginated API endpoints,
  bypassing single-file payload size limits.
- Custom Admin UIs:
  Build native configuration interfaces directly in Assets using Forge UI,
  letting admins connect accounts
  and set sync filters visually.
- Execution & Lifecycle Control:
  Hook into explicit import event handlers (startImport, stopImport)
  to trigger custom error logging, alerts, or post-sync cleanup.

## The app maps into a customer-owned schema

The app expects an existing `Product` object type in the schema
with preset attribute external IDs.
It validates by shape and
submits a mapping
that points at the existing object type and attributes.
We built this example for customers
who would want to feed their existing schemas & object types.
Such schemas may have
naming conventions,
ownership,
permissions,
and relationships outside the import app.
The reference app keeps that boundary visible
by treating the Assets schema as customer-owned.
This is suitable for customers building their own Assets Import apps.

The consequence is stricter mapping validation.
The app must discover the current schema,
match the expected object type and attributes,
and use the external IDs returned by Assets.
The mapping definition in code becomes the app's contract with the customer-owned schema.

If you were building for multiple customers,
like for distribution on the Atlassian Marketplace,
we would recommend the app own its own schema with object types.
Customers can use Automation or Data Manager to map
from app-owned import data,
into their own schemas.

## The mapping definition is centralized

`src/assets/product-mapping.ts` is the source of truth for Product fields.
The frontend preview and backend mapping payload both derive from it.

This avoids a common documentation-sample failure
where the UI says one thing
and the submitted payload does another.
The configuration UI can show the reader what will happen,
while the resolver submits the same mapping contract to Assets.

Keeping the mapping in backend-owned code also keeps the frontend out of the mapping payload.
The UI passes the extension context,
asks the backend to configure the mapping,
and displays the result.
That gives the resolver the logging, validation, and API access
needed to diagnose platform responses.

## The controller and worker queues model real import pressure

DummyJSON is not large enough to require a sophisticated ingestion pipeline.
Real Assets Imports often are.

Forge functions have invocation limits,
and external systems commonly expose paginated APIs.
The app therefore uses a controller queue and a worker queue.
The controller starts ingestion by fetching the first page and determining the total count.
The worker processes one bounded batch,
submits records to Assets,
reports progress,
and queues the next batch until the final submission.

This shape keeps batch orchestration explicit
without making DummyJSON special.
The batch engine depends on a source adapter
that can fetch and transform records.
DummyJSON is one adapter;
a real external system would be another.

## HATEOAS links are carried through the run

When an Assets execution starts,
the platform returns URLs for submitting data,
submitting progress,
checking status,
and cancellation.
The app stores and passes those links through queue work items.

That choice keeps later queue consumers tied to the execution that Assets created.
It also avoids reconstructing endpoint paths in places that do not own execution creation.
The result is a clearer division:
the Assets client knows how to talk to the platform,
lifecycle startup captures the execution links,
and queue workers use the links they were given.

## Run state separates submission from confirmed completion

Submitting the final batch with `completed: true`
means the app has finished sending data to Assets.
It does not necessarily mean Assets has finished processing that data.

The app records run outcomes so it can represent that distinction.
A submission-complete outcome records that the app sent the final batch.
Later status reconciliation can confirm
whether Assets reached a terminal state
and include any available created, updated, failed, or processed counts.

This distinction matters because an import integration has two clocks:
the app's ingestion clock
and the platform's processing clock.
Treating them as the same thing would make status behavior easier to write but less accurate.

## The quality gate is part of the reference

The repository is not only a code sample for one API.
It is also an example of maintaining a Forge app with local guardrails.
The guardrails make this app a much stronger starting point for AI-based coding,
than the template provided by `forge create`.

Architecture tests protect dependency direction.
Forge-specific linting protects platform constraints.
Typechecking and unit tests protect the import lifecycle and mapping contract.
Bundle size checks make dependency growth visible.
These checks are intentionally present
because a maintained reference app should demonstrate the operational standard around the pattern,
not only the happy path of the pattern itself.

If you are going to "vibe" your way to integration,
please keep the guardrails;
they will help AIs avoid the most confusing
and poorly documented problems.
The guardrails are not required by Forge, per se.
You can relax the guardrails (or use your own),
to manifest your own development style & practices.

The ADRs under `docs/adr/` capture the main decisions behind this shape:
maintaining reference app quality,
mapping into customer-owned schemas,
adopting the local quality toolchain,
and keeping the batch import engine in scope.
