import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../docs/sql/014_chargebee_subscription_payment_allocation.sql", import.meta.url);
const dryRunUrl = new URL("../docs/sql/016_chargebee_subscription_backfill_dry_run.sql", import.meta.url);
const seedUrl = new URL("../docs/sql/017_chargebee_subscription_cutover_seed.sql", import.meta.url);
const runbookUrl = new URL("../docs/chargebee_subscription_payment_allocation.md", import.meta.url);
const sql = await readFile(migrationUrl, "utf8");

const patterns = new Map([
  [6, [1,0,1,0,1,0,1,0,1,0,1,0]],
  [9, [1,1,0,1,1,1,0,1,1,1,0,1]],
  [12, [1,1,1,1,1,1,1,1,1,1,1,1]],
  [15, [2,1,1,1,2,1,1,1,2,1,1,1]],
  [18, [2,1,2,1,2,1,2,1,2,1,2,1]],
  [21, [2,2,1,2,2,2,1,2,2,2,1,2]],
  [24, [2,2,2,2,2,2,2,2,2,2,2,2]]
]);

test("migration is explicitly review-only", () => {
  assert.match(sql, /^-- REVIEW ONLY - DO NOT EXECUTE AGAINST PRODUCTION\./);
  assert.match(sql, /This file performs no\s+-- historic backfill\./);
});

test("all approved calendar patterns have twelve entries, correct totals and nonzero first position", () => {
  for (const [trees, pattern] of patterns) {
    assert.equal(pattern.length, 12);
    assert.equal(pattern.reduce((sum, value) => sum + value, 0), trees);
    assert.ok(pattern[0] > 0);
    assert.match(sql, new RegExp(`'[^']*${trees === 6 ? "6-bomen" : trees === 9 ? "9-bomen" : trees === 21 ? "21-bomen" : trees === 24 ? "24-bomen" : ".*"}[^']*'[\\s\\S]*?ARRAY\\[${pattern.join(",")}\\]`, "i"));
  }
});

test("schema separates transaction events from allocation periods", () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.chargebee_subscription_billing_periods/);
  assert.match(sql, /UNIQUE \(subscription_id, billing_period_start\)/);
  assert.match(sql, /chargebee_transaction_id text NOT NULL UNIQUE/);
  assert.match(sql, /billing_period_number integer NOT NULL/);
  assert.match(sql, /payment_event_number integer NOT NULL/);
  assert.doesNotMatch(sql, /UNIQUE \(chargebee_invoice_id\)/);
});

test("transaction replay returns stored allocation without mutation", () => {
  assert.match(sql, /chargebee-transaction:' \|\| p_chargebee_transaction_id/);
  const replay = sql.match(/IF FOUND THEN[\s\S]*?RETURN;\s+END IF;/)[0];
  assert.match(replay, /true, true/);
  assert.match(replay, /WHERE link\.billing_period_id = v_period\.id/);
  assert.doesNotMatch(replay, /INSERT INTO|UPDATE public\.trees1/);
  assert.match(replay, /already registered for another subscription/);
  assert.match(replay, /already registered with another plan/);
  assert.match(replay, /already registered with another invoice/);
});

test("same-period second transaction is recorded but cannot allocate or welcome", () => {
  assert.match(sql, /WHERE period\.subscription_id = v_subscription\.id\s+AND period\.billing_period_start = v_effective_period_start\s+FOR UPDATE/);
  assert.match(sql, /v_payment_event_number, false, v_normalized_email/);
  assert.match(sql, /false, false, 'not_required', 'not_required', 'pending'/);
  assert.match(sql, /true, false, true/);
});

test("calendar month index uses billing start and persisted subscription start", () => {
  assert.match(sql, /v_effective_period_start := COALESCE\(p_billing_period_start, p_paid_at\)/);
  assert.match(sql, /extract\(year FROM v_effective_period_start\)/);
  assert.match(sql, /extract\(month FROM v_subscription\.started_at\)/);
  assert.match(sql, /v_pattern_index := v_months_diff % 12/);
  assert.doesNotMatch(sql, /v_pattern_index\s*:=\s*.*payment_event_number/);
});

test("unknown plans fail before customer, subscription, payment or tree writes", () => {
  const unknown = sql.indexOf("Unknown or inactive Chargebee plan");
  assert.ok(unknown > 0);
  for (const write of [
    "INSERT INTO public.users1",
    "INSERT INTO public.chargebee_tree_subscriptions",
    "INSERT INTO public.chargebee_subscription_payments",
    "UPDATE public.trees1"
  ]) assert.ok(unknown < sql.indexOf(write), `${write} must follow plan rejection`);
  assert.doesNotMatch(sql, /default[^\n]*12 trees|fallback[^\n]*12/i);
});

test("allocation uses exact stock count and the approved live predicate", () => {
  const candidate = sql.match(/SELECT tree\.id[\s\S]*?FOR UPDATE OF tree SKIP LOCKED/)[0];
  for (const predicate of [
    /tree\.user_id IS NULL/,
    /tree\.is_claimed IS NOT TRUE/,
    /tree\.purchase_date IS NULL/,
    /tree\.order_id IS NULL/,
    /tree\.reserved_token IS NULL/,
    /tree\.claimed_at IS NULL/,
    /tree\.unclaimed_user_id IS NULL/,
    /tree\.tree_code IS NOT NULL/,
    /tree\.lat IS NOT NULL/,
    /tree\."long" IS NOT NULL/
  ]) assert.match(candidate, predicate);
  assert.match(sql, /FOR UPDATE OF tree SKIP LOCKED\s+LIMIT v_trees_due/);
  assert.match(sql, /cardinality\(v_tree_ids\) <> v_trees_due/);
  assert.match(sql, /Insufficient free trees/);
});

test("subscription, transaction, email and tree concurrency scopes are locked", () => {
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\([\s\S]*?'chargebee-transaction:/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\([\s\S]*?'chargebee-subscription:/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\([\s\S]*?'user-email:/);
  assert.match(sql, /FOR UPDATE OF tree SKIP LOCKED/);
});

test("plan changes affect only new periods and retain historic snapshots", () => {
  assert.match(sql, /IF v_period\.chargebee_plan_id <> p_chargebee_plan_id THEN/);
  assert.match(sql, /v_plan_changed := v_subscription\.current_plan_id <> p_chargebee_plan_id/);
  assert.match(sql, /plan_changed boolean NOT NULL DEFAULT false/);
  assert.match(sql, /chargebee_plan_id, trees_per_year,\s+allocation_pattern, allocation_pattern_index/);
});

test("cutover classification and persisted suppression govern initial side effects", () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.chargebee_subscription_cutover_policy/);
  assert.match(sql, /initial_side_effects_suppressed boolean NOT NULL DEFAULT false/);
  assert.match(sql, /p_subscription_created_at timestamptz DEFAULT NULL/);
  assert.match(sql, /p_subscription_created_at < v_cutover_at/);
  assert.match(sql, /manual review/i);
  assert.match(sql, /v_initial_side_effects_required :=\s*v_subscription\.successful_billing_period_count = 0\s*AND NOT v_subscription\.initial_side_effects_suppressed/);
  assert.match(sql, /'chargebee-initial:' \|\| p_chargebee_subscription_id/);
  assert.match(sql, /CASE WHEN v_initial_side_effects_required THEN 'pending' ELSE 'not_required' END/);
  assert.match(sql, /First successful Chargebee billing period resolves to zero trees/);
});

test("completed side effects are terminal and repeated completion is idempotent", () => {
  const body = sql.match(/CREATE OR REPLACE FUNCTION public\.mark_chargebee_subscription_payment_side_effect[\s\S]*?COMMENT ON FUNCTION public\.mark_chargebee_subscription_payment_side_effect/)[0];
  assert.match(body, /IF v_current_status = 'completed'/);
  assert.match(body, /IF p_status <> 'completed'/);
  assert.match(body, /RETURN v_payment/);
  assert.match(body, /conflicting external id/);
  assert.match(body, /conflicting external URL/);
  assert.doesNotMatch(body, /UPDATE public\.trees1|INSERT INTO public\.chargebee_subscription_payment_trees/);
});

test("review artifacts forbid automatic backfill and production execution", async () => {
  const [dryRun, seed, runbook] = await Promise.all([
    readFile(dryRunUrl, "utf8"),
    readFile(seedUrl, "utf8"),
    readFile(runbookUrl, "utf8")
  ]);
  assert.match(dryRun, /^-- REVIEW ONLY - READ-ONLY DRY-RUN REPORTING/);
  assert.doesNotMatch(dryRun, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\b/i);
  assert.match(seed, /^-- REVIEW ONLY - CUTOVER SEED TEMPLATE - DO NOT EXECUTE AS-IS\./);
  assert.match(seed, /initial_side_effects_suppressed, welcome_status/);
  assert.match(seed, /true, 'not_required', 0, 0, 0/);
  assert.match(seed, /GET DIAGNOSTICS v_inserted_rows = ROW_COUNT/);
  assert.match(seed, /REVIEW-ONLY SAFETY STOP/);
  assert.doesNotMatch(seed, /ON CONFLICT/);
  assert.match(runbook, /Do not execute/i);
  assert.match(runbook, /zap_95/);
  assert.match(runbook, /cutover/i);
});
