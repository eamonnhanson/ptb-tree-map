-- Plant N Boom / KETSO monitoring dashboard datamodel
-- Migration: 001_monitoring_datamodel.sql
-- Scope: create new monitoring tables only.
-- Safety: no drops, no alters, no changes to existing business tables.

BEGIN;

CREATE TABLE IF NOT EXISTS automation_events (
  id bigserial PRIMARY KEY,
  event_time timestamptz DEFAULT now(),
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'green',
  status text NOT NULL DEFAULT 'ok',
  source_system text,
  flow_name text,
  entity_type text,
  entity_id text,
  customer_email text,
  changed_fields jsonb DEFAULT '{}'::jsonb,
  summary text,
  action_required boolean DEFAULT false,
  external_link text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbound_messages (
  id bigserial PRIMARY KEY,
  message_time timestamptz DEFAULT now(),
  message_type text NOT NULL,
  provider text,
  recipient_email text,
  subject text,
  status text NOT NULL DEFAULT 'sent',
  related_event_id bigint REFERENCES automation_events(id),
  related_entity_type text,
  related_entity_id text,
  external_link text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_registry (
  id bigserial PRIMARY KEY,
  flow_name text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  trigger_description text,
  systems_used text[],
  tables_touched text[],
  fields_touched jsonb DEFAULT '{}'::jsonb,
  github_repo text,
  github_files text[],
  technical_summary text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_events_event_time
  ON automation_events (event_time);

CREATE INDEX IF NOT EXISTS idx_automation_events_category
  ON automation_events (category);

CREATE INDEX IF NOT EXISTS idx_automation_events_severity
  ON automation_events (severity);

CREATE INDEX IF NOT EXISTS idx_automation_events_action_required
  ON automation_events (action_required);

CREATE INDEX IF NOT EXISTS idx_automation_events_customer_email
  ON automation_events (customer_email);

CREATE INDEX IF NOT EXISTS idx_outbound_messages_message_time
  ON outbound_messages (message_time);

CREATE INDEX IF NOT EXISTS idx_outbound_messages_recipient_email
  ON outbound_messages (recipient_email);

CREATE INDEX IF NOT EXISTS idx_outbound_messages_status
  ON outbound_messages (status);

CREATE INDEX IF NOT EXISTS idx_automation_registry_flow_name
  ON automation_registry (flow_name);

CREATE INDEX IF NOT EXISTS idx_automation_registry_category
  ON automation_registry (category);

CREATE INDEX IF NOT EXISTS idx_automation_registry_status
  ON automation_registry (status);

-- ---------------------------------------------------------------------------
-- TEST DATA
-- These rows are optional smoke-test data for staging/local validation.
-- Remove or skip this section for a clean production installation.
-- ---------------------------------------------------------------------------

INSERT INTO automation_registry (
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
VALUES
  (
    'TEST - Academy upload review monitor',
    'academy/upload',
    'test',
    'Example event emitted when a student upload needs review.',
    ARRAY['PostgreSQL', 'KETSO uploader'],
    ARRAY['photo_uploads_review', 'academy_students'],
    '{"photo_uploads_review":["verification_status","academy_student_id","created_at_utc"]}'::jsonb,
    'ptb-tree-map',
    ARRAY['frontend/automation-dashboard/student-uploads.json'],
    'Test registry row for monitoring dashboard validation.',
    'TEST DATA - safe to delete after validation.'
  )
ON CONFLICT DO NOTHING;

INSERT INTO automation_events (
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
VALUES
  (
    'academy/upload',
    'orange',
    'needs_review',
    'KETSO uploader',
    'TEST - Academy upload review monitor',
    'photo_uploads_review',
    'test-upload-001',
    'student@example.invalid',
    '{"verification_status":{"from":"pending","to":"submitted_for_review"}}'::jsonb,
    'TEST DATA - student upload submitted for review.',
    true,
    null,
    null
  ),
  (
    'workflow/audit',
    'red',
    'failed',
    'Zapier',
    'TEST - Manual follow-up evidence',
    'workflow',
    'test-workflow-001',
    null,
    '{}'::jsonb,
    'TEST DATA - missing manual follow-up evidence.',
    true,
    null,
    'Missing live Zoho Mail folder evidence.'
  )
ON CONFLICT DO NOTHING;

INSERT INTO outbound_messages (
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
  'test_notification',
  'Zapier',
  'student@example.invalid',
  'TEST DATA - upload approved',
  'sent',
  event.id,
  event.entity_type,
  event.entity_id,
  null,
  null
FROM automation_events event
WHERE event.entity_id = 'test-upload-001'
LIMIT 1;

COMMIT;

-- ---------------------------------------------------------------------------
-- ROLLBACK - intentionally commented out.
-- Uncomment only in a controlled non-production rollback.
-- ---------------------------------------------------------------------------
--
-- BEGIN;
--
-- DELETE FROM outbound_messages
-- WHERE related_entity_id IN ('test-upload-001', 'test-workflow-001')
--    OR subject LIKE 'TEST DATA -%';
--
-- DELETE FROM automation_events
-- WHERE entity_id IN ('test-upload-001', 'test-workflow-001')
--    OR summary LIKE 'TEST DATA -%';
--
-- DELETE FROM automation_registry
-- WHERE flow_name LIKE 'TEST -%';
--
-- DROP TABLE IF EXISTS outbound_messages;
-- DROP TABLE IF EXISTS automation_events;
-- DROP TABLE IF EXISTS automation_registry;
--
-- COMMIT;
