/**
 * Import Status Lifecycle Function
 * Executed when Assets UI loads to display the status of the import
 */

import {
  type ExecutionStatus,
  getConfigStatus,
  getExecutionStatus as getExecutionStatusFromClient,
  getExecutionStatusByUrl as getExecutionStatusByUrlFromClient,
} from "../assets/import-client";
import {
  type AssetsImportContext,
  ForgeImportStatus,
  ImportConfigurationStatus,
  type ImportStatusResult,
} from "../assets/types";
import { logStructured } from "../forge/logging";

export type { ExecutionStatus };
export {
  getExecutionStatusFromClient as getExecutionStatus,
  getExecutionStatusByUrlFromClient as getExecutionStatusByUrl,
};

export function mapConfigurationStatus(
  configurationStatus: ImportConfigurationStatus | string | undefined,
): ForgeImportStatus {
  // Map each documented API status to appropriate Forge status
  // TypeScript ensures we handle all enum values
  switch (configurationStatus) {
    case ImportConfigurationStatus.IDLE:
    case ImportConfigurationStatus.RUNNING:
    case ImportConfigurationStatus.DISABLED:
      return ForgeImportStatus.READY;
    case ImportConfigurationStatus.MISSING_MAPPING:
      return ForgeImportStatus.NOT_CONFIGURED;
    default:
      // Handle undefined, null, empty string, or any future unknown values
      return ForgeImportStatus.NOT_CONFIGURED;
  }
}

export async function importStatus(
  context: AssetsImportContext,
): Promise<ImportStatusResult> {
  // logContext(context, "importStatus");
  const { importId, workspaceId } = context;
  const statusResult = await getConfigStatus(workspaceId, importId);
  if (statusResult.isErr()) {
    logStructured("debug", "importStatus", "Could not query status", {
      importsourceId: importId,
      workspaceId,
      error: statusResult.error.detail,
    });
    return {
      status: ForgeImportStatus.NOT_CONFIGURED,
    };
  }
  const configurationStatus = statusResult.value;
  const status = mapConfigurationStatus(configurationStatus);
  return { status };
}
