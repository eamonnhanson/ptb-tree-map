import test from "node:test";
import assert from "node:assert/strict";
import { createHandler, eventRecord } from "../netlify/functions/monitoring-ingest.js";
import { normalizeShopifyOrderId, SHOPIFY_GIFT_WORKFLOW, validateEvidencePayload } from "../netlify/functions/shopify-workflow-evidence.js";

const env = { AUTOMATION_DASHBOARD_USER: "zap", AUTOMATION_DASHBOARD_PASSWORD: "secret", MONITORING_DATABASE_URL: "configured" };
const auth = `Basic ${Buffer.from("zap:secret").toString("base64")}`;
const base = { event_type: "shopify_order_received", order_id: "gid://shopify/Order/90000000000001", occurred_at: "2026-07-29T18:29:34Z", created_at: "2026-07-29T18:29:34Z", customer_email: "customer@example.test", customer_locale: "fr-BM", sku: "01", ordered_quantity: 1, product_title: "Synthetic gift tree", workflow_key: SHOPIFY_GIFT_WORKFLOW.key, zap_id: SHOPIFY_GIFT_WORKFLOW.zapId, zap_version: SHOPIFY_GIFT_WORKFLOW.publishedVersion };

test("Shopify order-ID normaliseert numeriek en GID zonder giswerk", () => {
  assert.equal(normalizeShopifyOrderId(" 90000000000001 "), "90000000000001");
  assert.equal(normalizeShopifyOrderId("gid://shopify/Order/90000000000001"), "90000000000001");
  assert.equal(normalizeShopifyOrderId("order-123"), null);
});

test("payloadvalidatie normaliseert taal en weigert gevoelige of onbekende velden", () => {
  const valid = validateEvidencePayload(base);
  assert.equal(valid.value.language, "fr");
  assert.equal(valid.value.ordered_quantity, 1);
  assert.match(validateEvidencePayload({ ...base, claim_token: "secret" }).error, /niet-toegestane/);
  assert.match(validateEvidencePayload({ ...base, ordered_quantity: 0 }).error, /Onvolledige/);
});

test("ingestion is idempotent door stabiele sleutel en vergrendelde guarded insert", async () => {
  const calls = [];
  let first = true;
  const client = { query: async (sql, values) => { calls.push({ sql, values }); if (/returning id/.test(sql)) { const inserted = first; first = false; return { rowCount: inserted ? 1 : 0, rows: inserted ? [{ id: 1 }] : [] }; } return { rowCount: 0, rows: [] }; }, release() {} };
  const handler = createHandler({ env, getPool: () => ({ connect: async () => client }) });
  const request = { httpMethod: "POST", headers: { authorization: auth }, body: JSON.stringify(base) };
  assert.equal((await handler(request)).statusCode, 201);
  assert.equal((await handler(request)).statusCode, 200);
  const locks = calls.filter(call => /pg_advisory_xact_lock/.test(call.sql));
  assert.equal(locks.length, 2);
  assert.equal(locks[0].values[0], eventRecord(validateEvidencePayload(base).value).key);
  assert.doesNotMatch(JSON.stringify(calls.map(call => call.sql)), /customer@example\.test/);
});

test("ingestion vereist bestaande Basic Auth", async () => {
  const handler = createHandler({ env, getPool: () => { throw new Error("must not connect"); } });
  assert.equal((await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify(base) })).statusCode, 401);
});
