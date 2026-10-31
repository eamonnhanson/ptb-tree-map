import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertOpsDeploymentScope } from "../scripts/isolation.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
test("tracked working-tree changes remain inside apps/ops-console", () => {
  assert.doesNotThrow(() => assertOpsDeploymentScope({workingFiles: ['apps/ops-console/frontend/workspace.js'], branchFiles: []}));
  assert.throws(() => assertOpsDeploymentScope({workingFiles: ['api/trees.js'], branchFiles: []}), /tracked working-tree changes.*api\/trees.js/);
});

test("branch commits change only apps/ops-console", () => {
  assert.doesNotThrow(() => assertOpsDeploymentScope({workingFiles: [], branchFiles: ['apps/ops-console/README.md']}));
  assert.throws(() => assertOpsDeploymentScope({workingFiles: [], branchFiles: ['frontend/app.js']}), /branch commits.*frontend\/app.js/);
  assert.throws(() => assertOpsDeploymentScope({workingFiles: [], branchFiles: null}), /comparison unavailable/);
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
