# Workflow maintenance inventory

Inventory date: 2026-06-06

## Purpose

The workflow maintenance layer is the operational register for every automation that can create, move, enrich, notify, allocate, merge, or expose Plant N Boom, KETSO Academy, and dashboard data.

This layer is broader than Zapier. Zapier is only one automation surface. The same maintenance rules apply to Shopify, Chargebee, Zoho Flow, Zoho CRM, Zoho Forms, Zoho Creator, Zoho Writer, Zoho Mail, PostgreSQL/Aiven, Render, Netlify, and GitHub code.

The maintenance layer should answer five questions before a workflow is trusted:

- What triggers it?
- What systems does it read from?
- What systems, tables, files, emails, or documents does it write to?
- Which connection or database user does it use?
- Where is the runbook, owner, and next review date?

## Fixed Rule

No new workflow without a registry entry.

That means every new Zap, Zoho Flow, Shopify webhook/app automation, Chargebee automation, Creator/Writer merge, Mail rule, database job, Render endpoint, Netlify function, or dashboard integration must be registered before it is treated as production-maintained.

The registry entry does not need to be perfect on day one, but it must exist with:

- workflow id or temporary id;
- source and target system;
- trigger;
- business purpose;
- owner;
- connection or credential location;
- affected tables/files/endpoints;
- status and risk level;
- next review date.

## Dashboard Button

The dashboard should get a dedicated button:

`Workflow maintenance`

This button should open a maintenance view that is separate from live incident monitoring. Live monitoring answers "what is happening now"; workflow maintenance answers "what exists, who owns it, and what depends on what".

## Proposed Tabs

### Workflows

Primary registry view based on `docs/workflow_maintenance_registry.csv`.

Expected columns:

- workflow id/name;
- platform;
- source and target system;
- trigger;
- business purpose;
- owner;
- status;
- risk;
- last tested;
- next review;
- runbook link.

### Dependencies

Chain view for each workflow:

`trigger -> actions -> database/API/email/document output`

This should show uncertain dependencies explicitly rather than hiding them. For example, Zoho Creator to Zoho Writer certificate merge is expected but not yet proven from repo evidence.

### Connections

Credential and connection inventory without passwords.

This tab should show:

- system;
- connection name;
- username;
- role;
- rights;
- workflows using the connection;
- secret location;
- review status.

### Code Assets

GitHub/code asset inventory for functions, dashboard files, API files, SQL scripts, and docs.

This tab should help answer "which code file would break or change this workflow?".

### Runbooks

Runbook index for operational actions:

- how to test a workflow safely;
- how to confirm the right database/database user;
- how to validate dashboard evidence;
- how to pause or rollback safely;
- who must approve changes.

## Existing Live Monitoring Context

The current dashboard already has these monitoring tables:

- `monitoring.automation_registry`
- `monitoring.automation_events`
- `monitoring.outbound_messages`

The workflow maintenance inventory does not change these tables. It is a documentation and governance layer that can later feed or enrich `monitoring.automation_registry` after review.

## Current Source Coverage

Strong source coverage:

- Zapier export and history from `docs/sources/zapier/`.
- Master registry in `docs/master_workflow_registry.csv`.
- Monitoring schema and seed plans in `docs/sql/` and monitoring docs.
- GitHub code for Netlify functions, dashboard frontend, Render API, and SQL templates.
- Shopify product catalog export.
- Chargebee item/subscription/invoice exports.
- Zoho Mail samples and requirements.

Weak or missing source coverage:

- Live Shopify order and webhook configuration.
- Live Chargebee webhook/app configuration.
- Zoho Flow export.
- Direct Zoho Creator app/form definitions.
- Zoho Writer merge templates.
- Zoho Mail live folder/API state.
- Exact active/paused production state for each Zap.
- Exact database role privileges in Aiven.

## Maintenance Status Definitions

- `implemented`: code or source-controlled endpoint exists and is documented.
- `partially_audited`: source evidence exists, but final business outcome or live status still needs verification.
- `not_audited`: workflow appears in inventory but has not been validated.
- `unknown`: product/catalog signal exists, but automation coverage is not verified.
- `missing_source`: workflow is expected operationally, but no direct source/export/code evidence was found.
- `inferred_needs_verification`: workflow relationship is likely from other records, but needs manual confirmation.

## First Manual Follow-up List

- Export or inspect Zoho Flow and add every active flow to the registry.
- Confirm Zoho Creator app/form names for Zap-created records.
- Confirm Zoho Writer certificate templates and merge triggers.
- Confirm whether certificate emails are sent by Zoho Creator, Zoho Mail, Zapier, or another path.
- Confirm active/paused state of all 12 exported Zapier workflows.
- Confirm database users and privileges in Aiven.
- Confirm whether Shopify direct-to-Zoho CRM flows exist outside Zapier.
- Confirm whether Chargebee direct-to-Zoho CRM or Zoho Flow automations exist outside Zapier.
