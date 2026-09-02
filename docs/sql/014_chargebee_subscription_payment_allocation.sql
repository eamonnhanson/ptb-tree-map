-- REVIEW ONLY - DO NOT EXECUTE AGAINST PRODUCTION.
--
-- Chargebee subscription billing-period/payment ledger, atomic tree allocation
-- and retryable external side-effect state.
--
-- Production activation requires, in order: isolated PostgreSQL tests, schema
-- review, an approved historic backfill, backfill reconciliation, a preserved
-- zap_95 export and a reviewed disabled Zap copy. This file performs no
-- historic backfill.

BEGIN;

CREATE OR REPLACE FUNCTION public.chargebee_allocation_pattern_is_valid(
  p_pattern smallint[],
  p_trees_per_year smallint
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT p_pattern IS NOT NULL
    AND p_trees_per_year > 0
    AND cardinality(p_pattern) = 12
    AND p_pattern[1] > 0
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(p_pattern) AS item(value)
      WHERE item.value IS NULL OR item.value < 0
    )
    AND (
      SELECT COALESCE(sum(item.value), 0)
      FROM unnest(p_pattern) AS item(value)
    ) = p_trees_per_year;
$$;

CREATE TABLE IF NOT EXISTS public.chargebee_subscription_plans (
  chargebee_plan_id text PRIMARY KEY,
  label text NOT NULL,
  trees_per_year smallint NOT NULL CHECK (trees_per_year > 0),
  allocation_pattern smallint[] NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chargebee_plan_pattern_valid CHECK (
    public.chargebee_allocation_pattern_is_valid(allocation_pattern, trees_per_year)
  )
);

COMMENT ON TABLE public.chargebee_subscription_plans IS
  'Authoritative Chargebee plan-to-calendar-allocation registry. Unknown or inactive plans are rejected; no fallback plan exists.';

INSERT INTO public.chargebee_subscription_plans (
  chargebee_plan_id, label, trees_per_year, allocation_pattern, active
)
VALUES
  ('1-boom-per-maand-EUR-Monthly', '12 trees per year', 12, ARRAY[1,1,1,1,1,1,1,1,1,1,1,1]::smallint[], true),
  ('20-euro-24-bomen-abonnement-EUR-Monthly', '24 trees per year', 24, ARRAY[2,2,2,2,2,2,2,2,2,2,2,2]::smallint[], true),
  ('15-boom-per-maand-EUR-Monthly', '18 trees per year', 18, ARRAY[2,1,2,1,2,1,2,1,2,1,2,1]::smallint[], true),
  ('17-5-euro-21-bomen-abonnement-EUR-Monthly', '21 trees per year', 21, ARRAY[2,2,1,2,2,2,1,2,2,2,1,2]::smallint[], true),
  ('5-euro-6-bomen-abonnement-EUR-Monthly', '6 trees per year', 6, ARRAY[1,0,1,0,1,0,1,0,1,0,1,0]::smallint[], true),
  ('750-9-bomen-abonnement-EUR-Monthly', '9 trees per year', 9, ARRAY[1,1,0,1,1,1,0,1,1,1,0,1]::smallint[], true),
  ('12-5-euro-15-bomen-abonnement-EUR-Monthly', '15 trees per year', 15, ARRAY[2,1,1,1,2,1,1,1,2,1,1,1]::smallint[], true),
  ('Maandelijkse-bijdrage-1250-euro-EUR-Monthly', '15 trees per year', 15, ARRAY[2,1,1,1,2,1,1,1,2,1,1,1]::smallint[], true),
  ('1-boom-per-maand-ingang-volgende-maand-EUR-Monthly', '12 trees per year', 12, ARRAY[1,1,1,1,1,1,1,1,1,1,1,1]::smallint[], true)
ON CONFLICT (chargebee_plan_id) DO UPDATE
SET label = EXCLUDED.label,
    trees_per_year = EXCLUDED.trees_per_year,
    allocation_pattern = EXCLUDED.allocation_pattern,
    active = EXCLUDED.active,
    updated_at = now();

CREATE TABLE IF NOT EXISTS public.chargebee_subscription_cutover_policy (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  cutover_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chargebee_subscription_cutover_policy IS
  'Singleton safety boundary used only to classify previously unseen Chargebee subscriptions at cutover. The approved seed must contain exactly one row.';

CREATE TABLE IF NOT EXISTS public.chargebee_tree_subscriptions (
  id bigserial PRIMARY KEY,
  chargebee_subscription_id text NOT NULL UNIQUE,
  chargebee_customer_id text,
  user_id integer NOT NULL REFERENCES public.users1(id),
  customer_email text NOT NULL,
  current_plan_id text NOT NULL REFERENCES public.chargebee_subscription_plans(chargebee_plan_id),
  current_trees_per_year smallint NOT NULL,
  current_allocation_pattern smallint[] NOT NULL,
  successful_payment_event_count integer NOT NULL DEFAULT 0 CHECK (successful_payment_event_count >= 0),
  successful_billing_period_count integer NOT NULL DEFAULT 0 CHECK (successful_billing_period_count >= 0),
  trees_allocated_total integer NOT NULL DEFAULT 0 CHECK (trees_allocated_total >= 0),
  initial_side_effects_suppressed boolean NOT NULL DEFAULT false,
  welcome_status text NOT NULL DEFAULT 'pending'
    CHECK (welcome_status IN ('pending', 'completed', 'failed', 'not_required')),
  welcome_certificate_url text,
  last_chargebee_transaction_id text,
  last_chargebee_invoice_id text,
  last_payment_at timestamptz,
  last_allocation_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL,
  plan_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chargebee_subscription_pattern_valid CHECK (
    public.chargebee_allocation_pattern_is_valid(current_allocation_pattern, current_trees_per_year)
  )
);

COMMENT ON TABLE public.chargebee_tree_subscriptions IS
  'One operational row per Chargebee Subscription ID. Customer email and Chargebee Customer ID are attributes, never subscription identity.';
COMMENT ON COLUMN public.chargebee_tree_subscriptions.initial_side_effects_suppressed IS
  'Immutable cutover classification in normal operation. true suppresses the one-time welcome email and initial certificate but never tree allocation.';

CREATE TABLE IF NOT EXISTS public.chargebee_subscription_billing_periods (
  id bigserial PRIMARY KEY,
  subscription_id bigint NOT NULL REFERENCES public.chargebee_tree_subscriptions(id),
  chargebee_subscription_id text NOT NULL,
  billing_period_start timestamptz NOT NULL,
  billing_period_end timestamptz,
  billing_period_source text NOT NULL
    CHECK (billing_period_source IN ('chargebee', 'paid_at_fallback')),
  billing_period_number integer NOT NULL CHECK (billing_period_number > 0),
  allocation_pattern_index smallint NOT NULL CHECK (allocation_pattern_index BETWEEN 0 AND 11),
  chargebee_plan_id text NOT NULL REFERENCES public.chargebee_subscription_plans(chargebee_plan_id),
  trees_per_year smallint NOT NULL,
  allocation_pattern smallint[] NOT NULL,
  plan_changed boolean NOT NULL DEFAULT false,
  trees_due integer NOT NULL CHECK (trees_due >= 0),
  trees_allocated integer NOT NULL DEFAULT 0 CHECK (trees_allocated >= 0),
  allocation_status text NOT NULL DEFAULT 'processing'
    CHECK (allocation_status IN ('processing', 'allocated', 'no_allocation', 'failed')),
  allocated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, billing_period_start),
  UNIQUE (chargebee_subscription_id, billing_period_number),
  CONSTRAINT chargebee_billing_period_dates_valid CHECK (
    billing_period_end IS NULL OR billing_period_end > billing_period_start
  ),
  CONSTRAINT chargebee_billing_period_pattern_valid CHECK (
    public.chargebee_allocation_pattern_is_valid(allocation_pattern, trees_per_year)
  )
);

COMMENT ON TABLE public.chargebee_subscription_billing_periods IS
  'One calendar allocation decision per subscription and billing_period_start. Multiple successful transactions can reuse one period without reallocating.';

CREATE TABLE IF NOT EXISTS public.chargebee_subscription_payments (
  id bigserial PRIMARY KEY,
  subscription_id bigint NOT NULL REFERENCES public.chargebee_tree_subscriptions(id),
  billing_period_id bigint NOT NULL REFERENCES public.chargebee_subscription_billing_periods(id),
  chargebee_transaction_id text NOT NULL UNIQUE,
  chargebee_invoice_id text,
  chargebee_invoice_line_item_id text,
  chargebee_subscription_id text NOT NULL,
  chargebee_plan_id text NOT NULL,
  trees_per_year smallint NOT NULL,
  allocation_pattern smallint[] NOT NULL,
  allocation_pattern_index smallint NOT NULL CHECK (allocation_pattern_index BETWEEN 0 AND 11),
  billing_period_number integer NOT NULL CHECK (billing_period_number > 0),
  payment_event_number integer NOT NULL CHECK (payment_event_number > 0),
  is_allocation_owner boolean NOT NULL DEFAULT false,
  customer_email text NOT NULL,
  amount_minor bigint CHECK (amount_minor IS NULL OR amount_minor >= 0),
  currency text NOT NULL DEFAULT 'EUR' CHECK (char_length(currency) = 3),
  paid_at timestamptz NOT NULL,
  trees_due integer NOT NULL DEFAULT 0 CHECK (trees_due >= 0),
  trees_allocated integer NOT NULL DEFAULT 0 CHECK (trees_allocated >= 0),
  welcome_required boolean NOT NULL DEFAULT false,
  certificate_required boolean NOT NULL DEFAULT false,
  certificate_status text NOT NULL DEFAULT 'not_required'
    CHECK (certificate_status IN ('pending', 'completed', 'failed', 'not_required')),
  certificate_external_key text UNIQUE,
  certificate_external_id text,
  certificate_url text,
  certificate_error text,
  welcome_email_status text NOT NULL DEFAULT 'not_required'
    CHECK (welcome_email_status IN ('pending', 'completed', 'failed', 'not_required')),
  welcome_email_external_id text,
  welcome_email_error text,
  crm_status text NOT NULL DEFAULT 'pending'
    CHECK (crm_status IN ('pending', 'completed', 'failed', 'not_required')),
  crm_external_id text,
  crm_error text,
  financial_status text NOT NULL DEFAULT 'paid'
    CHECK (financial_status IN ('paid', 'refunded', 'partially_refunded', 'chargeback')),
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'allocated', 'no_allocation', 'failed')),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chargebee_subscription_id, payment_event_number),
  CONSTRAINT chargebee_payment_pattern_valid CHECK (
    public.chargebee_allocation_pattern_is_valid(allocation_pattern, trees_per_year)
  ),
  CONSTRAINT chargebee_payment_first_side_effects_valid CHECK (
    (welcome_required AND certificate_required
      AND welcome_email_status <> 'not_required'
      AND certificate_status <> 'not_required'
      AND certificate_external_key IS NOT NULL)
    OR
    (NOT welcome_required AND NOT certificate_required
      AND welcome_email_status = 'not_required'
      AND certificate_status = 'not_required'
      AND certificate_external_key IS NULL)
  )
);

COMMENT ON TABLE public.chargebee_subscription_payments IS
  'One successful Chargebee transaction event per transaction ID. billing_period_number counts periods; payment_event_number counts successful transaction events.';
COMMENT ON COLUMN public.chargebee_subscription_payments.certificate_status IS
  'completed means the customer-facing certificate email was accepted by the mail system, not merely that a Creator job exists.';

CREATE TABLE IF NOT EXISTS public.chargebee_subscription_payment_trees (
  id bigserial PRIMARY KEY,
  payment_id bigint NOT NULL REFERENCES public.chargebee_subscription_payments(id),
  billing_period_id bigint NOT NULL REFERENCES public.chargebee_subscription_billing_periods(id),
  tree_id integer NOT NULL REFERENCES public.trees1(id),
  tree_code text,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, tree_id),
  UNIQUE (tree_id)
);

CREATE INDEX IF NOT EXISTS chargebee_subscriptions_normalized_email_idx
  ON public.chargebee_tree_subscriptions (lower(trim(customer_email)));
CREATE INDEX IF NOT EXISTS chargebee_subscriptions_plan_status_idx
  ON public.chargebee_tree_subscriptions (current_plan_id, status);
CREATE INDEX IF NOT EXISTS chargebee_periods_subscription_start_idx
  ON public.chargebee_subscription_billing_periods (subscription_id, billing_period_start DESC);
CREATE INDEX IF NOT EXISTS chargebee_periods_status_idx
  ON public.chargebee_subscription_billing_periods (allocation_status);
CREATE INDEX IF NOT EXISTS chargebee_payments_subscription_paid_idx
  ON public.chargebee_subscription_payments (subscription_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS chargebee_payments_invoice_idx
  ON public.chargebee_subscription_payments (chargebee_invoice_id);
CREATE INDEX IF NOT EXISTS chargebee_payments_period_idx
  ON public.chargebee_subscription_payments (billing_period_id);
CREATE INDEX IF NOT EXISTS chargebee_payments_status_idx
  ON public.chargebee_subscription_payments (status);
CREATE INDEX IF NOT EXISTS chargebee_payment_trees_period_idx
  ON public.chargebee_subscription_payment_trees (billing_period_id);

CREATE OR REPLACE FUNCTION public.process_chargebee_subscription_payment(
  p_chargebee_transaction_id text,
  p_chargebee_subscription_id text,
  p_chargebee_plan_id text,
  p_customer_email text,
  p_paid_at timestamptz,
  p_billing_period_start timestamptz,
  p_billing_period_end timestamptz DEFAULT NULL,
  p_chargebee_invoice_id text DEFAULT NULL,
  p_chargebee_invoice_line_item_id text DEFAULT NULL,
  p_chargebee_customer_id text DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_subscription_status text DEFAULT 'active',
  p_started_at timestamptz DEFAULT NULL,
  p_amount_minor bigint DEFAULT NULL,
  p_currency text DEFAULT 'EUR',
  p_subscription_created_at timestamptz DEFAULT NULL
)
RETURNS TABLE (
  processed boolean,
  duplicate boolean,
  allocation_period_reused boolean,
  chargebee_transaction_id text,
  chargebee_subscription_id text,
  plan_id text,
  billing_period_number integer,
  payment_number integer,
  payment_event_number integer,
  is_first_payment boolean,
  trees_due integer,
  trees_allocated integer,
  trees_allocated_total integer,
  welcome_required boolean,
  certificate_required boolean,
  customer_email text,
  user_id integer,
  allocation_date timestamptz,
  assigned_trees jsonb,
  certificate_external_key text,
  certificate_status text,
  welcome_email_status text,
  crm_status text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan public.chargebee_subscription_plans%ROWTYPE;
  v_subscription public.chargebee_tree_subscriptions%ROWTYPE;
  v_period public.chargebee_subscription_billing_periods%ROWTYPE;
  v_payment public.chargebee_subscription_payments%ROWTYPE;
  v_user_id integer;
  v_normalized_email text;
  v_effective_period_start timestamptz;
  v_period_source text;
  v_months_diff integer;
  v_pattern_index integer;
  v_billing_period_number integer;
  v_payment_event_number integer;
  v_trees_due integer;
  v_tree_ids integer[] := ARRAY[]::integer[];
  v_assigned_trees jsonb := '[]'::jsonb;
  v_allocation_date timestamptz;
  v_initial_side_effects_required boolean;
  v_plan_changed boolean;
  v_cutover_at timestamptz;
BEGIN
  p_chargebee_transaction_id := btrim(p_chargebee_transaction_id);
  p_chargebee_subscription_id := btrim(p_chargebee_subscription_id);
  p_chargebee_plan_id := btrim(p_chargebee_plan_id);
  v_normalized_email := lower(btrim(p_customer_email));
  p_currency := upper(btrim(p_currency));
  p_subscription_status := COALESCE(NULLIF(btrim(p_subscription_status), ''), 'active');

  IF p_chargebee_transaction_id IS NULL OR p_chargebee_transaction_id = ''
     OR p_chargebee_transaction_id ~ '[[:cntrl:]]'
     OR char_length(p_chargebee_transaction_id) > 100 THEN
    RAISE EXCEPTION 'Invalid Chargebee transaction id';
  END IF;
  IF p_chargebee_subscription_id IS NULL OR p_chargebee_subscription_id = ''
     OR p_chargebee_subscription_id ~ '[[:cntrl:]]'
     OR char_length(p_chargebee_subscription_id) > 100 THEN
    RAISE EXCEPTION 'Invalid Chargebee subscription id';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'chargebee-transaction:' || p_chargebee_transaction_id, 0
  ));

  SELECT payment.* INTO v_payment
  FROM public.chargebee_subscription_payments AS payment
  WHERE payment.chargebee_transaction_id = p_chargebee_transaction_id;

  IF FOUND THEN
    IF v_payment.chargebee_subscription_id <> p_chargebee_subscription_id THEN
      RAISE EXCEPTION
        'Chargebee transaction % is already registered for another subscription',
        p_chargebee_transaction_id;
    END IF;
    IF p_chargebee_plan_id IS NOT NULL AND btrim(p_chargebee_plan_id) <> ''
       AND v_payment.chargebee_plan_id <> btrim(p_chargebee_plan_id) THEN
      RAISE EXCEPTION
        'Chargebee transaction % is already registered with another plan',
        p_chargebee_transaction_id;
    END IF;
    IF p_chargebee_invoice_id IS NOT NULL AND btrim(p_chargebee_invoice_id) <> ''
       AND v_payment.chargebee_invoice_id IS DISTINCT FROM btrim(p_chargebee_invoice_id) THEN
      RAISE EXCEPTION
        'Chargebee transaction % is already registered with another invoice',
        p_chargebee_transaction_id;
    END IF;

    SELECT subscription.* INTO STRICT v_subscription
    FROM public.chargebee_tree_subscriptions AS subscription
    WHERE subscription.id = v_payment.subscription_id;

    SELECT period.* INTO STRICT v_period
    FROM public.chargebee_subscription_billing_periods AS period
    WHERE period.id = v_payment.billing_period_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'tree_id', tree.id,
      'tree_code', tree.tree_code,
      'tree_type', tree.tree_type,
      'latitude', tree.lat,
      'longitude', tree."long",
      'planted_date', tree.planted_date
    ) ORDER BY tree.id), '[]'::jsonb)
    INTO v_assigned_trees
    FROM public.chargebee_subscription_payment_trees AS link
    JOIN public.trees1 AS tree ON tree.id = link.tree_id
    WHERE link.billing_period_id = v_period.id;

    RETURN QUERY SELECT
      true, true, NOT v_payment.is_allocation_owner,
      v_payment.chargebee_transaction_id,
      v_payment.chargebee_subscription_id,
      v_payment.chargebee_plan_id,
      v_payment.billing_period_number,
      v_payment.billing_period_number,
      v_payment.payment_event_number,
      v_payment.welcome_required,
      v_payment.trees_due,
      v_payment.trees_allocated,
      v_subscription.trees_allocated_total,
      v_payment.welcome_required,
      v_payment.certificate_required,
      v_payment.customer_email,
      v_subscription.user_id,
      v_period.allocated_at,
      v_assigned_trees,
      v_payment.certificate_external_key,
      v_payment.certificate_status,
      v_payment.welcome_email_status,
      v_payment.crm_status;
    RETURN;
  END IF;

  IF p_chargebee_plan_id IS NULL OR p_chargebee_plan_id = '' THEN
    RAISE EXCEPTION 'Invalid Chargebee plan id';
  END IF;
  SELECT plan.* INTO v_plan
  FROM public.chargebee_subscription_plans AS plan
  WHERE plan.chargebee_plan_id = p_chargebee_plan_id
    AND plan.active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or inactive Chargebee plan %', p_chargebee_plan_id;
  END IF;
  IF NOT public.chargebee_allocation_pattern_is_valid(
    v_plan.allocation_pattern, v_plan.trees_per_year
  ) THEN
    RAISE EXCEPTION 'Invalid allocation pattern for Chargebee plan %', p_chargebee_plan_id;
  END IF;
  IF v_normalized_email IS NULL OR v_normalized_email = ''
     OR v_normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid customer email';
  END IF;
  IF p_paid_at IS NULL OR p_amount_minor < 0
     OR p_currency IS NULL OR char_length(p_currency) <> 3 THEN
    RAISE EXCEPTION 'Invalid Chargebee payment details';
  END IF;
  IF p_billing_period_end IS NOT NULL
     AND p_billing_period_start IS NOT NULL
     AND p_billing_period_end <= p_billing_period_start THEN
    RAISE EXCEPTION 'Invalid Chargebee billing period';
  END IF;

  v_effective_period_start := COALESCE(p_billing_period_start, p_paid_at);
  v_period_source := CASE
    WHEN p_billing_period_start IS NULL THEN 'paid_at_fallback'
    ELSE 'chargebee'
  END;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'chargebee-subscription:' || p_chargebee_subscription_id, 0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'user-email:' || v_normalized_email, 0
  ));

  INSERT INTO public.users1 (
    email, first_name, last_name, chargebee_id, subscription_type,
    created_at, updated_at
  ) VALUES (
    v_normalized_email, NULLIF(btrim(p_first_name), ''),
    NULLIF(btrim(p_last_name), ''), NULLIF(btrim(p_chargebee_customer_id), ''),
    p_chargebee_plan_id, now(), now()
  )
  ON CONFLICT ((lower(trim(email)))) DO UPDATE
  SET first_name = COALESCE(EXCLUDED.first_name, public.users1.first_name),
      last_name = COALESCE(EXCLUDED.last_name, public.users1.last_name),
      chargebee_id = COALESCE(EXCLUDED.chargebee_id, public.users1.chargebee_id),
      subscription_type = EXCLUDED.subscription_type,
      updated_at = now()
  RETURNING id INTO v_user_id;

  SELECT subscription.* INTO v_subscription
  FROM public.chargebee_tree_subscriptions AS subscription
  WHERE subscription.chargebee_subscription_id = p_chargebee_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_started_at IS NULL THEN
      RAISE EXCEPTION 'started_at is required for a new Chargebee subscription';
    END IF;

    SELECT policy.cutover_at INTO v_cutover_at
    FROM public.chargebee_subscription_cutover_policy AS policy
    WHERE policy.singleton = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Chargebee cutover policy is not configured';
    END IF;
    IF p_subscription_created_at IS NULL THEN
      RAISE EXCEPTION
        'Chargebee subscription created_at is required for an unseeded subscription';
    END IF;
    IF p_subscription_created_at < v_cutover_at THEN
      RAISE EXCEPTION
        'Pre-cutover Chargebee subscription % is missing from the cutover seed and requires manual review',
        p_chargebee_subscription_id;
    END IF;

    INSERT INTO public.chargebee_tree_subscriptions (
      chargebee_subscription_id, chargebee_customer_id, user_id,
      customer_email, current_plan_id, current_trees_per_year,
      current_allocation_pattern, status, started_at,
      initial_side_effects_suppressed, welcome_status
    ) VALUES (
      p_chargebee_subscription_id, NULLIF(btrim(p_chargebee_customer_id), ''),
      v_user_id, v_normalized_email, v_plan.chargebee_plan_id,
      v_plan.trees_per_year, v_plan.allocation_pattern,
      p_subscription_status, p_started_at, false, 'pending'
    )
    RETURNING * INTO v_subscription;
  END IF;

  SELECT period.* INTO v_period
  FROM public.chargebee_subscription_billing_periods AS period
  WHERE period.subscription_id = v_subscription.id
    AND period.billing_period_start = v_effective_period_start
  FOR UPDATE;

  v_payment_event_number := v_subscription.successful_payment_event_count + 1;

  IF FOUND THEN
    IF v_period.chargebee_plan_id <> p_chargebee_plan_id THEN
      RAISE EXCEPTION
        'Billing period % for subscription % is already registered with plan %, not %',
        v_effective_period_start, p_chargebee_subscription_id,
        v_period.chargebee_plan_id, p_chargebee_plan_id;
    END IF;

    INSERT INTO public.chargebee_subscription_payments (
      subscription_id, billing_period_id, chargebee_transaction_id,
      chargebee_invoice_id, chargebee_invoice_line_item_id,
      chargebee_subscription_id, chargebee_plan_id, trees_per_year,
      allocation_pattern, allocation_pattern_index, billing_period_number,
      payment_event_number, is_allocation_owner, customer_email,
      amount_minor, currency, paid_at, trees_due, trees_allocated,
      welcome_required, certificate_required, certificate_status,
      welcome_email_status, crm_status, status, processed_at
    ) VALUES (
      v_subscription.id, v_period.id, p_chargebee_transaction_id,
      NULLIF(btrim(p_chargebee_invoice_id), ''),
      NULLIF(btrim(p_chargebee_invoice_line_item_id), ''),
      p_chargebee_subscription_id, v_period.chargebee_plan_id,
      v_period.trees_per_year, v_period.allocation_pattern,
      v_period.allocation_pattern_index, v_period.billing_period_number,
      v_payment_event_number, false, v_normalized_email,
      p_amount_minor, p_currency, p_paid_at, 0, 0,
      false, false, 'not_required', 'not_required', 'pending',
      'no_allocation', now()
    ) RETURNING * INTO v_payment;

    UPDATE public.chargebee_tree_subscriptions
    SET successful_payment_event_count = v_payment_event_number,
        chargebee_customer_id = COALESCE(NULLIF(btrim(p_chargebee_customer_id), ''), chargebee_customer_id),
        user_id = v_user_id,
        customer_email = v_normalized_email,
        last_chargebee_transaction_id = p_chargebee_transaction_id,
        last_chargebee_invoice_id = NULLIF(btrim(p_chargebee_invoice_id), ''),
        last_payment_at = p_paid_at,
        status = p_subscription_status,
        updated_at = now()
    WHERE id = v_subscription.id
    RETURNING * INTO v_subscription;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'tree_id', tree.id,
      'tree_code', tree.tree_code,
      'tree_type', tree.tree_type,
      'latitude', tree.lat,
      'longitude', tree."long",
      'planted_date', tree.planted_date
    ) ORDER BY tree.id), '[]'::jsonb)
    INTO v_assigned_trees
    FROM public.chargebee_subscription_payment_trees AS link
    JOIN public.trees1 AS tree ON tree.id = link.tree_id
    WHERE link.billing_period_id = v_period.id;

    RETURN QUERY SELECT
      true, false, true, v_payment.chargebee_transaction_id,
      v_payment.chargebee_subscription_id, v_payment.chargebee_plan_id,
      v_payment.billing_period_number, v_payment.billing_period_number,
      v_payment.payment_event_number, false, 0, 0,
      v_subscription.trees_allocated_total, false, false,
      v_payment.customer_email, v_subscription.user_id,
      v_period.allocated_at, v_assigned_trees,
      v_payment.certificate_external_key, v_payment.certificate_status,
      v_payment.welcome_email_status, v_payment.crm_status;
    RETURN;
  END IF;

  IF v_effective_period_start < v_subscription.started_at THEN
    RAISE EXCEPTION
      'Billing period % precedes subscription start % for %',
      v_effective_period_start, v_subscription.started_at,
      p_chargebee_subscription_id;
  END IF;

  v_months_diff :=
    (extract(year FROM v_effective_period_start)::integer
      - extract(year FROM v_subscription.started_at)::integer) * 12
    + extract(month FROM v_effective_period_start)::integer
    - extract(month FROM v_subscription.started_at)::integer;
  v_pattern_index := v_months_diff % 12;
  v_billing_period_number := v_subscription.successful_billing_period_count + 1;
  v_trees_due := v_plan.allocation_pattern[v_pattern_index + 1];
  v_initial_side_effects_required :=
    v_subscription.successful_billing_period_count = 0
    AND NOT v_subscription.initial_side_effects_suppressed;
  v_plan_changed := v_subscription.current_plan_id <> p_chargebee_plan_id;

  IF v_initial_side_effects_required AND v_trees_due = 0 THEN
    RAISE EXCEPTION
      'First successful Chargebee billing period resolves to zero trees for plan %',
      p_chargebee_plan_id;
  END IF;

  INSERT INTO public.chargebee_subscription_billing_periods (
    subscription_id, chargebee_subscription_id, billing_period_start,
    billing_period_end, billing_period_source, billing_period_number,
    allocation_pattern_index, chargebee_plan_id, trees_per_year,
    allocation_pattern, plan_changed, trees_due
  ) VALUES (
    v_subscription.id, p_chargebee_subscription_id, v_effective_period_start,
    p_billing_period_end, v_period_source, v_billing_period_number,
    v_pattern_index, v_plan.chargebee_plan_id, v_plan.trees_per_year,
    v_plan.allocation_pattern, v_plan_changed, v_trees_due
  ) RETURNING * INTO v_period;

  INSERT INTO public.chargebee_subscription_payments (
    subscription_id, billing_period_id, chargebee_transaction_id,
    chargebee_invoice_id, chargebee_invoice_line_item_id,
    chargebee_subscription_id, chargebee_plan_id, trees_per_year,
    allocation_pattern, allocation_pattern_index, billing_period_number,
    payment_event_number, is_allocation_owner, customer_email,
    amount_minor, currency, paid_at, trees_due, trees_allocated,
    welcome_required, certificate_required, certificate_status,
    certificate_external_key, welcome_email_status, crm_status, status
  ) VALUES (
    v_subscription.id, v_period.id, p_chargebee_transaction_id,
    NULLIF(btrim(p_chargebee_invoice_id), ''),
    NULLIF(btrim(p_chargebee_invoice_line_item_id), ''),
    p_chargebee_subscription_id, v_plan.chargebee_plan_id,
    v_plan.trees_per_year, v_plan.allocation_pattern, v_pattern_index,
    v_billing_period_number, v_payment_event_number, true,
    v_normalized_email, p_amount_minor, p_currency, p_paid_at,
    v_trees_due, 0, v_initial_side_effects_required,
    v_initial_side_effects_required,
    CASE WHEN v_initial_side_effects_required THEN 'pending' ELSE 'not_required' END,
    CASE WHEN v_initial_side_effects_required
      THEN 'chargebee-initial:' || p_chargebee_subscription_id
      ELSE NULL END,
    CASE WHEN v_initial_side_effects_required THEN 'pending' ELSE 'not_required' END,
    'pending', 'processing'
  ) RETURNING * INTO v_payment;

  IF v_trees_due > 0 THEN
    SELECT COALESCE(array_agg(candidate.id ORDER BY candidate.id), ARRAY[]::integer[])
    INTO v_tree_ids
    FROM (
      SELECT tree.id
      FROM public.trees1 AS tree
      WHERE tree.user_id IS NULL
        AND tree.is_claimed IS NOT TRUE
        AND tree.purchase_date IS NULL
        AND tree.order_id IS NULL
        AND tree.reserved_token IS NULL
        AND tree.claimed_at IS NULL
        AND tree.unclaimed_user_id IS NULL
        AND tree.tree_code IS NOT NULL
        AND tree.lat IS NOT NULL
        AND tree."long" IS NOT NULL
      ORDER BY tree.id
      FOR UPDATE OF tree SKIP LOCKED
      LIMIT v_trees_due
    ) AS candidate;

    IF cardinality(v_tree_ids) <> v_trees_due THEN
      RAISE EXCEPTION 'Insufficient free trees: required %, available %',
        v_trees_due, cardinality(v_tree_ids);
    END IF;

    v_allocation_date := now();

    UPDATE public.trees1 AS tree
    SET user_id = v_user_id,
        is_claimed = true,
        claimed_at = v_allocation_date,
        purchase_date = p_paid_at AT TIME ZONE 'UTC',
        updated_at = now() AT TIME ZONE 'UTC'
    WHERE tree.id = ANY(v_tree_ids);

    INSERT INTO public.chargebee_subscription_payment_trees (
      payment_id, billing_period_id, tree_id, tree_code, allocated_at
    )
    SELECT v_payment.id, v_period.id, tree.id, tree.tree_code, v_allocation_date
    FROM public.trees1 AS tree
    WHERE tree.id = ANY(v_tree_ids);

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'tree_id', tree.id,
      'tree_code', tree.tree_code,
      'tree_type', tree.tree_type,
      'latitude', tree.lat,
      'longitude', tree."long",
      'planted_date', tree.planted_date
    ) ORDER BY tree.id), '[]'::jsonb)
    INTO v_assigned_trees
    FROM public.trees1 AS tree
    WHERE tree.id = ANY(v_tree_ids);
  END IF;

  UPDATE public.chargebee_subscription_billing_periods
  SET trees_allocated = v_trees_due,
      allocation_status = CASE
        WHEN v_trees_due = 0 THEN 'no_allocation' ELSE 'allocated' END,
      allocated_at = v_allocation_date,
      updated_at = now()
  WHERE id = v_period.id
  RETURNING * INTO v_period;

  UPDATE public.chargebee_subscription_payments
  SET trees_allocated = v_trees_due,
      status = CASE
        WHEN v_trees_due = 0 THEN 'no_allocation' ELSE 'allocated' END,
      processed_at = now(),
      updated_at = now()
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  UPDATE public.chargebee_tree_subscriptions
  SET chargebee_customer_id = COALESCE(NULLIF(btrim(p_chargebee_customer_id), ''), chargebee_customer_id),
      user_id = v_user_id,
      customer_email = v_normalized_email,
      current_plan_id = v_plan.chargebee_plan_id,
      current_trees_per_year = v_plan.trees_per_year,
      current_allocation_pattern = v_plan.allocation_pattern,
      successful_payment_event_count = v_payment_event_number,
      successful_billing_period_count = v_billing_period_number,
      trees_allocated_total = public.chargebee_tree_subscriptions.trees_allocated_total + v_trees_due,
      welcome_status = CASE
        WHEN v_initial_side_effects_required THEN 'pending' ELSE welcome_status END,
      last_chargebee_transaction_id = p_chargebee_transaction_id,
      last_chargebee_invoice_id = NULLIF(btrim(p_chargebee_invoice_id), ''),
      last_payment_at = p_paid_at,
      last_allocation_at = CASE
        WHEN v_trees_due > 0 THEN v_allocation_date ELSE last_allocation_at END,
      status = p_subscription_status,
      plan_changed_at = CASE WHEN v_plan_changed THEN now() ELSE plan_changed_at END,
      updated_at = now()
  WHERE id = v_subscription.id
  RETURNING * INTO v_subscription;

  RETURN QUERY SELECT
    true, false, false, v_payment.chargebee_transaction_id,
    v_payment.chargebee_subscription_id, v_payment.chargebee_plan_id,
    v_payment.billing_period_number, v_payment.billing_period_number,
    v_payment.payment_event_number, v_initial_side_effects_required,
    v_payment.trees_due, v_payment.trees_allocated,
    v_subscription.trees_allocated_total, v_payment.welcome_required,
    v_payment.certificate_required, v_payment.customer_email,
    v_subscription.user_id, v_period.allocated_at, v_assigned_trees,
    v_payment.certificate_external_key, v_payment.certificate_status,
    v_payment.welcome_email_status, v_payment.crm_status;
END;
$$;

COMMENT ON FUNCTION public.process_chargebee_subscription_payment(
  text, text, text, text, timestamptz, timestamptz, timestamptz,
  text, text, text, text, text, text, timestamptz, bigint, text, timestamptz
) IS
  'Atomically records one successful Chargebee transaction, reuses an existing subscription billing period, or creates one calendar-indexed allocation with locked trees. Transaction retries return the original result.';

CREATE OR REPLACE FUNCTION public.mark_chargebee_subscription_payment_side_effect(
  p_chargebee_transaction_id text,
  p_effect text,
  p_status text,
  p_external_id text DEFAULT NULL,
  p_external_url text DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS public.chargebee_subscription_payments
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment public.chargebee_subscription_payments%ROWTYPE;
  v_current_status text;
  v_current_external_id text;
  v_current_external_url text;
BEGIN
  p_chargebee_transaction_id := btrim(p_chargebee_transaction_id);
  p_effect := lower(btrim(p_effect));
  p_status := lower(btrim(p_status));

  IF p_effect NOT IN ('certificate', 'welcome_email', 'crm') THEN
    RAISE EXCEPTION 'Unknown Chargebee side effect %', p_effect;
  END IF;
  IF p_status NOT IN ('pending', 'completed', 'failed', 'not_required') THEN
    RAISE EXCEPTION 'Unknown Chargebee side-effect status %', p_status;
  END IF;

  SELECT payment.* INTO v_payment
  FROM public.chargebee_subscription_payments AS payment
  WHERE payment.chargebee_transaction_id = p_chargebee_transaction_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown Chargebee transaction %', p_chargebee_transaction_id;
  END IF;

  v_current_status := CASE p_effect
    WHEN 'certificate' THEN v_payment.certificate_status
    WHEN 'welcome_email' THEN v_payment.welcome_email_status
    WHEN 'crm' THEN v_payment.crm_status
  END;
  v_current_external_id := CASE p_effect
    WHEN 'certificate' THEN v_payment.certificate_external_id
    WHEN 'welcome_email' THEN v_payment.welcome_email_external_id
    WHEN 'crm' THEN v_payment.crm_external_id
  END;
  v_current_external_url := CASE p_effect
    WHEN 'certificate' THEN v_payment.certificate_url
    ELSE NULL
  END;

  IF v_current_status = 'completed' THEN
    IF p_status <> 'completed' THEN
      RAISE EXCEPTION 'Completed Chargebee % side effect is terminal', p_effect;
    END IF;
    IF p_external_id IS NOT NULL AND v_current_external_id IS NOT NULL
       AND p_external_id <> v_current_external_id THEN
      RAISE EXCEPTION 'Completed Chargebee % side effect has a conflicting external id', p_effect;
    END IF;
    IF p_effect = 'certificate' AND p_external_url IS NOT NULL
       AND v_current_external_url IS NOT NULL
       AND p_external_url <> v_current_external_url THEN
      RAISE EXCEPTION 'Completed Chargebee certificate has a conflicting external URL';
    END IF;
    RETURN v_payment;
  END IF;

  IF p_effect = 'certificate' AND NOT v_payment.certificate_required
     AND p_status <> 'not_required' THEN
    RAISE EXCEPTION 'Certificate is not required for Chargebee transaction %', p_chargebee_transaction_id;
  END IF;
  IF p_effect = 'welcome_email' AND NOT v_payment.welcome_required
     AND p_status <> 'not_required' THEN
    RAISE EXCEPTION 'Welcome email is not required for Chargebee transaction %', p_chargebee_transaction_id;
  END IF;

  UPDATE public.chargebee_subscription_payments
  SET certificate_status = CASE WHEN p_effect = 'certificate' THEN p_status ELSE certificate_status END,
      certificate_external_id = CASE WHEN p_effect = 'certificate' THEN COALESCE(p_external_id, certificate_external_id) ELSE certificate_external_id END,
      certificate_url = CASE WHEN p_effect = 'certificate' THEN COALESCE(p_external_url, certificate_url) ELSE certificate_url END,
      certificate_error = CASE WHEN p_effect = 'certificate' AND p_status = 'failed' THEN p_error_message WHEN p_effect = 'certificate' THEN NULL ELSE certificate_error END,
      welcome_email_status = CASE WHEN p_effect = 'welcome_email' THEN p_status ELSE welcome_email_status END,
      welcome_email_external_id = CASE WHEN p_effect = 'welcome_email' THEN COALESCE(p_external_id, welcome_email_external_id) ELSE welcome_email_external_id END,
      welcome_email_error = CASE WHEN p_effect = 'welcome_email' AND p_status = 'failed' THEN p_error_message WHEN p_effect = 'welcome_email' THEN NULL ELSE welcome_email_error END,
      crm_status = CASE WHEN p_effect = 'crm' THEN p_status ELSE crm_status END,
      crm_external_id = CASE WHEN p_effect = 'crm' THEN COALESCE(p_external_id, crm_external_id) ELSE crm_external_id END,
      crm_error = CASE WHEN p_effect = 'crm' AND p_status = 'failed' THEN p_error_message WHEN p_effect = 'crm' THEN NULL ELSE crm_error END,
      updated_at = now()
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  IF p_effect = 'certificate' AND p_status = 'completed' THEN
    UPDATE public.chargebee_tree_subscriptions
    SET welcome_certificate_url = COALESCE(p_external_url, welcome_certificate_url),
        updated_at = now()
    WHERE id = v_payment.subscription_id;
  END IF;

  IF v_payment.welcome_required
     AND v_payment.certificate_required
     AND v_payment.welcome_email_status = 'completed'
     AND v_payment.certificate_status = 'completed' THEN
    UPDATE public.chargebee_tree_subscriptions
    SET welcome_status = 'completed', updated_at = now()
    WHERE id = v_payment.subscription_id;
  ELSIF v_payment.welcome_required
        AND (v_payment.welcome_email_status = 'failed'
             OR v_payment.certificate_status = 'failed') THEN
    UPDATE public.chargebee_tree_subscriptions
    SET welcome_status = 'failed', updated_at = now()
    WHERE id = v_payment.subscription_id
      AND welcome_status <> 'completed';
  END IF;

  RETURN v_payment;
END;
$$;

COMMENT ON FUNCTION public.mark_chargebee_subscription_payment_side_effect(
  text, text, text, text, text, text
) IS
  'Updates retryable Chargebee certificate, welcome-email or CRM state. completed is terminal and repeated matching completion is idempotent.';

COMMIT;
