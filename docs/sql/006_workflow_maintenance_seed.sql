-- Plant N Boom / KETSO workflow maintenance seed
-- Migration: 006_workflow_maintenance_seed.sql
-- Scope: seed workflow maintenance tables in ptb_monitoring_test only.
--
-- SAFETY:
-- - No SQL from this file has been executed while creating it.
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
-- - no secrets, passwords, tokens, API keys, or connection strings.

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'ptb_monitoring_test' THEN
    RAISE EXCEPTION
      'Refusing to seed workflow maintenance tables in database %. Expected ptb_monitoring_test.',
      current_database();
  END IF;
END
$$;

SELECT
  'before_seed' AS phase,
  (SELECT count(*) FROM monitoring.workflow_registry) AS workflow_registry_count,
  (SELECT count(*) FROM monitoring.workflow_connections) AS workflow_connections_count,
  (SELECT count(*) FROM monitoring.workflow_code_assets) AS workflow_code_assets_count,
  (SELECT count(*) FROM monitoring.workflow_runbooks) AS workflow_runbooks_count,
  (SELECT count(*) FROM monitoring.workflow_reviews) AS workflow_reviews_count;

INSERT INTO monitoring.workflow_registry (
  workflow_id,
  workflow_name,
  platform,
  source_system,
  target_system,
  trigger_description,
  business_purpose,
  owner_name,
  status,
  risk_level,
  reads_from,
  writes_to,
  database_user,
  connection_name,
  runbook_file,
  last_tested_at,
  next_review_at,
  related_automation_registry_flow_name,
  notes
)
VALUES
  ($$zap_1$$, $$IMCD_NL_TreeCert_Postgres$$, $$Zapier$$, $$Zoho Forms$$, $$PostgreSQL; Zoho Creator$$, $$new_form_entry$$, $$Allocate tree/certificate record from Zoho Form submission$$, $$Eamonn$$, $$partially_audited$$, $$low$$, $$Zoho Forms payload; users1; trees1$$, $$users1; trees1; Zoho Creator record$$, $$zapier_user$$, $$Zapier defaultdb connection$$, null, DATE '2026-05-31', DATE '2026-06-30', $$IMCD_NL_TreeCert_Postgres$$, $$Zoho Creator app/form names still need verification in Zapier UI. Code assets: docs/zapier_workflow_registry.csv$$),
  ($$zap_15$$, $$IMCD_BEL_TreeCert_Postgres$$, $$Zapier$$, $$Zoho Forms$$, $$PostgreSQL; Zoho Creator$$, $$new_form_entry$$, $$Allocate Belgian IMCD tree/certificate record from Zoho Form submission$$, $$Eamonn$$, $$partially_audited$$, $$low$$, $$Zoho Forms payload; users1; trees1$$, $$users1; trees1; Zoho Creator record$$, $$zapier_user$$, $$Zapier defaultdb connection$$, null, DATE '2026-05-31', DATE '2026-06-30', $$IMCD_BEL_TreeCert_Postgres$$, $$Zoho Creator app/form names still need verification in Zapier UI. Code assets: docs/zapier_workflow_registry.csv$$),
  ($$zap_29$$, $$zap a multipleEigenbomenShopifyToPostgreSQL SKU 02$$, $$Zapier$$, $$Shopify$$, $$PostgreSQL; Zoho Creator$$, $$new_paid_order_v3$$, $$Allocate owned tree purchase to PostgreSQL and create Zoho Creator evidence$$, $$Eamonn$$, $$partially_audited$$, $$medium$$, $$Shopify order; trees1; users1$$, $$trees1; users1; Zoho Creator record$$, $$zapier_user$$, $$Zapier defaultdb connection$$, null, DATE '2026-05-31', DATE '2026-06-30', $$zap a multipleEigenbomenShopifyToPostgreSQL SKU 02$$, $$History showed filtered runs only in inspected period; production active/paused state must be checked. Code assets: docs/zapier_workflow_registry.csv$$),
  ($$zap_47$$, $$Shopify tokenized gift tree link flow$$, $$Zapier$$, $$Shopify$$, $$PostgreSQL; Zoho Creator; Zoho Mail$$, $$new_paid_order_v3$$, $$Create gift claim token reserve trees and send claim-link email$$, $$Eamonn$$, $$partially_audited$$, $$medium$$, $$Shopify order; trees1; gift_claims; email_templates_01_gifttrees$$, $$gift_claims; Zoho Creator record; Zoho Mail outbound$$, $$zapier_user$$, $$Zapier defaultdb connection$$, null, DATE '2026-05-31', DATE '2026-06-30', $$Shopify tokenized gift tree link flow$$, $$Known as zap a- Shopify -> Tokenized Gift Tree Link SKU 01. Code assets: docs/zapier_workflow_registry.csv$$),
  ($$zap_61$$, $$ZAP B gift claim processing$$, $$Zapier$$, $$Zoho Forms$$, $$PostgreSQL; Zoho Creator$$, $$new_form_entry$$, $$Process gift tree claim form allocate claimed trees and create certificate jobs$$, $$Eamonn$$, $$not_audited$$, $$low$$, $$Zoho Forms payload; gift_claims; users1; SET; trees1$$, $$gift_claims; users1; trees1; Zoho Creator record$$, $$zapier_user$$, $$Zapier defaultdb connection$$, null, DATE '2026-05-31', DATE '2026-06-30', $$ZAP B gift claim processing$$, $$Certificate job output is inferred from Zapier inventory and needs manual confirmation. Code assets: docs/zapier_workflow_registry.csv$$),
  ($$zap_95$$, $$Chargebee subscription flow$$, $$Zapier$$, $$Chargebee$$, $$PostgreSQL; Zoho Mail$$, $$payment_succeeded$$, $$Handle subscription/customer record allocate subscription tree and send allocation mail$$, $$Eamonn$$, $$partially_audited$$, $$medium$$, $$Chargebee payment; users1; trees1$$, $$users1; trees1; Zoho Mail outbound$$, $$zapier_user$$, $$Zapier defaultdb connection$$, null, DATE '2026-05-31', DATE '2026-06-30', $$Chargebee subscription flow$$, $$Workflow name in export is Nieuw abonnes chargebee REVERTED; 8 halted runs in inspected history. Code assets: docs/zapier_workflow_registry.csv$$),
  ($$zap_124$$, $$Monthly Tree Report$$, $$Zapier$$, $$Schedule$$, $$Zoho Mail; PostgreSQL$$, $$everyMonth$$, $$Email monthly tree report from PostgreSQL tree data$$, $$Eamonn$$, $$partially_audited$$, $$low$$, $$trees1$$, $$Zoho Mail outbound$$, $$zapier_user$$, $$Zapier defaultdb connection$$, null, DATE '2026-05-31', DATE '2026-06-30', $$Monthly Tree Report$$, $$Needs final workflow/audit log row and live recipient confirmation. Code assets: docs/zapier_workflow_registry.csv$$),
  ($$zap_129$$, $$Forest Hero Photo Email$$, $$Zapier$$, $$Schedule$$, $$Zoho Mail; PostgreSQL$$, $$everyHour$$, $$Send forest photo email once per user and log to email_log$$, $$Eamonn$$, $$partially_audited$$, $$low$$, $$photos; trees1; users1; email_log; unsent$$, $$email_log; Zoho Mail outbound$$, $$zapier_user$$, $$Zapier defaultdb connection$$, null, DATE '2026-05-31', DATE '2026-06-30', $$Forest Hero Photo Email$$, $$Large halted count likely due no eligible rows; confirm expected behavior. Code assets: docs/zapier_workflow_registry.csv$$),
  ($$zap_135$$, $$Copy zap b multiple Eigenbomen SKU02$$, $$Zapier$$, $$Shopify$$, $$PostgreSQL; Zoho Creator$$, $$new_paid_order_v3$$, $$Allocate owned tree purchase to PostgreSQL and create Zoho Creator evidence$$, $$Eamonn$$, $$partially_audited$$, $$medium$$, $$Shopify order; trees1; users1$$, $$trees1; users1; Zoho Creator record$$, $$zapier_user$$, $$Zapier defaultdb connection$$, null, DATE '2026-05-31', DATE '2026-06-30', $$Copy zap b multiple Eigenbomen SKU02$$, $$Possible duplicate/replacement of zap_29; ownership and active state need review. Code assets: docs/zapier_workflow_registry.csv$$),
  ($$zap_141$$, $$Shopify subscription manual Zoho Form$$, $$Zapier$$, $$Zoho Forms$$, $$PostgreSQL; Zoho Mail$$, $$new_form_entry$$, $$Handle manually submitted Shopify subscription allocate tree and send allocation mail$$, $$Eamonn$$, $$partially_audited$$, $$medium$$, $$Zoho Forms payload; users1; trees1$$, $$users1; trees1; Zoho Mail outbound$$, $$zapier_user$$, $$Zapier defaultdb connection$$, null, DATE '2026-05-31', DATE '2026-06-30', $$Shopify subscription manual Zoho Form$$, $$Manual Shopify subscription intake via Zoho Form rather than direct Shopify trigger. Code assets: docs/zapier_workflow_registry.csv$$),
  ($$zap_172$$, $$Zapier Webhooks by Zapier / zap_172$$, $$Zapier$$, $$Webhook$$, $$Zoho Mail; monitoring.automation_events$$, $$hook_v2$$, $$Send KETSO Academy upload approval email and provide heartbeat pilot$$, $$Eamonn$$, $$partially_audited$$, $$low$$, $$Webhook payload$$, $$Zoho Mail outbound; monitoring.automation_events$$, $$zapier_user$$, $$Zapier ptb_monitoring_test connection$$, $$docs/monitoring_zap172_heartbeat_plan.md$$, DATE '2026-06-04', DATE '2026-06-30', $$Zapier Webhooks by Zapier / zap_172$$, $$Heartbeat plan writes only to ptb_monitoring_test when explicitly enabled. Code assets: docs/monitoring_zap172_heartbeat_plan.md; docs/sql/004_monitoring_zap172_heartbeat_template.sql$$),
  ($$zap_175$$, $$KETSO Academy Zoho CRM onboarding$$, $$Zapier$$, $$Zoho CRM$$, $$PostgreSQL; Zoho CRM; Zoho Mail$$, $$new_or_updated_module_entry$$, $$Create/update Academy onboarding data and send onboarding email$$, $$Eamonn$$, $$partially_audited$$, $$high$$, $$Zoho CRM contact; process_academy_student_from_crm$$, $$process_academy_student_from_crm; Zoho CRM fields; Zoho Mail outbound$$, $$zapier_user$$, $$Zapier defaultdb connection$$, null, DATE '2026-05-31', DATE '2026-06-30', $$KETSO Academy Zoho CRM onboarding$$, $$13 errors in inspected history; high priority for runbook. Code assets: docs/zapier_workflow_registry.csv$$),
  ($$shopify_gift_tree_catalog$$, $$Shopify product Geef een boom cadeau$$, $$Shopify$$, $$Shopify$$, $$Zapier; Zoho Mail; PostgreSQL$$, $$product purchased$$, $$Product catalog signal for gift tree purchase requiring claim link and likely certificate$$, $$Eamonn$$, $$unknown$$, $$medium$$, $$Shopify product export$$, $$Unknown downstream until order audit$$, $$None$$, $$Shopify admin$$, null, DATE '2026-05-31', DATE '2026-06-30', $$Shopify product Geef een boom cadeau$$, $$Expected to relate to zap_47 but matching order evidence was not verified. Code assets: docs/shopify_product_workflow_map.md$$),
  ($$shopify_owned_tree_catalog$$, $$Shopify product Koop een boom voor jezelf$$, $$Shopify$$, $$Shopify$$, $$Zapier; PostgreSQL; Zoho Creator$$, $$product purchased$$, $$Product catalog signal for owned tree purchase allocation$$, $$Eamonn$$, $$unknown$$, $$medium$$, $$Shopify product export$$, $$Unknown downstream until order audit$$, $$None$$, $$Shopify admin$$, null, DATE '2026-05-31', DATE '2026-06-30', $$Shopify product Koop een boom voor jezelf$$, $$Expected to relate to zap_29 or zap_135 but matching order evidence was not verified. Code assets: docs/shopify_product_workflow_map.md$$),
  ($$shopify_subscription_catalog$$, $$Shopify subscription products$$, $$Shopify$$, $$Shopify$$, $$Chargebee; Zapier; PostgreSQL; Zoho Mail$$, $$product purchased$$, $$Product catalog signal for recurring subscription handling$$, $$Eamonn$$, $$unknown$$, $$medium$$, $$Shopify product export; Chargebee plan map$$, $$Unknown downstream until order/subscription audit$$, $$None$$, $$Shopify admin; Chargebee admin$$, null, DATE '2026-05-31', DATE '2026-06-30', $$Shopify subscription products$$, $$Persoons-abonnement and Gezins-abonnement map loosely to Chargebee plans but order coverage is not complete. Code assets: docs/shopify_product_workflow_map.md; docs/chargebee_subscription_map.md$$),
  ($$chargebee_subscription_plans$$, $$Chargebee subscription plan coverage$$, $$Chargebee$$, $$Chargebee$$, $$Zapier; PostgreSQL; Zoho Mail$$, $$payment_succeeded / first_invoice_generated$$, $$Subscription plan signal for allocation welcome/thank-you email and follow-up$$, $$Eamonn$$, $$partially_audited$$, $$medium$$, $$Chargebee subscriptions; Chargebee invoices; Chargebee items$$, $$users1; trees1; Zoho Mail outbound$$, $$zapier_user$$, $$Zapier defaultdb connection$$, null, DATE '2026-05-31', DATE '2026-06-30', $$Chargebee subscription plan coverage$$, $$Plan-level record covering exported Chargebee plans; exact item-price mapping still needs export. Code assets: docs/chargebee_subscription_map.md; docs/chargebee_audit_gap_report.md$$),
  ($$zoho_form_to_creator_treecert$$, $$Zoho Form to Zoho Creator certificate records$$, $$Zoho Forms / Zoho Creator$$, $$Zoho Forms$$, $$Zoho Creator; PostgreSQL$$, $$new_form_entry$$, $$Create certificate/tree allocation records from form submissions$$, $$Eamonn$$, $$inferred_needs_verification$$, $$medium$$, $$Zoho Forms submissions; users1; trees1$$, $$Zoho Creator records; users1; trees1$$, $$zapier_user$$, $$Zapier defaultdb connection$$, null, DATE '2026-05-31', DATE '2026-06-30', $$Zoho Form to Zoho Creator certificate records$$, $$Covered through zap_1 and zap_15; direct Zoho Flow/Creator automation inventory not found. Code assets: docs/zapier_workflow_registry.csv$$),
  ($$zoho_creator_writer_certificate_merge$$, $$Zoho Creator to Zoho Writer certificate merge$$, $$Zoho Creator / Zoho Writer$$, $$Zoho Creator$$, $$Zoho Writer; Zoho Mail$$, $$record created / certificate job ready$$, $$Generate certificate documents and prepare/send customer evidence$$, $$Eamonn$$, $$missing_source$$, $$high$$, $$Zoho Creator certificate/job records$$, $$Zoho Writer merge document; email attachment$$, $$unknown$$, $$Zoho Creator/Writer connection$$, null, DATE '2026-05-31', DATE '2026-06-30', $$Zoho Creator to Zoho Writer certificate merge$$, $$No repo implementation or export found; Eamonn must confirm app names templates and trigger. Code assets: docs/master_workflow_registry.csv$$),
  ($$zoho_creator_mail_certificate_email$$, $$Zoho Creator / Zoho Mail certificate email$$, $$Zoho Creator / Zoho Mail$$, $$Zoho Creator$$, $$Zoho Mail$$, $$certificate ready$$, $$Send certificate or certificate-related customer email$$, $$Eamonn$$, $$missing_source$$, $$high$$, $$Zoho Creator certificate/job records$$, $$Zoho Mail outbound$$, $$unknown$$, $$Zoho Mail connection$$, null, DATE '2026-05-31', DATE '2026-06-30', $$Zoho Creator / Zoho Mail certificate email$$, $$Email evidence exists as Zoho Mail signal category but live Creator-to-Mail flow source is missing. Code assets: docs/master_workflow_registry.csv; docs/zoho_mail_source_inventory.md$$),
  ($$zoho_mail_outbox_evidence$$, $$Zoho Mail outbound evidence signals$$, $$Zoho Mail$$, $$Zoho Mail$$, $$Monitoring dashboard$$, $$manual export / future API$$, $$Provide evidence for sent tree allocation onboarding subscription and certificate emails$$, $$Eamonn$$, $$partially_audited$$, $$low$$, $$Zoho Mail outbox samples$$, $$monitoring.outbound_messages future import$$, $$None$$, $$Zoho Mail API or manual export$$, null, DATE '2026-05-31', DATE '2026-06-30', $$Zoho Mail outbound evidence signals$$, $$Exact live folders and API/export access need confirmation. Code assets: docs/zoho_mail_source_inventory.md; docs/zoho_mail_dashboard_signal_candidates.md$$),
  ($$zoho_flow_cross_zoho_apps$$, $$Zoho Flow cross-Zoho automations$$, $$Zoho Flow$$, $$Zoho apps$$, $$Zoho apps$$, $$event-based Zoho Flow trigger$$, $$Catch unregistered Zoho-to-Zoho automations that bypass Zapier$$, $$Eamonn$$, $$missing_source$$, $$high$$, $$Unknown Zoho Flow sources$$, $$Unknown Zoho targets$$, $$unknown$$, $$Zoho Flow connections$$, null, DATE '2026-06-06', DATE '2026-06-30', $$Zoho Flow cross-Zoho automations$$, $$No Zoho Flow export found in repo; must be manually exported or reviewed in Zoho Flow UI. Code assets: docs/workflow_source_inventory.md$$),
  ($$render_tree_map_api$$, $$Render API / dashboard endpoints$$, $$Render$$, $$HTTP clients; Cloudflare Pages; Netlify functions$$, $$PostgreSQL$$, $$HTTP API request$$, $$Serve tree map forest hero academy upload review and moderation APIs$$, $$Eamonn$$, $$partially_audited$$, $$medium$$, $$DATABASE_URL; PG_URL; public tables; review tables$$, $$photo_uploads_review; academy_point_events$$, $$web_ro / web_rw$$, $$DATABASE_URL; PG_URL$$, $$docs/automation_inventory.md$$, DATE '2026-05-31', DATE '2026-06-30', $$Render API / dashboard endpoints$$, $$Repository inventory found no Shopify/Chargebee writers in Render code. Code assets: server.js; api/db.js; api/trees.js; api/savePhotoReview.js; api/getPhotoReviewGallery.js; api/getStudentGallery.js$$),
  ($$netlify_monitoring_summary$$, $$Netlify monitoring summary function$$, $$Netlify$$, $$Monitoring dashboard$$, $$PostgreSQL / Aiven$$, $$GET /.netlify/functions/monitoring-summary$$, $$Read live monitoring counts from monitoring schema$$, $$Eamonn$$, $$implemented$$, $$medium$$, $$monitoring.automation_events; monitoring.outbound_messages; monitoring.automation_registry$$, $$None$$, $$web_ro$$, $$MONITORING_DATABASE_URL$$, null, DATE '2026-06-04', DATE '2026-06-30', $$Netlify monitoring summary function$$, $$Guard checks ptb_monitoring_test in function code. Code assets: netlify/functions/monitoring-summary.js$$),
  ($$netlify_monitoring_events$$, $$Netlify monitoring events function$$, $$Netlify$$, $$Monitoring dashboard$$, $$PostgreSQL / Aiven$$, $$GET /.netlify/functions/monitoring-events$$, $$Read live automation events for dashboard$$, $$Eamonn$$, $$implemented$$, $$medium$$, $$monitoring.automation_events$$, $$None$$, $$web_ro$$, $$MONITORING_DATABASE_URL$$, null, DATE '2026-06-04', DATE '2026-06-30', $$Netlify monitoring events function$$, $$Read-only dashboard endpoint; no secrets in repo. Code assets: netlify/functions/monitoring-events.js$$),
  ($$netlify_monitoring_outbound$$, $$Netlify monitoring outbound messages function$$, $$Netlify$$, $$Monitoring dashboard$$, $$PostgreSQL / Aiven$$, $$GET /.netlify/functions/monitoring-outbound-messages$$, $$Read outbound message evidence for dashboard$$, $$Eamonn$$, $$implemented$$, $$medium$$, $$monitoring.outbound_messages$$, $$None$$, $$web_ro$$, $$MONITORING_DATABASE_URL$$, null, DATE '2026-06-04', DATE '2026-06-30', $$Netlify monitoring outbound messages function$$, $$Read-only dashboard endpoint; no secrets in repo. Code assets: netlify/functions/monitoring-outbound-messages.js$$),
  ($$netlify_monitoring_registry$$, $$Netlify monitoring registry function$$, $$Netlify$$, $$Monitoring dashboard$$, $$PostgreSQL / Aiven$$, $$GET /.netlify/functions/monitoring-registry$$, $$Read automation registry rows for dashboard$$, $$Eamonn$$, $$implemented$$, $$medium$$, $$monitoring.automation_registry$$, $$None$$, $$web_ro$$, $$MONITORING_DATABASE_URL$$, null, DATE '2026-06-04', DATE '2026-06-30', $$Netlify monitoring registry function$$, $$Registry is live monitoring source but maintenance registry is currently documentation only. Code assets: netlify/functions/monitoring-registry.js$$),
  ($$github_monitoring_docs$$, $$GitHub-code monitoring docs and SQL assets$$, $$GitHub$$, $$Repository maintainers$$, $$Dashboard/API/SQL docs$$, $$file change / review$$, $$Maintain source-controlled monitoring docs SQL templates and implementation references$$, $$Eamonn$$, $$implemented$$, $$low$$, $$docs/*.md; docs/*.csv; docs/sql/*.sql$$, $$Git repository only$$, $$None$$, $$GitHub$$, null, DATE '2026-06-06', DATE '2026-06-30', $$GitHub-code monitoring docs and SQL assets$$, $$No commit or push performed for this inventory. Code assets: docs/master_workflow_registry.csv; docs/sql/001_monitoring_datamodel.sql; docs/sql/002_monitoring_registry_seed.sql$$)
ON CONFLICT (workflow_id) DO UPDATE
SET
  workflow_name = EXCLUDED.workflow_name,
  platform = EXCLUDED.platform,
  source_system = EXCLUDED.source_system,
  target_system = EXCLUDED.target_system,
  trigger_description = EXCLUDED.trigger_description,
  business_purpose = EXCLUDED.business_purpose,
  owner_name = EXCLUDED.owner_name,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  reads_from = EXCLUDED.reads_from,
  writes_to = EXCLUDED.writes_to,
  database_user = EXCLUDED.database_user,
  connection_name = EXCLUDED.connection_name,
  runbook_file = EXCLUDED.runbook_file,
  last_tested_at = EXCLUDED.last_tested_at,
  next_review_at = EXCLUDED.next_review_at,
  related_automation_registry_flow_name = EXCLUDED.related_automation_registry_flow_name,
  notes = EXCLUDED.notes,
  updated_at = now();

INSERT INTO monitoring.workflow_connections (
  system,
  connection_name,
  username,
  role_name,
  rights_summary,
  used_by,
  secret_location,
  review_status,
  least_privilege_status,
  next_review_at,
  owner_name,
  notes
)
SELECT seeded.*
FROM (
  VALUES
    ($$PostgreSQL / Aiven$$, $$Aiven admin connection$$, $$avnadmin$$, $$database admin$$, $$admin; exact rights not listed in repo$$, $$manual database administration; initial setup only$$, $$Aiven console / local admin secret store$$, $$needs_manual_review$$, $$not_reviewed$$, DATE '2026-06-30', $$Eamonn$$, $$Reserved for administration, not day-to-day automations.$$),
    ($$PostgreSQL / Aiven$$, $$Render read-only or dashboard read connection$$, $$web_ro$$, $$application read-only$$, $$expected SELECT on public/monitoring tables; exact grants need confirmation$$, $$Render read APIs if configured; Netlify monitoring functions if MONITORING_DATABASE_URL uses this user$$, $$Render or Netlify environment variables$$, $$needs_manual_review$$, $$needs_confirmation$$, DATE '2026-06-30', $$Eamonn$$, $$Preferred user for dashboard reads.$$),
    ($$PostgreSQL / Aiven$$, $$Render read-write application connection$$, $$web_rw$$, $$application read-write$$, $$expected SELECT/INSERT/UPDATE on operational tables; exact grants need confirmation$$, $$Render photo review and academy moderation write endpoints$$, $$Render environment variable DATABASE_URL or equivalent$$, $$needs_manual_review$$, $$needs_confirmation$$, DATE '2026-06-30', $$Eamonn$$, $$Limit to application write paths that need it.$$),
    ($$PostgreSQL / Aiven$$, $$Zapier production database connection$$, $$zapier_user$$, $$automation read-write$$, $$expected SELECT/INSERT/UPDATE for Zapier allocation workflows; exact grants need confirmation$$, $$zap_1; zap_15; zap_29; zap_47; zap_61; zap_95; zap_124; zap_129; zap_135; zap_141; zap_175$$, $$Zapier PostgreSQL app connection$$, $$needs_manual_review$$, $$needs_confirmation$$, DATE '2026-06-30', $$Eamonn$$, $$Review per workflow because many Zaps write production tables.$$),
    ($$Netlify$$, $$MONITORING_DATABASE_URL$$, $$unknown, should be web_ro$$, $$serverless database connection$$, $$should be read-only for dashboard functions; test functions guard against wrong DB name$$, $$monitoring-summary; monitoring-events; monitoring-outbound-messages; monitoring-registry$$, $$Netlify environment variable MONITORING_DATABASE_URL$$, $$needs_manual_review$$, $$needs_confirmation$$, DATE '2026-06-30', $$Eamonn$$, $$No full connection string stored here.$$),
    ($$Zapier$$, $$Zapier defaultdb connection$$, $$zapier_user$$, $$production automation connection$$, $$read/write against production defaultdb; exact grants unknown$$, $$production Zapier workflows except heartbeat test connection$$, $$Zapier connected account for PostgreSQL$$, $$needs_manual_review$$, $$needs_confirmation$$, DATE '2026-06-30', $$Eamonn$$, $$Must not be reused for ptb_monitoring_test heartbeat.$$),
    ($$Zapier$$, $$Zapier ptb_monitoring_test connection$$, $$zapier_user or dedicated monitoring user$$, $$test monitoring writer$$, $$insert heartbeat into ptb_monitoring_test.monitoring.automation_events only when guarded$$, $$zap_172 heartbeat pilot$$, $$Zapier connected account for PostgreSQL pointing to ptb_monitoring_test$$, $$partially_reviewed$$, $$partially_reviewed$$, DATE '2026-06-30', $$Eamonn$$, $$Separate from defaultdb connection for heartbeat pilot.$$),
    ($$Render$$, $$DATABASE_URL$$, $$unknown, likely web_rw$$, $$application database connection$$, $$read/write for backend APIs; exact grants unknown$$, $$server.js; api/db.js; savePhotoReview; moderation endpoints$$, $$Render environment variables$$, $$needs_manual_review$$, $$needs_confirmation$$, DATE '2026-06-30', $$Eamonn$$, $$No value stored here; role separation needs review.$$),
    ($$Render$$, $$PG_URL$$, $$unknown, should be web_ro$$, $$tree lookup database connection$$, $$read-only tree lookup expected$$, $$api/trees.js$$, $$Render environment variable PG_URL$$, $$needs_manual_review$$, $$needs_confirmation$$, DATE '2026-06-30', $$Eamonn$$, $$Separate tree lookup connection in code.$$),
    ($$Zoho Mail$$, $$Zoho Mail Zapier/API connection$$, $$unknown$$, $$outbound email connection$$, $$send mail and/or read outbox evidence; exact scopes unknown$$, $$zap_47; zap_95; zap_124; zap_129; zap_141; zap_172; zap_175; Zoho Mail evidence workflows$$, $$Zapier connected Zoho Mail account / future Zoho Mail API secret$$, $$needs_manual_review$$, $$needs_confirmation$$, DATE '2026-06-30', $$Eamonn$$, $$Live folder/API state still needs confirmation.$$),
    ($$Zoho CRM$$, $$Zoho CRM Zapier connection$$, $$unknown$$, $$CRM automation connection$$, $$read/update contacts and Academy onboarding fields$$, $$zap_175$$, $$Zapier connected Zoho CRM account$$, $$needs_manual_review$$, $$needs_confirmation$$, DATE '2026-06-30', $$Eamonn$$, $$Confirm Academy field ownership and update rights.$$),
    ($$Zoho Forms$$, $$Zoho Forms Zapier connection$$, $$unknown$$, $$form trigger connection$$, $$read submitted forms$$, $$zap_1; zap_15; zap_61; zap_141$$, $$Zapier connected Zoho Forms account$$, $$needs_manual_review$$, $$needs_confirmation$$, DATE '2026-06-30', $$Eamonn$$, $$Confirm form names and production active state.$$),
    ($$Zoho Creator$$, $$Zoho Creator Zapier connection$$, $$unknown$$, $$app record creation connection$$, $$create records; exact app/forms unknown$$, $$zap_1; zap_15; zap_29; zap_47; zap_61; zap_135$$, $$Zapier connected Zoho Creator account$$, $$needs_manual_review$$, $$needs_confirmation$$, DATE '2026-06-30', $$Eamonn$$, $$App/form names need manual review.$$),
    ($$Zoho Writer$$, $$Zoho Writer merge connection$$, $$unknown$$, $$document merge connection$$, $$expected merge/generate certificates; exact rights unknown$$, $$Zoho Creator to Zoho Writer certificate merge$$, $$Zoho Writer / Zoho Creator integration settings$$, $$missing_source$$, $$unknown$$, DATE '2026-06-30', $$Eamonn$$, $$No export or implementation found in repo.$$),
    ($$Shopify$$, $$Shopify admin / Zapier Shopify connection$$, $$unknown$$, $$ecommerce source connection$$, $$read paid orders and product data; exact scopes unknown$$, $$zap_29; zap_47; zap_135; Shopify catalog signals$$, $$Shopify admin / Zapier connected app$$, $$needs_manual_review$$, $$needs_confirmation$$, DATE '2026-06-30', $$Eamonn$$, $$Order/webhook coverage still needs export.$$),
    ($$Chargebee$$, $$Chargebee Zapier connection$$, $$unknown$$, $$subscription source connection$$, $$read payment/subscription/invoice events; exact scopes unknown$$, $$zap_95; Chargebee subscription flow$$, $$Zapier connected Chargebee account$$, $$needs_manual_review$$, $$needs_confirmation$$, DATE '2026-06-30', $$Eamonn$$, $$Direct Zoho links and webhook config still need confirmation.$$)
) AS seeded(
  system,
  connection_name,
  username,
  role_name,
  rights_summary,
  used_by,
  secret_location,
  review_status,
  least_privilege_status,
  next_review_at,
  owner_name,
  notes
)
WHERE NOT EXISTS (
  SELECT 1
  FROM monitoring.workflow_connections existing
  WHERE existing.system = seeded.system
    AND existing.connection_name = seeded.connection_name
    AND COALESCE(existing.username, '') = COALESCE(seeded.username, '')
);

INSERT INTO monitoring.workflow_code_assets (
  file_path,
  asset_type,
  purpose,
  related_workflows,
  environment_variables,
  status,
  owner_name,
  review_status,
  next_review_at,
  notes
)
SELECT seeded.*
FROM (
  VALUES
    ($$netlify/functions/monitoring-summary.js$$, $$netlify_function$$, $$Live dashboard summary API reading monitoring counts$$, $$netlify_monitoring_summary$$, $$MONITORING_DATABASE_URL$$, $$implemented$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Read-only dashboard function.$$),
    ($$netlify/functions/monitoring-events.js$$, $$netlify_function$$, $$Live dashboard events API reading monitoring.automation_events$$, $$netlify_monitoring_events$$, $$MONITORING_DATABASE_URL$$, $$implemented$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Used by automation dashboard for event data.$$),
    ($$netlify/functions/monitoring-outbound-messages.js$$, $$netlify_function$$, $$Live dashboard outbound messages API reading monitoring.outbound_messages$$, $$netlify_monitoring_outbound$$, $$MONITORING_DATABASE_URL$$, $$implemented$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Used for outbound email evidence display.$$),
    ($$netlify/functions/monitoring-registry.js$$, $$netlify_function$$, $$Live dashboard registry API reading monitoring.automation_registry$$, $$netlify_monitoring_registry$$, $$MONITORING_DATABASE_URL$$, $$implemented$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Current live registry source.$$),
    ($$frontend/automation-dashboard/index.html$$, $$frontend$$, $$Automation dashboard page shell$$, $$dashboard; future Workflow maintenance button$$, $$none$$, $$implemented$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$No frontend change made by this seed.$$),
    ($$frontend/automation-dashboard/app.js$$, $$frontend$$, $$Dashboard client logic fetching Netlify monitoring endpoints$$, $$dashboard; monitoring summary/events/outbound/registry$$, $$none$$, $$implemented$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Candidate future place for Workflow maintenance view.$$),
    ($$frontend/automation-dashboard/styles.css$$, $$frontend$$, $$Dashboard styling$$, $$dashboard$$, $$none$$, $$implemented$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$No frontend change made by this seed.$$),
    ($$frontend/automation-dashboard/student-uploads.json$$, $$frontend_data$$, $$Static sample/dashboard data$$, $$academy upload dashboard examples$$, $$none$$, $$sample_or_legacy$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Mentioned in earlier SQL test data.$$),
    ($$api/db.js$$, $$api_db_helper$$, $$PostgreSQL pool helper with DATABASE_URL and DB_SCHEMA$$, $$Render API / dashboard endpoints$$, $$DATABASE_URL; NODE_ENV; DB_SCHEMA$$, $$implemented$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Main backend DB helper.$$),
    ($$server.js$$, $$api_server$$, $$Express server route registration and moderation/webhook logic$$, $$Render API / dashboard endpoints; approval webhook to Zapier$$, $$PORT; DATABASE_URL; DB_SCHEMA; ADMIN_GALLERY_KEY; ZAPIER_APPROVAL_WEBHOOK_URL; OPENAI_API_KEY$$, $$implemented$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Referenced by existing automation inventory.$$),
    ($$docs/sql/001_monitoring_datamodel.sql$$, $$sql$$, $$Defines existing monitoring tables$$, $$monitoring datamodel$$, $$none$$, $$plan_or_migration_file$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Not executed by this seed.$$),
    ($$docs/sql/002_monitoring_registry_seed.sql$$, $$sql$$, $$Concept seed plan for monitoring.automation_registry$$, $$monitoring registry seed$$, $$none$$, $$plan_only$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Contains no active registry inserts.$$),
    ($$docs/sql/003_monitoring_real_events_seed.sql$$, $$sql$$, $$Real events seed/reference SQL$$, $$monitoring events$$, $$none$$, $$existing_sql_asset$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Not executed by this seed.$$),
    ($$docs/sql/004_monitoring_zap172_heartbeat_template.sql$$, $$sql$$, $$Zap 172 heartbeat insert template$$, $$zap_172 heartbeat$$, $$Zapier mapped placeholders; database connection selected in Zapier$$, $$template_only$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Intended only for guarded ptb_monitoring_test use.$$),
    ($$docs/sql/005_workflow_maintenance_datamodel.sql$$, $$sql$$, $$Defines workflow maintenance tables$$, $$workflow maintenance datamodel$$, $$none$$, $$plan_or_migration_file$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Must be run before this seed in ptb_monitoring_test.$$),
    ($$docs/sql/006_workflow_maintenance_seed.sql$$, $$sql$$, $$Seeds workflow maintenance tables$$, $$workflow maintenance seed$$, $$none$$, $$seed_plan_file$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$This file; default ROLLBACK active.$$),
    ($$docs/workflow_maintenance_registry.csv$$, $$doc_csv$$, $$First workflow maintenance registry source$$, $$workflow maintenance$$, $$none$$, $$source_doc$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Source for 27 workflow registry records.$$),
    ($$docs/workflow_connections_inventory.md$$, $$doc_md$$, $$Connection and DB user inventory without secrets$$, $$workflow maintenance connections$$, $$none$$, $$source_doc$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Source for connection seeds.$$),
    ($$docs/workflow_code_assets_inventory.md$$, $$doc_md$$, $$Code/document asset inventory$$, $$workflow maintenance code assets$$, $$none$$, $$source_doc$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Source for code asset seeds.$$),
    ($$docs/workflow_maintenance_inventory.md$$, $$doc_md$$, $$Maintenance layer overview and governance rule$$, $$workflow maintenance$$, $$none$$, $$source_doc$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Runbook-like overview for the maintenance layer.$$),
    ($$docs/workflow_dependency_map.md$$, $$doc_md$$, $$Trigger/action/output dependency map$$, $$workflow maintenance dependencies$$, $$none$$, $$source_doc$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Dependency source; not seeded into dependency table in this file.$$),
    ($$docs/workflow_maintenance_datamodel_plan.md$$, $$doc_md$$, $$Workflow maintenance datamodel plan$$, $$workflow maintenance datamodel$$, $$none$$, $$source_doc$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Explains future dashboard shape and import mapping.$$),
    ($$docs/workflow_maintenance_seed_plan.md$$, $$doc_md$$, $$Workflow maintenance seed plan$$, $$workflow maintenance seed$$, $$none$$, $$source_doc$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Created with this seed script.$$),
    ($$docs/monitoring_zap172_heartbeat_plan.md$$, $$doc_md$$, $$Zap 172 heartbeat plan$$, $$zap_172$$, $$none$$, $$source_doc$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Runbook source for heartbeat pilot.$$),
    ($$docs/master_workflow_registry.csv$$, $$doc_csv$$, $$Broad workflow/source registry$$, $$all workflow maintenance seed candidates$$, $$none$$, $$source_doc$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Earlier registry source across Zapier, Shopify, Chargebee, Zoho Mail.$$),
    ($$docs/zapier_workflow_registry.csv$$, $$doc_csv$$, $$Detailed Zapier workflow registry$$, $$12 Zapier workflows$$, $$none$$, $$source_doc$$, $$Eamonn$$, $$needs_manual_review$$, DATE '2026-06-30', $$Includes actions, tables, fields, history counts, risks.$$)
) AS seeded(
  file_path,
  asset_type,
  purpose,
  related_workflows,
  environment_variables,
  status,
  owner_name,
  review_status,
  next_review_at,
  notes
)
WHERE NOT EXISTS (
  SELECT 1
  FROM monitoring.workflow_code_assets existing
  WHERE existing.file_path = seeded.file_path
);

INSERT INTO monitoring.workflow_runbooks (
  workflow_id,
  runbook_file,
  runbook_title,
  runbook_type,
  purpose,
  safe_test_steps,
  rollback_notes,
  owner_name,
  status,
  next_review_at,
  notes
)
SELECT seeded.*
FROM (
  VALUES
    ($$zap_172$$, $$docs/monitoring_zap172_heartbeat_plan.md$$, $$Zap 172 heartbeat plan$$, $$safe_test$$, $$Safely test the Zap 172 heartbeat pattern in ptb_monitoring_test.$$,
      $$Confirm Zapier uses the ptb_monitoring_test connection; keep allow_write guarded; verify dashboard summary/events after a test run.$$,
      $$Rollback should target only reviewed heartbeat test rows after explicit approval; this seed does not perform rollback actions.$$,
      $$Eamonn$$, $$draft$$, DATE '2026-06-30', $$Existing runbook source from monitoring docs.$$),
    ($$workflow_maintenance$$, $$docs/workflow_maintenance_inventory.md$$, $$Workflow maintenance overview$$, $$governance$$, $$Explain scope, dashboard button, tabs, and no-new-workflow-without-registry rule.$$,
      $$Review as documentation only; no database write is required to read this runbook.$$,
      $$No runtime rollback needed for documentation-only review.$$,
      $$Eamonn$$, $$draft$$, DATE '2026-06-30', $$Source overview for maintenance layer.$$),
    ($$workflow_maintenance$$, $$docs/workflow_maintenance_datamodel_plan.md$$, $$Workflow maintenance datamodel plan$$, $$datamodel$$, $$Explain table design and mapping to existing automation_registry.$$,
      $$Run docs/sql/005_workflow_maintenance_datamodel.sql only in ptb_monitoring_test with ROLLBACK active first.$$,
      $$Default SQL file already rolls back; production rollout needs separate plan.$$,
      $$Eamonn$$, $$draft$$, DATE '2026-06-30', $$Datamodel planning document.$$),
    ($$workflow_maintenance$$, $$docs/workflow_maintenance_seed_plan.md$$, $$Workflow maintenance seed plan$$, $$seed$$, $$Explain seed scope, expected counts, safety controls, and open uncertainties.$$,
      $$Run docs/sql/006_workflow_maintenance_seed.sql only after the datamodel exists in ptb_monitoring_test and with ROLLBACK active first.$$,
      $$Default SQL file already rolls back; use COMMIT only after reviewed test output.$$,
      $$Eamonn$$, $$draft$$, DATE '2026-06-30', $$Created alongside seed SQL.$$)
) AS seeded(
  workflow_id,
  runbook_file,
  runbook_title,
  runbook_type,
  purpose,
  safe_test_steps,
  rollback_notes,
  owner_name,
  status,
  next_review_at,
  notes
)
WHERE NOT EXISTS (
  SELECT 1
  FROM monitoring.workflow_runbooks existing
  WHERE existing.runbook_file = seeded.runbook_file
    AND COALESCE(existing.workflow_id, '') = COALESCE(seeded.workflow_id, '')
);

INSERT INTO monitoring.workflow_reviews (
  workflow_id,
  review_type,
  review_status,
  reviewed_by,
  reviewed_at,
  next_review_at,
  findings,
  action_items,
  risk_level_before,
  risk_level_after,
  evidence_source,
  notes
)
SELECT
  $$workflow_maintenance$$,
  $$initial_inventory$$,
  $$needs_followup$$,
  $$Codex documentation pass$$,
  now(),
  DATE '2026-06-30',
  $$Open uncertainties: Zoho Flow export missing; Zoho Creator app/form names unverified; Zoho Writer certificate templates and merge triggers unverified; live Zoho Mail folder/API state unverified; active/paused status of Zapier workflows unverified; Aiven rights for avnadmin, web_ro, web_rw, and zapier_user unverified; Shopify order/webhook coverage incomplete; Chargebee direct-to-Zoho or Zoho Flow coverage incomplete; Render DATABASE_URL versus PG_URL role separation needs confirmation.$$,
  $$Manual review needed: export or inspect Zoho Flow, Zoho Creator, Zoho Writer, Shopify, Chargebee, Zoho Mail, Aiven privileges, Zapier active states, and Render/Netlify environment role usage before production load.$$,
  $$unknown$$,
  $$medium$$,
  $$docs/workflow_maintenance_inventory.md; docs/workflow_dependency_map.md; docs/workflow_connections_inventory.md; docs/workflow_code_assets_inventory.md$$,
  $$Single initial review record for the maintenance layer seed.$$
WHERE NOT EXISTS (
  SELECT 1
  FROM monitoring.workflow_reviews existing
  WHERE existing.workflow_id = $$workflow_maintenance$$
    AND existing.review_type = $$initial_inventory$$
);

SELECT
  'after_seed' AS phase,
  (SELECT count(*) FROM monitoring.workflow_registry) AS workflow_registry_count,
  (SELECT count(*) FROM monitoring.workflow_connections) AS workflow_connections_count,
  (SELECT count(*) FROM monitoring.workflow_code_assets) AS workflow_code_assets_count,
  (SELECT count(*) FROM monitoring.workflow_runbooks) AS workflow_runbooks_count,
  (SELECT count(*) FROM monitoring.workflow_reviews) AS workflow_reviews_count;

SELECT
  workflow_id,
  workflow_name,
  platform,
  status,
  risk_level,
  next_review_at
FROM monitoring.workflow_registry
ORDER BY workflow_id;

SELECT
  system,
  connection_name,
  username,
  review_status,
  least_privilege_status,
  next_review_at
FROM monitoring.workflow_connections
ORDER BY system, connection_name, username;

SELECT
  file_path,
  asset_type,
  related_workflows,
  status,
  review_status
FROM monitoring.workflow_code_assets
ORDER BY file_path;

SELECT
  workflow_id,
  runbook_file,
  runbook_title,
  status,
  next_review_at
FROM monitoring.workflow_runbooks
ORDER BY workflow_id, runbook_file;

SELECT
  workflow_id,
  review_type,
  review_status,
  next_review_at,
  findings,
  action_items
FROM monitoring.workflow_reviews
WHERE review_status IN ($$open$$, $$needs_followup$$, $$blocked$$)
ORDER BY next_review_at NULLS LAST, workflow_id;

-- Default: roll back the seed test run.
ROLLBACK;

-- After review in ptb_monitoring_test only, replace ROLLBACK above with:
-- COMMIT;
