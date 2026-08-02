import { createDatabasePool, postgresDiagnostics } from "./tree-allocated.js";
import { idempotencyKey, SHOPIFY_GIFT_WORKFLOW, validateEvidencePayload } from "./shopify-workflow-evidence.js";

let pool;
const response = (statusCode, body, extra = {}) => ({ statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra }, body: JSON.stringify(body) });
const getHeader = (event, name) => Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === name)?.[1] || "";
function authorized(event, env) {
  if (!env.AUTOMATION_DASHBOARD_USER || !env.AUTOMATION_DASHBOARD_PASSWORD) return false;
  const value = getHeader(event, "authorization");
  if (!value.startsWith("Basic ")) return false;
  const [user, ...password] = Buffer.from(value.slice(6), "base64").toString("utf8").split(":");
  return user === env.AUTOMATION_DASHBOARD_USER && password.join(":") === env.AUTOMATION_DASHBOARD_PASSWORD;
}
function database(env) {
  if (!env.MONITORING_DATABASE_URL) return null;
  if (!pool) pool = createDatabasePool(env.MONITORING_DATABASE_URL);
  return pool;
}

export function eventRecord(data) {
  const key = idempotencyKey(data);
  const failed = data.status === "failed" || data.submission_status === "failed" || data.creator_record_count > 1 || data.creator_record_count === 0;
  const source = data.event_type === "shopify_order_received" ? "Shopify" : data.event_type === "gift_claim_created" ? "Zoho Creator" : "E-mailactie";
  const changed = { ...data, idempotency_key: key, workflow_name: SHOPIFY_GIFT_WORKFLOW.name };
  delete changed.customer_email;
  delete changed.recipient_email;
  return { key, failed, source, customerEmail: data.customer_email || data.recipient_email || null, changed };
}

export function createHandler({ env = process.env, getPool = () => database(env), logger = console } = {}) {
  return async event => {
    if (!authorized(event, env)) return response(env.AUTOMATION_DASHBOARD_USER ? 401 : 503, { ok: false, error: "Niet geautoriseerd" }, { "WWW-Authenticate": 'Basic realm="Plant N Boom monitoring ingestion"' });
    if (event.httpMethod !== "POST") return response(405, { ok: false, error: "Method not allowed" }, { Allow: "POST" });
    if ((event.body || "").length > 16384) return response(413, { ok: false, error: "Payload te groot" });
    let payload;
    try { payload = JSON.parse(event.body || ""); } catch { return response(400, { ok: false, error: "Ongeldige JSON-payload" }); }
    const validated = validateEvidencePayload(payload);
    if (validated.error) return response(400, { ok: false, error: validated.error });
    const db = getPool();
    if (!db) return response(503, { ok: false, error: "Monitoringdatabase is niet geconfigureerd" });
    const record = eventRecord(validated.value);
    let client;
    try {
      client = await db.connect();
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [record.key]);
      const inserted = await client.query(`insert into monitoring.automation_events
        (event_time,category,severity,status,source_system,flow_name,entity_type,entity_id,customer_email,changed_fields,summary,action_required,error_message)
        select $1,$2,$3,$4,$5,$6,'shopify_order',$7,$8,$9::jsonb,$10,$11,$12
        where not exists (select 1 from monitoring.automation_events where changed_fields->>'idempotency_key'=$13)
        returning id`, [validated.value.occurred_at, validated.value.event_type, record.failed ? "red" : "green", record.failed ? "failed" : "confirmed", record.source, SHOPIFY_GIFT_WORKFLOW.name, validated.value.order_id, record.customerEmail, JSON.stringify(record.changed), `${validated.value.event_type} geregistreerd`, record.failed, record.failed ? "Geregistreerde workflowfout" : null, record.key]);
      await client.query("commit");
      const created = inserted.rowCount === 1;
      return response(created ? 201 : 200, { ok: true, inserted: created, event_type: validated.value.event_type, order_id: validated.value.order_id });
    } catch (error) {
      if (client) try { await client.query("rollback"); } catch {}
      logger.error("Monitoring ingestion failed", postgresDiagnostics(error));
      return response(503, { ok: false, error: "Monitoringevent kon niet worden opgeslagen" });
    } finally { client?.release(); }
  };
}

export const handler = createHandler();
