-- Plant N Boom / KETSO workflow maintenance datamodel
-- Migration: 005_workflow_maintenance_datamodel.sql
-- Scope: design new workflow maintenance tables only.
--
-- SAFETY:
-- - First run only with the ROLLBACK at the bottom.
-- - Run only against database ptb_monitoring_test.
-- - After review, replace ROLLBACK with COMMIT in a controlled test run.
-- - Do not run against production without a separate reviewed production plan.
--
-- This file intentionally contains:
-- - no DROP;
-- - no TRUNCATE;
-- - no DELETE;
-- - no ALTER on existing tables;
-- - no secrets.

BEGIN;

-- Hard guard: fail immediately if this file is accidentally run outside the
-- intended test database.
DO $$
BEGIN
  IF current_database() <> 'ptb_monitoring_test' THEN
    RAISE EXCEPTION
      'Refusing to create workflow maintenance tables in database %. Expected ptb_monitoring_test.',
      current_database();
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS monitoring;

CREATE TABLE IF NOT EXISTS monitoring.workflow_registry (
  workflow_id text PRIMARY KEY,
  workflow_name text NOT NULL,
  platform text NOT NULL,
  source_system text,
  target_system text,
  trigger_description text,
  business_purpose text,
  owner_name text,
  status text NOT NULL DEFAULT 'unknown',
  risk_level text NOT NULL DEFAULT 'unknown',
  reads_from text,
  writes_to text,
  database_user text,
  connection_name text,
  runbook_file text,
  last_tested_at date,
  next_review_at date,
  related_automation_registry_flow_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE monitoring.workflow_registry IS
  'Maintenance registry for all workflow automations across Zapier, Zoho, Shopify, Chargebee, hosting, database, and code assets.';
COMMENT ON COLUMN monitoring.workflow_registry.workflow_id IS
  'Stable maintenance id, for example zap_172 or netlify_monitoring_summary. This is not a foreign key to an external system.';
COMMENT ON COLUMN monitoring.workflow_registry.platform IS
  'Automation/runtime platform such as Zapier, Zoho Flow, Shopify, Chargebee, PostgreSQL/Aiven, Render, Netlify, or GitHub.';
COMMENT ON COLUMN monitoring.workflow_registry.status IS
  'Maintenance status such as implemented, partially_audited, unknown, missing_source, or retired.';
COMMENT ON COLUMN monitoring.workflow_registry.related_automation_registry_flow_name IS
  'Optional text link to monitoring.automation_registry.flow_name; kept as text to avoid coupling this maintenance model to the runtime registry.';

CREATE TABLE IF NOT EXISTS monitoring.workflow_dependencies (
  dependency_id bigserial PRIMARY KEY,
  workflow_id text NOT NULL,
  dependency_order integer,
  dependency_type text NOT NULL,
  source_system text,
  target_system text,
  trigger_or_input text,
  action_summary text,
  output_summary text,
  reads_from text,
  writes_to text,
  uncertainty_level text NOT NULL DEFAULT 'unknown',
  missing_information text,
  evidence_source text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE monitoring.workflow_dependencies IS
  'Step-level dependency map for workflow chains: trigger -> actions -> database/API/email/document output.';
COMMENT ON COLUMN monitoring.workflow_dependencies.workflow_id IS
  'Text id matching workflow_registry.workflow_id by convention. No hard foreign key, so incomplete imports can be staged safely.';
COMMENT ON COLUMN monitoring.workflow_dependencies.dependency_type IS
  'Dependency kind such as trigger, filter, database_read, database_write, api_call, email_send, document_merge, code_asset, or manual_review.';
COMMENT ON COLUMN monitoring.workflow_dependencies.uncertainty_level IS
  'Known/partial/uncertain/missing_source marker for audit visibility in the dashboard.';

CREATE TABLE IF NOT EXISTS monitoring.workflow_connections (
  connection_id bigserial PRIMARY KEY,
  system text NOT NULL,
  connection_name text NOT NULL,
  username text,
  role_name text,
  rights_summary text,
  used_by text,
  secret_location text,
  review_status text NOT NULL DEFAULT 'needs_manual_review',
  least_privilege_status text,
  last_reviewed_at date,
  next_review_at date,
  owner_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE monitoring.workflow_connections IS
  'Inventory of service connections and database users without passwords, tokens, or connection strings.';
COMMENT ON COLUMN monitoring.workflow_connections.secret_location IS
  'Where the secret is managed, for example Netlify environment variables, Render environment variables, Zapier connected account, or Aiven console. Never store secret values here.';
COMMENT ON COLUMN monitoring.workflow_connections.rights_summary IS
  'Human-readable privilege summary; exact grants may require manual Aiven or platform review.';

CREATE TABLE IF NOT EXISTS monitoring.workflow_code_assets (
  code_asset_id bigserial PRIMARY KEY,
  file_path text NOT NULL,
  asset_type text NOT NULL DEFAULT 'unknown',
  purpose text,
  related_workflows text,
  environment_variables text,
  status text NOT NULL DEFAULT 'unknown',
  owner_name text,
  review_status text NOT NULL DEFAULT 'needs_manual_review',
  last_reviewed_at date,
  next_review_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE monitoring.workflow_code_assets IS
  'Source-controlled assets related to workflow maintenance: Netlify functions, dashboard files, API files, SQL scripts, and docs.';
COMMENT ON COLUMN monitoring.workflow_code_assets.file_path IS
  'Repository-relative path or external asset label. For GitHub assets, prefer repo-relative paths.';
COMMENT ON COLUMN monitoring.workflow_code_assets.environment_variables IS
  'Names of environment variables used by the asset. Do not store values.';

CREATE TABLE IF NOT EXISTS monitoring.workflow_runbooks (
  runbook_id bigserial PRIMARY KEY,
  workflow_id text,
  runbook_file text NOT NULL,
  runbook_title text NOT NULL,
  runbook_type text NOT NULL DEFAULT 'operational',
  purpose text,
  safe_test_steps text,
  rollback_notes text,
  owner_name text,
  status text NOT NULL DEFAULT 'draft',
  last_reviewed_at date,
  next_review_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE monitoring.workflow_runbooks IS
  'Runbook index for safe testing, review, rollback, and operational ownership of workflows.';
COMMENT ON COLUMN monitoring.workflow_runbooks.workflow_id IS
  'Optional text workflow id. Some runbooks cover multiple workflows or platform-wide procedures.';
COMMENT ON COLUMN monitoring.workflow_runbooks.safe_test_steps IS
  'Plain-language safe test instructions. Do not include secrets or destructive commands.';

CREATE TABLE IF NOT EXISTS monitoring.workflow_reviews (
  review_id bigserial PRIMARY KEY,
  workflow_id text,
  review_type text NOT NULL DEFAULT 'manual',
  review_status text NOT NULL DEFAULT 'open',
  reviewed_by text,
  reviewed_at timestamptz,
  next_review_at date,
  findings text,
  action_items text,
  risk_level_before text,
  risk_level_after text,
  evidence_source text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE monitoring.workflow_reviews IS
  'Review history for workflow maintenance checks, open risks, and follow-up actions.';
COMMENT ON COLUMN monitoring.workflow_reviews.review_status IS
  'Status such as open, passed, needs_followup, blocked, or closed.';
COMMENT ON COLUMN monitoring.workflow_reviews.evidence_source IS
  'Source used for the review, such as Zapier history export, Shopify order export, Aiven privilege review, or manual UI inspection.';

CREATE INDEX IF NOT EXISTS idx_workflow_registry_platform
  ON monitoring.workflow_registry (platform);

CREATE INDEX IF NOT EXISTS idx_workflow_registry_status
  ON monitoring.workflow_registry (status);

CREATE INDEX IF NOT EXISTS idx_workflow_registry_risk_level
  ON monitoring.workflow_registry (risk_level);

CREATE INDEX IF NOT EXISTS idx_workflow_registry_next_review_at
  ON monitoring.workflow_registry (next_review_at);

CREATE INDEX IF NOT EXISTS idx_workflow_dependencies_workflow_id
  ON monitoring.workflow_dependencies (workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_dependencies_type
  ON monitoring.workflow_dependencies (dependency_type);

CREATE INDEX IF NOT EXISTS idx_workflow_connections_system
  ON monitoring.workflow_connections (system);

CREATE INDEX IF NOT EXISTS idx_workflow_connections_review_status
  ON monitoring.workflow_connections (review_status);

CREATE INDEX IF NOT EXISTS idx_workflow_code_assets_file_path
  ON monitoring.workflow_code_assets (file_path);

CREATE INDEX IF NOT EXISTS idx_workflow_code_assets_status
  ON monitoring.workflow_code_assets (status);

CREATE INDEX IF NOT EXISTS idx_workflow_runbooks_workflow_id
  ON monitoring.workflow_runbooks (workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_runbooks_status
  ON monitoring.workflow_runbooks (status);

CREATE INDEX IF NOT EXISTS idx_workflow_reviews_workflow_id
  ON monitoring.workflow_reviews (workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_reviews_review_status
  ON monitoring.workflow_reviews (review_status);

-- Control query for the first test run. The expected value for
-- is_expected_test_database is true.
SELECT
  current_database() AS database_name,
  current_database() = 'ptb_monitoring_test' AS is_expected_test_database;

-- Default: roll back the design run.
ROLLBACK;

-- After review in ptb_monitoring_test only, replace ROLLBACK above with:
-- COMMIT;
