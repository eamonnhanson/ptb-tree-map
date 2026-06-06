# Workflow maintenance seed plan

Date: 2026-06-06

This plan describes the safe seed script for the workflow maintenance tables. It is documentation only. No SQL has been executed.

## Files

Seed SQL:

- `docs/sql/006_workflow_maintenance_seed.sql`

Source files:

- `docs/workflow_maintenance_registry.csv`
- `docs/workflow_connections_inventory.md`
- `docs/workflow_code_assets_inventory.md`
- `docs/workflow_maintenance_inventory.md`
- `docs/workflow_dependency_map.md`
- `docs/workflow_maintenance_datamodel_plan.md`

Target tables:

- `monitoring.workflow_registry`
- `monitoring.workflow_connections`
- `monitoring.workflow_code_assets`
- `monitoring.workflow_runbooks`
- `monitoring.workflow_reviews`

The seed assumes the datamodel from `docs/sql/005_workflow_maintenance_datamodel.sql` already exists in `ptb_monitoring_test`.

## Safety Controls

The SQL file is intentionally test-safe:

- starts with `BEGIN;`;
- has a hard guard requiring `current_database() = 'ptb_monitoring_test'`;
- uses active `ROLLBACK;` at the bottom;
- includes only commented `-- COMMIT;`;
- has no secrets, passwords, tokens, API keys, or connection strings;
- has no `DROP`, `TRUNCATE`, `DELETE`, or `ALTER`;
- uses `INSERT` and `INSERT ... SELECT`;
- uses `ON CONFLICT (workflow_id)` for `workflow_registry`;
- uses `WHERE NOT EXISTS` checks for connections, code assets, runbooks, and reviews.

## Seed Scope

### `workflow_registry`

Loads all 27 rows from `docs/workflow_maintenance_registry.csv`.

Expected seeded rows:

- `27`

The registry seed uses `ON CONFLICT (workflow_id) DO UPDATE` so reruns can refresh the same maintenance ids without creating duplicates.

### `workflow_connections`

Seeds known service/database connections without secret values:

- `avnadmin`
- `web_ro`
- `web_rw`
- `zapier_user`
- Netlify `MONITORING_DATABASE_URL`
- Zapier defaultdb connection
- Zapier `ptb_monitoring_test` connection
- Render `DATABASE_URL`
- Render `PG_URL`
- Zoho Mail connection
- Zoho CRM connection
- Zoho Forms connection
- Zoho Creator connection
- Zoho Writer connection
- Shopify connection
- Chargebee connection

Expected seeded rows:

- `16`

Duplicates are prevented by matching `system`, `connection_name`, and `username`.

### `workflow_code_assets`

Seeds the main code and documentation assets needed for maintenance:

- Netlify monitoring functions;
- `frontend/automation-dashboard` files;
- `api/db.js`;
- `server.js`;
- monitoring and workflow SQL scripts;
- registry, connection, code asset, dependency, datamodel, and seed docs;
- Zapier and master registry source docs.

Expected seeded rows:

- `26`

Duplicates are prevented by matching `file_path`.

### `workflow_runbooks`

Seeds initial runbook records:

- `docs/monitoring_zap172_heartbeat_plan.md`
- `docs/workflow_maintenance_inventory.md`
- `docs/workflow_maintenance_datamodel_plan.md`
- `docs/workflow_maintenance_seed_plan.md`

Expected seeded rows:

- `4`

Duplicates are prevented by matching `runbook_file` and `workflow_id`.

### `workflow_reviews`

Seeds one initial review record:

- `workflow_id`: `workflow_maintenance`
- `review_type`: `initial_inventory`
- `review_status`: `needs_followup`

Expected seeded rows:

- `1`

Duplicates are prevented by matching `workflow_id` and `review_type`.

## Control Queries

The SQL includes these control outputs:

- counts before seed;
- counts after seed;
- overview of `workflow_registry`;
- overview of `workflow_connections`;
- overview of `workflow_code_assets`;
- overview of `workflow_runbooks`;
- overview of open reviews.

Because `ROLLBACK;` is active, the after-seed queries show what the transaction would contain, then the transaction is rolled back.

## Open Uncertainties

The initial review record preserves the main open uncertainties:

- Zoho Flow export is missing.
- Zoho Creator app/form names are not verified.
- Zoho Writer certificate templates and merge triggers are not verified.
- Live Zoho Mail folder/API state is not verified.
- Active/paused status of Zapier workflows is not verified.
- Aiven rights for `avnadmin`, `web_ro`, `web_rw`, and `zapier_user` are not verified.
- Shopify order/webhook coverage is incomplete.
- Chargebee direct-to-Zoho or Zoho Flow coverage is incomplete.
- Render `DATABASE_URL` versus `PG_URL` role separation needs confirmation.

## Later Dashboard Use

Under the dashboard button `Workflow maintenance`, these seeded tables can support:

- workflow list by platform/status/risk;
- connection review board;
- code asset ownership and env-var visibility;
- runbook coverage;
- open review/follow-up queue.

This seed does not add dashboard UI or Netlify function changes. A later dashboard task should expose these tables read-only after the seed has been reviewed in `ptb_monitoring_test`.
