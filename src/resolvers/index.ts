import Resolver from "@forge/resolver";
import {
  type BuildMappingRequest,
  buildMappingBackend,
  type SubmitMappingRequest,
  submitMappingBackend,
} from "./mapping-resolver";

const resolver = new Resolver();

interface GetTextRequest {
  payload: {
    example?: string;
  };
  context?: unknown;
}

resolver.define("getText", (_req: GetTextRequest): string => {
  return "Hello, world!";
});

// Define mapping functions in the same resolver so they can be invoked from the module
resolver.define("buildMapping", async (req: BuildMappingRequest) => {
  return buildMappingBackend(req);
});

resolver.define("submitMapping", async (req: SubmitMappingRequest) => {
  return submitMappingBackend(req);
});

export const importConfig = resolver.getDefinitions();
export const importConfigResolver = resolver.getDefinitions();

// Also export as standalone functions for type compatibility
export async function buildMapping(req: BuildMappingRequest) {
  return buildMappingBackend(req);
}

export async function submitMapping(req: SubmitMappingRequest) {
  return submitMappingBackend(req);
}

// Re-export lifecycle functions from their dedicated modules
export { onDeleteImport } from "../import-lifecycle/delete";
export { startImport } from "../import-lifecycle/start";
export { importStatus } from "../import-lifecycle/status";
export { stopImport } from "../import-lifecycle/stop";
