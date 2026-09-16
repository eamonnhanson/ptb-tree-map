-- REVIEW-ONLY TEMPLATE. DO NOT RUN AUTOMATICALLY.
-- Replace database and administrator assumptions only during a separately
-- approved production access change. This file changes privileges if executed.

BEGIN;

CREATE ROLE ops_console_reader LOGIN PASSWORD 'replace-through-secure-admin-channel';
GRANT CONNECT ON DATABASE replace_database_name TO ops_console_reader;
GRANT USAGE ON SCHEMA monitoring TO ops_console_reader;

GRANT SELECT ON TABLE
  monitoring.automation_registry,
  monitoring.automation_events,
  monitoring.outbound_messages,
  monitoring.workflow_registry,
  monitoring.workflow_dependencies,
  monitoring.workflow_connections,
  monitoring.workflow_code_assets,
  monitoring.workflow_runbooks,
  monitoring.workflow_reviews
TO ops_console_reader;

ALTER ROLE ops_console_reader SET default_transaction_read_only = on;

COMMIT;

-- Verify manually after approval:
-- select current_user, current_setting('default_transaction_read_only');
