-- REVIEW-ONLY configuration for the Waar zijn de bomen campaign.
-- Requires migration 027 first. Safe default: both products remain disabled.
-- Shopify store: planteenboom.nu (EUR)
-- Created as DRAFT products on 2026-10-31. Do not enable until rollout gates pass.

BEGIN;

INSERT INTO public.campaign_products (
  sku, product_id, variant_id, is_test, unit_price, enabled
)
VALUES
  (
    'PNB-WAAR-ZIJN-DE-BOMEN',
    '16155239973194',
    '64172816367946',
    false,
    10.00,
    false
  ),
  (
    'PNB-WAAR-ZIJN-DE-BOMEN-TEST',
    '16155240005962',
    '64172819480906',
    true,
    0.00,
    false
  )
ON CONFLICT (sku) DO UPDATE
SET
  product_id = EXCLUDED.product_id,
  variant_id = EXCLUDED.variant_id,
  is_test = EXCLUDED.is_test,
  unit_price = EXCLUDED.unit_price,
  enabled = false;

COMMIT;
