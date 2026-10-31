import { fileURLToPath } from 'node:url';
import { inspectIsolation, assertOpsDeploymentScope } from './isolation.mjs';
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
assertOpsDeploymentScope(inspectIsolation(repoRoot));
console.log('Ops-only deployment scope verified');
