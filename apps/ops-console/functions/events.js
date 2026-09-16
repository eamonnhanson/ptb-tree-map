import { readHandler } from "./_shared/handler.js";
import { listEvents } from "./_shared/repository.js";

export const handler = readHandler(() => listEvents(), "events");
