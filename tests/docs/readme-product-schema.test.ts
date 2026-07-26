/**
 * README/Product mapping drift guard
 *
 * Parses the Product schema table in README.md (between the
 * PRODUCT_SCHEMA_TABLE markers) and checks it matches
 * PRODUCT_FIELD_MAPPINGS, the single source of truth for the
 * customer-owned Assets schema this app expects.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_FIELD_MAPPINGS } from "../../src/assets/product-mapping";

interface ReadmeSchemaRow {
  assetsField: string;
  type: string;
  required: boolean;
  description: string;
}

function parseReadmeProductSchemaTable(): ReadmeSchemaRow[] {
  const readme = readFileSync(join(process.cwd(), "README.md"), "utf-8");

  const start = readme.indexOf("<!-- PRODUCT_SCHEMA_TABLE:START -->");
  const end = readme.indexOf("<!-- PRODUCT_SCHEMA_TABLE:END -->");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      "README.md is missing the PRODUCT_SCHEMA_TABLE:START/END markers around the Product schema table.",
    );
  }

  const tableBlock = readme.slice(start, end);
  const rows = tableBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    // Drop the header row and the "| --- |" separator row.
    .slice(2);

  return rows.map((row) => {
    const cells = row
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell, index, all) => !(index === 0 || index === all.length - 1));
    const [assetsField, type, required, description] = cells;
    return {
      assetsField,
      type,
      required: required === "Yes",
      description,
    };
  });
}

describe("README Product schema table", () => {
  it("matches PRODUCT_FIELD_MAPPINGS exactly, in order", () => {
    const readmeRows = parseReadmeProductSchemaTable();
    const expectedRows = PRODUCT_FIELD_MAPPINGS.map((fieldMapping) => ({
      assetsField: fieldMapping.assetsField,
      type: fieldMapping.expectedAssetsType,
      required: fieldMapping.required,
      description: fieldMapping.description,
    }));

    expect(readmeRows).toEqual(expectedRows);
  });
});
