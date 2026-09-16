import { readHandler } from "./_shared/handler.js";
import { listActions } from "./_shared/repository.js";

export const handler = readHandler(() => listActions(), "actions");
