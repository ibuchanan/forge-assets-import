/**
 * Import Delete Lifecycle Function
 * Triggered when user deletes the import configuration in Assets UI
 */

import type { AssetsImportContext, ImportResult } from "../assets/types";
import { logContext, logStructured } from "../forge/logging";
import { clearActiveRunState, clearLatestOutcome } from "./run-state";

export async function onDeleteImport(
  context: AssetsImportContext,
): Promise<ImportResult> {
  logContext(context, "onDeleteImport");
  const { importId } = context;

  await clearActiveRunState(importId);
  await clearLatestOutcome(importId);

  logStructured("info", "onDeleteImport", "Import deleted", {
    importId,
  });
  return {
    result: "on delete import",
  };
}
