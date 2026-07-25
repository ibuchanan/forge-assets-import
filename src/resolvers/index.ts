import Resolver from "@forge/resolver";
import {
  type BuildMappingRequest,
  buildMappingPreviewBackend,
  configureMappingBackend,
} from "./mapping-resolver";

const resolver = new Resolver();

// Define mapping functions in the same resolver so they can be invoked from the module
resolver.define("configureMapping", async (req: BuildMappingRequest) => {
  return configureMappingBackend(req);
});

resolver.define("buildMappingPreview", async (req: BuildMappingRequest) => {
  return buildMappingPreviewBackend(req);
});

export const importConfigResolver = resolver.getDefinitions();

// Re-export lifecycle functions from their dedicated modules
export { onDeleteImport } from "../import-lifecycle/delete";
export { startImport } from "../import-lifecycle/start";
export { importStatus } from "../import-lifecycle/status";
export { stopImport } from "../import-lifecycle/stop";
