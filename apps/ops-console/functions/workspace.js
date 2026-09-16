import { readHandler } from './_shared/handler.js';
import { loadWorkspace } from './_shared/workspace.js';
export const handler = readHandler(() => loadWorkspace(), 'workspace');
