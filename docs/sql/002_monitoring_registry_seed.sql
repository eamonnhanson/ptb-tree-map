-- Safe test seed for monitoring.automation_registry.
-- Target database: ptb_monitoring_test only.
--
-- Source:
--   docs/master_workflow_registry.csv
--
-- Safety rules:
--   - Do not run against production.
--   - This script only inserts into monitoring.automation_registry.
--   - Run first with the ROLLBACK at the bottom.
--   - Review the count and inserted-record output.
--   - Only after review, manually replace the final ROLLBACK with COMMIT.
--   - Do not add secrets to this file.
--
-- Duplicate avoidance:
--   monitoring.automation_registry has no unique constraint in
--   docs/sql/001_monitoring_datamodel.sql, so ON CONFLICT cannot be used
--   safely here. This seed avoids duplicates with NOT EXISTS on
--   flow_name + category.

BEGIN;

-- Safety check: this must return ptb_monitoring_test.
SELECT
  current_database() AS database_name,
  CASE
    WHEN current_database() = 'ptb_monitoring_test'
      THEN 'OK: test database'
    ELSE 'STOP: wrong database, rollback immediately'
  END AS safety_check;

-- Control query: current registry count before insert.
SELECT
  count(*)::int AS registry_count_before_insert
FROM monitoring.automation_registry;

-- Candidate duplicate preview. Rows here will be skipped by the insert.
WITH seed(flow_name, category) AS (
  VALUES
    ('IMCD_NL_TreeCert_Postgres', 'certificate/tree allocation'),
    ('IMCD_BEL_TreeCert_Postgres', 'certificate/tree allocation'),
    ('zap a multipleEigenbomenShopifyToPostgreSQL (SKU 02)', 'shopify/tree purchase'),
    ('zap a- Shopify -> Tokenized Gift Tree Link (SKU 01)', 'shopify/tree purchase'),
    ('ZAP B', 'other'),
    ('Nieuw abonnes chargebee REVERTED', 'subscription'),
    ('Monthly Tree Report', 'reporting'),
    ('Send Forest Hero Photo Email (once per user/ p/h) - Forest Photo 2025Q4 - Eenmalige e-mail', 'outbound photo email'),
    ('(Copy) zap b multiple Eigenbomen SKU02', 'shopify/tree purchase'),
    ('Nieuw abonnes shopify handmatig - zoho form', 'shopify/tree purchase'),
    ('Webhooks by Zapier', 'other'),
    ('Trigger: New or Updated Contact in Zoho CRM', 'academy/onboarding')
)
SELECT
  seed.flow_name,
  seed.category,
  registry.id AS existing_registry_id
FROM seed
JOIN monitoring.automation_registry registry
  ON registry.flow_name = seed.flow_name
 AND registry.category = seed.category
ORDER BY seed.category, seed.flow_name;

-- Seed insert.
-- The current_database() predicate prevents inserts outside ptb_monitoring_test.
WITH seed(
  workflow_id,
  flow_name,
  category,
  status,
  trigger_description,
  systems_used,
  technical_summary,
  notes
) AS (
  VALUES
    (
      'zap_1',
      'IMCD_NL_TreeCert_Postgres',
      'certificate/tree allocation',
      'partially_audited',
      'ZohoForms: new_form_entry',
      ARRAY['ZohoForms', 'PostgreSQL', 'BranchingAPI', 'ZohoCreator'],
      'Allocate tree/certificate record from Zoho Form submission. Evidence source: Zapier export/history.',
      'Risk: low. Open question: Verify production active/paused state and whether final customer-visible evidence is complete. Notes: standardized final workflow/audit log row.'
    ),
    (
      'zap_15',
      'IMCD_BEL_TreeCert_Postgres',
      'certificate/tree allocation',
      'partially_audited',
      'ZohoForms: new_form_entry',
      ARRAY['ZohoForms', 'PostgreSQL', 'BranchingAPI', 'ZohoCreator'],
      'Allocate tree/certificate record from Zoho Form submission. Evidence source: Zapier export/history.',
      'Risk: low. Open question: Verify production active/paused state and whether final customer-visible evidence is complete. Notes: standardized final workflow/audit log row.'
    ),
    (
      'zap_29',
      'zap a multipleEigenbomenShopifyToPostgreSQL (SKU 02)',
      'shopify/tree purchase',
      'partially_audited',
      'Shopify: new_paid_order_v3',
      ARRAY['Shopify', 'FilterAPI', 'PostgreSQL', 'Code', 'ZapierLooping', 'BranchingAPI', 'ZohoCreator'],
      'Allocate owned tree purchase to PostgreSQL and create Zoho Creator evidence. Evidence source: Zapier export/history.',
      'Risk: medium. Open question: Verify production active/paused state and whether final customer-visible evidence is complete. Notes: standardized final workflow/audit log row.'
    ),
    (
      'zap_47',
      'zap a- Shopify -> Tokenized Gift Tree Link (SKU 01)',
      'shopify/tree purchase',
      'partially_audited',
      'Shopify: new_paid_order_v3',
      ARRAY['Shopify', 'FilterAPI', 'Code', 'PostgreSQL', 'ZapierFormatter', 'ZohoCreator', 'ZohoMail'],
      'Create claim token, reserve/record gift claim, send claim-link email. Evidence source: Zapier export/history.',
      'Risk: medium. Open question: Verify production active/paused state and whether final customer-visible evidence is complete. Notes: standardized final workflow/audit log row.'
    ),
    (
      'zap_61',
      'ZAP B',
      'other',
      'not_audited',
      'ZohoForms: new_form_entry',
      ARRAY['ZohoForms', 'PostgreSQL', 'FilterAPI', 'Code', 'ZapierLooping', 'ZapierFormatter', 'BranchingAPI', 'ZohoCreator'],
      'Process gift tree claim form, allocate claimed trees, create certificate jobs. Evidence source: Zapier export/history.',
      'Risk: low. Open question: Verify production active/paused state and whether final customer-visible evidence is complete. Notes: standardized final workflow/audit log row.'
    ),
    (
      'zap_95',
      'Nieuw abonnes chargebee REVERTED',
      'subscription',
      'partially_audited',
      'Chargebee: payment_succeeded',
      ARRAY['Chargebee', 'ZapierFormatter', 'BranchingAPI', 'Code', 'ZohoMail', 'PostgreSQL', 'FilterAPI'],
      'Handle subscription/customer record, allocate subscription tree, send allocation mail. Evidence source: Zapier export/history.',
      'Risk: medium. Open question: Verify production active/paused state and whether final customer-visible evidence is complete. Notes: standardized final workflow/audit log row.'
    ),
    (
      'zap_124',
      'Monthly Tree Report',
      'reporting',
      'partially_audited',
      'Schedule: everyMonth',
      ARRAY['Schedule', 'PostgreSQL', 'Code', 'ZohoMail'],
      'Email monthly tree report. Evidence source: Zapier export/history.',
      'Risk: low. Open question: Verify production active/paused state and whether final customer-visible evidence is complete. Notes: standardized final workflow/audit log row.'
    ),
    (
      'zap_129',
      'Send Forest Hero Photo Email (once per user/ p/h) - Forest Photo 2025Q4 - Eenmalige e-mail',
      'outbound photo email',
      'partially_audited',
      'Schedule: everyHour',
      ARRAY['Schedule', 'PostgreSQL', 'ZapierFormatter', 'ZapierLooping', 'ZohoMail'],
      'Send forest photo email once and log to email_log. Evidence source: Zapier export/history.',
      'Risk: low. Open question: Verify production active/paused state and whether final customer-visible evidence is complete. Notes: standardized final event status fields.'
    ),
    (
      'zap_135',
      '(Copy) zap b multiple Eigenbomen SKU02',
      'shopify/tree purchase',
      'partially_audited',
      'Shopify: new_paid_order_v3',
      ARRAY['Shopify', 'FilterAPI', 'Delay', 'PostgreSQL', 'Code', 'ZohoCreator'],
      'Allocate owned tree purchase to PostgreSQL and create Zoho Creator evidence. Evidence source: Zapier export/history.',
      'Risk: medium. Open question: Verify production active/paused state and whether final customer-visible evidence is complete. Notes: standardized final workflow/audit log row.'
    ),
    (
      'zap_141',
      'Nieuw abonnes shopify handmatig - zoho form',
      'shopify/tree purchase',
      'partially_audited',
      'ZohoForms: new_form_entry',
      ARRAY['ZohoForms', 'ZapierFormatter', 'BranchingAPI', 'Code', 'ZohoMail', 'PostgreSQL', 'FilterAPI'],
      'Handle subscription/customer record, allocate subscription tree, send allocation mail. Evidence source: Zapier export/history.',
      'Risk: medium. Open question: Verify production active/paused state and whether final customer-visible evidence is complete. Notes: standardized final workflow/audit log row.'
    ),
    (
      'zap_172',
      'Webhooks by Zapier',
      'other',
      'partially_audited',
      'WebHook: hook_v2',
      ARRAY['WebHook', 'FilterAPI', 'ZohoMail'],
      'Workflow needs verification. Evidence source: Zapier export/history.',
      'Risk: low. Open question: Verify production active/paused state and whether final customer-visible evidence is complete. Notes: standardized final workflow/audit log row.'
    ),
    (
      'zap_175',
      'Trigger: New or Updated Contact in Zoho CRM',
      'academy/onboarding',
      'partially_audited',
      'ZohoCRM: new_or_updated_module_entry',
      ARRAY['ZohoCRM', 'FilterAPI', 'PostgreSQL', 'ZohoMail'],
      'Create/update Academy onboarding data and send onboarding email. Evidence source: Zapier export/history.',
      'Risk: high. Open question: Verify production active/paused state and whether final customer-visible evidence is complete. Notes: standardized final workflow/audit log row.'
    )
),
inserted AS (
  INSERT INTO monitoring.automation_registry (
    flow_name,
    category,
    status,
    trigger_description,
    systems_used,
    tables_touched,
    fields_touched,
    github_repo,
    github_files,
    technical_summary,
    notes
  )
  SELECT
    seed.flow_name,
    seed.category,
    seed.status,
    seed.trigger_description,
    seed.systems_used,
    ARRAY[]::text[] AS tables_touched,
    jsonb_build_object(
      'workflow_id', seed.workflow_id,
      'source_file', 'docs/master_workflow_registry.csv'
    ) AS fields_touched,
    'ptb-tree-map' AS github_repo,
    ARRAY['docs/master_workflow_registry.csv'] AS github_files,
    seed.technical_summary,
    seed.notes
  FROM seed
  WHERE current_database() = 'ptb_monitoring_test'
    AND NOT EXISTS (
      SELECT 1
      FROM monitoring.automation_registry existing
      WHERE existing.flow_name = seed.flow_name
        AND existing.category = seed.category
    )
  RETURNING
    id,
    flow_name,
    category,
    status,
    fields_touched ->> 'workflow_id' AS workflow_id
)
SELECT
  'inserted_this_run' AS result_type,
  id,
  workflow_id,
  flow_name,
  category,
  status
FROM inserted
ORDER BY category, flow_name;

-- Control query: registry count after insert within this transaction.
SELECT
  count(*)::int AS registry_count_after_insert
FROM monitoring.automation_registry;

-- Control query: overview of seed candidates now present in the registry.
WITH candidate_workflows(workflow_id, flow_name, category) AS (
  VALUES
    ('zap_1', 'IMCD_NL_TreeCert_Postgres', 'certificate/tree allocation'),
    ('zap_15', 'IMCD_BEL_TreeCert_Postgres', 'certificate/tree allocation'),
    ('zap_29', 'zap a multipleEigenbomenShopifyToPostgreSQL (SKU 02)', 'shopify/tree purchase'),
    ('zap_47', 'zap a- Shopify -> Tokenized Gift Tree Link (SKU 01)', 'shopify/tree purchase'),
    ('zap_61', 'ZAP B', 'other'),
    ('zap_95', 'Nieuw abonnes chargebee REVERTED', 'subscription'),
    ('zap_124', 'Monthly Tree Report', 'reporting'),
    ('zap_129', 'Send Forest Hero Photo Email (once per user/ p/h) - Forest Photo 2025Q4 - Eenmalige e-mail', 'outbound photo email'),
    ('zap_135', '(Copy) zap b multiple Eigenbomen SKU02', 'shopify/tree purchase'),
    ('zap_141', 'Nieuw abonnes shopify handmatig - zoho form', 'shopify/tree purchase'),
    ('zap_172', 'Webhooks by Zapier', 'other'),
    ('zap_175', 'Trigger: New or Updated Contact in Zoho CRM', 'academy/onboarding')
)
SELECT
  candidates.workflow_id,
  registry.id AS registry_id,
  registry.flow_name,
  registry.category,
  registry.status,
  registry.created_at
FROM candidate_workflows candidates
LEFT JOIN monitoring.automation_registry registry
  ON registry.flow_name = candidates.flow_name
 AND registry.category = candidates.category
ORDER BY candidates.workflow_id;

-- Default safe ending.
-- Keep this ROLLBACK for the first run and review all output above.
ROLLBACK;

-- After review in ptb_monitoring_test only:
-- 1. Replace the ROLLBACK above with COMMIT.
-- 2. Run the script again.
-- 3. Confirm the dashboard reads the registry via monitoring-registry.
--
-- COMMIT;
