import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const tests = readdirSync(new URL("../tests/", import.meta.url))
  .filter((name) => name.endsWith(".test.js"))
  .sort()
  .map((name) => `tests/${name}`);
if (!tests.length) throw new Error("No Ops Console tests found");
// Explicit arguments work even where neither the shell nor Node expands globs.
const result = spawnSync(process.execPath, ["--test", ...tests], {
  cwd: root, stdio: "inherit", shell: false
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
