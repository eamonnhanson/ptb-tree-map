import { guardGet, json, unavailable } from "./_shared/http.js";
import { getSystemVisibility, listActions, listEvents, listWorkflows } from "./_shared/repository.js";

export async function handler(event) {
  const guard = guardGet(event);
  if (guard) return guard;
  try {
    const [workflows, actions, events, systems] = await Promise.all([
      listWorkflows({ criticalOnly: true }), listActions(), listEvents(), getSystemVisibility()
    ]);
    const failures = events.rows.filter((item) =>
      String(item.severity).toLowerCase() === "red" || ["failed", "error", "blocked", "halted"].includes(String(item.status).toLowerCase())
    ).slice(0, 10);
    return json(200, {
      ok: true,
      overview: { workflows, actions, recent_failures: failures, systems },
      generated_at: new Date().toISOString()
    });
  } catch {
    return unavailable("Monitoring data unavailable");
  }
}
