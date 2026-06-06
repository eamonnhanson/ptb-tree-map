# Workflow maintenance datamodel plan

Date: 2026-06-06

This plan describes a test-safe datamodel for the workflow maintenance layer of the dashboard. It is documentation only. No SQL has been executed.

## Why These Tables Are Needed

The existing monitoring layer is event-oriented:

- `monitoring.automation_registry`
- `monitoring.automation_events`
- `monitoring.outbound_messages`

That layer answers what the dashboard knows about live or planned monitoring signals. The workflow maintenance layer answers a different set of questions:

- Which workflows exist across Zapier, Zoho, Shopify, Chargebee, PostgreSQL/Aiven, Render, Netlify, and GitHub?
- What does each workflow depend on?
- Which service connection or database user does it use?
- Which code files or docs would be touched if the workflow changes?
- Is there a runbook?
- When was it last reviewed and what remains uncertain?

The maintenance tables are designed as a governance and audit layer, not as runtime event tables.

## Proposed Tables

### `monitoring.workflow_registry`

Primary workflow maintenance register.

This is the database version of `docs/workflow_maintenance_registry.csv`. It stores the workflow id, platform, source/target systems, trigger, purpose, owner, status, risk, connection name, runbook file, and review dates.

The table uses `workflow_id` as a text primary key because ids come from many places: Zapier ids, Netlify function names, Render API labels, Shopify catalog signals, and temporary maintenance ids.

### `monitoring.workflow_dependencies`

Step and dependency map for each workflow.

This table supports chains like:

`trigger -> actions -> database/API/e-mail/document output`

It intentionally stores systems and workflow ids as text so uncertain or partial dependencies can be staged before the whole registry is perfect.

### `monitoring.workflow_connections`

Connection and credential inventory without secrets.

This table stores only metadata:

- system;
- connection name;
- username;
- role;
- rights summary;
- used by;
- secret location;
- review status.

It must never store passwords, tokens, API keys, or connection strings.

### `monitoring.workflow_code_assets`

Code and document asset inventory.

This table maps workflow maintenance to GitHub files and source-controlled docs, including Netlify functions, dashboard files, API files, SQL scripts, and inventory docs.

### `monitoring.workflow_runbooks`

Operational runbook index.

This table tracks the file and purpose of safe test steps, rollback notes, owner, status, and review dates. Runbooks may point to a single workflow or a platform-wide process.

### `monitoring.workflow_reviews`

Optional review history table.

This table records manual reviews, findings, risk changes, evidence source, and follow-up actions. It gives the dashboard a place to show stale reviews and open maintenance risks without mixing that history into runtime events.

## Relationship To Existing `automation_registry`

`monitoring.automation_registry` remains the lightweight runtime registry for monitored flows and dashboard cards.

`monitoring.workflow_registry` is broader:

- It can include flows that are not yet monitored.
- It can include platform connections and code-only workflows.
- It can include missing-source placeholders such as Zoho Flow or Zoho Writer merge workflows.
- It can track review dates, owners, runbooks, and risk.

The new table has an optional text field:

`related_automation_registry_flow_name`

This can point by convention to `monitoring.automation_registry.flow_name`, but it is not a hard foreign key. That keeps the maintenance model usable while the current live registry remains unchanged.

## Mapping From `workflow_maintenance_registry.csv`

Later import mapping:

| CSV column | Target table | Target column |
| --- | --- | --- |
| `workflow_id` | `workflow_registry` | `workflow_id` |
| `workflow_name` | `workflow_registry` | `workflow_name` |
| `platform` | `workflow_registry` | `platform` |
| `source_system` | `workflow_registry` | `source_system` |
| `target_system` | `workflow_registry` | `target_system` |
| `trigger` | `workflow_registry` | `trigger_description` |
| `business_purpose` | `workflow_registry` | `business_purpose` |
| `owner` | `workflow_registry` | `owner_name` |
| `status` | `workflow_registry` | `status` |
| `risk_level` | `workflow_registry` | `risk_level` |
| `reads_from` | `workflow_registry` and `workflow_dependencies` | `reads_from` |
| `writes_to` | `workflow_registry` and `workflow_dependencies` | `writes_to` |
| `database_user` | `workflow_registry` and `workflow_connections` | `database_user` / `username` |
| `connection_name` | `workflow_registry` and `workflow_connections` | `connection_name` |
| `code_assets` | `workflow_code_assets` | `file_path`, `related_workflows` |
| `runbook_file` | `workflow_runbooks` | `runbook_file` |
| `last_tested_at` | `workflow_registry` or `workflow_reviews` | `last_tested_at` / `reviewed_at` |
| `next_review_at` | `workflow_registry`, `workflow_connections`, `workflow_runbooks` | `next_review_at` |
| `notes` | all relevant tables | `notes` |

Additional import sources:

- `docs/workflow_dependency_map.md` -> `workflow_dependencies`
- `docs/workflow_connections_inventory.md` -> `workflow_connections`
- `docs/workflow_code_assets_inventory.md` -> `workflow_code_assets`
- future runbook docs -> `workflow_runbooks`
- manual review outcomes -> `workflow_reviews`

## Fields That Need Manual Completion

These fields are known to need human review before a production import:

- Active/paused production state for each Zapier workflow.
- Zoho Creator app names, form names, and record destinations.
- Zoho Writer certificate template names and merge trigger.
- Zoho Flow active flows and connected apps.
- Shopify webhook/app configuration and order coverage.
- Chargebee webhook/app configuration and direct Zoho links.
- Aiven privilege details for `avnadmin`, `web_ro`, `web_rw`, and `zapier_user`.
- Whether `MONITORING_DATABASE_URL` uses read-only credentials in every Netlify context.
- Render `DATABASE_URL` and `PG_URL` role separation.
- Real runbook files for high-risk flows such as `zap_175`, `zap_95`, and certificate generation.

## Dashboard Shape

The dashboard should expose this under the button:

`Workflow maintenance`

Suggested tabs:

- `Workflows`: rows from `workflow_registry`, with status, risk, owner, last tested, and next review.
- `Dependencies`: chain view from `workflow_dependencies`.
- `Connections`: connection and database-user review status from `workflow_connections`.
- `Code assets`: file and environment-variable metadata from `workflow_code_assets`.
- `Runbooks`: operational docs from `workflow_runbooks`.
- `Reviews`: stale reviews, open findings, and risk changes from `workflow_reviews`.

Useful first dashboard indicators:

- workflows without runbook;
- workflows with `missing_source`, `unknown`, or `not_audited` status;
- high-risk workflows with overdue review;
- connections with `needs_manual_review`;
- code assets with unknown owner or environment variables;
- dependencies marked uncertain or missing source.

## Test-Safe SQL Approach

The SQL file is:

`docs/sql/005_workflow_maintenance_datamodel.sql`

Safety choices:

- Transaction starts with `BEGIN;`.
- Database guard fails outside `ptb_monitoring_test`.
- Only `CREATE SCHEMA IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, comments, and indexes are included.
- No `DROP`, `TRUNCATE`, `DELETE`, or `ALTER` on existing tables.
- The default final statement is `ROLLBACK;`.
- `-- COMMIT;` is included only as a comment for a later reviewed test run.

## Open Risks

- The maintenance tables may drift from `automation_registry` unless an import/update process is designed later.
- Some records represent signals or catalog items, not executable workflows; the dashboard should label these clearly.
- Too many text fields can allow inconsistent names. This is intentional for the first safe model, but later normalization may be useful.
- Connection rights are currently mostly inferred and must not be treated as confirmed security facts.
- Zoho Flow, Zoho Creator, and Zoho Writer are underrepresented until exports or manual screenshots/reviews are added.
- A production rollout needs a separate migration plan, backup/checklist, and explicit approval.
