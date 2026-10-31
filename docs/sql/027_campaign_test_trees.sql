-- Review and apply to an isolated database first. No seed data is created here.
BEGIN;
ALTER TABLE public.trees1 ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.trees1 ADD COLUMN IF NOT EXISTS source_sku text;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_attrdef d
  ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  WHERE a.attrelid='public.trees1'::regclass AND a.attname='is_test'
  AND a.atttypid='boolean'::regtype AND a.attnotnull
  AND pg_catalog.pg_get_expr(d.adbin,d.adrelid)='false') THEN
  RAISE EXCEPTION 'trees1.is_test must be boolean NOT NULL DEFAULT false; review incompatible schema';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
  WHERE conrelid = 'public.trees1'::regclass AND conname = 'campaign_test_code') THEN
  ALTER TABLE public.trees1 ADD CONSTRAINT campaign_test_code CHECK (
 (is_test = true AND tree_code IS NOT NULL AND tree_code LIKE 'TEST-WZDB-%') OR
 (is_test = false AND COALESCE(tree_code, '') NOT LIKE 'TEST-WZDB-%')
) NOT VALID;
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.campaign_products (
 sku text PRIMARY KEY, product_id text NOT NULL, variant_id text UNIQUE NOT NULL,
 is_test boolean NOT NULL, unit_price numeric(12,2) NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 CHECK ((is_test AND sku = 'PNB-WAAR-ZIJN-DE-BOMEN-TEST' AND unit_price = 0)
 OR (NOT is_test AND sku = 'PNB-WAAR-ZIJN-DE-BOMEN' AND unit_price > 0))
);
CREATE INDEX IF NOT EXISTS trees1_campaign_free_pool_idx ON public.trees1(is_test, id)
 WHERE user_id IS NULL AND is_claimed IS NOT TRUE AND purchase_date IS NULL
 AND order_id IS NULL AND reserved_token IS NULL AND claimed_at IS NULL
 AND unclaimed_user_id IS NULL AND tree_code IS NOT NULL AND lat IS NOT NULL AND "long" IS NOT NULL;
CREATE INDEX IF NOT EXISTS trees1_campaign_order_idx ON public.trees1(order_id) WHERE order_id IS NOT NULL;
-- Populate registry only with verified Shopify IDs and normal tree price; no guessed defaults.
CREATE TABLE IF NOT EXISTS public.campaign_orders (
 order_id text PRIMARY KEY, sku text NOT NULL REFERENCES public.campaign_products(sku),
 is_test boolean NOT NULL, user_id integer NOT NULL REFERENCES public.users1(id),
 quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 100),
 customer_email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 tree_ids integer[] NOT NULL DEFAULT '{}'
);
REVOKE ALL ON public.campaign_orders FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.allocate_campaign_order(
 p_order_id text, p_sku text, p_product_id text, p_variant_id text,
 p_quantity integer, p_unit_price numeric, p_currency text, p_email text
) RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE policy public.campaign_products%ROWTYPE; previous public.campaign_orders%ROWTYPE;
 ids integer[]; uid integer; result jsonb;
BEGIN
 IF p_order_id IS NULL OR p_order_id !~ '^[0-9]{1,30}$'
 OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 100
 OR p_email IS NULL OR btrim(p_email) = '' THEN
  RAISE EXCEPTION 'Invalid campaign order';
 END IF;
 SELECT * INTO policy FROM public.campaign_products WHERE sku = p_sku AND enabled FOR SHARE;
 IF NOT FOUND OR p_product_id IS DISTINCT FROM policy.product_id
 OR p_variant_id IS DISTINCT FROM policy.variant_id
 OR p_unit_price IS DISTINCT FROM policy.unit_price OR p_currency IS DISTINCT FROM 'EUR' THEN
  RAISE EXCEPTION 'Unknown campaign identity or invalid price/currency';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('shopify-order:' || p_order_id, 0));
 SELECT * INTO previous FROM public.campaign_orders WHERE order_id = p_order_id;
 IF FOUND THEN
  IF previous.is_test <> policy.is_test OR previous.sku <> p_sku OR previous.quantity <> p_quantity
   OR previous.customer_email <> lower(btrim(p_email)) THEN
   RAISE EXCEPTION 'Conflicting campaign order replay';
  END IF;
  ids := previous.tree_ids;
 ELSE
  IF EXISTS (SELECT 1 FROM public.trees1 WHERE order_id = p_order_id) THEN
   RAISE EXCEPTION 'Order already allocated by another workflow';
  END IF;
  SELECT array_agg(id) INTO ids FROM (
   SELECT t.id FROM public.trees1 t
   WHERE t.is_test = policy.is_test AND t.user_id IS NULL
    AND t.is_claimed IS NOT TRUE AND t.purchase_date IS NULL AND t.order_id IS NULL
    AND t.reserved_token IS NULL AND t.claimed_at IS NULL AND t.unclaimed_user_id IS NULL
    AND t.tree_code IS NOT NULL AND t.lat IS NOT NULL AND t."long" IS NOT NULL
   ORDER BY t.id FOR UPDATE OF t SKIP LOCKED LIMIT p_quantity
  ) candidates;
  IF coalesce(cardinality(ids), 0) <> p_quantity THEN
   IF policy.is_test THEN RAISE EXCEPTION 'TEST_POOL_EMPTY';
   ELSE RAISE EXCEPTION 'PRODUCTION_POOL_EMPTY'; END IF;
  END IF;
  INSERT INTO public.users1(email, created_at, updated_at)
   VALUES (lower(btrim(p_email)), now(), now())
   ON CONFLICT (email) DO UPDATE SET updated_at = now() RETURNING id INTO uid;
  INSERT INTO public.campaign_orders(order_id, sku, is_test, user_id, quantity, customer_email, tree_ids)
   VALUES(p_order_id, p_sku, policy.is_test, uid, p_quantity, lower(btrim(p_email)), ids);
  UPDATE public.trees1 SET user_id = uid, order_id = p_order_id, source_sku = p_sku,
   is_claimed = true, claimed_at = now(), purchase_date = now() AT TIME ZONE 'UTC',
   updated_at = now() AT TIME ZONE 'UTC' WHERE id = ANY(ids) AND is_test = policy.is_test;
 END IF;
 SELECT jsonb_agg(jsonb_build_object('tree_id', id, 'tree_code', tree_code,
  'tree_type', tree_type, 'latitude', lat, 'longitude', "long", 'is_test', is_test,
  'warning', CASE WHEN is_test THEN 'TEST TREE – not a real planted tree' END))
 INTO result FROM public.trees1 WHERE id = ANY(ids);
 RAISE LOG '%', jsonb_build_object(
  'allocation_environment', CASE WHEN policy.is_test THEN 'TEST' ELSE 'PRODUCTION' END,
  'order_id', p_order_id, 'sku', p_sku, 'tree_ids', ids,
  'tree_codes', (SELECT array_agg(tree_code) FROM public.trees1 WHERE id = ANY(ids)),
  'result', CASE WHEN previous.order_id IS NOT NULL THEN 'REPLAY' ELSE 'ALLOCATED' END);
 RETURN jsonb_build_object('order_id', p_order_id, 'sku', p_sku, 'is_test', policy.is_test,
  'user_id', COALESCE(previous.user_id, uid),
  'duplicate', previous.order_id IS NOT NULL, 'assigned_trees', result);
EXCEPTION WHEN OTHERS THEN
 RAISE LOG '%', jsonb_build_object(
  'allocation_environment', CASE WHEN policy.is_test THEN 'TEST'
   WHEN policy.is_test = false THEN 'PRODUCTION' ELSE 'UNCLASSIFIED' END,
  'order_id', p_order_id, 'sku', p_sku, 'tree_ids', ARRAY[]::integer[],
  'tree_codes', ARRAY[]::text[], 'result', CASE WHEN SQLERRM IN ('TEST_POOL_EMPTY','PRODUCTION_POOL_EMPTY')
   THEN SQLERRM ELSE 'FAILED' END, 'sqlstate', SQLSTATE);
 RAISE;
END;
$$;
REVOKE ALL ON FUNCTION public.allocate_campaign_order(text,text,text,text,integer,numeric,text,text) FROM PUBLIC;

-- Legacy direct SQL must never allocate fake trees. Fail closed rather than fall back.
-- Definer only for this read-only guard: legacy writers need no ledger privileges.
CREATE OR REPLACE FUNCTION public.guard_campaign_test_tree() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.is_test IS DISTINCT FROM OLD.is_test THEN
  RAISE EXCEPTION 'Tree pool classification is immutable';
 END IF;
 IF EXISTS (SELECT 1 FROM public.campaign_orders o WHERE o.order_id = NEW.order_id
  AND (o.is_test IS DISTINCT FROM NEW.is_test OR NOT (NEW.id = ANY(o.tree_ids)))) THEN
  RAISE EXCEPTION 'Campaign order cannot cross tree pools or add unregistered trees';
 END IF;
 IF NEW.source_sku = 'PNB-WAAR-ZIJN-DE-BOMEN-TEST' AND NOT NEW.is_test THEN
  RAISE EXCEPTION 'Test SKU cannot allocate production trees';
 END IF;
 IF NEW.is_test AND (NEW.user_id IS NOT NULL OR NEW.order_id IS NOT NULL OR NEW.is_claimed IS TRUE
  OR NEW.reserved_token IS NOT NULL OR NEW.unclaimed_user_id IS NOT NULL
  OR NEW.purchase_date IS NOT NULL OR NEW.claimed_at IS NOT NULL
  OR (to_jsonb(NEW)->>'claimed_token') IS NOT NULL) THEN
  IF NOT EXISTS (SELECT 1 FROM public.campaign_orders o WHERE o.is_test
   AND o.order_id = NEW.order_id AND o.user_id = NEW.user_id
   AND o.sku = NEW.source_sku AND NEW.id = ANY(o.tree_ids)) THEN
   RAISE EXCEPTION 'Test tree allocation requires a matching campaign order';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.trees1'::regclass
  AND tgname = 'guard_campaign_test_tree') THEN
  CREATE TRIGGER guard_campaign_test_tree BEFORE INSERT OR UPDATE ON public.trees1
 FOR EACH ROW EXECUTE FUNCTION public.guard_campaign_test_tree();
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.guard_campaign_test_tree() FROM PUBLIC;

-- Replenishment avoids resetting history, claims, users or production trees.
-- Owner-only: grant to a dedicated authenticated maintenance role if needed.
CREATE OR REPLACE FUNCTION public.replenish_campaign_test_pool(p_confirmation text, p_count integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE start_number integer;
BEGIN
 IF p_confirmation IS DISTINCT FROM 'CREATE FAKE WZDB TREES' OR p_count IS NULL OR p_count NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'Explicit confirmation and count 1..100 required';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.campaign_products WHERE is_test AND enabled) THEN
  RAISE EXCEPTION 'Test campaign disabled: complete external allocation/reporting audit first';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('wzdb-test-seed',0));
 SELECT coalesce(max(substring(tree_code from '^TEST-WZDB-([0-9]+)$')::integer),0)
 INTO start_number FROM public.trees1 WHERE is_test = true;
 INSERT INTO public.trees1(tree_code, tree_type, area, lat, "long", is_test, is_claimed)
 SELECT 'TEST-WZDB-' || lpad((start_number+n)::text,8,'0'),
  'TEST TREE – not a real planted tree', 'TEST ONLY – synthetic ocean cluster',
  0 + n * 0.00001, -30 + n * 0.00001, true, false
 FROM generate_series(1,p_count) n;
 RETURN p_count;
END;
$$;
REVOKE ALL ON FUNCTION public.replenish_campaign_test_pool(text,integer) FROM PUBLIC;
COMMIT;
