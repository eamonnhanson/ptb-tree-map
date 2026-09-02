-- REVIEW ONLY - ISOLATED TEST DATABASE ONLY.
-- NEVER EXECUTE AGAINST PRODUCTION.
--
-- Prerequisite: run 014_chargebee_subscription_payment_allocation.sql only in
-- a disposable database named ptb_chargebee_subscription_test[_suffix], with
-- production-shaped users1 and trees1 tables. This script always rolls back.
-- Concurrent-session coverage lives in
-- test/chargebeeSubscriptionAllocationIntegration.test.js.

BEGIN;

DO $$
BEGIN
  IF current_database() !~ '^ptb_chargebee_subscription_test(_[a-z0-9_]+)?$' THEN
    RAISE EXCEPTION 'Refusing non-isolated database %', current_database();
  END IF;
END;
$$;

TRUNCATE TABLE
  public.chargebee_subscription_payment_trees,
  public.chargebee_subscription_payments,
  public.chargebee_subscription_billing_periods,
  public.chargebee_tree_subscriptions,
  public.trees1,
  public.users1 RESTART IDENTITY CASCADE;

INSERT INTO public.chargebee_subscription_cutover_policy (singleton, cutover_at)
VALUES (true, '2026-01-01T00:00:00Z')
ON CONFLICT (singleton) DO UPDATE SET cutover_at = EXCLUDED.cutover_at;

INSERT INTO public.trees1 (
  tree_code, tree_type, lat, "long", planted_date, is_claimed
)
SELECT
  'CB-SQL-TEST-' || lpad(value::text, 4, '0'),
  'Cashew', 8.96356199, -12.52373404, DATE '2025-01-02', false
FROM generate_series(1, 30) AS value;

-- First payment: one period/event/tree and first-payment side effects.
SELECT *
FROM public.process_chargebee_subscription_payment(
  'txn-sql-first', 'sub-sql-first', '1-boom-per-maand-EUR-Monthly',
  'sql-test@example.test', '2026-01-02T00:00:00Z',
  '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z',
  'invoice-sql-first', 'line-sql-first', 'customer-sql-first',
  'SQL', 'Test', 'active', '2026-01-01T00:00:00Z', 1000, 'EUR',
  '2026-01-01T00:00:00Z'
);

DO $$
DECLARE
  v_periods integer;
  v_events integer;
  v_trees integer;
  v_welcome boolean;
BEGIN
  SELECT count(*) INTO v_periods FROM public.chargebee_subscription_billing_periods;
  SELECT count(*) INTO v_events FROM public.chargebee_subscription_payments;
  SELECT count(*) INTO v_trees FROM public.chargebee_subscription_payment_trees;
  SELECT welcome_required INTO v_welcome
  FROM public.chargebee_subscription_payments
  WHERE chargebee_transaction_id = 'txn-sql-first';
  IF (v_periods, v_events, v_trees, v_welcome) IS DISTINCT FROM (1, 1, 1, true) THEN
    RAISE EXCEPTION 'Unexpected first-payment state: %, %, %, %',
      v_periods, v_events, v_trees, v_welcome;
  END IF;
END;
$$;

-- Identical transaction replay: no new period/event/tree.
SELECT *
FROM public.process_chargebee_subscription_payment(
  'txn-sql-first', 'sub-sql-first', '1-boom-per-maand-EUR-Monthly',
  'sql-test@example.test', '2026-01-02T00:00:00Z',
  '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z',
  'invoice-sql-first', 'line-sql-first', 'customer-sql-first',
  'SQL', 'Test', 'active', '2026-01-01T00:00:00Z', 1000, 'EUR',
  '2026-01-01T00:00:00Z'
);

-- A second successful transaction in the same period: new event only.
SELECT *
FROM public.process_chargebee_subscription_payment(
  'txn-sql-second-same-period', 'sub-sql-first',
  '1-boom-per-maand-EUR-Monthly', 'sql-test@example.test',
  '2026-01-03T00:00:00Z', '2026-01-01T00:00:00Z',
  '2026-02-01T00:00:00Z', 'invoice-sql-first',
  'line-sql-second', 'customer-sql-first', 'SQL', 'Test', 'active',
  '2026-01-01T00:00:00Z', 1000, 'EUR', '2026-01-01T00:00:00Z'
);

DO $$
DECLARE
  v_periods integer;
  v_events integer;
  v_trees integer;
  v_second public.chargebee_subscription_payments%ROWTYPE;
BEGIN
  SELECT count(*) INTO v_periods FROM public.chargebee_subscription_billing_periods;
  SELECT count(*) INTO v_events FROM public.chargebee_subscription_payments;
  SELECT count(*) INTO v_trees FROM public.chargebee_subscription_payment_trees;
  SELECT * INTO STRICT v_second
  FROM public.chargebee_subscription_payments
  WHERE chargebee_transaction_id = 'txn-sql-second-same-period';
  IF (v_periods, v_events, v_trees) IS DISTINCT FROM (1, 2, 1)
     OR v_second.billing_period_number <> 1
     OR v_second.payment_event_number <> 2
     OR v_second.is_allocation_owner
     OR v_second.welcome_required
     OR v_second.certificate_required THEN
    RAISE EXCEPTION 'Same-period payment allocated or requested first-payment effects';
  END IF;
END;
$$;

-- Calendar month 2 of a six-tree plan is a persisted zero-allocation period.
SELECT *
FROM public.process_chargebee_subscription_payment(
  'txn-six-first', 'sub-six', '5-euro-6-bomen-abonnement-EUR-Monthly',
  'six@example.test', '2026-01-02T00:00:00Z',
  '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z',
  'invoice-six-1', 'line-six-1', 'customer-six',
  'Six', 'Trees', 'active', '2026-01-01T00:00:00Z', 500, 'EUR',
  '2026-01-01T00:00:00Z'
);

SELECT *
FROM public.process_chargebee_subscription_payment(
  'txn-six-second', 'sub-six', '5-euro-6-bomen-abonnement-EUR-Monthly',
  'six@example.test', '2026-02-02T00:00:00Z',
  '2026-02-01T00:00:00Z', '2026-03-01T00:00:00Z',
  'invoice-six-2', 'line-six-2', 'customer-six',
  'Six', 'Trees', 'active', '2026-01-01T00:00:00Z', 500, 'EUR',
  '2026-01-01T00:00:00Z'
);

DO $$
DECLARE
  v_period public.chargebee_subscription_billing_periods%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_period
  FROM public.chargebee_subscription_billing_periods
  WHERE chargebee_subscription_id = 'sub-six'
    AND billing_period_number = 2;
  IF v_period.allocation_pattern_index <> 1
     OR v_period.trees_due <> 0
     OR v_period.trees_allocated <> 0
     OR v_period.allocation_status <> 'no_allocation' THEN
    RAISE EXCEPTION 'Six-tree calendar period 2 is incorrect';
  END IF;
END;
$$;

-- A cutover-seeded subscription starts its local counters at zero, allocates
-- normally, but never requests initial customer-facing side effects.
INSERT INTO public.users1 (email) VALUES ('seeded-existing@example.test');
INSERT INTO public.chargebee_tree_subscriptions (
  chargebee_subscription_id, user_id, customer_email, current_plan_id,
  current_trees_per_year, current_allocation_pattern, status, started_at,
  initial_side_effects_suppressed, welcome_status
)
SELECT 'sub-seeded-existing', id, 'seeded-existing@example.test',
       plan.chargebee_plan_id, plan.trees_per_year, plan.allocation_pattern, 'active',
       '2025-01-01T00:00:00Z', true, 'not_required'
FROM public.users1
JOIN public.chargebee_subscription_plans AS plan
  ON plan.chargebee_plan_id = '12-5-euro-15-bomen-abonnement-EUR-Monthly'
WHERE email = 'seeded-existing@example.test';

SELECT * FROM public.process_chargebee_subscription_payment(
  'txn-seeded-existing', 'sub-seeded-existing',
  '12-5-euro-15-bomen-abonnement-EUR-Monthly',
  'seeded-existing@example.test', '2026-02-02T00:00:00Z',
  '2026-02-01T00:00:00Z', '2026-03-01T00:00:00Z',
  'invoice-seeded-existing', 'line-seeded-existing', 'customer-seeded-existing',
  'Seeded', 'Existing', 'active', '2025-01-01T00:00:00Z', 1250, 'EUR', NULL
);

DO $$
DECLARE v_payment public.chargebee_subscription_payments%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_payment FROM public.chargebee_subscription_payments
  WHERE chargebee_transaction_id = 'txn-seeded-existing';
  IF v_payment.billing_period_number <> 1
     OR v_payment.payment_event_number <> 1
     OR v_payment.trees_allocated <> 1
     OR v_payment.welcome_required
     OR v_payment.certificate_required THEN
    RAISE EXCEPTION 'Cutover-seeded subscription classification failed';
  END IF;
END;
$$;

-- An unseen pre-cutover subscription and an unseen subscription without a
-- creation timestamp both fail before leaving subscription/payment rows.
DO $$
DECLARE v_before integer; v_after integer;
BEGIN
  SELECT count(*) INTO v_before FROM public.chargebee_tree_subscriptions;
  BEGIN
    PERFORM public.process_chargebee_subscription_payment(
      'txn-missed-seed', 'sub-missed-seed', '1-boom-per-maand-EUR-Monthly',
      'missed-seed@example.test', now(), '2026-02-01', '2026-03-01',
      'invoice-missed', 'line-missed', 'customer-missed', 'Missed', 'Seed',
      'active', '2025-01-01', 1000, 'EUR', '2025-12-31'
    );
    RAISE EXCEPTION 'Expected missed-seed rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%manual review%' THEN RAISE; END IF;
  END;
  SELECT count(*) INTO v_after FROM public.chargebee_tree_subscriptions;
  IF v_after <> v_before THEN RAISE EXCEPTION 'Rejected payment persisted rows'; END IF;
  BEGIN
    PERFORM public.process_chargebee_subscription_payment(
      'txn-missing-created', 'sub-missing-created', '1-boom-per-maand-EUR-Monthly',
      'missing-created@example.test', now(), '2026-02-01', '2026-03-01',
      'invoice-missing-created', 'line-missing-created', 'customer-missing-created',
      'Missing', 'Created', 'active', '2026-01-01', 1000, 'EUR', NULL
    );
    RAISE EXCEPTION 'Expected missing-created rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%created_at is required%' THEN RAISE; END IF;
  END;
  DELETE FROM public.chargebee_subscription_cutover_policy;
  BEGIN
    PERFORM public.process_chargebee_subscription_payment(
      'txn-missing-policy', 'sub-missing-policy', '1-boom-per-maand-EUR-Monthly',
      'missing-policy@example.test', now(), '2026-02-01', '2026-03-01',
      'invoice-missing-policy', 'line-missing-policy', 'customer-missing-policy',
      'Missing', 'Policy', 'active', '2026-01-01', 1000, 'EUR', '2026-01-02'
    );
    RAISE EXCEPTION 'Expected missing-policy rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%cutover policy is not configured%' THEN RAISE; END IF;
  END;
  INSERT INTO public.chargebee_subscription_cutover_policy(singleton, cutover_at)
  VALUES (true, '2026-01-01T00:00:00Z');
END;
$$;

-- Side-effect completion is idempotent and drives subscription completion only
-- after both customer-facing effects are accepted.
SELECT public.mark_chargebee_subscription_payment_side_effect(
  'txn-sql-first', 'welcome_email', 'completed', 'welcome-mail-1', NULL, NULL
);
SELECT public.mark_chargebee_subscription_payment_side_effect(
  'txn-sql-first', 'welcome_email', 'completed', 'welcome-mail-1', NULL, NULL
);
SELECT public.mark_chargebee_subscription_payment_side_effect(
  'txn-sql-first', 'certificate', 'completed', 'certificate-mail-1',
  'https://example.invalid/certificate.pdf', NULL
);

DO $$
DECLARE
  v_status text;
BEGIN
  SELECT welcome_status INTO STRICT v_status
  FROM public.chargebee_tree_subscriptions
  WHERE chargebee_subscription_id = 'sub-sql-first';
  IF v_status <> 'completed' THEN
    RAISE EXCEPTION 'Welcome aggregate did not complete';
  END IF;
END;
$$;

-- Global zero-duplicate-allocation invariant.
DO $$
DECLARE
  v_duplicates integer;
BEGIN
  SELECT count(*) INTO v_duplicates
  FROM (
    SELECT tree_id
    FROM public.chargebee_subscription_payment_trees
    GROUP BY tree_id
    HAVING count(*) > 1
  ) AS duplicate_tree;
  IF v_duplicates <> 0 THEN
    RAISE EXCEPTION 'Duplicate Chargebee tree allocations found';
  END IF;
END;
$$;

ROLLBACK;
