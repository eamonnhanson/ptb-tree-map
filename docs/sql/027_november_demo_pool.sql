-- November 2026 demo-site pool using real trees.
-- REVIEW FIRST. This migration is designed to be run once after a production backup.
-- It does NOT create fake trees and does not change normal ownership for demo orders.
--
-- Design:
--   * release exactly 600 trees previously allocated to the specified source email;
--   * preserve every original tree row in an immutable audit table;
--   * reserve 100 of those released real trees as a reusable demo pool;
--   * leave the other 500 as normal free production inventory;
--   * demo Shopify orders (SKU "test") temporarily reserve real demo trees for 24 hours;
--   * demo orders never write user_id/is_claimed/order_id on trees1;
--   * expired demo reservations are reusable automatically.

BEGIN;

ALTER TABLE public.trees1
  ADD COLUMN IF NOT EXISTS demo_pool boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS trees1_demo_pool_available_idx
  ON public.trees1 (demo_pool, id)
  WHERE demo_pool = true
    AND user_id IS NULL
    AND is_claimed IS NOT TRUE
    AND order_id IS NULL
    AND tree_code IS NOT NULL
    AND lat IS NOT NULL
    AND "long" IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.demo_release_batches (
  batch_key text PRIMARY KEY,
  source_email text NOT NULL,
  released_count integer NOT NULL CHECK (released_count > 0),
  demo_count integer NOT NULL CHECK (demo_count >= 0 AND demo_count <= released_count),
  sale_count integer NOT NULL CHECK (sale_count = released_count - demo_count),
  released_at timestamptz NOT NULL DEFAULT now(),
  note text
);

CREATE TABLE IF NOT EXISTS public.tree_allocation_release_audit (
  batch_key text NOT NULL REFERENCES public.demo_release_batches(batch_key),
  tree_id integer NOT NULL REFERENCES public.trees1(id),
  source_email text NOT NULL,
  destination text NOT NULL CHECK (destination IN ('demo_pool', 'sale_pool')),
  original_tree jsonb NOT NULL,
  released_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_key, tree_id)
);

CREATE TABLE IF NOT EXISTS public.demo_orders (
  shopify_order_id text PRIMARY KEY,
  sku text NOT NULL CHECK (sku = 'test'),
  shopify_variant_id text NOT NULL,
  customer_email text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  reserved_until timestamptz NOT NULL,
  CHECK (reserved_until > reserved_at)
);

CREATE TABLE IF NOT EXISTS public.demo_order_trees (
  shopify_order_id text NOT NULL REFERENCES public.demo_orders(shopify_order_id) ON DELETE CASCADE,
  tree_id integer NOT NULL REFERENCES public.trees1(id),
  released_at timestamptz,
  PRIMARY KEY (shopify_order_id, tree_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS demo_order_trees_active_tree_idx
  ON public.demo_order_trees(tree_id)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS demo_orders_email_active_idx
  ON public.demo_orders(lower(customer_email), reserved_until DESC);

CREATE OR REPLACE FUNCTION public.release_expired_demo_reservations()
RETURNS integer
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  released integer;
BEGIN
  UPDATE public.demo_order_trees link
  SET released_at = now()
  FROM public.demo_orders ord
  WHERE link.shopify_order_id = ord.shopify_order_id
    AND link.released_at IS NULL
    AND ord.reserved_until <= now();

  GET DIAGNOSTICS released = ROW_COUNT;
  RETURN released;
END;
$$;

COMMENT ON FUNCTION public.release_expired_demo_reservations() IS
  'Marks expired temporary demo-tree links released. Demo visibility also checks reserved_until, so expiry is effective even before cleanup runs.';

CREATE OR REPLACE FUNCTION public.prepare_november_2026_demo_pool(
  p_source_email text,
  p_confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_batch CONSTANT text := 'november-2026-demo';
  v_ids integer[];
  v_demo_ids integer[];
  v_count integer;
  v_existing public.demo_release_batches%ROWTYPE;
BEGIN
  IF lower(btrim(p_source_email)) <> lower('mark.kirkels@warchild.nl') THEN
    RAISE EXCEPTION 'Unexpected source email';
  END IF;
  IF p_confirmation IS DISTINCT FROM 'RELEASE 600 WAR CHILD TREES FOR NOVEMBER DEMO' THEN
    RAISE EXCEPTION 'Explicit release confirmation required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_batch, 0));

  SELECT * INTO v_existing
  FROM public.demo_release_batches
  WHERE batch_key = v_batch;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'already_prepared',
      'batch_key', v_existing.batch_key,
      'released_count', v_existing.released_count,
      'demo_count', v_existing.demo_count,
      'sale_count', v_existing.sale_count,
      'released_at', v_existing.released_at
    );
  END IF;

  SELECT array_agg(candidate.id ORDER BY candidate.id)
  INTO v_ids
  FROM (
    SELECT t.id
    FROM public.trees1 t
    JOIN public.users1 u ON u.id = t.user_id
    WHERE lower(btrim(u.email)) = lower(btrim(p_source_email))
      AND COALESCE((to_jsonb(t)->>'is_test')::boolean, false) = false
    ORDER BY t.id
    FOR UPDATE OF t
    LIMIT 600
  ) candidate;

  v_count := COALESCE(cardinality(v_ids), 0);
  IF v_count < 600 THEN
    RAISE EXCEPTION 'Source user has only % directly allocated production trees; 600 required', v_count;
  END IF;

  v_demo_ids := v_ids[1:100];

  INSERT INTO public.demo_release_batches(
    batch_key, source_email, released_count, demo_count, sale_count, note
  ) VALUES (
    v_batch, lower(btrim(p_source_email)), 600, 100, 500,
    'Authorised November 2026 demo-site reallocation: 100 reusable demo trees, 500 returned to sale inventory'
  );

  INSERT INTO public.tree_allocation_release_audit(
    batch_key, tree_id, source_email, destination, original_tree
  )
  SELECT
    v_batch,
    t.id,
    lower(btrim(p_source_email)),
    CASE WHEN ordinality <= 100 THEN 'demo_pool' ELSE 'sale_pool' END,
    to_jsonb(t)
  FROM unnest(v_ids) WITH ORDINALITY picked(id, ordinality)
  JOIN public.trees1 t ON t.id = picked.id;

  UPDATE public.trees1 t
  SET user_id = NULL,
      is_claimed = false,
      claimed_at = NULL,
      order_id = NULL,
      tree_name = NULL,
      demo_pool = (t.id = ANY(v_demo_ids)),
      updated_at = now() AT TIME ZONE 'UTC'
  WHERE t.id = ANY(v_ids);

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='trees1' AND column_name='purchase_date'
  ) THEN
    EXECUTE 'UPDATE public.trees1 SET purchase_date = NULL WHERE id = ANY($1)' USING v_ids;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='trees1' AND column_name='reserved_token'
  ) THEN
    EXECUTE 'UPDATE public.trees1 SET reserved_token = NULL WHERE id = ANY($1)' USING v_ids;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='trees1' AND column_name='claimed_token'
  ) THEN
    EXECUTE 'UPDATE public.trees1 SET claimed_token = NULL WHERE id = ANY($1)' USING v_ids;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='trees1' AND column_name='unclaimed_user_id'
  ) THEN
    EXECUTE 'UPDATE public.trees1 SET unclaimed_user_id = NULL WHERE id = ANY($1)' USING v_ids;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='trees1' AND column_name='source_sku'
  ) THEN
    EXECUTE 'UPDATE public.trees1 SET source_sku = NULL WHERE id = ANY($1)' USING v_ids;
  END IF;

  RETURN jsonb_build_object(
    'status', 'prepared',
    'batch_key', v_batch,
    'released_count', 600,
    'demo_count', 100,
    'sale_count', 500,
    'source_email', lower(btrim(p_source_email))
  );
END;
$$;

COMMENT ON FUNCTION public.prepare_november_2026_demo_pool(text,text) IS
  'One-time, audited release of 600 trees from the authorised War Child allocation. 100 become reusable demo pool; 500 become normal sale inventory.';

CREATE OR REPLACE FUNCTION public.allocate_demo_order(
  p_shopify_order_id text,
  p_sku text,
  p_shopify_variant_id text,
  p_customer_email text,
  p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order public.demo_orders%ROWTYPE;
  v_tree_ids integer[];
  v_result jsonb;
  v_reserved_until timestamptz;
BEGIN
  p_shopify_order_id := btrim(p_shopify_order_id);
  p_sku := lower(btrim(p_sku));
  p_shopify_variant_id := btrim(p_shopify_variant_id);
  p_customer_email := lower(btrim(p_customer_email));

  IF p_shopify_order_id IS NULL OR p_shopify_order_id !~ '^[0-9]{1,30}$' THEN
    RAISE EXCEPTION 'Invalid Shopify order id';
  END IF;
  IF p_sku IS DISTINCT FROM 'test' THEN
    RAISE EXCEPTION 'Invalid demo SKU';
  END IF;
  IF p_shopify_variant_id IS DISTINCT FROM '64172819480906' THEN
    RAISE EXCEPTION 'Invalid demo variant';
  END IF;
  IF p_customer_email IS NULL OR p_customer_email = '' THEN
    RAISE EXCEPTION 'Customer email required';
  END IF;
  IF p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Demo quantity must be between 1 and 10';
  END IF;

  PERFORM public.release_expired_demo_reservations();
  PERFORM pg_advisory_xact_lock(hashtextextended('demo-order:' || p_shopify_order_id, 0));

  SELECT * INTO v_order
  FROM public.demo_orders
  WHERE shopify_order_id = p_shopify_order_id;

  IF FOUND THEN
    IF v_order.sku <> p_sku
       OR v_order.shopify_variant_id <> p_shopify_variant_id
       OR v_order.customer_email <> p_customer_email
       OR v_order.quantity <> p_quantity THEN
      RAISE EXCEPTION 'Conflicting demo order replay';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'tree_id', t.id,
      'tree_code', t.tree_code,
      'tree_type', t.tree_type,
      'latitude', t.lat,
      'longitude', t."long",
      'area', t.area,
      'planted_date', t.planted_date,
      'is_demo', true,
      'demo_expires_at', v_order.reserved_until
    ) ORDER BY t.id), '[]'::jsonb)
    INTO v_result
    FROM public.demo_order_trees link
    JOIN public.trees1 t ON t.id = link.tree_id
    WHERE link.shopify_order_id = p_shopify_order_id;

    RETURN jsonb_build_object(
      'duplicate', true,
      'shopify_order_id', p_shopify_order_id,
      'reserved_until', v_order.reserved_until,
      'assigned_trees', v_result
    );
  END IF;

  SELECT COALESCE(array_agg(candidate.id ORDER BY candidate.id), ARRAY[]::integer[])
  INTO v_tree_ids
  FROM (
    SELECT t.id
    FROM public.trees1 t
    WHERE t.demo_pool = true
      AND t.user_id IS NULL
      AND t.is_claimed IS NOT TRUE
      AND t.order_id IS NULL
      AND COALESCE((to_jsonb(t)->>'purchase_date'), '') = ''
      AND COALESCE((to_jsonb(t)->>'reserved_token'), '') = ''
      AND t.claimed_at IS NULL
      AND COALESCE((to_jsonb(t)->>'unclaimed_user_id'), '') = ''
      AND t.tree_code IS NOT NULL
      AND t.lat IS NOT NULL
      AND t."long" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.demo_order_trees active_link
        WHERE active_link.tree_id = t.id
          AND active_link.released_at IS NULL
      )
    ORDER BY t.id
    FOR UPDATE OF t SKIP LOCKED
    LIMIT p_quantity
  ) candidate;

  IF cardinality(v_tree_ids) <> p_quantity THEN
    RAISE EXCEPTION 'DEMO_POOL_EMPTY';
  END IF;

  v_reserved_until := now() + interval '24 hours';

  INSERT INTO public.demo_orders(
    shopify_order_id, sku, shopify_variant_id, customer_email,
    quantity, reserved_at, reserved_until
  ) VALUES (
    p_shopify_order_id, p_sku, p_shopify_variant_id, p_customer_email,
    p_quantity, now(), v_reserved_until
  );

  INSERT INTO public.demo_order_trees(shopify_order_id, tree_id)
  SELECT p_shopify_order_id, unnest(v_tree_ids);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'tree_id', t.id,
    'tree_code', t.tree_code,
    'tree_type', t.tree_type,
    'latitude', t.lat,
    'longitude', t."long",
    'area', t.area,
    'planted_date', t.planted_date,
    'is_demo', true,
    'demo_expires_at', v_reserved_until
  ) ORDER BY t.id), '[]'::jsonb)
  INTO v_result
  FROM public.trees1 t
  WHERE t.id = ANY(v_tree_ids);

  RETURN jsonb_build_object(
    'duplicate', false,
    'shopify_order_id', p_shopify_order_id,
    'reserved_until', v_reserved_until,
    'assigned_trees', v_result
  );
END;
$$;

COMMENT ON FUNCTION public.allocate_demo_order(text,text,text,text,integer) IS
  'Temporarily reserves 1-10 real demo-pool trees for 24 hours for Shopify SKU test. Does not mutate real ownership fields on trees1.';

COMMIT;
