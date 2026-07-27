# Reference: Forge Assets Import project

## Project identity

| Item               | Value                                      |
| ------------------ | ------------------------------------------ |
| Package name       | `explore-forge-assets-import`              |
| Runtime            | Forge `nodejs24.x`, arm64, 256 MB          |
| App type           | Jira Service Management Assets import type |
| External source    | `https://dummyjson.com/products`           |
| Target object type | `Product`                                  |
| License            | Apache-2.0                                 |

## Forge modules

| Manifest module                          | Key                           | Handler or resource                         |
| ---------------------------------------- | ----------------------------- | ------------------------------------------- |
| `jiraServiceManagement:assetsImportType` | `explore-forge-assets-import` | Native UI resource plus lifecycle functions |
| `resource`                               | `import-config-ui`            | `src/frontend/index.tsx`                    |
| `function`                               | `importConfigResolver`        | `index.importConfigResolver`                |
| `function`                               | `importLifecycleStart`        | `index.startImport`                         |
| `function`                               | `importLifecycleStop`         | `index.stopImport`                          |
| `function`                               | `importLifecycleStatus`       | `index.importStatus`                        |
| `function`                               | `importLifecycleDelete`       | `index.onDeleteImport`                      |
| `function`                               | `importQueueController`       | `index.importQueueController`               |
| `function`                               | `importQueueWorker`           | `index.importQueueWorker`                   |
| `consumer`                               | `controller-consumer`         | Queue `import-controller-queue`             |
| `consumer`                               | `worker-consumer`             | Queue `import-worker-queue`                 |

## Permissions

| Permission                  | Value                              |
| --------------------------- | ---------------------------------- |
| Storage                     | `storage:app`                      |
| Assets import configuration | `import:import-configuration:cmdb` |
| Assets object read          | `read:cmdb-object:jira`            |
| Assets object write         | `write:cmdb-object:jira`           |
| Backend external fetch      | `https://dummyjson.com`            |

## Source layout

| Path                    | Contents                                                               |
| ----------------------- | ---------------------------------------------------------------------- |
| `src/assets/`           | Assets Import API client, lifecycle types, Product mapping definition  |
| `src/external/`         | DummyJSON API client and source adapter                                |
| `src/forge/`            | Forge API path and structured logging utilities                        |
| `src/frontend/`         | Forge React configuration UI                                           |
| `src/import-lifecycle/` | Assets lifecycle handlers, run state, and batch engine                 |
| `src/resolvers/`        | Configuration resolvers and queue consumers                            |
| `src/scripts/`          | Development-time validation scripts                                    |
| `src/types/`            | Hand-written Assets API and queue types                                |
| `tests/`                | Vitest suites, architecture tests, fixtures, and Forge manifest checks |
| `docs/adr/`             | Architecture decision records                                          |

## Product mapping

| Source field  | Assets attribute | Assets type | Required | External ID part |
| ------------- | ---------------- | ----------- | -------- | ---------------- |
| `key`         | `Key`            | `text`      | Yes      | Yes              |
| `name`        | `Name`           | `text`      | Yes      | No               |
| `description` | `Description`    | `text`      | Yes      | No               |
| `price`       | `Price`          | `double`    | Yes      | No               |
| `category`    | `Category`       | `text`      | Yes      | No               |
| `brand`       | `Brand`          | `text`      | No       | No               |
| `rating`      | `Rating`         | `double`    | Yes      | No               |
| `stock`       | `Stock`          | `integer`   | Yes      | No               |

## Normalized Product record

| Field         | Type     | Source                             |
| ------------- | -------- | ---------------------------------- |
| `key`         | `string` | DummyJSON `id` converted to string |
| `name`        | `string` | DummyJSON `title`                  |
| `description` | `string` | DummyJSON `description`            |
| `price`       | `number` | DummyJSON `price`                  |
| `category`    | `string` | DummyJSON `category`               |
| `brand`       | `string` | DummyJSON `brand`, when present    |
| `rating`      | `number` | DummyJSON `rating`                 |
| `stock`       | `number` | DummyJSON `stock`                  |

## Queue work item

| Field                   | Type     | Description                                  |
| ----------------------- | -------- | -------------------------------------------- |
| `importConfigurationId` | `string` | Assets import source ID                      |
| `workspaceId`           | `string` | Assets workspace ID                          |
| `executionId`           | `string` | Assets import execution ID                   |
| `skip`                  | `number` | Offset for the current source page           |
| `limit`                 | `number` | Batch size                                   |
| `total`                 | `number` | Total source records reported by the source  |
| `submitResultsUrl`      | `string` | Assets execution URL for data submission     |
| `submitProgressUrl`     | `string` | Assets execution URL for progress submission |
| `getExecutionStatusUrl` | `string` | Assets execution URL for status lookup       |
| `cancelUrl`             | `string` | Assets execution URL for cancellation        |

## Lifecycle handlers

| Handler          | File                             | Result                                                                       |
| ---------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| `startImport`    | `src/import-lifecycle/start.ts`  | Creates an Assets execution, queues controller work, stores active run state |
| `stopImport`     | `src/import-lifecycle/stop.ts`   | Cancels the active Assets execution and controller job when available        |
| `importStatus`   | `src/import-lifecycle/status.ts` | Maps Assets configuration status to Forge import status                      |
| `onDeleteImport` | `src/import-lifecycle/delete.ts` | Cleans stored run state for a deleted import                                 |

## Resolver operations

| Operation                    | File                                   | Description                                                            |
| ---------------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| `buildMappingPreviewBackend` | `src/resolvers/mapping-resolver.ts`    | Returns mapping preview rows for the configuration UI                  |
| `buildMappingBackend`        | `src/resolvers/mapping-resolver.ts`    | Builds the Assets mapping payload from the current Product object type |
| `configureMappingBackend`    | `src/resolvers/mapping-resolver.ts`    | Builds and submits the mapping in one backend operation                |
| `submitMappingBackend`       | `src/resolvers/mapping-resolver.ts`    | Submits a provided mapping payload to the Assets Import API            |
| `importQueueController`      | `src/resolvers/controller-resolver.ts` | Fetches the first source batch and queues worker work                  |
| `importQueueWorker`          | `src/resolvers/worker-resolver.ts`     | Processes one batch and enqueues the next worker item when needed      |

## NPM scripts

| Script                        | Description                                                   |
| ----------------------------- | ------------------------------------------------------------- |
| `npm run build`               | Runs `tsc`                                                    |
| `npm run check`               | Runs the Lefthook pre-push group                              |
| `npm run format`              | Applies Biome formatting                                      |
| `npm run format:check`        | Checks Biome formatting                                       |
| `npm run lint`                | Runs the Lefthook lint group                                  |
| `npm run lint:check`          | Runs Biome lint                                               |
| `npm run lint:fix`            | Applies Biome lint fixes                                      |
| `npm run lint:forge`          | Runs `forge lint`                                             |
| `npm run lint:prelint`        | Runs the Forge prelint ast-grep rules                         |
| `npm run size`                | Builds and checks gzip size budgets                           |
| `npm run test`                | Runs Vitest                                                   |
| `npm run test:coverage`       | Runs Vitest with coverage                                     |
| `npm run test:watch`          | Runs Vitest in watch mode                                     |
| `npm run todo`                | Lists TODO comments                                           |
| `npm run changelog`           | Generates a changelog with git-cliff                          |
| `npm run forge:register`      | Runs `forge register`                                         |
| `npm run forge:deploy`        | Runs non-interactive Forge deploy through SecretSpec          |
| `npm run forge:install`       | Runs non-interactive Forge install through SecretSpec         |
| `npm run forge:upgrade`       | Runs non-interactive Forge install upgrade through SecretSpec |
| `npm run forge:uninstall`     | Runs non-interactive Forge uninstall through SecretSpec       |
| `npm run forge:variables:set` | Pushes declared app runtime variables to Forge                |

## Size budgets

| Bundle group | Path                                         | Limit      |
| ------------ | -------------------------------------------- | ---------- |
| Backend      | `dist/**/*.js`, excluding `dist/frontend/**` | 40 KB gzip |
| Frontend     | `dist/frontend/index.js`                     | 10 KB gzip |
