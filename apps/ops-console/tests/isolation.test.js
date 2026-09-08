import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "../..");

test("all working-tree changes remain inside apps/ops-console", () => {
  const tracked = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: repoRoot, encoding: "utf8" });
  const changed = `${tracked}\n${untracked}`.trim().split("\n").filter(Boolean);
  assert.ok(changed.length > 0);
  assert.deepEqual(changed.filter((file) => !file.startsWith("apps/ops-console/")), []);
});

test("independent Netlify directories cannot publish root applications", () => {
  const config = readFileSync(path.join(appRoot, "netlify.toml"), "utf8");
  assert.match(config, /publish = "dist"/);
  assert.match(config, /functions = "functions"/);
  assert.doesNotMatch(config, /frontend\/automation-dashboard|\.\.\/\.\.\/frontend|\.\.\/\.\.\/netlify/);
});

test("new API contains only read-only SQL transaction and SELECT queries", () => {
  const repository = readFileSync(path.join(appRoot, "functions/_shared/repository.js"), "utf8");
  const database = readFileSync(path.join(appRoot, "functions/_shared/db.js"), "utf8");
  assert.match(database, /BEGIN READ ONLY/);
  assert.doesNotMatch(`${repository}\n${database}`, /\b(insert|update|delete|drop|alter|truncate|grant|revoke)\b/i);
});
