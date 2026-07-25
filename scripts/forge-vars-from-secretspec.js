#!/usr/bin/env node

const { execFileSync } = require("node:child_process");

/**
 * App-level runtime secrets to push to Forge via `forge variables set`,
 * matching keys declared under [profiles.default] in secretspec.toml.
 *
 * Empty today: the DummyJSON sample source requires no authentication, so
 * this app has no runtime secrets to push. Add a key here (and a matching
 * entry in secretspec.toml) when a future external source needs a real
 * credential, such as an API token.
 */
const APP_VARIABLE_KEYS = [];

function resolveSecretspecEnv() {
  const output = execFileSync(
    "secretspec",
    [
      "run",
      "--provider",
      "dotenv",
      "--reason",
      "npm run forge:variables:set",
      "--",
      "node",
      "-p",
      "JSON.stringify(process.env)",
    ],
    { encoding: "utf8" },
  );
  const lastLine = output.trim().split("\n").pop();
  return JSON.parse(lastLine);
}

function main() {
  if (APP_VARIABLE_KEYS.length === 0) {
    console.log(
      "No app-level Forge variables declared in APP_VARIABLE_KEYS. " +
        "DummyJSON needs no authentication, so there is nothing to push " +
        "today. Add a key here and to secretspec.toml when a future " +
        "external source needs a real credential.",
    );
    return;
  }

  const env = resolveSecretspecEnv();
  const environment = env.FORGE_ENVIRONMENT || "development";

  for (const key of APP_VARIABLE_KEYS) {
    const value = env[key];
    if (!value) {
      throw new Error(`Missing value for ${key}; check secretspec.toml`);
    }
    execFileSync(
      "forge",
      [
        "variables",
        "set",
        key,
        value,
        "--environment",
        environment,
        "--encrypt",
      ],
      { stdio: "inherit" },
    );
  }
}

main();
