import { readHandler } from "./_shared/handler.js";
import { listWorkflows } from "./_shared/repository.js";

export const handler = readHandler(() => listWorkflows(), "workflows");
