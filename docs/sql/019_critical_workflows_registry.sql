-- Registry-first dashboard integration for the three critical workflows.
-- Repository migration only. This file does not prove deployment or live state.
-- Apply only to ptb_monitoring_test after migrations 005, 011, 013 and 014
-- have been reviewed. It does not change production business data.

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'ptb_monitoring_test' THEN
    RAISE EXCEPTION 'Expected ptb_monitoring_test, got %', current_database();
  END IF;
END
$$;

INSERT INTO monitoring.workflow_registry (
  workflow_id, workflow_name, platform, source_system, target_system,
  trigger_description, business_purpose, owner_name, status, risk_level,
  reads_from, writes_to, database_user, connection_name, runbook_file,
  related_automation_registry_flow_name, notes
)
VALUES
  (
    'zap_95', 'Chargebee payment to PostgreSQL MVP', 'Zapier', 'Chargebee',
    'PostgreSQL; Zoho Mail; Zoho Writer', 'New Payment followed by Find Existing Subscription',
    'Validate a Chargebee invoice line, process its payment atomically, then execute only required allocation or first-payment side effects.',
    'Eamonn', 'partially_audited', 'high',
    'Chargebee payment and subscription; chargebee_subscription_plans; users1; trees1',
    'chargebee_tree_subscriptions; chargebee_subscription_billing_periods; chargebee_subscription_payments; chargebee_subscription_payment_trees; users1; trees1',
    'zapier_user', 'Zapier defaultdb connection',
    'docs/chargebee_subscription_payment_allocation.md', 'Nieuw abonnes chargebee REVERTED',
    'PostgreSQL migration 014 is review-only and does not prove deployment or live Zap status.'
  ),
  (
    'shopify_monthly_donation_subscription_payment', 'Shopify subscriptions to tree allocation',
    'Shopify Flow / Zapier', 'Shopify', 'PostgreSQL; Zoho Creator; Zoho Writer; e-mailprovider; Zoho CRM',
    'Successful Shopify subscription billing order tagged with subscription contract identity',
    'Atomically number each paid contract order, allocate all due trees and expose retryable side effects.',
    'Eamonn', 'partially_audited', 'high',
    'Shopify paid order; shopify_tree_subscription_variants; users1; trees1',
    'shopify_tree_subscriptions; shopify_subscription_payments; shopify_subscription_payment_trees; users1; trees1',
    'zapier_user', 'Zapier defaultdb connection', 'docs/shopify_subscription_tree_allocation.md',
    'Shopify monthly donation subscription payment',
    'PostgreSQL migration 011 is review-only; the real Zap identity, deployment and live state remain unverified.'
  ),
  (
    'zap_175', 'Zoho CRM Academy onboarding → PostgreSQL', 'Zapier', 'Zoho CRM',
    'PostgreSQL; Zoho CRM; Zoho Mail', 'New or updated Zoho CRM contact',
    'Create or update Academy onboarding data, mirror identifiers/status in CRM and send the onboarding invitation.',
    'Eamonn', 'partially_audited', 'high',
    'Zoho CRM contact; academy_students',
    'academy_students; Zoho CRM onboarding fields; Zoho Mail outbound; academy_onboarding_completions',
    'zapier_user', 'Zapier defaultdb connection', 'docs/zapier_postgresql_completion_steps.md',
    'Zoho CRM Academy onboarding → PostgreSQL',
    'The production Zap and completion layer exist. Keep dashboard status ORANGE until a new successful post-change runtime completion is demonstrated.'
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

DELETE FROM monitoring.workflow_dependencies
WHERE workflow_id = 'zap_175';

INSERT INTO monitoring.workflow_dependencies (
  workflow_id, dependency_order, dependency_type, source_system, target_system,
  trigger_or_input, action_summary, output_summary, reads_from, writes_to,
  uncertainty_level, missing_information, evidence_source
)
SELECT dependency.*
FROM (VALUES
  ('zap_95', 10, 'trigger', 'Chargebee', 'Zapier', 'New Payment', 'Receive the payment event', 'Chargebee payment payload', 'Chargebee payment', NULL, 'partial', 'Live Zap version and active state', 'User-supplied reviewed workflow structure'),
  ('zap_95', 20, 'api_read', 'Zapier', 'Chargebee', 'Payment subscription identity', 'Find Existing Subscription', 'Chargebee subscription payload', 'Chargebee subscription', NULL, 'partial', 'Final field mapping', 'User-supplied reviewed workflow structure'),
  ('zap_95', 30, 'validation', 'Code by Zapier', 'Zapier', 'Invoice line item', 'Validate the invoice line item', 'Validated plan and billing-period input', 'Invoice line item', NULL, 'partial', 'Validator source and fixtures', 'User-supplied reviewed workflow structure'),
  ('zap_95', 40, 'database_write', 'Zapier', 'PostgreSQL', 'Validated Chargebee payment and subscription', 'Call process_chargebee_subscription_payment', 'Idempotent payment, billing period and tree-allocation result', 'chargebee_subscription_plans; users1; trees1', 'chargebee_tree_subscriptions; chargebee_subscription_billing_periods; chargebee_subscription_payments; chargebee_subscription_payment_trees; users1; trees1', 'known', 'Migration is not deployed by this registry file', 'docs/sql/014_chargebee_subscription_payment_allocation.sql'),
  ('zap_95', 50, 'branch', 'Zapier', 'Zapier Paths', 'PostgreSQL processor result', 'Split into allocation-notification and initial-side-effect paths', 'Selected business path', NULL, NULL, 'partial', 'Final path predicates', 'User-supplied reviewed workflow structure'),
  ('zap_95', 60, 'filter', 'Zapier Path A', 'Zoho Mail', 'Allocation-notification flags', 'Apply Path A conditions', 'Eligible allocation notification', NULL, NULL, 'partial', 'Exact predicate mapping', 'User-supplied reviewed workflow structure'),
  ('zap_95', 70, 'email_send', 'Zapier Path A', 'Zoho Mail', 'Eligible allocation result', 'Send allocation notification', 'Submitted allocation notification', NULL, 'chargebee_subscription_payments side-effect evidence not yet mapped', 'partial', 'Provider message ID and status mapping', 'User-supplied reviewed workflow structure'),
  ('zap_95', 80, 'filter', 'Zapier Path B', 'Code by Zapier', 'Initial-side-effect flags', 'Apply Path B conditions', 'Eligible first-payment side effects', NULL, NULL, 'partial', 'Exact predicate mapping', 'User-supplied reviewed workflow structure'),
  ('zap_95', 90, 'data_transform', 'Code by Zapier', 'Zoho Writer', 'Eligible first-payment result', 'Prepare Writer merge input', 'Validated merge payload', 'Assigned tree result', NULL, 'partial', 'Python source and output contract', 'User-supplied reviewed workflow structure'),
  ('zap_95', 100, 'document_merge', 'Zapier Path B', 'Zoho Writer', 'Validated merge payload', 'Merge template and send email', 'Writer merge/send result', NULL, 'chargebee_subscription_payments side-effect evidence', 'partial', 'Template identity, message ID and final delivery semantics', 'User-supplied reviewed workflow structure'),
  ('zap_95', 110, 'database_write', 'Zapier Path B', 'PostgreSQL', 'Successful Writer result', 'Call mark_chargebee_subscription_payment_side_effect', 'Persisted terminal side-effect status', 'chargebee_subscription_payments', 'chargebee_subscription_payments', 'known', 'Migration is not deployed by this registry file', 'docs/sql/014_chargebee_subscription_payment_allocation.sql'),

  ('zap_175', 10, 'trigger', 'Zoho CRM', 'Zapier', 'New or updated contact', 'Receive contact change', 'Zoho CRM contact payload', 'Zoho CRM contact', NULL, 'partial', 'Live trigger configuration and active state', 'docs/zapier_postgresql_completion_steps.md'),
  ('zap_175', 20, 'filter', 'Zapier', 'PostgreSQL', 'Zoho CRM contact payload', 'Apply Academy onboarding filter', 'Eligible onboarding contact', NULL, NULL, 'partial', 'Exact filter fields and ownership', 'docs/zapier_postgresql_completion_steps.md'),
  ('zap_175', 30, 'database_write', 'Zapier', 'PostgreSQL', 'Eligible onboarding contact', 'Call process_academy_student_from_crm with p_test_mode FALSE', 'Academy student ID, KETSO student ID, upload token, onboarding URL, automation status and message', 'academy_students', 'academy_students', 'known', 'Production-equivalent function is source-controlled; runtime behavior still requires post-change evidence', 'docs/sql/021_process_academy_student_from_crm.sql'),
  ('zap_175', 40, 'crm_update', 'Zapier', 'Zoho CRM', 'PostgreSQL onboarding result', 'Write student ID, URL and automation status', 'Updated CRM contact', NULL, 'Zoho CRM onboarding fields', 'partial', 'CRM field ownership and exact mapping', 'docs/zapier_postgresql_completion_steps.md'),
  ('zap_175', 50, 'email_send', 'Zapier', 'Zoho Mail', 'Updated onboarding contact', 'Send onboarding invitation', 'Submitted onboarding email', NULL, NULL, 'partial', 'Outbound message ID and delivery semantics', 'docs/zapier_postgresql_completion_steps.md'),
  ('zap_175', 60, 'crm_update', 'Zapier', 'Zoho CRM', 'Mail action result', 'Update invite status and date', 'Final CRM invite markers', NULL, 'Zoho CRM invite fields', 'partial', 'Retry behavior and failure reconciliation', 'docs/zapier_postgresql_completion_steps.md'),
  ('zap_175', 70, 'database_write', 'Zapier', 'PostgreSQL', 'Successful final CRM update', 'Call complete_academy_onboarding', 'One idempotent completion record proving all preceding business actions succeeded', 'academy_students; academy_onboarding_completions', 'academy_onboarding_completions', 'known', 'No new successful post-change runtime completion has yet been demonstrated; completion does not prove inbox delivery', 'docs/sql/020_academy_onboarding_completion.sql')
) AS dependency(
  workflow_id, dependency_order, dependency_type, source_system, target_system,
  trigger_or_input, action_summary, output_summary, reads_from, writes_to,
  uncertainty_level, missing_information, evidence_source
)
WHERE NOT EXISTS (
  SELECT 1 FROM monitoring.workflow_dependencies existing
  WHERE existing.workflow_id = dependency.workflow_id
    AND existing.dependency_order = dependency.dependency_order
);

COMMIT;
