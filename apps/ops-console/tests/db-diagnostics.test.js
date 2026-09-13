import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../functions/db-diagnostics.js";

const original = { user: process.env.OPS_CONSOLE_USER, password: process.env.OPS_CONSOLE_PASSWORD };
const event = { httpMethod: "GET", headers: { authorization: `Basic ${Buffer.from("operator:secret").toString("base64")}` } };
test.beforeEach(() => { process.env.OPS_CONSOLE_USER = "operator"; process.env.OPS_CONSOLE_PASSWORD = "secret"; });
test.after(() => { process.env.OPS_CONSOLE_USER = original.user; process.env.OPS_CONSOLE_PASSWORD = original.password; });
test("diagnostics rejects unauthenticated access", async () => assert.equal((await createHandler()({ httpMethod: "GET", headers: {} })).statusCode, 401));
test("diagnostics returns only safe read-only results", async () => {
  const queries = [];
  const handler = createHandler({ connectionUrl: () => "postgres://secret-user:secret-password@monitor.example.test:14296/ptb_monitoring_test?sslmode=require", query: async (sql, values) => { queries.push({ sql, values }); if (sql.includes("current_database")) return { rows: [{ database: "ptb_monitoring_test", current_user: "ops_reader" }] }; if (sql.includes("count(*)")) return { rows: [{ matching_events: 3 }] }; return { rows: [{ entity_id: "17987956932938", entity_type: "shopify_order", category: "shopify_order_received", status: "confirmed", severity: "green", event_time: "2026-09-13T00:00:00Z", customer_email: "buyer@example.test", sku: "02", ordered_quantity: "2" }] }; } });
  const response = await handler(event), body = JSON.parse(response.body), output = JSON.stringify(body);
  assert.equal(response.statusCode, 200); assert.deepEqual(body.connection, { host: "monitor.example.test", port: 14296, database: "ptb_monitoring_test", current_user: "ops_reader" }); assert.equal(body.shopify_tree_sale_events.count, 3); assert.equal(body.target_order.rows.length, 1); assert.equal(queries.length, 3); assert.doesNotMatch(output, /secret-user|secret-password|sslmode/);
});
test("diagnostics reports a missing target order as an empty list", async () => {
  const handler = createHandler({ connectionUrl: () => "postgres://user:password@monitor.example.test/db", query: async sql => sql.includes("current_database") ? { rows: [{ database: "db", current_user: "reader" }] } : sql.includes("count(*)") ? { rows: [{ matching_events: 0 }] } : { rows: [] } });
  assert.deepEqual(JSON.parse((await handler(event)).body).target_order.rows, []);
});
