import { execFileSync } from "node:child_process";

export function inspectIsolation(repoRoot) {
  const git = (...args) => execFileSync("git", args, {
    cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
  });
  const names = (output) => output.split("\0").filter(Boolean);
  // HEAD comparison includes staged and unstaged tracked changes.
  const workingFiles = names(git("diff", "--name-only", "-z", "HEAD", "--"));
  let branchFiles = null;
  let base;
  try {
    base = git("merge-base", "HEAD", "origin/main").trim();
  } catch (error) {
    // A depth-one CI checkout may not contain the comparison history.
    // Do not pretend that listing files proves branch isolation.
    if (git("rev-parse", "--is-shallow-repository").trim() !== "true") throw error;
  }
  if (base) branchFiles = names(git("diff", "--name-only", "-z", base, "HEAD", "--"));
  return { workingFiles, branchFiles };
}

export function outsideOps(files) {
  return files.filter((file) => !file.startsWith("apps/ops-console/"));
}
