-- Planned workflow registry/dependencies for Shopify subscription allocations.
-- Repository migration only: do not execute until migration 005 exists in the
-- target monitoring database and the real Zap identity has been confirmed.

BEGIN;

INSERT INTO monitoring.workflow_registry (
  workflow_id, workflow_name, platform, source_system, target_system,
  trigger_description, business_purpose, owner_name, status, risk_level,
  reads_from, writes_to, database_user, connection_name, runbook_file,
  related_automation_registry_flow_name, notes
)
VALUES (
  'shopify_monthly_donation_subscription_payment',
  'Shopify monthly donation subscription payment',
  'Shopify Flow / Zapier',
  'Shopify',
  'PostgreSQL; Zoho Creator; Zoho Writer; e-mailprovider; Zoho CRM',
  'Successful Shopify subscription billing order tagged ptb_subscription and ptb_contract_<id>',
  'Atomically number the contract payment, allocate all due trees and expose retryable first-payment side effects.',
  'Eamonn',
  'planned',
  'medium',
  'Shopify paid order; Shopify Flow tags; shopify_tree_subscription_variants; users1; trees1',
  'shopify_tree_subscriptions; shopify_subscription_payments; shopify_subscription_payment_trees; users1; trees1',
  'zapier_user',
  'Zapier defaultdb connection',
  'docs/shopify_subscription_tree_allocation.md',
  'Shopify monthly donation subscription payment',
  'Replace planned status and add the real Zap ID/name only after a reviewed test-mode Zap exists. Chargebee is not part of this product route.'
)
ON CONFLICT (workflow_id) DO UPDATE
SET workflow_name = EXCLUDED.workflow_name,
    platform = EXCLUDED.platform,
    source_system = EXCLUDED.source_system,
    target_system = EXCLUDED.target_system,
    trigger_description = EXCLUDED.trigger_description,
    business_purpose = EXCLUDED.business_purpose,
    status = EXCLUDED.status,
    risk_level = EXCLUDED.risk_level,
    reads_from = EXCLUDED.reads_from,
    writes_to = EXCLUDED.writes_to,
    database_user = EXCLUDED.database_user,
    connection_name = EXCLUDED.connection_name,
    runbook_file = EXCLUDED.runbook_file,
    related_automation_registry_flow_name = EXCLUDED.related_automation_registry_flow_name,
    notes = EXCLUDED.notes,
    updated_at = now();

INSERT INTO monitoring.workflow_dependencies (
  workflow_id, dependency_order, dependency_type, source_system, target_system,
  trigger_or_input, action_summary, output_summary, reads_from, writes_to,
  uncertainty_level, missing_information, evidence_source
)
SELECT dependency.*
FROM (VALUES
  ('shopify_monthly_donation_subscription_payment', 10, 'trigger', 'Shopify subscriptions', 'Shopify Flow', 'successful billing attempt', 'Tag paid order with ptb_subscription and ptb_contract_<id>', 'tagged paid order', NULL, 'Shopify order tags', 'known', NULL, 'Confirmed Shopify Flow design'),
  ('shopify_monthly_donation_subscription_payment', 20, 'api_read', 'Zapier', 'Shopify', 'paid order ID after delay', 'Get Order by ID and read variant, customer, paid timestamp and tags', 'validated payment payload', 'Shopify order', NULL, 'partial', 'Real Zap ID and final field mappings', 'Implementation request'),
  ('shopify_monthly_donation_subscription_payment', 30, 'database_write', 'Zapier', 'PostgreSQL', 'validated payment payload', 'Call process_shopify_subscription_payment exactly once', 'payment and atomic tree allocation result', 'variant registry; users1; trees1', 'subscription/payment/payment-tree registries; users1; trees1', 'known', NULL, 'docs/sql/011_shopify_subscription_tree_allocation.sql'),
  ('shopify_monthly_donation_subscription_payment', 40, 'document_merge', 'Zapier / Zoho Creator', 'Zoho Writer', 'first payment with certificate_required=true and Assigned_Trees', 'Create one welcome certificate', 'certificate status and URL', NULL, 'external side-effect status', 'partial', 'Writer multi-tree template and callback', 'Existing CertificateJobs workflow evidence'),
  ('shopify_monthly_donation_subscription_payment', 50, 'email_send', 'Zapier / Zoho', 'Customer', 'first payment with welcome_required=true', 'Send welcome email once', 'welcome email status', NULL, 'external side-effect status', 'partial', 'Final provider/send evidence mapping', 'Existing Zoho Mail workflow evidence'),
  ('shopify_monthly_donation_subscription_payment', 60, 'crm_update', 'Zapier', 'Zoho CRM', 'processed payment result', 'Mirror subscription/allocation summary', 'CRM side-effect status', NULL, 'external side-effect status', 'partial', 'Final CRM module and field mapping', 'Implementation request')
) AS dependency(
  workflow_id, dependency_order, dependency_type, source_system, target_system,
  trigger_or_input, action_summary, output_summary, reads_from, writes_to,
  uncertainty_level, missing_information, evidence_source
)
WHERE NOT EXISTS (
  SELECT 1
  FROM monitoring.workflow_dependencies existing
  WHERE existing.workflow_id = dependency.workflow_id
    AND existing.dependency_order = dependency.dependency_order
);

COMMIT;

