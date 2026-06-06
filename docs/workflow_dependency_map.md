# Workflow dependency map

Inventory date: 2026-06-06

This map describes the operational chain per workflow:

`trigger -> actions -> database/API/e-mail/document output`

Uncertain dependencies are intentionally named. This file is a maintenance aid, not proof that every listed external workflow is currently active.

## Zapier Workflows

### zap_1: IMCD_NL_TreeCert_Postgres

Chain:

`Zoho Forms new form entry -> Zapier filters/paths -> PostgreSQL custom queries/updates -> Zoho Creator create records`

Known outputs:

- PostgreSQL tables: `users1`, `trees1`.
- Zoho Creator records/forms touched, exact app/form names not verified.

Uncertain:

- Whether a customer-visible certificate or email is completed after the Zoho Creator record.
- Whether production Zap is currently active.

Manual input needed:

- Confirm Zoho Creator app/form names.
- Confirm final customer evidence and runbook owner.

### zap_15: IMCD_BEL_TreeCert_Postgres

Chain:

`Zoho Forms new form entry -> Zapier filters/paths -> PostgreSQL custom queries/updates -> Zoho Creator create records`

Known outputs:

- PostgreSQL tables: `users1`, `trees1`.
- Zoho Creator records/forms touched, exact app/form names not verified.

Uncertain:

- Same as `zap_1`; likely Belgian variant.

Manual input needed:

- Confirm whether this shares the same Zoho Creator app/template as `zap_1`.

### zap_29: Shopify owned tree purchase to PostgreSQL

Chain:

`Shopify paid order -> filter -> PostgreSQL query -> Code by Zapier -> Looping line items -> PostgreSQL allocation/update -> Zoho Creator create record`

Known outputs:

- PostgreSQL tables: `trees1`, `users1`.
- Zoho Creator record evidence.

Uncertain:

- Inspected history showed filtered runs, not successful allocations.
- Relationship with `zap_135` may be duplicate, replacement, or test copy.

Manual input needed:

- Confirm whether `zap_29` or `zap_135` is the production SKU 02 path.
- Confirm order id and final allocation evidence for a recent Shopify order.

### zap_47: Shopify tokenized gift tree link flow

Chain:

`Shopify paid order for SKU 01 -> filter -> Code by Zapier token logic -> PostgreSQL tree/gift claim queries -> formatter date steps -> Zoho Creator create record -> Zoho Mail claim-link email`

Known outputs:

- PostgreSQL tables: `trees1`, `gift_claims`, `email_templates_01_gifttrees`.
- Zoho Creator record.
- Zoho Mail outbound email.

Uncertain:

- `SET` appears in extracted PostgreSQL table list and should be checked as SQL syntax artifact versus real table.
- Final claim completion after recipient uses link depends on `zap_61`.

Manual input needed:

- Confirm live email template and sender.
- Confirm token expiry and claim URL format.

### zap_61: ZAP B gift claim processing

Chain:

`Zoho Forms gift claim entry -> PostgreSQL gift_claim lookup -> filters/code/looping -> PostgreSQL allocation queries -> formatter/code -> Zoho Creator certificate/job record`

Known outputs:

- PostgreSQL tables: `gift_claims`, `users1`, `trees1`.
- Zoho Creator record.

Uncertain:

- The inventory describes certificate jobs, but the downstream Zoho Writer merge/email path is not proven.
- No Zapier history success was found in the inspected period.

Manual input needed:

- Confirm the form name used by gift claim links.
- Confirm certificate generation handoff.

### zap_95: Chargebee subscription flow

Chain:

`Chargebee payment_succeeded -> formatter/path logic -> Code by Zapier -> Zoho Mail alert/allocation emails -> PostgreSQL user/tree updates -> filters -> additional Zoho Mail sends`

Known outputs:

- PostgreSQL tables: `users1`, `trees1`.
- Zoho Mail outbound actions.

Uncertain:

- Workflow export name says `REVERTED`.
- Chargebee direct-to-Zoho CRM/Zoho Flow paths were not found in repo.
- Some inspected runs halted.

Manual input needed:

- Confirm if `zap_95` is current production subscription automation.
- Confirm Chargebee webhook/app configuration and connection.

### zap_124: Monthly Tree Report

Chain:

`Monthly schedule -> PostgreSQL tree query -> Code by Zapier report formatting -> Zoho Mail report email`

Known outputs:

- Reads `trees1`.
- Sends monthly Zoho Mail report.

Uncertain:

- Recipient list and success evidence are not standardized in a registry/event row.

Manual input needed:

- Confirm recipients and expected send day/time.

### zap_129: Forest Hero Photo Email

Chain:

`Hourly schedule -> PostgreSQL query for eligible photos/trees/users/email_log/unsent -> formatter/looping -> PostgreSQL log query -> Zoho Mail photo email`

Known outputs:

- Reads `photos`, `trees1`, `users1`, `email_log`, and query aliases/extracted names `base`, `params`, `unsent`.
- Writes or checks `email_log`.
- Sends Zoho Mail outbound email.

Uncertain:

- Many halted runs likely mean no eligible row, but this needs confirmation.
- Exact email_log write semantics are from Zapier SQL and not represented in repo code.

Manual input needed:

- Confirm halted-runs interpretation.
- Confirm whether this should emit monitoring events.

### zap_135: Copy zap b multiple Eigenbomen SKU02

Chain:

`Shopify paid order -> filter -> delay -> PostgreSQL rows query -> Code by Zapier -> Zoho Creator create record`

Known outputs:

- PostgreSQL tables: `trees1`, `users1`.
- Zoho Creator record.

Uncertain:

- Possible duplicate or replacement for `zap_29`.

Manual input needed:

- Decide canonical workflow id for SKU 02 owned tree purchases.

### zap_141: Shopify subscription manual Zoho Form

Chain:

`Zoho Forms new entry -> formatter/path/code -> Zoho Mail alert -> PostgreSQL user/tree updates -> Zoho Mail allocation emails`

Known outputs:

- PostgreSQL tables: `users1`, `trees1`.
- Zoho Mail outbound actions.

Uncertain:

- This is a manual/form-based Shopify subscription path, not a direct Shopify webhook.

Manual input needed:

- Confirm which Shopify products/orders should enter this form path.

### zap_172: Webhooks by Zapier

Chain:

`Webhook received -> Zapier filter -> Zoho Mail approval email`

Heartbeat pilot chain:

`Webhook received -> filter passed -> PostgreSQL heartbeat insert into monitoring.automation_events in ptb_monitoring_test -> Zoho Mail approval email`

Known outputs:

- Zoho Mail email: KETSO Academy upload approved.
- Planned/test monitoring event in `monitoring.automation_events`.

Uncertain:

- Current heartbeat proves pre-email workflow progress, not email delivery.

Manual input needed:

- Confirm whether a second post-email monitoring event should be added later.

### zap_175: KETSO Academy Zoho CRM onboarding

Chain:

`Zoho CRM contact new/updated -> filter -> PostgreSQL function/query process_academy_student_from_crm -> Zoho CRM update -> Zoho Mail onboarding email -> Zoho CRM status update`

Known outputs:

- PostgreSQL function/table reference: `process_academy_student_from_crm`.
- Zoho CRM fields: KETSO student ID, onboarding URL/status/invite fields.
- Zoho Mail onboarding email.

Uncertain:

- 13 errors in inspected history require review.
- Whether Zoho CRM or PostgreSQL is the authoritative Academy student state needs confirmation.

Manual input needed:

- Confirm error cause and retry procedure.
- Confirm owner for CRM field changes.

## Shopify and Chargebee Signals

### Shopify product catalog signals

Chain:

`Shopify product/order -> expected Zapier or manual workflow -> tree allocation, gift claim, subscription handling, or thank-you evidence`

Known:

- Product export contains gift tree, owned tree, donation, personal subscription, family subscription, and monthly donation entries.
- Zapier records exist for SKU 01 and SKU 02-like flows.

Uncertain:

- No Shopify order export was available.
- Direct Shopify to Zoho CRM flows were not found in repo evidence.

Manual input needed:

- Export Shopify orders/webhooks/apps.
- Confirm direct Shopify to Zoho CRM or Shopify to Zapier coverage.

### Chargebee subscription signals

Chain:

`Chargebee subscription/invoice/payment -> Zapier or Zoho automation -> PostgreSQL user/tree update -> Zoho Mail outbound evidence`

Known:

- Chargebee item/subscription/invoice exports exist.
- `zap_95` handles Chargebee `payment_succeeded`.

Uncertain:

- Direct Chargebee to Zoho CRM or Zoho Flow automations were not found in repo evidence.
- Exact item price mapping still needs export.

Manual input needed:

- Export Chargebee webhooks/apps.
- Confirm whether Zoho CRM is updated directly by Chargebee or only through Zapier/manual processes.

## Zoho Native Workflows

### Zoho Form to Zoho Creator

Chain:

`Zoho Form submission -> Zapier or Zoho Flow -> PostgreSQL update -> Zoho Creator record`

Known:

- Proven indirectly for `zap_1`, `zap_15`, and `zap_61`.

Uncertain:

- No Zoho Flow export was found.
- Direct Zoho Forms to Zoho Creator rules may exist outside Zapier.

Manual input needed:

- Export Zoho Flow.
- Inspect Zoho Creator app automations/workflows.

### Zoho Creator to Zoho Writer certificate merge

Chain:

`Zoho Creator certificate/job record -> Zoho Writer merge template -> generated certificate document -> possible Zoho Mail email`

Known:

- Certificate expectation appears in workflow registry and business context.

Uncertain:

- No repository code or export proves the Creator-to-Writer merge.
- Template names, merge fields, and output folder are unknown.

Manual input needed:

- Confirm Zoho Writer template names.
- Confirm trigger, merge field source, and storage/send path.

### Zoho Creator / Zoho Mail email sending

Chain:

`Zoho Creator record/state -> Zoho Mail send action or workflow -> customer/student email -> Zoho Mail outbox evidence`

Known:

- Zoho Mail evidence samples exist.

Uncertain:

- Whether Creator sends directly or Zapier sends on Creator state is unclear.

Manual input needed:

- Confirm all Creator email workflows and sender accounts.

## Code and Hosting Workflows

### Netlify monitoring functions

Chain:

`Dashboard fetch -> Netlify function -> MONITORING_DATABASE_URL -> monitoring schema read -> dashboard cards/tables`

Known endpoints:

- `monitoring-summary.js`
- `monitoring-events.js`
- `monitoring-outbound-messages.js`
- `monitoring-registry.js`

Uncertain:

- Exact production database user rights must be confirmed in Aiven.

Manual input needed:

- Confirm `MONITORING_DATABASE_URL` uses least-privilege read-only user in production.

### Render API / dashboard endpoints

Chain:

`Frontend/uploader/API request -> Render Express endpoint -> PostgreSQL via DATABASE_URL or PG_URL -> JSON response or table write`

Known:

- Tree/forest hero endpoints read public tree/user tables.
- Photo review and academy moderation endpoints write `photo_uploads_review` and `academy_point_events`.

Uncertain:

- `DATABASE_URL` versus `PG_URL` role separation is not fully documented.

Manual input needed:

- Confirm Render environment variables and database users.

### GitHub code and docs

Chain:

`Code/doc change -> review -> deploy or manual SQL/doc usage -> dashboard/API behavior`

Known:

- Monitoring docs, SQL templates, Netlify functions, frontend dashboard files, and API helpers are source-controlled.

Uncertain:

- Some operational automations live outside GitHub and need manual exports.

Manual input needed:

- Decide which external workflow exports must be stored in `docs/sources/`.
