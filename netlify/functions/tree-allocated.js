import pg from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { determineTreeAllocatedStatus, DEFAULT_PROCESSING_WINDOW_HOURS } from "./tree-allocated-status.js";
import { EVIDENCE_EVENT_TYPES, normalizeShopifyOrderId, SHOPIFY_GIFT_WORKFLOW } from "./shopify-workflow-evidence.js";

const { Pool } = pg;
let pool;
let monitoringPool;
const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const allowedPeriods = new Set(["today", "7d", "30d", "custom"]);
const allowedStatuses = new Set(["all", "completed", "processing", "unverifiable", "action_required"]);

function json(statusCode, body, extra = {}) { return { statusCode, headers: { ...headers, ...extra }, body: JSON.stringify(body) }; }
function header(event, name) { return Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === name)?.[1] || ""; }
function authorized(event, env) {
  if (!env.AUTOMATION_DASHBOARD_USER || !env.AUTOMATION_DASHBOARD_PASSWORD) return false;
  const value = header(event, "authorization");
  if (!value.startsWith("Basic ")) return false;
  const [user, ...password] = Buffer.from(value.slice(6), "base64").toString("utf8").split(":");
  return user === env.AUTOMATION_DASHBOARD_USER && password.join(":") === env.AUTOMATION_DASHBOARD_PASSWORD;
}
function positiveInt(value, fallback, max) {
  if (value == null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= 1 && parsed <= max ? parsed : null;
}
function isoDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : null; }

export function sanitizeDatabaseUrl(connectionString) {
  const parsed = new URL(connectionString);
  parsed.searchParams.delete("sslrootcert");
  parsed.searchParams.delete("sslcert");
  parsed.searchParams.delete("sslkey");
  // pg-connection-string gives URL SSL parameters precedence over Pool.ssl.
  // Remove them so the verified bundled CA configuration below remains effective.
  parsed.searchParams.delete("sslmode");
  parsed.searchParams.delete("ssl");
  return parsed.toString();
}

export function createDatabasePool(connectionString, {
  PoolClass = Pool,
  readCertificate = readFileSync,
  runtimeDirectory = process.cwd()
} = {}) {
  const caPath = path.resolve(runtimeDirectory, "certs", "ca.pem");
  const ca = readCertificate(caPath, "utf8");

  return new PoolClass({
    connectionString: sanitizeDatabaseUrl(connectionString),
    ssl: {
      ca,
      rejectUnauthorized: true
    },
    max: 2,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000
  });
}

export function postgresDiagnostics(error) {
  return {
    code: error?.code ?? null,
    message: error?.message ?? null,
    table: error?.table ?? null,
    column: error?.column ?? null,
    position: error?.position ?? null
  };
}

function db(env) {
  const connectionString = env.TREE_SALES_DATABASE_URL || env.DATABASE_URL;
  if (!connectionString) return null;
  if (!pool) pool = createDatabasePool(connectionString);
  return pool;
}

function monitoringDb(env) {
  if (!env.MONITORING_DATABASE_URL) return null;
  if (!monitoringPool) monitoringPool = createDatabasePool(env.MONITORING_DATABASE_URL);
  return monitoringPool;
}

function evidenceByOrder(rows) {
  const evidence = new Map();
  for (const row of rows) {
    const orderId = normalizeShopifyOrderId(row.entity_id || row.changed_fields?.order_id);
    if (!orderId) continue;
    const item = evidence.get(orderId) || {};
    const data = typeof row.changed_fields === "string" ? JSON.parse(row.changed_fields) : (row.changed_fields || {});
    if (row.category === "shopify_order_received") Object.assign(item, { shopify_source_available: true, order_date: data.created_at, ordered_count: Number(data.ordered_quantity), sku: data.sku, language: data.language, email: row.customer_email || item.email });
    if (row.category === "gift_claim_created") Object.assign(item, { creator_source_available: true, creator_record_count: Number(data.creator_record_count), creator_record_id: data.creator_record_id || null });
    if (row.category === "gift_claim_email_submitted") Object.assign(item, { email_submission_status: data.submission_status, email_submitted: data.submission_status === "submitted" });
    if (row.status === "failed" || row.action_required === true) item.technical_error = "Geregistreerde technische workflowfout";
    evidence.set(orderId, item);
  }
  return evidence;
}

export function createHandler({ env = process.env, getPool = () => db(env), getMonitoringPool = () => monitoringDb(env), now = () => new Date(), logger = console } = {}) {
  return async function handler(event) {
    if (!authorized(event, env)) return json(env.AUTOMATION_DASHBOARD_USER ? 401 : 503, { ok: false, error: "Dashboardtoegang is niet geconfigureerd of niet toegestaan" }, { "WWW-Authenticate": 'Basic realm="Plant N Boom automation dashboard"' });
    if (event.httpMethod !== "GET") return json(405, { ok: false, error: "Method not allowed" }, { Allow: "GET" });
    const q = event.queryStringParameters || {};
    const page = positiveInt(q.page, 1, 100000);
    const pageSize = positiveInt(q.page_size, 25, 100);
    const period = q.period || "7d";
    const status = q.status || "all";
    if (!page || !pageSize || !allowedPeriods.has(period) || !allowedStatuses.has(status) || (q.from && !isoDate(q.from)) || (q.to && !isoDate(q.to)) || (period === "custom" && (!isoDate(q.from) || !isoDate(q.to)))) {
      return json(400, { ok: false, error: "Ongeldige filters of periode" });
    }
    const database = getPool();
    if (!database) return json(503, { ok: false, error: "PostgreSQL-bron is niet geconfigureerd", source_status: { postgresql: "unavailable", shopify: "not_configured", creator: "not_configured" } });

    try {
      const values = [];
      const where = ["t.order_id is not null", "btrim(t.order_id::text) <> ''"];
      const search = String(q.search || "").trim().slice(0, 120);
      if (search) { values.push(`%${search}%`); where.push(`(u.first_name ilike $${values.length} or u.last_name ilike $${values.length} or u.email ilike $${values.length} or t.order_id::text ilike $${values.length} or t.tree_code ilike $${values.length} or u.id::text ilike $${values.length})`); }
      let from = q.from, to = q.to;
      if (period !== "custom") {
        const days = period === "today" ? 0 : period === "7d" ? 6 : 29;
        const d = now(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - days); from = d.toISOString().slice(0, 10); to = now().toISOString().slice(0, 10);
      }
      values.push(from); where.push(`coalesce(t.claimed_at, t.updated_at, t.created_at)::date >= $${values.length}::date`);
      values.push(to); where.push(`coalesce(t.claimed_at, t.updated_at, t.created_at)::date <= $${values.length}::date`);
      values.push(pageSize); const limitAt = values.length;
      values.push((page - 1) * pageSize); const offsetAt = values.length;
      const sql = `select t.order_id::text as shopify_order_id, null::timestamptz as order_date,
        max(coalesce(t.claimed_at,t.updated_at,t.created_at)) as allocation_observed_at,
        max(u.id)::int as user_id, max(u.email) as email, max(concat_ws(' ',u.first_name,u.last_name)) as customer_name,
        null::text as sku, null::text as language, count(*)::int as allocated_count,
        json_agg(json_build_object('id',t.id,'tree_code',t.tree_code,'tree_type',t.tree_type,'lat',t.lat,'long',t.long,'planted_date',t.planted_date,'claimed_at',t.claimed_at,'user_id',t.user_id,'order_id',t.order_id) order by t.id) as trees,
        count(*) over()::int as total_count
        from public.trees1 t left join public.users1 u on u.id=t.user_id where ${where.join(" and ")}
        group by t.order_id order by max(coalesce(t.claimed_at,t.updated_at,t.created_at)) desc limit $${limitAt} offset $${offsetAt}`;
      const result = await database.query(sql, values);
      let monitoringStatus = "not_configured";
      let evidence = new Map();
      const monitoring = getMonitoringPool();
      if (monitoring && result.rows.length) {
        try {
          const orderIds = result.rows.map(row => normalizeShopifyOrderId(row.shopify_order_id)).filter(Boolean);
          const eventResult = await monitoring.query(`select event_time,category,status,entity_id,customer_email,changed_fields,action_required
            from monitoring.automation_events
            where entity_type='shopify_order' and entity_id=any($1::text[]) and category=any($2::text[])
              and changed_fields->>'workflow_key'=$3
            order by event_time,id`, [orderIds, EVIDENCE_EVENT_TYPES, SHOPIFY_GIFT_WORKFLOW.key]);
          evidence = evidenceByOrder(eventResult.rows);
          monitoringStatus = "available";
        } catch (error) {
          monitoringStatus = "unavailable";
          logger.error("Tree allocated monitoring query failed", postgresDiagnostics(error));
        }
      } else if (monitoring) monitoringStatus = "available";
      const orders = result.rows.map(row => {
        const workflowEvidence = evidence.get(normalizeShopifyOrderId(row.shopify_order_id)) || {};
        const order = {
          ...row,
          order_date: null,
          ordered_count: null,
          creator_record_count: null,
          creator_record_id: null,
          email_submitted: null,
          email_submission_status: null,
          mismatched_order_count: 0,
          shopify_source_available: false,
          creator_source_available: false,
          ...workflowEvidence
        };
        return { ...order, final_status: determineTreeAllocatedStatus(order, now()) };
      });
      const filtered = status === "all" ? orders : orders.filter(order => order.final_status.status === status);
      const counts = { new: orders.length, completed: 0, processing: 0, unverifiable: 0, action_required: 0 };
      orders.forEach(order => { counts[order.final_status.status] += 1; });
      const hasShopify = orders.some(order => order.shopify_source_available);
      const hasCreator = orders.some(order => order.creator_source_available);
      return json(200, { ok: true, generated_at: now().toISOString(), period: { key: period, from, to }, processing_window_hours: DEFAULT_PROCESSING_WINDOW_HOURS, source_status: { postgresql: "available", shopify: hasShopify ? "available" : monitoringStatus === "available" ? "connected_no_evidence" : monitoringStatus, creator: hasCreator ? "available" : monitoringStatus === "available" ? "connected_no_evidence" : monitoringStatus, monitoring: monitoringStatus }, limitations: monitoringStatus === "available" ? ["Historische orders zonder workflowevents blijven niet volledig controleerbaar."] : ["Monitoringevents zijn niet beschikbaar; Shopify- en Creator-bewijs kan niet worden gecontroleerd."], counts, orders: filtered, pagination: { page, page_size: pageSize, total: Number(result.rows[0]?.total_count || 0) }, workflow_links: { zap: env.ZAP_C_URL || null, history: env.ZAP_C_HISTORY_URL || null } });
    } catch (error) {
      logger.error("Tree allocated query failed", postgresDiagnostics(error));
      return json(503, { ok: false, error: "Tree allocated data is tijdelijk niet bereikbaar", source_status: { postgresql: "unavailable", shopify: "not_configured", creator: "not_configured" } });
    }
  };
}

export const handler = createHandler();
