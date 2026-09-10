import { guardGet, json, unavailable } from "./http.js";
import { reportFailure } from "./diagnostics.js";

export function readHandler(loader, key) {
  return async function handler(event) {
    const guard = guardGet(event);
    if (guard) return guard;
    try {
      const data = await loader(event);
      return json(200, { ok: true, [key]: data, generated_at: new Date().toISOString() });
    } catch (error) {
      reportFailure(error, key);
      return unavailable("Monitoring data unavailable");
    }
  };
}
