# Forge Assets Import

[![Apache 2.0 license](https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat-square)](LICENSE)

[JSM Assets](https://support.atlassian.com/jira-service-management-cloud/docs/what-is-assets/)
is Atlassian's configuration management database (CMDB) built into Jira Service Management.
Teams use it to track infrastructure, services, hardware, and any other objects that matter to their operations.
A critical capability is **importing data from external systems** —
so that Assets reflects the real state of your environment without manual entry.

The [Forge Assets Import API](https://developer.atlassian.com/platform/forge/assets-import-app/)
lets you build a first-class import integration
that appears natively inside the Assets UI,
complete with configuration, field mapping, progress tracking, and lifecycle controls.

This app demonstrates the full import integration pattern:

* A **configuration UI** rendered inside the Assets "Configure App" modal,
  showing the field mapping between the external source and Assets attributes.
* **Import lifecycle hooks** (`startImport`, `stopImport`, `importStatus`, `onDeleteImport`)
  wired to Forge functions via the `jiraServiceManagement:assetsImportType` module.
* A **controller queue** that creates an import execution via the Assets API,
  fetches the first data batch to determine the total record count,
  and pushes the initial work item to the worker queue.
* A **worker queue** that fetches data in batches from the external source,
  submits each batch to the Assets import execution endpoint,
  reports progress, and self-chains until all records are ingested.

[DummyJSON](https://dummyjson.com/docs/products) is used as a stand-in external data source
(a public fake store API that returns product records).
Replace it with your own external system client in `src/external/`;
the external source's egress domain is declared in `manifest.yml` under
`permissions.external.fetch` and needs updating too.

See the
[Forge Async Events API diagram](https://dac-static.atlassian.com/platform/forge/images/assets-import-async-events-api-example.png?_v=1.5800.340)
for a visual overview of the controller/worker queue pattern.

## What kind of project this is

This is a **maintained reference app**, not a production integration and not
an archival sample. The DummyJSON product scenario is intentionally small
and artificial — it exists to demonstrate the Assets Import lifecycle end to
end, not to model a realistic customer integration. What *is* meant to be
taken seriously is the quality bar behind it; see
[Development](#development) below and
[`docs/adr/0001-maintain-reference-app-quality.md`](docs/adr/0001-maintain-reference-app-quality.md)
for the reasoning.

## Mapping configuration and the Insight JSON selector

The mapping configuration uses two Atlassian-proprietary query concepts — not standard JSONPath or JMESPath.

**`selector`** on each `objectTypeMapping` is a top-level key name that tells the Assets Import engine which field in your submitted data payload holds the array of records to process. This project submits `{ data: { products: [...] } }` and sets `selector: "products"`, so Assets iterates over `data.products`.

**`attributeLocators`** on each `attributeMapping` is an array of field name strings that extract a value from each individual record. This project normalizes each DummyJSON product into flat keys (`"key"`, `"name"`, `"price"`, etc. — see the table below) before mapping, so `attributeLocators` is always a single-element array naming one of those normalized fields. Whether the Insight JSON selector supports deeper path syntax (e.g. dot-notation for nested fields) is not documented by Atlassian; treat it as a flat key lookup until proven otherwise.

See `tests/data/schema/assets_mapping_2023_10_19.schema.json` for the formal schema and `tests/data/payload/mapping-configuration.json` for a concrete example.

## Product schema

Before installing this app, create a `Product` object type in your Assets schema with the attributes below. The app validates this schema at configuration time and reports any missing required attribute or external ID; it never creates or mutates your schema.

Each attribute needs an **external ID** set (Assets attribute settings → External ID) — the app matches attributes by name and uses the external ID to build the mapping request. `Key` must be marked as (part of) the object's label/identity attribute, since it doubles as the import's external ID part.

`Brand` is optional: omit it (or leave its external ID unset) and the app will map every other attribute without blocking the import; DummyJSON records without a brand value are imported without one too.

<!-- PRODUCT_SCHEMA_TABLE:START -->
| Assets attribute | Type | Required | Description |
| --- | --- | --- | --- |
| Key | text | Yes | Unique product identifier (used as external ID) |
| Name | text | Yes | Product name/title |
| Description | text | Yes | Detailed product description |
| Price | double | Yes | Product price in USD |
| Category | text | Yes | Product category |
| Brand | text | No | Product brand/manufacturer |
| Rating | double | Yes | Product rating (0-5) |
| Stock | integer | Yes | Available stock quantity |
<!-- PRODUCT_SCHEMA_TABLE:END -->

This table is generated from `src/assets/product-mapping.ts` (`PRODUCT_FIELD_MAPPINGS`) and checked against it by `tests/docs/readme-product-schema.test.ts`; if you change the mapping, regenerate the table with the same source before committing.

## Learn more

- **Atlassian Forge**. If this is your first Forge app,
  [try a simple "hello world" app first](https://go.atlassian.com/forge).
- **JSM Assets**. Learn more about
  [Assets object types and schemas](https://developer.atlassian.com/cloud/assets/).

Questions?
Join the Forge conversation in
[the Atlassian developer community](https://community.developer.atlassian.com/c/forge/).

## Requirements

See [Set up Forge](https://developer.atlassian.com/platform/forge/set-up-forge/) for full setup instructions.
At minimum, you need:

- Node.js (see `.nvmrc`/`engines.node` — `24.x`) and npm for installing dependencies.
- The Forge CLI, installed and authenticated with `forge login`.
- Access to an Atlassian site with Jira Service Management and Assets, and
  permission to install Forge apps on it, if you intend to deploy or install
  the app (not required just to run the local quality checks — see
  [Development](#development)).

## Quick start

Install dependencies:

```sh
npm install
```

Register the app (once per developer, writes your app ID into `manifest.yml`):

```sh
forge register
```

Deploy your code:

```sh
forge deploy
```

Install the app on an Atlassian site:

```sh
forge install
```

After the app is deployed and installed on a site, develop against it without
redeploying for every change:

```sh
forge tunnel
```

Notes:

- Use `forge deploy` when you want to persist code changes.
- Use `forge install` when you want to install the app on a new site. Once
  installed, subsequent deploys are picked up automatically without
  reinstalling — unless you add new scopes or egress rules, in which case run
  `forge install --upgrade`.

For non-interactive, scripted equivalents of these commands, see
[Development](#development).

## Development

Contributing to this repo, running its local quality toolchain (formatting,
linting, Forge prelint, typechecking, tests, bundle size checks), and
understanding its structure are covered in
[`DEVELOPMENT.md`](DEVELOPMENT.md).

## Contributions

Contributions to the Forge Assets Import repo are welcome!
Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

Copyright (c) 2025–2026 Atlassian US., Inc.
Apache 2.0 licensed, see [LICENSE](LICENSE) file.

[![With ❤️ from Atlassian](https://raw.githubusercontent.com/atlassian-internal/oss-assets/master/banner-with-thanks-light.png)](https://www.atlassian.com)
