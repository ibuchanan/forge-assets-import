/**
 * Assets Import Lifecycle Hook Wiring Tests
 *
 * Validates that jiraServiceManagement:assetsImportType modules have all required
 * lifecycle hooks properly wired to real function handlers in the manifest.
 *
 * The Assets import module lifecycle includes:
 * - importStatus: Called to get the current status of an import
 * - onDeleteImport: Called when an import is deleted
 * - startImport: Called to start/trigger an import
 * - stopImport: Called to stop/cancel an import
 *
 * If any of these hooks are missing or point to non-existent functions,
 * the import will fail at runtime.
 *
 * @see {@link https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-service-management-assets-import-type/|Assets Import Type module reference}
 */

import path from "node:path";
import { describe, expect, it } from "vitest";
import { findExportedNames, parseSourceFile } from "./ast-helpers";
import {
  getManifestHandlerReferences,
  loadManifest,
  ParsedManifest,
} from "./manifest-helpers";

interface AssetsImportTypeModuleWithLifecycle {
  key: string;
  resolver?: { function: string };
  importStatus?: { function: string };
  onDeleteImport?: { function: string };
  startImport?: { function: string };
  stopImport?: { function: string };
}

/**
 * All required lifecycle hooks for Assets import modules
 */
const REQUIRED_LIFECYCLE_HOOKS = [
  "importStatus",
  "onDeleteImport",
  "startImport",
  "stopImport",
] as const;

describe("Assets Import Lifecycle Hook Wiring", () => {
  it("should ensure all assetsImportType modules are properly wired", () => {
    const manifest = loadManifest();
    const assetsImportModules = (manifest.modules[
      "jiraServiceManagement:assetsImportType"
    ] || []) as AssetsImportTypeModuleWithLifecycle[];

    if (assetsImportModules.length === 0) {
      // No assets import modules declared, nothing to validate
      return;
    }

    const violations: string[] = [];

    for (const module of assetsImportModules) {
      // Check that all required lifecycle hooks are declared
      const missingHooks = REQUIRED_LIFECYCLE_HOOKS.filter(
        (hook) => !(hook in module),
      );

      if (missingHooks.length > 0) {
        violations.push(
          `Assets import module '${module.key}' is missing lifecycle hooks: ${missingHooks.join(", ")}. ` +
            `All of these are required: ${REQUIRED_LIFECYCLE_HOOKS.join(", ")}`,
        );
      }

      // Check that all declared lifecycle hooks point to real functions
      for (const hook of REQUIRED_LIFECYCLE_HOOKS) {
        const hookConfig =
          module[hook as (typeof REQUIRED_LIFECYCLE_HOOKS)[number]];
        if (hookConfig && "function" in hookConfig) {
          const functionName = hookConfig.function;

          // Verify the function is declared in manifest.modules.function
          const functionExists = (manifest.modules.function || []).some(
            (f) => f.key === functionName,
          );

          if (!functionExists) {
            violations.push(
              `Assets import module '${module.key}' hook '${hook}' references ` +
                `function '${functionName}' which is not declared in manifest.modules.function`,
            );
          }
        }
      }

      // Check that the resolver is declared if present
      if (module.resolver?.function) {
        const functionExists = (manifest.modules.function || []).some(
          (f) => f.key === module.resolver!.function,
        );

        if (!functionExists) {
          violations.push(
            `Assets import module '${module.key}' resolver references ` +
              `function '${module.resolver.function}' which is not declared in manifest.modules.function`,
          );
        }
      }
    }

    expect(
      violations,
      violations.length
        ? `Found assets import lifecycle wiring issues:\n${violations.join("\n")}`
        : undefined,
    ).toEqual([]);
  });

  it("should ensure all lifecycle hook handlers are exported from resolvers", () => {
    const manifest = loadManifest();
    const assetsImportModules = (manifest.modules[
      "jiraServiceManagement:assetsImportType"
    ] || []) as AssetsImportTypeModuleWithLifecycle[];

    if (assetsImportModules.length === 0) {
      return;
    }

    const violations: string[] = [];
    const declaredFunctions = new Set(
      (manifest.modules.function || []).map((f) => f.key),
    );

    // Get all referenced function names from lifecycle hooks
    const referencedFunctionNames = new Set<string>();

    for (const module of assetsImportModules) {
      if (module.resolver?.function) {
        referencedFunctionNames.add(module.resolver.function);
      }
      for (const hook of REQUIRED_LIFECYCLE_HOOKS) {
        const hookConfig =
          module[hook as (typeof REQUIRED_LIFECYCLE_HOOKS)[number]];
        if (hookConfig && "function" in hookConfig) {
          referencedFunctionNames.add(hookConfig.function);
        }
      }
    }

    // Get the handler references for all lifecycle functions
    const handlerRefs = getManifestHandlerReferences(manifest);
    const lifecycleHandlerRefs = handlerRefs.filter((ref) =>
      referencedFunctionNames.has(ref.key),
    );

    // Parse the resolver file to check exports
    const resolversFile = path.join(process.cwd(), "src/resolvers/index.ts");
    const sourceFile = parseSourceFile(resolversFile);
    const exportedNames = findExportedNames(sourceFile);

    for (const ref of lifecycleHandlerRefs) {
      const { exportName } = parseLifecycleHandlerReference(ref.handler);

      if (!exportedNames.has(exportName)) {
        violations.push(
          `Lifecycle hook handler '${ref.key}' references missing export ` +
            `'${exportName}' in src/resolvers/index.ts`,
        );
      }
    }

    expect(
      violations,
      violations.length
        ? `Found missing lifecycle hook exports:\n${violations.join("\n")}`
        : undefined,
    ).toEqual([]);
  });
});

/**
 * Parse a handler reference to extract the export name.
 * Handles both "#" and "." notation.
 */
function parseLifecycleHandlerReference(handler: string): {
  exportName: string;
} {
  if (handler.includes("#")) {
    const [, exportName] = handler.split("#");
    return { exportName };
  }

  const [, exportName] = handler.split(".");
  return { exportName };
}
