/**
 * Import Delete Lifecycle Function
 * Triggered when user deletes the import configuration in Assets UI
 */

import type { AssetsImportContext, ImportResult } from "../assets/types";
import { logContext, logStructured } from "../forge/logging";

export async function onDeleteImport(
  context: AssetsImportContext,
): Promise<ImportResult> {
  logContext(context, "onDeleteImport");
  logStructured("info", "onDeleteImport", "Import deleted", {
    importId: context.importId,
  });
  // No cleanup needed - all state is transient
  return {
    result: "on delete import",
  };
}
