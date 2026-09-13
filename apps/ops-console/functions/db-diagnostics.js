import { read } from "./_shared/db.js";
import { guardGet, json, unavailable } from "./_shared/http.js";

const ORDER_ID = "17987956932938";
const IDENTITY = "select current_database() as database, current_user as current_user";
const EVENT_COUNT = "select count(*)::int as matching_events from monitoring.automation_events where entity_type = 'shopify_order' and category = 'shopify_order_received'";
const ORDER_ROWS = "select entity_id::text, entity_type, category, status, severity, event_time, customer_email, changed_fields->>'sku' as sku, changed_fields->>'ordered_quantity' as ordered_quantity from monitoring.automation_events where entity_id::text = $1 order by event_time desc, id desc limit 5";

function connectionAddress(value) {
  const url = new URL(value);
  return { host: url.hostname, port: Number(url.port || 5432) };
}

export function createHandler({ query = read, connectionUrl = () => process.env.OPS_CONSOLE_DATABASE_URL } = {}) {
  return async event => {
    const guard = guardGet(event); if (guard) return guard;
    try {
      const [identity, count, order] = await Promise.all([query(IDENTITY), query(EVENT_COUNT), query(ORDER_ROWS, [ORDER_ID])]);
      const address = connectionAddress(connectionUrl());
      return json(200, { ok: true, connection: { ...address, database: identity.rows[0]?.database, current_user: identity.rows[0]?.current_user }, shopify_tree_sale_events: { count: count.rows[0]?.matching_events ?? 0 }, target_order: { order_id: ORDER_ID, rows: order.rows || [] } });
    } catch { return unavailable("Database diagnostics are unavailable"); }
  };
}

export const handler = createHandler();
