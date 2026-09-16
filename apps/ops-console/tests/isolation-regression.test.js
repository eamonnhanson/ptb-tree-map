import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { inspectIsolation, outsideOps } from "../scripts/isolation.mjs";

test("isolation checks clean, uncommitted, staged and committed changes", (t) => {
  const repo = mkdtempSync(path.join(tmpdir(), "ops-isolation-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: repo, stdio: "pipe" });
  git("init");
  git("config", "user.name", "Isolation test");
  git("config", "user.email", "isolation@example.invalid");
  git("config", "commit.gpgsign", "false");
  mkdirSync(path.join(repo, "apps/ops-console"), { recursive: true });
  mkdirSync(path.join(repo, "frontend"));
  writeFileSync(path.join(repo, "apps/ops-console/example.js"), "initial\n");
  writeFileSync(path.join(repo, "frontend/protected.js"), "initial\n");
  git("add", ".");
  git("commit", "-m", "Fixture base");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  assert.deepEqual(inspectIsolation(repo), { workingFiles: [], branchFiles: [] });

  writeFileSync(path.join(repo, "apps/ops-console/example.js"), "ops edit\n");
  assert.deepEqual(inspectIsolation(repo).workingFiles, ["apps/ops-console/example.js"]);
  assert.deepEqual(outsideOps(inspectIsolation(repo).workingFiles), []);

  writeFileSync(path.join(repo, "frontend/protected.js"), "protected edit\n");
  assert.deepEqual(outsideOps(inspectIsolation(repo).workingFiles), ["frontend/protected.js"]);
  git("add", ".");
  assert.deepEqual(outsideOps(inspectIsolation(repo).workingFiles), ["frontend/protected.js"]);
  git("commit", "-m", "Fixture protected change");
  assert.deepEqual(outsideOps(inspectIsolation(repo).branchFiles), ["frontend/protected.js"]);
  assert.deepEqual(inspectIsolation(repo).workingFiles, []);
});
