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

// Deployment scope is an explicit operation, not a property of every repository feature.
export function assertOpsDeploymentScope({ workingFiles, branchFiles }) {
  const working = outsideOps(workingFiles);
  const branch = branchFiles === null ? null : outsideOps(branchFiles);
  const problems = [];
  if (working.length) problems.push(`tracked working-tree changes remain inside apps/ops-console: ${working.join(', ')}`);
  if (branch === null) problems.push('branch comparison unavailable; fetch origin/main and full history before deployment');
  else if (branch.length) problems.push(`branch commits change only apps/ops-console: ${branch.join(', ')}`);
  if (problems.length) throw new Error(problems.join('\n'));
}
