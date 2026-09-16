import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectIsolation, outsideOps } from "../scripts/isolation.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "../..");

test("tracked working-tree changes remain inside apps/ops-console", () => {
  assert.deepEqual(outsideOps(inspectIsolation(repoRoot).workingFiles), []);
});

test("branch commits change only apps/ops-console", (t) => {
  const { branchFiles } = inspectIsolation(repoRoot);
  if (branchFiles === null) {
    t.skip("Shallow checkout lacks comparison history; review the full PR diff before deployment");
    return;
  }
  // Zero commits ahead of main is valid; uncommitted edits are checked above.
  assert.deepEqual(outsideOps(branchFiles), []);
});

test("independent Netlify directories cannot publish root applications", () => {
  const config = readFileSync(path.join(appRoot, "netlify.toml"), "utf8");
  assert.match(config, /publish = "dist"/);
  assert.match(config, /functions = "functions"/);
  assert.match(config, /edge_functions = "edge-functions"/);
  assert.doesNotMatch(config, /frontend\/automation-dashboard|\.\.\/\.\.\/frontend|\.\.\/\.\.\/netlify/);
});

test("new API contains only read-only SQL transaction and SELECT queries", () => {
  const repository = readFileSync(path.join(appRoot, "functions/_shared/repository.js"), "utf8");
  const database = readFileSync(path.join(appRoot, "functions/_shared/db.js"), "utf8");
  assert.match(database, /BEGIN READ ONLY/);
  assert.doesNotMatch(`${repository}\n${database}`, /\b(insert|update|delete|drop|alter|truncate|grant|revoke)\b/i);
});
