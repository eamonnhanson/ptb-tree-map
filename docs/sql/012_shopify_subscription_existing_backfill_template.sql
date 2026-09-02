-- CONTROLLED TEMPLATE ONLY — DO NOT EXECUTE UNTIL EVERY placeholder has been
-- replaced with values verified from Shopify orders/contracts and PostgreSQL.
-- Keep ROLLBACK during review. This template intentionally contains no known
-- customer email, guessed payment count or assumed production contract.

BEGIN;

-- Required manual evidence per contract:
-- contract_id, Shopify customer id, normalized email, product/variant id,
-- start timestamp, every successful historic order id + paid_at + amount,
-- successful payment count, trees already allocated to those payments,
-- welcome/certificate completion, last order and last payment timestamp.

DO $$
BEGIN
  RAISE EXCEPTION
    'Safety stop: copy this template to a reviewed change script and remove this guard only after historical reconciliation';
END
$$;

-- Recommended approach after review:
-- 1. Insert the contract with the CONFIRMED historic counters.
-- 2. Insert one payment row for every CONFIRMED successful historic order.
-- 3. Link already allocated trees in shopify_subscription_payment_trees.
-- 4. Reconcile counts using the control queries below.
--
-- INSERT INTO public.shopify_tree_subscriptions (...)
-- VALUES (...)
-- ON CONFLICT (shopify_subscription_contract_id) DO NOTHING;
--
-- Never call process_shopify_subscription_payment for old orders unless it is
-- intended and verified that those old orders still need a new tree allocation.

SELECT
  s.shopify_subscription_contract_id,
  s.successful_payment_count,
  count(DISTINCT p.id) AS registered_payments,
  s.trees_allocated_total,
  count(link.tree_id) AS linked_trees
FROM public.shopify_tree_subscriptions s
LEFT JOIN public.shopify_subscription_payments p ON p.subscription_id = s.id
LEFT JOIN public.shopify_subscription_payment_trees link ON link.payment_id = p.id
GROUP BY s.id, s.shopify_subscription_contract_id,
  s.successful_payment_count, s.trees_allocated_total;

ROLLBACK;

