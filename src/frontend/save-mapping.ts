import { invoke } from "@forge/bridge";

export interface AssetsImportExtension {
  workspaceId: string;
  importId: string;
  schemaId: string;
}

function extractInvokeBody<T>(response: T | { body: T }): T {
  if (response !== null && typeof response === "object" && "body" in response) {
    return (response as { body: T }).body;
  }
  return response as T;
}

/**
 * Save the Product mapping by invoking the single backend configureMapping
 * resolver, which builds the attribute mapping from the current schema and
 * submits it to Assets. The frontend never builds or casts the mapping body.
 */
export async function saveMapping(
  extension: AssetsImportExtension,
): Promise<void> {
  const { workspaceId, importId } = extension;

  const result = extractInvokeBody(
    await invoke<{
      success: boolean;
      error?: { detail?: string };
    }>("configureMapping", {
      workspaceId,
      importId,
    }),
  );

  if (!result.success) {
    throw new Error(
      result.error?.detail || "Failed to save mapping configuration",
    );
  }
}
