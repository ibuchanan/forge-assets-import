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
Replace it with your own external system client in `src/external/`.

See the
[Forge Async Events API diagram](https://dac-static.atlassian.com/platform/forge/images/assets-import-async-events-api-example.png?_v=1.5800.340)
for a visual overview of the controller/worker queue pattern.

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

- Node.js and npm for installing dependencies and running local checks.
- The Forge CLI, installed and authenticated with `forge login`.
- Access to an Atlassian site with Jira Service Management and Assets.
- Permission to install Forge apps on that site.

## Quick start

Register the app (once per developer, writes your app ID into `manifest.yml`):
```
forge register
```

Install dependencies:
```
npm install
```

Validate the app:
```
npm run check
```

Deploy your app using the interactive Forge command:
```
forge deploy
```

Install your app on an Atlassian site using the interactive Forge command:
```
forge install
```

After the app has been deployed and installed on a site,
develop it locally using `forge tunnel` to proxy development-environment invocations to your local code:
```
forge tunnel
```

See `package.json` for additional development utilities.

### Notes
- Use `forge deploy` when you want to persist code changes.
- Use `forge install` when you want to install the app on a new site.
  Once installed, subsequent deploys are picked up automatically without reinstalling —
  unless you add new scopes or egress rules, in which case run `forge install --upgrade`.
- The external data source (DummyJSON) is declared in `manifest.yml` under `permissions.external.fetch`.
  Update this entry when pointing the app at a different external system.

## Contributions

Contributions to the Forge Assets Import repo are welcome!
Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

Copyright (c) 2025 Atlassian US., Inc.
Apache 2.0 licensed, see [LICENSE](LICENSE) file.

[![With ❤️ from Atlassian](https://raw.githubusercontent.com/atlassian-internal/oss-assets/master/banner-with-thanks-light.png)](https://www.atlassian.com)

