import { guardGet, json, unavailable } from "./_shared/http.js";
import { getWorkflow } from "./_shared/repository.js";

const VALID_ID = /^[a-zA-Z0-9_-]{1,100}$/;

export async function handler(event) {
  const guard = guardGet(event);
  if (guard) return guard;
  const id = event.queryStringParameters?.id || "";
  if (!VALID_ID.test(id)) return json(400, { ok: false, error: "Invalid workflow id" });
  try {
    const detail = await getWorkflow(id);
    if (!detail) return json(404, { ok: false, error: "Workflow not found" });
    return json(200, { ok: true, detail, generated_at: new Date().toISOString() });
  } catch {
    return unavailable("Workflow registry unavailable");
  }
}
