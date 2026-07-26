/**
 * Manifest scope guardrail
 *
 * All Assets calls are centralized in src/assets/import-client.ts, which only
 * calls Assets Import API endpoints under /importsource/... (covered by
 * import:import-configuration:cmdb) plus object create/update performed by
 * that API on the app's behalf (covered by read/write:cmdb-object:jira). It
 * never calls the raw CMDB schema/type/attribute REST endpoints, so this
 * pins the manifest to that minimal scope set and fails if a broader scope
 * creeps back in without a matching audit.
 *
 * @see {@link https://developer.atlassian.com/platform/forge/manifest-reference/permissions/|Manifest permissions reference}
 */

import { describe, expect, it } from "vitest";
import { getManifestScopes, loadManifest } from "./manifest-helpers";

const EXPECTED_SCOPES = [
  "storage:app",
  "import:import-configuration:cmdb",
  "read:cmdb-object:jira",
  "write:cmdb-object:jira",
];

describe("Manifest scopes", () => {
  it("declares exactly the scopes required by the centralized Assets Import client", () => {
    const manifest = loadManifest();
    const scopes = getManifestScopes(manifest);

    expect(new Set(scopes)).toEqual(new Set(EXPECTED_SCOPES));
  });
});
