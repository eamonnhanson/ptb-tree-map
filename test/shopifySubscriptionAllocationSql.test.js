import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../docs/sql/011_shopify_subscription_tree_allocation.sql", import.meta.url);
const backfillUrl = new URL("../docs/sql/012_shopify_subscription_existing_backfill_template.sql", import.meta.url);
const documentationUrl = new URL("../docs/shopify_subscription_tree_allocation.md", import.meta.url);
const registryUrl = new URL("../docs/sql/013_shopify_subscription_workflow_registry.sql", import.meta.url);
const sql = await readFile(migrationUrl, "utf8");

const variants = new Map([
  ["53296965386570", { mode: "odd_payment", trees: 1 }],
  ["53296965419338", { mode: "every_payment", trees: 1 }],
  ["53296965452106", { mode: "every_payment", trees: 2 }]
]);
const decision = (variantId, paymentNumber) => {
  const variant = variants.get(variantId);
  if (!variant) throw new Error("unknown variant");
  const treesDue = variant.mode === "odd_payment" && paymentNumber % 2 === 0 ? 0 : variant.trees;
  return {
    treesDue,
    first: paymentNumber === 1,
    welcome: paymentNumber === 1 && treesDue > 0,
    certificate: paymentNumber === 1 && treesDue > 0
  };
};

test("€5 eerste betaling alloceert één boom en vraagt welcome/certificate", () => {
  assert.deepEqual(decision("53296965386570", 1), { treesDue: 1, first: true, welcome: true, certificate: true });
});

test("€5 tweede betaling alloceert geen boom", () => {
  assert.deepEqual(decision("53296965386570", 2), { treesDue: 0, first: false, welcome: false, certificate: false });
});

test("€5 derde betaling alloceert één boom zonder welcome/certificate", () => {
  assert.deepEqual(decision("53296965386570", 3), { treesDue: 1, first: false, welcome: false, certificate: false });
});

test("€10 eerste betaling alloceert één boom", () => assert.equal(decision("53296965419338", 1).treesDue, 1));
test("€10 vervolg alloceert één boom", () => assert.equal(decision("53296965419338", 8).treesDue, 1));

test("€20 eerste betaling retourneert twee bomen en certificate flag", () => {
  const result = decision("53296965452106", 1);
  assert.equal(result.treesDue, 2);
  assert.equal(result.certificate, true);
  assert.match(sql, /jsonb_agg\(jsonb_build_object\([\s\S]*?'tree_id'[\s\S]*?'longitude'/);
});

test("€20 vervolg alloceert twee bomen zonder certificate flag", () => {
  const result = decision("53296965452106", 2);
  assert.equal(result.treesDue, 2);
  assert.equal(result.certificate, false);
});

test("duplicate order is een succesvolle read van het bestaande resultaat", () => {
  assert.match(sql, /UNIQUE\s*\(shopify_order_id\)/i);
  assert.match(sql, /IF FOUND THEN[\s\S]*?true, true[\s\S]*?v_assigned_trees/i);
  assert.match(sql, /shopify-order:' \|\| p_shopify_order_id/);
  assert.match(sql, /already registered with different contract or variant data/);
});

test("onbekende variant stopt vóór payment en allocation", () => {
  assert.throws(() => decision("999", 1), /unknown variant/);
  assert.match(sql, /Unknown or inactive Shopify subscription variant/);
});

test("onvoldoende vrije bomen rolt de volledige functiecall terug", () => {
  assert.match(sql, /cardinality\(v_tree_ids\) <> v_trees_due/);
  assert.match(sql, /RAISE EXCEPTION 'Insufficient free trees/);
  assert.doesNotMatch(sql, /EXCEPTION\s+WHEN[\s\S]*?Insufficient free trees/i);
});

test("ontbrekende user wordt met genormaliseerde email aangemaakt", () => {
  assert.match(sql, /lower\(btrim\(p_customer_email\)\)/);
  assert.match(sql, /INSERT INTO public\.users1 \(email, created_at, updated_at\)/);
  assert.match(sql, /ON CONFLICT \(email\) DO UPDATE/);
});

test("emailwijziging verandert subscription identity niet", () => {
  assert.match(sql, /shopify_subscription_contract_id text NOT NULL UNIQUE/);
  assert.match(sql, /customer_email = v_normalized_email/);
  assert.doesNotMatch(sql, /WHERE customer_email = p_customer_email\s+FOR UPDATE/i);
});

test("twee contracten met dezelfde email hebben afzonderlijke counters", () => {
  assert.match(sql, /shopify-contract:' \|\| p_shopify_subscription_contract_id/);
  assert.match(sql, /WHERE subscription\.shopify_subscription_contract_id = p_shopify_subscription_contract_id\s+FOR UPDATE/);
  assert.match(sql, /UNIQUE \(shopify_subscription_contract_id, payment_number\)/);
});

test("retry na externe fout gebruikt side-effectfunctie en alloceert niet opnieuw", () => {
  assert.match(sql, /FUNCTION public\.mark_shopify_subscription_payment_side_effect/);
  const sideEffectBody = sql.match(/CREATE OR REPLACE FUNCTION public\.mark_shopify_subscription_payment_side_effect[\s\S]*?COMMENT ON FUNCTION public\.mark_shopify_subscription_payment_side_effect/)[0];
  assert.doesNotMatch(sideEffectBody, /UPDATE public\.trees1|INSERT INTO public\.shopify_subscription_payment_trees/);
  assert.match(sql, /duplicate boolean[\s\S]*?assigned_trees jsonb/);
});

test("concurrency gebruikt order- en contractlocks plus locked tree rows", () => {
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('shopify-order:/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\([\s\S]*?'shopify-contract:/);
  assert.match(sql, /FOR UPDATE OF t SKIP LOCKED/);
});

test("€20 allocation is exact-aantal en één transactionele update", () => {
  assert.match(sql, /LIMIT v_trees_due/);
  assert.match(sql, /cardinality\(v_tree_ids\) <> v_trees_due/);
  assert.match(sql, /WHERE t\.id = ANY\(v_tree_ids\)/);
});

test("vrije-boompredicate volgt de bevestigde productievoorwaarden exact", () => {
  const candidateQuery = sql.match(/SELECT t\.id[\s\S]*?FOR UPDATE OF t SKIP LOCKED/)[0];
  for (const predicate of [
    /t\.user_id IS NULL/,
    /t\.is_claimed IS NOT TRUE/,
    /t\.purchase_date IS NULL/,
    /t\.order_id IS NULL/,
    /t\.reserved_token IS NULL/,
    /t\.claimed_at IS NULL/,
    /t\.unclaimed_user_id IS NULL/,
    /t\.tree_code IS NOT NULL/,
    /t\.lat IS NOT NULL/,
    /t\."long" IS NOT NULL/
  ]) assert.match(candidateQuery, predicate);
  assert.doesNotMatch(candidateQuery, /COALESCE\(t\.is_claimed/);
});

test("allocation bewaart bestaande tree_code en retourneert hem", () => {
  const allocationUpdate = sql.match(/UPDATE public\.trees1 t[\s\S]*?WHERE t\.id = ANY\(v_tree_ids\);/)[0];
  assert.doesNotMatch(allocationUpdate, /SET[\s\S]*?tree_code\s*=/i);
  assert.match(sql, /'tree_code', t\.tree_code/);
});

test("Shopify order-ID blijft numerieke tekst voor varchar(50)", () => {
  assert.match(sql, /p_shopify_order_id text/);
  assert.match(sql, /p_shopify_order_id !~ '\^\[0-9\]\{1,30\}\$'/);
  assert.match(sql, /order_id = p_shopify_order_id/);
  assert.doesNotMatch(sql, /order_id\s*=\s*p_shopify_order_id::(?:bigint|integer)/i);
});

test("purchase_date en updated_at worden deterministisch als UTC timestamp zonder tijdzone opgeslagen", () => {
  assert.match(sql, /purchase_date = p_paid_at AT TIME ZONE 'UTC'/);
  assert.match(sql, /updated_at = now\(\) AT TIME ZONE 'UTC'/);
});

test("interne user- en tree-sleutels volgen productie integer primary keys", () => {
  assert.match(sql, /user_id integer,/);
  assert.match(sql, /tree_id integer NOT NULL REFERENCES public\.trees1\(id\)/);
  assert.match(sql, /v_user_id integer;/);
  assert.match(sql, /v_tree_ids integer\[\]/);
});

test("refunds bewaren allocationhistorie", () => {
  assert.match(sql, /financial_status IN \('paid', 'refunded', 'partially_refunded', 'chargeback'\)/);
  assert.doesNotMatch(sql, /DELETE FROM public\.shopify_subscription_payment_trees|is_claimed = false/);
});

test("backfilltemplate stopt standaard en bevat geen onbevestigde klantdata", async () => {
  const backfill = await readFile(backfillUrl, "utf8");
  assert.match(backfill, /Safety stop/);
  assert.match(backfill, /ROLLBACK;/);
  assert.doesNotMatch(backfill, /rwroos@|Droogleever|34475868490|30923587914/i);
});

test("technische documentatie bevat Zapier call en productievolgorde", async () => {
  const documentation = await readFile(documentationUrl, "utf8");
  assert.match(documentation, /process_shopify_subscription_payment/);
  assert.match(documentation, /Assigned_Trees/);
  assert.match(documentation, /Productieprocedure/);
  assert.match(documentation, /niet.*productie/i);
});

test("registry seed blijft planned tot de echte Zap-identiteit bekend is", async () => {
  const registry = await readFile(registryUrl, "utf8");
  assert.match(registry, /shopify_monthly_donation_subscription_payment/);
  assert.match(registry, /'planned'/);
  assert.match(registry, /process_shopify_subscription_payment/);
  assert.match(registry, /Assigned_Trees/);
  assert.doesNotMatch(registry, /'active'/);
});
