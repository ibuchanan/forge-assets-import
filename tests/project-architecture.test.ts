/**
 * Project-Specific Architecture Tests
 *
 * These tests define and verify the allowed dependency relationships between
 * modules in this specific Forge app. They prevent accidental coupling and
 * maintain the intended layered architecture:
 *
 *   frontend         →  (no backend imports)
 *   resolvers        →  assets, external, forge, import-lifecycle
 *   import-lifecycle →  assets, forge, resolvers
 *   assets           →  (Forge platform APIs only)
 *   external         →  (external HTTP only)
 *   forge            →  (Forge platform APIs only)
 *
 * These rules reference specific module names (assets, external, import-lifecycle)
 * that are unique to this project.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { projectFiles } from "archunit";
import { describe, expect, it } from "vitest";

describe("Project Architecture", () => {
  describe("module dependency rules", () => {
    it("frontend should not depend on backend modules", async () => {
      for (const mod of [
        "resolvers",
        "import-lifecycle",
        "assets",
        "external",
        "forge",
      ]) {
        const rule = projectFiles()
          .inFolder("src/frontend/**")
          .shouldNot()
          .dependOnFiles()
          .inFolder(`src/${mod}/**`);
        await expect(rule).toPassAsync();
      }
    });

    it("external should not depend on other app modules", async () => {
      for (const mod of [
        "resolvers",
        "import-lifecycle",
        "assets",
        "frontend",
        "forge",
      ]) {
        const rule = projectFiles()
          .inFolder("src/external/**")
          .shouldNot()
          .dependOnFiles()
          .inFolder(`src/${mod}/**`);
        await expect(rule).toPassAsync();
      }
    });

    it("forge utilities should not depend on other app modules", async () => {
      for (const mod of [
        "resolvers",
        "import-lifecycle",
        "assets",
        "external",
        "frontend",
      ]) {
        const rule = projectFiles()
          .inFolder("src/forge/**")
          .shouldNot()
          .dependOnFiles()
          .inFolder(`src/${mod}/**`);
        await expect(rule).toPassAsync();
      }
    });

    it("import-lifecycle should not depend on frontend or external", async () => {
      for (const mod of ["frontend", "external"]) {
        const rule = projectFiles()
          .inFolder("src/import-lifecycle/**")
          .shouldNot()
          .dependOnFiles()
          .inFolder(`src/${mod}/**`);
        await expect(rule).toPassAsync();
      }
    });

    it("resolvers should not depend on frontend", async () => {
      const rule = projectFiles()
        .inFolder("src/resolvers/**")
        .shouldNot()
        .dependOnFiles()
        .inFolder("src/frontend/**");
      await expect(rule).toPassAsync();
    });
  });

  describe("auth patterns - project-specific", () => {
    it("should use api.asApp() for all backend API requests", () => {
      const srcPath = path.join(process.cwd(), "src");
      const files = getAllTypeScriptFiles(srcPath);

      for (const file of files) {
        // Skip frontend files - they use @forge/bridge
        if (file.includes("/frontend/")) {
          continue;
        }

        const content = fs.readFileSync(file, "utf-8");

        // Skip files that don't use @forge/api
        if (!content.includes("@forge/api")) {
          continue;
        }

        // Check for .asUser() usage - this project should use .asApp() instead
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Skip comments and imports
          if (line.trim().startsWith("//") || line.includes("import")) {
            continue;
          }

          // Look for .asUser() usage
          if (line.includes(".asUser()")) {
            expect(
              line,
              `File ${file}, line ${i + 1}: This project uses api.asApp() for all backend API requests, not .asUser(). See project auth architecture.`,
            ).not.toMatch(/\.asUser\(\)/);
          }
        }
      }
    });
  });
});

/**
 * Helper function to recursively find all TypeScript files in a directory
 */
function getAllTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentPath: string) {
    if (!fs.existsSync(currentPath)) {
      return;
    }

    const items = fs.readdirSync(currentPath);

    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules and dist
        if (
          item !== "node_modules" &&
          item !== "dist" &&
          !item.startsWith(".")
        ) {
          walk(fullPath);
        }
      } else if (
        item.endsWith(".ts") ||
        item.endsWith(".tsx") ||
        item.endsWith(".js")
      ) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}
