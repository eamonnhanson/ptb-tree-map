import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { createDatabasePool, createHandler, postgresDiagnostics, sanitizeDatabaseUrl } from "../netlify/functions/tree-allocated.js";

const env = { AUTOMATION_DASHBOARD_USER: "superuser", AUTOMATION_DASHBOARD_PASSWORD: "secret" };
const auth = `Basic ${Buffer.from("superuser:secret").toString("base64")}`;
const event = (query = {}, authenticated = true) => ({ httpMethod: "GET", headers: authenticated ? { authorization: auth } : {}, queryStringParameters: query });

test("database-URL verwijdert lokale certificaatpaden en conflicterende SSL-flags", () => {
  const sanitized = new URL(sanitizeDatabaseUrl(
    "postgresql://user:password@db.example.test/trees?sslmode=verify-ca&sslrootcert=.%2Fcerts%2Fca.pem&sslcert=client.pem&sslkey=client.key&application_name=tree-allocated"
  ));

  assert.equal(sanitized.searchParams.get("sslrootcert"), null);
  assert.equal(sanitized.searchParams.get("sslcert"), null);
  assert.equal(sanitized.searchParams.get("sslkey"), null);
  assert.equal(sanitized.searchParams.get("sslmode"), null);
  assert.equal(sanitized.searchParams.get("application_name"), "tree-allocated");
});

test("database-Pool gebruikt de gebundelde CA met volledige TLS-verificatie", () => {
  const calls = [];
  class PoolStub {
    constructor(options) { calls.push(options); }
  }
  const database = createDatabasePool(
    "postgresql://user:password@db.example.test/trees?sslmode=verify-ca&sslrootcert=./certs/ca.pem",
    {
      PoolClass: PoolStub,
      runtimeDirectory: "C:/netlify/runtime",
      readCertificate: (certificatePath, encoding) => {
        assert.match(certificatePath.replaceAll("\\", "/"), /C:\/netlify\/runtime\/certs\/ca\.pem$/);
        assert.equal(encoding, "utf8");
        return "TEST CA CONTENT";
      }
    }
  );

  assert.ok(database instanceof PoolStub);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].ssl.ca, "TEST CA CONTENT");
  assert.equal(calls[0].ssl.rejectUnauthorized, true);
  assert.doesNotMatch(calls[0].connectionString, /sslrootcert|sslcert=|sslkey=/);
  assert.equal(Object.hasOwn(calls[0].ssl, "cert"), false);
  assert.equal(Object.hasOwn(calls[0].ssl, "key"), false);

  const effectiveClient = new pg.Client(calls[0]);
  assert.equal(effectiveClient.connectionParameters.ssl.ca, "TEST CA CONTENT");
  assert.equal(effectiveClient.connectionParameters.ssl.rejectUnauthorized, true);
});

test("niet-geauthenticeerde gebruiker krijgt geen API-toegang", async () => {
  const handler = createHandler({ env, getPool: () => ({ query: async () => ({ rows: [] }) }) });
  assert.equal((await handler(event({}, false))).statusCode, 401);
});

test("PostgreSQL-foutlogging bevat uitsluitend veilige diagnostische velden", async () => {
  const logged = [];
  const databaseError = Object.assign(new Error("column t.sku does not exist"), {
    code: "42703",
    table: "trees1",
    column: "sku",
    position: "428",
    detail: "sensitive detail",
    query: "select secret",
    parameters: ["secret"]
  });
  const diagnostics = postgresDiagnostics(databaseError);
  assert.deepEqual(Object.keys(diagnostics), ["code", "message", "table", "column", "position"]);

  const handler = createHandler({
    env,
    getPool: () => ({ query: async () => { throw databaseError; } }),
    logger: { error: (...args) => logged.push(args) }
  });
  const response = await handler(event());

  assert.equal(response.statusCode, 503);
  assert.deepEqual(logged, [["Tree allocated query failed", {
    code: "42703",
    message: "column t.sku does not exist",
    table: "trees1",
    column: "sku",
    position: "428"
  }]]);
  assert.doesNotMatch(JSON.stringify(logged), /sensitive detail|select secret|parameters/);
});

test("filters en aangepaste periode worden gevalideerd", async () => {
  const handler = createHandler({ env, getPool: () => ({ query: async () => ({ rows: [] }) }) });
  assert.equal((await handler(event({ period: "custom", from: "geen-datum", to: "2026-08-02" }))).statusCode, 400);
  assert.equal((await handler(event({ page_size: "1000" }))).statusCode, 400);
});

test("API groepeert orderresultaten en geeft bronstatus terug", async () => {
  const calls = [];
  const handler = createHandler({
    env,
    now: () => new Date("2026-08-02T12:00:00Z"),
    getPool: () => ({ query: async (sql, values) => { calls.push({ sql, values }); return { rows: [{ shopify_order_id: "90000000000002", order_date: null, allocation_observed_at: "2026-08-02T10:00:00Z", user_id: 2978, email: "klant@example.test", customer_name: "Test Klant", allocated_count: 2, trees: [{ tree_code: "TEST-TREE-001" }, { tree_code: "TEST-TREE-002" }], total_count: 1 }] }; } })
  });
  const response = await handler(event());
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(body.orders.length, 1);
  assert.equal(body.orders[0].final_status.status, "unverifiable");
  assert.equal(body.orders[0].order_date, null);
  assert.equal(body.orders[0].allocation_observed_at, "2026-08-02T10:00:00Z");
  assert.equal(body.counts.unverifiable, 1);
  assert.equal(body.counts.action_required, 0);
  assert.equal(body.source_status.shopify, "not_configured");
  assert.match(calls[0].sql, /group by t\.order_id/i);
  assert.doesNotMatch(calls[0].sql, /\bt\.sku\b/i);
  assert.doesNotMatch(calls[0].sql, /\bt\.language\b/i);
  assert.match(calls[0].sql, /null::text as sku/i);
  assert.match(calls[0].sql, /null::text as language/i);
  assert.match(calls[0].sql, /null::timestamptz as order_date/i);
  assert.doesNotMatch(calls[0].sql, /max\([^)]*claimed_at[^)]*\) as order_date/i);
  assert.equal(calls[0].values.at(-2), 25);
});

test("monitoringbewijs maakt Shopify-, Creator- en e-mailresultaat controleerbaar", async () => {
  const allocation = { shopify_order_id: "90000000000003", allocation_observed_at: "2026-07-29T18:31:00Z", user_id: 2978, email: "customer@example.test", customer_name: "Test", allocated_count: 1, trees: [], total_count: 1 };
  const events = [
    { category: "shopify_order_received", entity_id: "gid://shopify/Order/90000000000003", customer_email: "customer@example.test", status: "confirmed", changed_fields: { order_id: "90000000000003", workflow_key: "shopify_gift_tree_sku01_374491281", created_at: "2026-07-29T18:29:34Z", ordered_quantity: 1, sku: "01", language: "fr" } },
    { category: "gift_claim_created", entity_id: "90000000000003", status: "confirmed", changed_fields: { workflow_key: "shopify_gift_tree_sku01_374491281", creator_record_count: 1, creator_record_id: "creator-test-1" } },
    { category: "gift_claim_email_submitted", entity_id: "90000000000003", status: "confirmed", changed_fields: { workflow_key: "shopify_gift_tree_sku01_374491281", submission_status: "submitted" } }
  ];
  const handler = createHandler({ env, getPool: () => ({ query: async () => ({ rows: [allocation] }) }), getMonitoringPool: () => ({ query: async () => ({ rows: events }) }), now: () => new Date("2026-08-02T12:00:00Z") });
  const body = JSON.parse((await handler(event())).body);
  assert.equal(body.orders[0].order_date, "2026-07-29T18:29:34Z");
  assert.equal(body.orders[0].ordered_count, 1);
  assert.equal(body.orders[0].creator_record_count, 1);
  assert.equal(body.orders[0].email_submission_status, "submitted");
  assert.equal(body.orders[0].final_status.status, "completed");
});
