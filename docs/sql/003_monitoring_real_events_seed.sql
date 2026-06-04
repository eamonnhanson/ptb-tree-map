-- Safe real monitoring event seed for ptb_monitoring_test.
--
-- Purpose:
--   Replace the existing TEST DATA in monitoring.automation_events and
--   monitoring.outbound_messages with realistic workflow-based monitoring
--   records for the live automation dashboard.
--
-- Safety rules:
--   - Do not run against production.
--   - Run first with the active ROLLBACK at the bottom.
--   - Review all output: counts, deleted test rows, inserted events, inserted outbound messages.
--   - Only after review, manually replace the final ROLLBACK with COMMIT.
--   - No secrets belong in this file.
--   - This script must not use TRUNCATE, DROP, or ALTER.
--
-- Scope:
--   - Reads monitoring.automation_registry.
--   - Deletes only TEST DATA rows from monitoring.outbound_messages and monitoring.automation_events.
--   - Inserts only into monitoring.automation_events and monitoring.outbound_messages.

BEGIN;

-- Safety check: this must return ptb_monitoring_test before this script is committed.
SELECT
  current_database() AS database_name,
  current_user AS database_user,
  CASE
    WHEN current_database() = 'ptb_monitoring_test'
      THEN 'OK: test database'
    ELSE 'STOP: wrong database, rollback immediately'
  END AS safety_check;

-- Counts before cleanup and seed.
SELECT
  (SELECT count(*)::int FROM monitoring.automation_registry) AS automation_registry_before,
  (SELECT count(*)::int FROM monitoring.automation_events) AS automation_events_before,
  (SELECT count(*)::int FROM monitoring.outbound_messages) AS outbound_messages_before;

-- Preview TEST DATA rows that will be removed inside this transaction.
SELECT
  'outbound_test_data_before_delete' AS row_type,
  id,
  subject,
  related_entity_id,
  status
FROM monitoring.outbound_messages
WHERE subject LIKE 'TEST DATA -%'
   OR related_entity_id LIKE 'test-%'
ORDER BY id;

SELECT
  'event_test_data_before_delete' AS row_type,
  id,
  entity_id,
  summary,
  status
FROM monitoring.automation_events
WHERE summary LIKE 'TEST DATA -%'
   OR entity_id LIKE 'test-%'
ORDER BY id;

-- Delete outbound TEST DATA first because outbound_messages can reference automation_events.
WITH deleted_outbound AS (
  DELETE FROM monitoring.outbound_messages outbound
  WHERE current_database() = 'ptb_monitoring_test'
    AND (
      outbound.subject LIKE 'TEST DATA -%'
      OR outbound.related_entity_id LIKE 'test-%'
    )
  RETURNING
    id,
    subject,
    related_entity_id,
    status
)
SELECT
  'deleted_outbound_test_data' AS result_type,
  id,
  subject,
  related_entity_id,
  status
FROM deleted_outbound
ORDER BY id;

-- Delete automation event TEST DATA after dependent outbound rows are gone.
WITH deleted_events AS (
  DELETE FROM monitoring.automation_events event
  WHERE current_database() = 'ptb_monitoring_test'
    AND (
      event.summary LIKE 'TEST DATA -%'
      OR event.entity_id LIKE 'test-%'
    )
  RETURNING
    id,
    entity_id,
    summary,
    status
)
SELECT
  'deleted_event_test_data' AS result_type,
  id,
  entity_id,
  summary,
  status
FROM deleted_events
ORDER BY id;

-- Candidate workflow events.
-- Events are inserted only if their registry flow exists and the entity_id + summary
-- combination is not already present.
WITH candidate_events(
  flow_name,
  entity_id,
  category,
  severity,
  status,
  summary,
  error_message,
  external_link,
  changed_fields
) AS (
  VALUES
    (
      'IMCD_NL_TreeCert_Postgres',
      'workflow:zap_1:certificate-audit',
      'certificate/tree allocation',
      'orange',
      'needs_review',
      'Controle nodig: certificaatflow heeft auditbewijs nodig',
      'Registry seed: auditbewijs en final workflow/audit log moeten periodiek worden gecontroleerd.',
      'docs/master_workflow_registry.csv#zap_1',
      jsonb_build_object(
        'workflow_id', 'zap_1',
        'flow_name', 'IMCD_NL_TreeCert_Postgres',
        'source', 'docs/master_workflow_registry.csv',
        'check_type', 'certificate_audit_evidence'
      )
    ),
    (
      'IMCD_BEL_TreeCert_Postgres',
      'workflow:zap_15:certificate-audit',
      'certificate/tree allocation',
      'yellow',
      'monitoring_required',
      'Controle nodig: certificaatflow heeft auditbewijs nodig',
      'Registry seed: Belgische certificaatflow heeft periodieke auditcontrole nodig.',
      'docs/master_workflow_registry.csv#zap_15',
      jsonb_build_object(
        'workflow_id', 'zap_15',
        'flow_name', 'IMCD_BEL_TreeCert_Postgres',
        'source', 'docs/master_workflow_registry.csv',
        'check_type', 'certificate_audit_evidence'
      )
    ),
    (
      'zap a- Shopify -> Tokenized Gift Tree Link (SKU 01)',
      'workflow:zap_47:gift-claim-periodic-test',
      'shopify/tree purchase',
      'orange',
      'needs_review',
      'Controle nodig: tokenized gift tree claim flow moet periodiek getest worden',
      'Registry seed: claim token, gift_claims registratie en claim-link mail periodiek controleren.',
      'docs/master_workflow_registry.csv#zap_47',
      jsonb_build_object(
        'workflow_id', 'zap_47',
        'flow_name', 'zap a- Shopify -> Tokenized Gift Tree Link (SKU 01)',
        'source', 'docs/master_workflow_registry.csv',
        'check_type', 'gift_claim_periodic_test'
      )
    ),
    (
      'Monthly Tree Report',
      'workflow:zap_124:monthly-report-send-check',
      'reporting',
      'orange',
      'pending',
      'Controle nodig: monthly tree report workflow mist recente verzendcontrole',
      'Registry seed: recente outbound run en Zoho Mail bewijs moeten worden gecontroleerd.',
      'docs/master_workflow_registry.csv#zap_124',
      jsonb_build_object(
        'workflow_id', 'zap_124',
        'flow_name', 'Monthly Tree Report',
        'source', 'docs/master_workflow_registry.csv',
        'check_type', 'monthly_report_send_check'
      )
    ),
    (
      'Send Forest Hero Photo Email (once per user/ p/h) - Forest Photo 2025Q4 - Eenmalige e-mail',
      'workflow:zap_129:forest-hero-outbound-proof',
      'outbound photo email',
      'red',
      'needs_review',
      'Controle nodig: Forest Hero foto-e-mail vraagt bewijs van laatste outbound run',
      'Registry seed: laatste outbound run, email_log en Zoho Mail bewijs moeten worden gematcht.',
      'docs/master_workflow_registry.csv#zap_129',
      jsonb_build_object(
        'workflow_id', 'zap_129',
        'flow_name', 'Send Forest Hero Photo Email (once per user/ p/h) - Forest Photo 2025Q4 - Eenmalige e-mail',
        'source', 'docs/master_workflow_registry.csv',
        'check_type', 'forest_hero_outbound_proof'
      )
    ),
    (
      'Webhooks by Zapier',
      'workflow:zap_172:webhook-response-monitoring',
      'other',
      'yellow',
      'monitoring_required',
      'Controle nodig: Webhooks by Zapier vraagt endpoint/response monitoring',
      'Registry seed: endpointbeschikbaarheid en response logging moeten periodiek worden gecontroleerd.',
      'docs/master_workflow_registry.csv#zap_172',
      jsonb_build_object(
        'workflow_id', 'zap_172',
        'flow_name', 'Webhooks by Zapier',
        'source', 'docs/master_workflow_registry.csv',
        'check_type', 'webhook_response_monitoring'
      )
    ),
    (
      'Trigger: New or Updated Contact in Zoho CRM',
      'workflow:zap_175:zoho-crm-postgresql-match',
      'academy/onboarding',
      'red',
      'needs_review',
      'Controle nodig: Zoho CRM contact-sync vraagt periodieke match met PostgreSQL',
      'Registry seed: Zoho CRM contact-sync, PostgreSQL verwerking en onboardingmail moeten worden gematcht.',
      'docs/master_workflow_registry.csv#zap_175',
      jsonb_build_object(
        'workflow_id', 'zap_175',
        'flow_name', 'Trigger: New or Updated Contact in Zoho CRM',
        'source', 'docs/master_workflow_registry.csv',
        'check_type', 'zoho_crm_postgresql_match'
      )
    )
),
registry_matches AS (
  SELECT
    candidates.*,
    registry.id AS registry_id
  FROM candidate_events candidates
  JOIN monitoring.automation_registry registry
    ON registry.flow_name = candidates.flow_name
),
inserted_events AS (
  INSERT INTO monitoring.automation_events (
    event_time,
    category,
    severity,
    status,
    entity_id,
    summary,
    action_required,
    customer_email,
    error_message,
    external_link,
    changed_fields
  )
  SELECT
    now() AS event_time,
    registry_matches.category,
    registry_matches.severity,
    registry_matches.status,
    registry_matches.entity_id,
    registry_matches.summary,
    true AS action_required,
    null::text AS customer_email,
    registry_matches.error_message,
    registry_matches.external_link,
    registry_matches.changed_fields || jsonb_build_object('registry_id', registry_matches.registry_id)
  FROM registry_matches
  WHERE current_database() = 'ptb_monitoring_test'
    AND NOT EXISTS (
      SELECT 1
      FROM monitoring.automation_events existing
      WHERE existing.entity_id = registry_matches.entity_id
        AND existing.summary = registry_matches.summary
    )
  RETURNING
    id,
    event_time,
    category,
    severity,
    status,
    entity_id,
    summary
)
SELECT
  'inserted_event' AS result_type,
  id,
  event_time,
  category,
  severity,
  status,
  entity_id,
  summary
FROM inserted_events
ORDER BY severity, category, entity_id;

-- Candidate outbound follow-up records linked to the newly present events.
WITH candidate_outbound(
  event_entity_id,
  message_type,
  provider,
  recipient_email,
  subject,
  status,
  related_entity_type,
  related_entity_id,
  external_link,
  error_message
) AS (
  VALUES
    (
      'workflow:zap_1:certificate-audit',
      'audit_followup',
      'Manual follow-up',
      'automation-team@example.invalid',
      'Controle nodig: certificaatflow auditbewijs',
      'draft_needed',
      'workflow',
      'workflow:zap_1:certificate-audit',
      'docs/master_workflow_registry.csv#zap_1',
      'Maak auditbewijs concreet voor certificaatflow en final workflow/audit log.'
    ),
    (
      'workflow:zap_124:monthly-report-send-check',
      'outbound_followup',
      'Zapier',
      'automation-team@example.invalid',
      'Controle nodig: Monthly Tree Report',
      'pending_review',
      'workflow',
      'workflow:zap_124:monthly-report-send-check',
      'docs/master_workflow_registry.csv#zap_124',
      'Controleer recente Zapier run en Zoho Mail verzendbewijs.'
    ),
    (
      'workflow:zap_129:forest-hero-outbound-proof',
      'outbound_followup',
      'Zoho Mail',
      'automation-team@example.invalid',
      'Controle nodig: Forest Hero foto-e-mail',
      'pending_review',
      'workflow',
      'workflow:zap_129:forest-hero-outbound-proof',
      'docs/master_workflow_registry.csv#zap_129',
      'Match email_log en Zoho Mail bewijs voor laatste outbound run.'
    )
),
event_matches AS (
  SELECT
    outbound.*,
    event.id AS related_event_id
  FROM candidate_outbound outbound
  JOIN monitoring.automation_events event
    ON event.entity_id = outbound.event_entity_id
),
inserted_outbound AS (
  INSERT INTO monitoring.outbound_messages (
    message_time,
    message_type,
    provider,
    recipient_email,
    subject,
    status,
    related_event_id,
    related_entity_type,
    related_entity_id,
    external_link,
    error_message
  )
  SELECT
    now() AS message_time,
    event_matches.message_type,
    event_matches.provider,
    event_matches.recipient_email,
    event_matches.subject,
    event_matches.status,
    event_matches.related_event_id,
    event_matches.related_entity_type,
    event_matches.related_entity_id,
    event_matches.external_link,
    event_matches.error_message
  FROM event_matches
  WHERE current_database() = 'ptb_monitoring_test'
    AND NOT EXISTS (
      SELECT 1
      FROM monitoring.outbound_messages existing
      WHERE existing.subject = event_matches.subject
        AND (
          existing.recipient_email = event_matches.recipient_email
          OR existing.related_entity_id = event_matches.related_entity_id
        )
    )
  RETURNING
    id,
    message_time,
    message_type,
    provider,
    recipient_email,
    subject,
    status,
    related_event_id,
    related_entity_id
)
SELECT
  'inserted_outbound_message' AS result_type,
  id,
  message_time,
  message_type,
  provider,
  recipient_email,
  subject,
  status,
  related_event_id,
  related_entity_id
FROM inserted_outbound
ORDER BY subject;

-- Counts after cleanup and seed, still inside the transaction.
SELECT
  (SELECT count(*)::int FROM monitoring.automation_events) AS automation_events_after_seed,
  (SELECT count(*)::int FROM monitoring.outbound_messages) AS outbound_messages_after_seed;

-- Overview of candidate events now present in the transaction.
SELECT
  id,
  event_time,
  category,
  severity,
  status,
  entity_id,
  summary,
  action_required
FROM monitoring.automation_events
WHERE entity_id IN (
  'workflow:zap_1:certificate-audit',
  'workflow:zap_15:certificate-audit',
  'workflow:zap_47:gift-claim-periodic-test',
  'workflow:zap_124:monthly-report-send-check',
  'workflow:zap_129:forest-hero-outbound-proof',
  'workflow:zap_172:webhook-response-monitoring',
  'workflow:zap_175:zoho-crm-postgresql-match'
)
ORDER BY severity, category, entity_id;

-- Overview of candidate outbound messages now present in the transaction.
SELECT
  id,
  message_time,
  message_type,
  provider,
  recipient_email,
  subject,
  status,
  related_event_id,
  related_entity_id
FROM monitoring.outbound_messages
WHERE subject IN (
  'Controle nodig: certificaatflow auditbewijs',
  'Controle nodig: Monthly Tree Report',
  'Controle nodig: Forest Hero foto-e-mail'
)
ORDER BY subject;

-- TEST DATA should be absent inside this transaction after cleanup.
SELECT
  (SELECT count(*)::int
   FROM monitoring.automation_events
   WHERE summary LIKE 'TEST DATA -%'
      OR entity_id LIKE 'test-%') AS remaining_test_events,
  (SELECT count(*)::int
   FROM monitoring.outbound_messages
   WHERE subject LIKE 'TEST DATA -%'
      OR related_entity_id LIKE 'test-%') AS remaining_test_outbound_messages;

-- Default safe ending.
-- Keep this ROLLBACK for the first run and review all output above.
ROLLBACK;

-- After review in ptb_monitoring_test only:
-- 1. Replace the ROLLBACK above with COMMIT.
-- 2. Run the script again.
-- 3. Confirm the dashboard summary and live action/outbound sections.
--
-- COMMIT;
