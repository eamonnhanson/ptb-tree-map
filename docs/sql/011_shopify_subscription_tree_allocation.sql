-- Shopify subscription payment processing and atomic tree allocation.
--
-- REVIEW-ONLY MIGRATION. Do not run this file automatically and do not run it
-- against production until the live users1/trees1 schema and a backup have
-- been reviewed. This migration never backfills existing subscriptions.
--
-- Source of truth:
--   Shopify   = subscription contract and successful paid order
--   PostgreSQL = payment counter, idempotency and tree allocation
--   Zapier     = transport and external side effects only

BEGIN;

CREATE TABLE IF NOT EXISTS public.shopify_tree_subscription_variants (
  shopify_variant_id text PRIMARY KEY,
  shopify_product_id text NOT NULL,
  label text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'EUR' CHECK (char_length(currency) = 3),
  allocation_mode text NOT NULL CHECK (allocation_mode IN ('odd_payment', 'every_payment')),
  trees_per_allocation smallint NOT NULL CHECK (trees_per_allocation > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.shopify_tree_subscription_variants IS
  'Declarative allocation policy for Shopify Maandelijkse donatie variants. Zapier must not duplicate these rules.';

INSERT INTO public.shopify_tree_subscription_variants (
  shopify_variant_id, shopify_product_id, label, amount, currency,
  allocation_mode, trees_per_allocation, active
)
VALUES
  ('53296965386570', '15258713063754', 'Maandelijkse donatie EUR 5', 5.00, 'EUR', 'odd_payment', 1, true),
  ('53296965419338', '15258713063754', 'Maandelijkse donatie EUR 10', 10.00, 'EUR', 'every_payment', 1, true),
  ('53296965452106', '15258713063754', 'Maandelijkse donatie EUR 20', 20.00, 'EUR', 'every_payment', 2, true)
ON CONFLICT (shopify_variant_id) DO UPDATE
SET shopify_product_id = EXCLUDED.shopify_product_id,
    label = EXCLUDED.label,
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    allocation_mode = EXCLUDED.allocation_mode,
    trees_per_allocation = EXCLUDED.trees_per_allocation,
    active = EXCLUDED.active,
    updated_at = now();

CREATE TABLE IF NOT EXISTS public.shopify_tree_subscriptions (
  id bigserial PRIMARY KEY,
  shopify_subscription_contract_id text NOT NULL UNIQUE,
  shopify_customer_id text,
  user_id integer,
  customer_email text NOT NULL,
  shopify_product_id text NOT NULL,
  shopify_variant_id text NOT NULL REFERENCES public.shopify_tree_subscription_variants(shopify_variant_id),
  subscription_amount numeric(12,2) NOT NULL CHECK (subscription_amount >= 0),
  currency text NOT NULL CHECK (char_length(currency) = 3),
  successful_payment_count integer NOT NULL DEFAULT 0 CHECK (successful_payment_count >= 0),
  trees_allocated_total integer NOT NULL DEFAULT 0 CHECK (trees_allocated_total >= 0),
  welcome_status text NOT NULL DEFAULT 'pending'
    CHECK (welcome_status IN ('pending', 'completed', 'failed', 'not_required')),
  welcome_certificate_url text,
  last_shopify_order_id text,
  last_payment_at timestamptz,
  last_allocation_at timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'failed', 'expired', 'unknown')),
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.shopify_tree_subscriptions IS
  'Runtime registry keyed by Shopify subscription contract, never by customer email.';

CREATE TABLE IF NOT EXISTS public.shopify_subscription_payments (
  id bigserial PRIMARY KEY,
  subscription_id bigint NOT NULL REFERENCES public.shopify_tree_subscriptions(id),
  shopify_order_id text NOT NULL UNIQUE,
  shopify_order_name text,
  shopify_subscription_contract_id text NOT NULL,
  shopify_variant_id text NOT NULL REFERENCES public.shopify_tree_subscription_variants(shopify_variant_id),
  customer_email text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL CHECK (char_length(currency) = 3),
  paid_at timestamptz NOT NULL,
  payment_number integer NOT NULL CHECK (payment_number > 0),
  trees_due integer NOT NULL CHECK (trees_due >= 0),
  trees_allocated integer NOT NULL DEFAULT 0 CHECK (trees_allocated >= 0),
  welcome_required boolean NOT NULL DEFAULT false,
  certificate_required boolean NOT NULL DEFAULT false,
  certificate_status text NOT NULL DEFAULT 'not_required'
    CHECK (certificate_status IN ('pending', 'completed', 'failed', 'not_required')),
  certificate_external_id text,
  certificate_url text,
  welcome_email_status text NOT NULL DEFAULT 'not_required'
    CHECK (welcome_email_status IN ('pending', 'completed', 'failed', 'not_required')),
  crm_status text NOT NULL DEFAULT 'pending'
    CHECK (crm_status IN ('pending', 'completed', 'failed', 'not_required')),
  financial_status text NOT NULL DEFAULT 'paid'
    CHECK (financial_status IN ('paid', 'refunded', 'partially_refunded', 'chargeback')),
  refunded_at timestamptz,
  raw_tags text,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'allocated', 'no_allocation', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shopify_subscription_contract_id, payment_number)
);

COMMENT ON TABLE public.shopify_subscription_payments IS
  'One durable row per successful Shopify order. UNIQUE(shopify_order_id) is the hard idempotency boundary.';
COMMENT ON COLUMN public.shopify_subscription_payments.financial_status IS
  'Refunds and chargebacks are recorded without releasing historical tree allocations.';

CREATE TABLE IF NOT EXISTS public.shopify_subscription_payment_trees (
  id bigserial PRIMARY KEY,
  payment_id bigint NOT NULL REFERENCES public.shopify_subscription_payments(id),
  tree_id integer NOT NULL REFERENCES public.trees1(id),
  tree_code text,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, tree_id),
  UNIQUE (tree_id)
);

COMMENT ON TABLE public.shopify_subscription_payment_trees IS
  'Immutable one-to-many audit link from a Shopify subscription payment to allocated trees.';

CREATE INDEX IF NOT EXISTS shopify_tree_subscriptions_customer_email_idx
  ON public.shopify_tree_subscriptions (lower(customer_email));
CREATE INDEX IF NOT EXISTS shopify_tree_subscriptions_variant_status_idx
  ON public.shopify_tree_subscriptions (shopify_variant_id, status);
CREATE INDEX IF NOT EXISTS shopify_subscription_payments_contract_paid_idx
  ON public.shopify_subscription_payments (shopify_subscription_contract_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS shopify_subscription_payments_status_idx
  ON public.shopify_subscription_payments (status, paid_at DESC);
CREATE INDEX IF NOT EXISTS shopify_subscription_payments_customer_email_idx
  ON public.shopify_subscription_payments (lower(customer_email));
CREATE INDEX IF NOT EXISTS shopify_subscription_payment_trees_payment_idx
  ON public.shopify_subscription_payment_trees (payment_id);

CREATE OR REPLACE FUNCTION public.process_shopify_subscription_payment(
  p_shopify_order_id text,
  p_shopify_subscription_contract_id text,
  p_shopify_variant_id text,
  p_customer_email text,
  p_paid_at timestamptz,
  p_amount numeric,
  p_shopify_order_name text DEFAULT NULL,
  p_shopify_customer_id text DEFAULT NULL,
  p_currency text DEFAULT 'EUR',
  p_raw_tags text DEFAULT NULL
)
RETURNS TABLE (
  processed boolean,
  duplicate boolean,
  shopify_order_id text,
  shopify_subscription_contract_id text,
  shopify_variant_id text,
  payment_number integer,
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
  certificate_status text,
  welcome_email_status text,
  crm_status text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_variant public.shopify_tree_subscription_variants%ROWTYPE;
  v_subscription public.shopify_tree_subscriptions%ROWTYPE;
  v_payment public.shopify_subscription_payments%ROWTYPE;
  v_user_id integer;
  v_payment_number integer;
  v_trees_due integer;
  v_tree_ids integer[] := ARRAY[]::integer[];
  v_assigned_trees jsonb := '[]'::jsonb;
  v_allocation_date timestamptz;
  v_normalized_email text;
BEGIN
  p_shopify_order_id := btrim(p_shopify_order_id);
  p_shopify_subscription_contract_id := btrim(p_shopify_subscription_contract_id);
  p_shopify_variant_id := btrim(p_shopify_variant_id);
  v_normalized_email := lower(btrim(p_customer_email));
  p_currency := upper(btrim(p_currency));

  IF p_shopify_order_id IS NULL OR p_shopify_order_id !~ '^[0-9]{1,30}$' THEN
    RAISE EXCEPTION 'Invalid Shopify order id';
  END IF;
  IF p_shopify_subscription_contract_id IS NULL OR p_shopify_subscription_contract_id !~ '^[0-9]{1,30}$' THEN
    RAISE EXCEPTION 'Invalid Shopify subscription contract id';
  END IF;
  IF p_shopify_variant_id IS NULL OR p_shopify_variant_id !~ '^[0-9]{1,30}$' THEN
    RAISE EXCEPTION 'Invalid Shopify variant id';
  END IF;
  IF v_normalized_email IS NULL OR v_normalized_email = '' OR v_normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid customer email';
  END IF;
  IF p_paid_at IS NULL OR p_amount IS NULL OR p_amount < 0 OR char_length(p_currency) <> 3 THEN
    RAISE EXCEPTION 'Invalid payment details';
  END IF;

  SELECT variant.* INTO v_variant
  FROM public.shopify_tree_subscription_variants variant
  WHERE variant.shopify_variant_id = p_shopify_variant_id AND variant.active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or inactive Shopify subscription variant %', p_shopify_variant_id;
  END IF;

  -- Transaction-scoped locks serialize duplicate deliveries and payment
  -- numbering without holding locks outside this database transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended('shopify-order:' || p_shopify_order_id, 0));

  SELECT payment.* INTO v_payment
  FROM public.shopify_subscription_payments payment
  WHERE payment.shopify_order_id = p_shopify_order_id;

  IF FOUND THEN
    IF v_payment.shopify_subscription_contract_id <> p_shopify_subscription_contract_id
       OR v_payment.shopify_variant_id <> p_shopify_variant_id THEN
      RAISE EXCEPTION
        'Shopify order % was already registered with different contract or variant data',
        p_shopify_order_id;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'tree_id', t.id,
      'tree_code', t.tree_code,
      'tree_type', t.tree_type,
      'latitude', t.lat,
      'longitude', t."long"
    ) ORDER BY t.id), '[]'::jsonb)
    INTO v_assigned_trees
    FROM public.shopify_subscription_payment_trees link
    JOIN public.trees1 t ON t.id = link.tree_id
    WHERE link.payment_id = v_payment.id;

    SELECT subscription.* INTO v_subscription
    FROM public.shopify_tree_subscriptions subscription
    WHERE subscription.id = v_payment.subscription_id;

    RETURN QUERY SELECT
      true, true, v_payment.shopify_order_id,
      v_payment.shopify_subscription_contract_id, v_payment.shopify_variant_id,
      v_payment.payment_number, v_payment.payment_number = 1,
      v_payment.trees_due, v_payment.trees_allocated,
      v_subscription.trees_allocated_total, v_payment.welcome_required,
      v_payment.certificate_required, v_payment.customer_email,
      v_subscription.user_id, v_payment.processed_at, v_assigned_trees,
      v_payment.certificate_status, v_payment.welcome_email_status,
      v_payment.crm_status;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'shopify-contract:' || p_shopify_subscription_contract_id, 0
  ));

  SELECT subscription.* INTO v_subscription
  FROM public.shopify_tree_subscriptions subscription
  WHERE subscription.shopify_subscription_contract_id = p_shopify_subscription_contract_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.shopify_tree_subscriptions (
      shopify_subscription_contract_id, shopify_customer_id, customer_email,
      shopify_product_id, shopify_variant_id, subscription_amount, currency,
      status, started_at
    ) VALUES (
      p_shopify_subscription_contract_id, NULLIF(btrim(p_shopify_customer_id), ''),
      v_normalized_email, v_variant.shopify_product_id, p_shopify_variant_id,
      p_amount, p_currency, 'active', p_paid_at
    ) RETURNING * INTO v_subscription;
  END IF;

  SELECT id INTO v_user_id
  FROM public.users1
  WHERE lower(btrim(email)) = v_normalized_email
  ORDER BY id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    INSERT INTO public.users1 (email, created_at, updated_at)
    VALUES (v_normalized_email, now(), now())
    ON CONFLICT (email) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_user_id;
  END IF;

  v_payment_number := v_subscription.successful_payment_count + 1;
  v_trees_due := CASE v_variant.allocation_mode
    WHEN 'odd_payment' THEN CASE WHEN v_payment_number % 2 = 1 THEN v_variant.trees_per_allocation ELSE 0 END
    WHEN 'every_payment' THEN v_variant.trees_per_allocation
  END;

  INSERT INTO public.shopify_subscription_payments (
    subscription_id, shopify_order_id, shopify_order_name,
    shopify_subscription_contract_id, shopify_variant_id, customer_email,
    amount, currency, paid_at, payment_number, trees_due,
    welcome_required, certificate_required, certificate_status,
    welcome_email_status, crm_status, raw_tags
  ) VALUES (
    v_subscription.id, p_shopify_order_id, NULLIF(btrim(p_shopify_order_name), ''),
    p_shopify_subscription_contract_id, p_shopify_variant_id, v_normalized_email,
    p_amount, p_currency, p_paid_at, v_payment_number, v_trees_due,
    v_payment_number = 1 AND v_trees_due > 0,
    v_payment_number = 1 AND v_trees_due > 0,
    CASE WHEN v_payment_number = 1 AND v_trees_due > 0 THEN 'pending' ELSE 'not_required' END,
    CASE WHEN v_payment_number = 1 AND v_trees_due > 0 THEN 'pending' ELSE 'not_required' END,
    'pending', p_raw_tags
  ) RETURNING * INTO v_payment;

  IF v_trees_due > 0 THEN
    SELECT COALESCE(array_agg(candidate.id ORDER BY candidate.id), ARRAY[]::integer[])
    INTO v_tree_ids
    FROM (
      SELECT t.id
      FROM public.trees1 t
      WHERE t.user_id IS NULL
        AND t.is_claimed IS NOT TRUE
        AND t.purchase_date IS NULL
        AND t.order_id IS NULL
        AND t.reserved_token IS NULL
        AND t.claimed_at IS NULL
        AND t.unclaimed_user_id IS NULL
        AND t.tree_code IS NOT NULL
        AND t.lat IS NOT NULL
        AND t."long" IS NOT NULL
      ORDER BY t.id
      FOR UPDATE OF t SKIP LOCKED
      LIMIT v_trees_due
    ) candidate;

    IF cardinality(v_tree_ids) <> v_trees_due THEN
      RAISE EXCEPTION 'Insufficient free trees: required %, available %',
        v_trees_due, cardinality(v_tree_ids);
    END IF;

    v_allocation_date := now();
    UPDATE public.trees1 t
    SET user_id = v_user_id,
        is_claimed = true,
        claimed_at = v_allocation_date,
        order_id = p_shopify_order_id,
        purchase_date = p_paid_at AT TIME ZONE 'UTC',
        updated_at = now() AT TIME ZONE 'UTC'
    WHERE t.id = ANY(v_tree_ids);

    INSERT INTO public.shopify_subscription_payment_trees (
      payment_id, tree_id, tree_code, allocated_at
    )
    SELECT v_payment.id, t.id, t.tree_code, v_allocation_date
    FROM public.trees1 t
    WHERE t.id = ANY(v_tree_ids);

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'tree_id', t.id,
      'tree_code', t.tree_code,
      'tree_type', t.tree_type,
      'latitude', t.lat,
      'longitude', t."long"
    ) ORDER BY t.id), '[]'::jsonb)
    INTO v_assigned_trees
    FROM public.trees1 t
    WHERE t.id = ANY(v_tree_ids);
  END IF;

  UPDATE public.shopify_subscription_payments
  SET trees_allocated = v_trees_due,
      status = CASE WHEN v_trees_due = 0 THEN 'no_allocation' ELSE 'allocated' END,
      processed_at = now(),
      updated_at = now()
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  UPDATE public.shopify_tree_subscriptions subscription
  SET shopify_customer_id = COALESCE(NULLIF(btrim(p_shopify_customer_id), ''), shopify_customer_id),
      user_id = v_user_id,
      customer_email = v_normalized_email,
      shopify_product_id = v_variant.shopify_product_id,
      shopify_variant_id = p_shopify_variant_id,
      subscription_amount = p_amount,
      currency = p_currency,
      successful_payment_count = v_payment_number,
      trees_allocated_total = subscription.trees_allocated_total + v_trees_due,
      last_shopify_order_id = p_shopify_order_id,
      last_payment_at = p_paid_at,
      last_allocation_at = CASE WHEN v_trees_due > 0 THEN v_allocation_date ELSE subscription.last_allocation_at END,
      updated_at = now()
  WHERE subscription.id = v_subscription.id
  RETURNING * INTO v_subscription;

  RETURN QUERY SELECT
    true, false, v_payment.shopify_order_id,
    v_payment.shopify_subscription_contract_id, v_payment.shopify_variant_id,
    v_payment.payment_number, v_payment.payment_number = 1,
    v_payment.trees_due, v_payment.trees_allocated,
    v_subscription.trees_allocated_total, v_payment.welcome_required,
    v_payment.certificate_required, v_payment.customer_email,
    v_subscription.user_id, v_payment.processed_at, v_assigned_trees,
    v_payment.certificate_status, v_payment.welcome_email_status,
    v_payment.crm_status;
END;
$$;

COMMENT ON FUNCTION public.process_shopify_subscription_payment(
  text, text, text, text, timestamptz, numeric, text, text, text, text
) IS
  'Atomically records one successful Shopify subscription order, numbers it per contract and allocates all due trees. Duplicate order IDs return the original result.';

CREATE OR REPLACE FUNCTION public.mark_shopify_subscription_payment_side_effect(
  p_shopify_order_id text,
  p_effect text,
  p_status text,
  p_external_id text DEFAULT NULL,
  p_external_url text DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS public.shopify_subscription_payments
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment public.shopify_subscription_payments%ROWTYPE;
BEGIN
  IF p_effect NOT IN ('certificate', 'welcome_email', 'crm') THEN
    RAISE EXCEPTION 'Unknown side effect %', p_effect;
  END IF;
  IF p_status NOT IN ('pending', 'completed', 'failed', 'not_required') THEN
    RAISE EXCEPTION 'Unknown side effect status %', p_status;
  END IF;

  UPDATE public.shopify_subscription_payments
  SET certificate_status = CASE WHEN p_effect = 'certificate' THEN p_status ELSE certificate_status END,
      certificate_external_id = CASE WHEN p_effect = 'certificate' THEN COALESCE(p_external_id, certificate_external_id) ELSE certificate_external_id END,
      certificate_url = CASE WHEN p_effect = 'certificate' THEN COALESCE(p_external_url, certificate_url) ELSE certificate_url END,
      welcome_email_status = CASE WHEN p_effect = 'welcome_email' THEN p_status ELSE welcome_email_status END,
      crm_status = CASE WHEN p_effect = 'crm' THEN p_status ELSE crm_status END,
      error_message = CASE WHEN p_status = 'failed' THEN p_error_message ELSE NULL END,
      updated_at = now()
  WHERE shopify_order_id = btrim(p_shopify_order_id)
  RETURNING * INTO v_payment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown Shopify order %', p_shopify_order_id;
  END IF;

  IF p_effect = 'certificate' AND p_status = 'completed' THEN
    UPDATE public.shopify_tree_subscriptions
    SET welcome_certificate_url = COALESCE(p_external_url, welcome_certificate_url),
        updated_at = now()
    WHERE id = v_payment.subscription_id;
  END IF;

  IF v_payment.certificate_required
     AND (CASE WHEN p_effect = 'certificate' THEN p_status ELSE v_payment.certificate_status END) = 'completed'
     AND (CASE WHEN p_effect = 'welcome_email' THEN p_status ELSE v_payment.welcome_email_status END) = 'completed' THEN
    UPDATE public.shopify_tree_subscriptions
    SET welcome_status = 'completed', updated_at = now()
    WHERE id = v_payment.subscription_id;
  END IF;

  RETURN v_payment;
END;
$$;

COMMENT ON FUNCTION public.mark_shopify_subscription_payment_side_effect(text, text, text, text, text, text) IS
  'Updates retryable Writer, welcome email or CRM state without invoking tree allocation.';

COMMIT;
