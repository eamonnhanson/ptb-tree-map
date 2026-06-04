-- Zapier Custom Query template: zap_172 heartbeat.
--
-- Intended Zapier action:
--   PostgreSQL by Zapier -> Find Row via Custom Query
--
-- Safety:
--   - Inserts only into monitoring.automation_events.
--   - Writes only when current_database() = 'ptb_monitoring_test'.
--   - Writes only when allow_write is mapped to the literal string 'true'.
--   - Default Zapier test runs should map allow_write to 'false' or leave it unset.
--   - No DELETE, DROP, ALTER, TRUNCATE, or writes to other tables.
--
-- Replace the {{...}} placeholders in Zapier field mapping.

WITH zapier_input AS (
  SELECT
    lower(nullif('{{allow_write}}', '')) AS allow_write,
    nullif('{{zapier_run_id}}', '') AS zapier_run_id,
    nullif('{{zapier_fallback_timestamp}}', '') AS fallback_timestamp,
    nullif('{{trigger_source}}', '') AS trigger_source,
    coalesce(nullif('{{inserted_by}}', ''), 'zapier:zap_172') AS inserted_by
),
event_payload AS (
  SELECT
    now() AS event_time,
    'workflow/heartbeat'::text AS category,
    'green'::text AS severity,
    'ok'::text AS status,
    'Zapier'::text AS source_system,
    'Webhooks by Zapier'::text AS flow_name,
    'workflow'::text AS entity_type,
    'zap_172'::text AS entity_id,
    null::text AS customer_email,
    jsonb_build_object(
      'workflow_id', 'zap_172',
      'workflow_name', 'Webhooks by Zapier',
      'zapier_run_id', coalesce(zapier_input.zapier_run_id, zapier_input.fallback_timestamp, to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')),
      'fallback_timestamp', zapier_input.fallback_timestamp,
      'trigger_source', coalesce(zapier_input.trigger_source, 'webhook_success_path'),
      'inserted_by', zapier_input.inserted_by
    ) AS changed_fields,
    'Webhooks by Zapier heartbeat received'::text AS summary,
    false AS action_required,
    null::text AS external_link,
    null::text AS error_message,
    zapier_input.allow_write
  FROM zapier_input
)
INSERT INTO monitoring.automation_events (
  event_time,
  category,
  severity,
  status,
  source_system,
  flow_name,
  entity_type,
  entity_id,
  customer_email,
  changed_fields,
  summary,
  action_required,
  external_link,
  error_message
)
SELECT
  event_payload.event_time,
  event_payload.category,
  event_payload.severity,
  event_payload.status,
  event_payload.source_system,
  event_payload.flow_name,
  event_payload.entity_type,
  event_payload.entity_id,
  event_payload.customer_email,
  event_payload.changed_fields,
  event_payload.summary,
  event_payload.action_required,
  event_payload.external_link,
  event_payload.error_message
FROM event_payload
WHERE current_database() = 'ptb_monitoring_test'
  AND event_payload.allow_write = 'true'
  AND NOT EXISTS (
    SELECT 1
    FROM monitoring.automation_events existing
    WHERE existing.entity_id = event_payload.entity_id
      AND existing.summary = event_payload.summary
      AND existing.event_time >= now() - interval '10 minutes'
      AND coalesce(existing.changed_fields ->> 'zapier_run_id', '') =
          coalesce(event_payload.changed_fields ->> 'zapier_run_id', '')
  )
RETURNING
  id,
  event_time,
  entity_id,
  summary,
  action_required;
