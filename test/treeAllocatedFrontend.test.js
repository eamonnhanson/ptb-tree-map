import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Tree allocated-tegel en directe route bestaan binnen beveiligde dashboardstructuur", async () => {
  const sales = await readFile(new URL("../frontend/automation-dashboard/tree-sales/index.html", import.meta.url), "utf8");
  const page = await readFile(new URL("../frontend/automation-dashboard/tree-sales/tree-allocated/index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../frontend/automation-dashboard/tree-sales/tree-allocated/tree-allocated.js", import.meta.url), "utf8");
  const netlify = await readFile(new URL("../netlify.toml", import.meta.url), "utf8");
  assert.match(sales, /href="\/automation-dashboard\/tree-sales\/tree-allocated\/"/);
  assert.match(page, /<h1>Tree allocated<\/h1>/);
  assert.match(page, /tree-allocated\.js/);
  assert.match(page, /Niet volledig controleerbaar/);
  assert.match(page, /Allocatieperiode/);
  assert.match(page, /name="language" disabled/);
  assert.match(page, /name="sku"[^>]*disabled/);
  assert.match(script, /Shopify orderdatum<\/dt><dd>\$\{formatDate\(order\.order_date\)\}/);
  assert.match(script, /Toewijzing waargenomen op/);
  assert.match(script, /Bron niet gekoppeld/);
  assert.doesNotMatch(script, /<dt>Orderdatum<\/dt><dd>\$\{formatDate\(order\.allocation_observed_at\)\}/);
  assert.match(netlify, /path = "\/automation-dashboard\/\*"/);
});
