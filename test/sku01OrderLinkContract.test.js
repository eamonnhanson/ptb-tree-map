import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { determineTreeAllocatedStatus } from "../netlify/functions/tree-allocated-status.js";
import { normalizeShopifyOrderId } from "../netlify/functions/shopify-workflow-evidence.js";

const runbookUrl = new URL("../docs/sku01_order_link_runbook.md", import.meta.url);
const exportUrl = new URL("../docs/sources/zapier/exported-zap-2026-05-31T10_27_41.118Z.json", import.meta.url);
const complete = count => ({
  order_date: "2026-08-04T14:11:04Z",
  email: "synthetic@example.test",
  user_id: 4001,
  ordered_count: count,
  allocated_count: count,
  mismatched_order_count: 0,
  creator_record_count: 1,
  email_submitted: true,
  shopify_source_available: true,
  creator_source_available: true
});

test("geëxporteerde SKU 01-reservering selecteert nu alleen en claimstappen zetten geen order_id", async () => {
  const source = JSON.parse(await readFile(exportUrl, "utf8"));
  const reserve = source.zaps.find(zap => Number(zap.id) === 47).nodes["50"].params.query;
  const claim = source.zaps.find(zap => Number(zap.id) === 61).nodes["75"].params.query;
  assert.match(reserve, /^SELECT id, tree_code/m);
  assert.doesNotMatch(reserve, /UPDATE public\.trees1|order_id/i);
  assert.match(claim, /UPDATE public\.trees1/);
  assert.doesNotMatch(claim.match(/SET[\s\S]*?WHERE/i)[0], /order_id/i);
});

test("runbook reserveert atomair op uitsluitend de interne Shopify Order ID mapping", async () => {
  const runbook = await readFile(runbookUrl, "utf8");
  assert.match(runbook, /SET order_id = input\.shopify_order_id/);
  assert.match(runbook, /FOR UPDATE OF t SKIP LOCKED/);
  assert.match(runbook, /COUNT\(\*\) FROM candidates/);
  assert.match(runbook, /intern Shopify-order-ID ontbreekt of is ongeldig/);
  assert.match(runbook, /\{\{47__id\}\}/);
  assert.doesNotMatch(runbook.match(/Nieuwe reserveringsquery[\s\S]*?```/)[0], /checkout|zichtbare order|e-mail/i);
});

test("één en meerdere gekoppelde SKU 01-bomen zijn herkenbaar voor Tree allocated", () => {
  assert.equal(determineTreeAllocatedStatus(complete(1)).status, "completed");
  assert.equal(determineTreeAllocatedStatus(complete(2)).status, "completed");
});

test("ontbrekend order-ID wordt geblokkeerd en claimcontract behoudt order_id", async () => {
  assert.equal(normalizeShopifyOrderId(null), null);
  assert.equal(normalizeShopifyOrderId(""), null);
  assert.equal(normalizeShopifyOrderId("gid://shopify/Order/18002517623114"), "18002517623114");
  const runbook = await readFile(runbookUrl, "utf8");
  assert.match(runbook, /AND order_id IS NOT NULL/);
  assert.match(runbook, /bestaande `SET`-lijst bevat geen `order_id`/);
});

test("koppeling gebruikt geen e-mail, checkout-ID of zichtbaar ordernummer", async () => {
  const runbook = await readFile(runbookUrl, "utf8");
  assert.match(runbook, /Gebruik niet het checkout-ID, het zichtbare ordernummer, e-mailadres of een tijdstip/);
  assert.doesNotMatch(runbook.match(/Nieuwe reserveringsquery[\s\S]*?```/)[0], /67334198886730|Plant N Boom26_1381|@/);
});
