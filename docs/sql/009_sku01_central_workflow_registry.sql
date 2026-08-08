-- Registry update for the eleven Zapier workflows confirmed active on 2026-08-07.
-- This migration is intentionally not executed by the application.
-- Review the workflow labels and run it explicitly against the monitoring database.
-- No operational customer data is changed.

BEGIN;

INSERT INTO monitoring.workflow_registry (
  workflow_id,workflow_name,platform,source_system,target_system,trigger_description,
  business_purpose,owner_name,status,risk_level,reads_from,writes_to,database_user,
  connection_name,last_tested_at,next_review_at,notes
)
VALUES (
  'zap_61','SKU 01 - Gift Tree Claim - Zap C','Zapier','Zoho Forms',
  'PostgreSQL; Zoho Creator; Zoho Writer; e-mailprovider',
  'new_form_entry for an existing SKU 01 GiftClaims token',
  'Claim all reserved trees atomically, create exactly one CertificateJobs record and let Creator generate and offer exactly one certificate email.',
  'Eamonn','active','medium','gift_claims; users1; trees1; Zoho Forms payload',
  'users1; trees1; Zoho Creator CertificateJobs; monitoring.automation_events',
  'zapier_user','Zapier defaultdb connection',DATE '2026-08-07',DATE '2026-09-07',
  'Actieve productie-Zap 375413581. Volgt op Zap 374491281. Productie end-to-end getest op 2026-08-07. Editor: https://zapier.com/editor/375413581/published'
)
ON CONFLICT (workflow_id) DO UPDATE
SET workflow_name=EXCLUDED.workflow_name,platform=EXCLUDED.platform,source_system=EXCLUDED.source_system,
    target_system=EXCLUDED.target_system,trigger_description=EXCLUDED.trigger_description,
    business_purpose=EXCLUDED.business_purpose,status=EXCLUDED.status,risk_level=EXCLUDED.risk_level,
    reads_from=EXCLUDED.reads_from,writes_to=EXCLUDED.writes_to,database_user=EXCLUDED.database_user,
    connection_name=EXCLUDED.connection_name,last_tested_at=EXCLUDED.last_tested_at,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

INSERT INTO monitoring.workflow_registry (
  workflow_id,workflow_name,platform,source_system,target_system,trigger_description,
  business_purpose,owner_name,status,risk_level,reads_from,writes_to,database_user,
  connection_name,last_tested_at,next_review_at,notes
)
VALUES (
  'zap_47','DEV - Shopify → Tokenized Gift Tree Link - Multilingual','Zapier','Shopify',
  'PostgreSQL; Zoho Creator; e-mailprovider','new_paid_order_v3 for SKU 01',
  'Create the gift claim token, reserve the purchased trees and send the multilingual claim link to the buyer.',
  'Eamonn','active','medium','Shopify order; trees1; gift_claims; email_templates_01_gifttrees',
  'gift_claims; reserved trees; claim-link email','zapier_user','Zapier defaultdb connection',
  DATE '2026-08-07',DATE '2026-09-07',
  'Actieve productie-Zap 374491281. Dit is de eerste stap van Gift Tree link generation en gaat vooraf aan Zap 375413581. Editor: https://zapier.com/editor/374491281/published'
)
ON CONFLICT (workflow_id) DO UPDATE
SET workflow_name=EXCLUDED.workflow_name,platform=EXCLUDED.platform,source_system=EXCLUDED.source_system,
    target_system=EXCLUDED.target_system,trigger_description=EXCLUDED.trigger_description,
    business_purpose=EXCLUDED.business_purpose,status=EXCLUDED.status,risk_level=EXCLUDED.risk_level,
    reads_from=EXCLUDED.reads_from,writes_to=EXCLUDED.writes_to,last_tested_at=EXCLUDED.last_tested_at,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

-- The two historical SKU 02 variants are switched off in Zapier and must not
-- appear as active workflows.
UPDATE monitoring.workflow_registry
SET status='decommissioned',
    notes=concat_ws(' ',notes,'Uitgeschakeld bevestigd op 2026-08-07; vervangen door Zap 374807250.'),
    updated_at=now()
WHERE workflow_id IN ('zap_29','zap_135');

INSERT INTO monitoring.workflow_registry (
  workflow_id,workflow_name,platform,source_system,target_system,trigger_description,
  business_purpose,owner_name,status,risk_level,reads_from,writes_to,database_user,
  connection_name,last_tested_at,next_review_at,notes
)
VALUES (
  'zap_374807250','Zap C – Shopify naar PostgreSQL en Creator – SKU 02','Zapier','Shopify',
  'PostgreSQL; Zoho Creator','paid Shopify order for SKU 02',
  'Find or create the buyer, atomically allocate the purchased trees and create one Zoho Creator record.',
  'Eamonn','active','medium','Shopify order; users1; trees1','users1; trees1; Zoho Creator record',
  'zapier_user','Zapier defaultdb connection',DATE '2026-08-07',DATE '2026-09-07',
  'Actieve productie-Zap 374807250 voor een boom voor de koper zelf. Editor: https://zapier.com/editor/374807250/published'
)
ON CONFLICT (workflow_id) DO UPDATE
SET workflow_name=EXCLUDED.workflow_name,platform=EXCLUDED.platform,source_system=EXCLUDED.source_system,
    target_system=EXCLUDED.target_system,trigger_description=EXCLUDED.trigger_description,
    business_purpose=EXCLUDED.business_purpose,status=EXCLUDED.status,risk_level=EXCLUDED.risk_level,
    reads_from=EXCLUDED.reads_from,writes_to=EXCLUDED.writes_to,last_tested_at=EXCLUDED.last_tested_at,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

-- These eight workflows are visibly enabled in the supplied Zapier overview.
-- Keep the exact Zapier name as technical evidence; the frontend adds a short,
-- superuser-friendly process title.
UPDATE monitoring.workflow_registry registry
SET workflow_name=confirmed.workflow_name,
    status='active',
    last_tested_at=DATE '2026-08-07',
    next_review_at=DATE '2026-09-07',
    updated_at=now()
FROM (VALUES
  ('zap_1','IMCD_NL_TreeCert_Postgres'),
  ('zap_15','IMCD_BEL_TreeCert_Postgres'),
  ('zap_95','Nieuw abonnes chargebee REVERTED'),
  ('zap_124','Monthly Tree Report'),
  ('zap_129','Send Forest Hero Photo Email (once per user/ p/h) - Forest Photo 2025Q4 - Eénmalige e-mail'),
  ('zap_141','Nieuw abonnes shopify handmatig - zoho form'),
  ('zap_172','Webhooks by Zapier'),
  ('zap_175','Trigger: New or Updated Contact in Zoho CRM')
) AS confirmed(workflow_id,workflow_name)
WHERE registry.workflow_id=confirmed.workflow_id;

-- Abort instead of committing a partially populated dashboard. After the two
-- old SKU 02 variants are retired, exactly eleven enabled Zapier rows must
-- remain in this registry snapshot.
DO $$
DECLARE active_zap_count integer;
BEGIN
  SELECT count(*) INTO active_zap_count
  FROM monitoring.workflow_registry
  WHERE lower(platform)='zapier' AND lower(status)='active';
  IF active_zap_count <> 11 THEN
    RAISE EXCEPTION 'Expected 11 active Zapier workflows after registry update, found %',active_zap_count;
  END IF;
END
$$;

INSERT INTO monitoring.workflow_dependencies (
  workflow_id,dependency_order,dependency_type,source_system,target_system,
  trigger_or_input,action_summary,output_summary,uncertainty_level,missing_information,evidence_source
)
SELECT seeded.*
FROM (VALUES
  ('zap_61',101,'trigger','Zoho Forms','Zapier','SKU 01 claim form submission','Read claim data','claim_received','known',NULL,'End-to-end production test 2026-08-07'),
  ('zap_61',102,'database_read','Zapier','PostgreSQL','claim token','Read GiftClaims and form rows','claim_data_loaded','known',NULL,'Zap C configuration'),
  ('zap_61',103,'database_write','Zapier','PostgreSQL','recipient email and reserved tree IDs','Find or create one user and atomically claim all reserved trees','trees_allocated','known',NULL,'PostgreSQL users1 and trees1'),
  ('zap_61',104,'monitoring_event','Shopify / Zapier','monitoring.automation_events','paid Shopify order','Register Shopify order evidence','shopify_order_received','known',NULL,'monitoring-ingest'),
  ('zap_61',105,'monitoring_event','Zoho Creator','monitoring.automation_events','GiftClaims record','Register exactly one GiftClaims record','gift_claim_created','known',NULL,'monitoring-ingest'),
  ('zap_61',106,'monitoring_event','Zapier / Zoho Creator','monitoring.automation_events','central CertificateJobs create action','Register exactly one CertificateJobs record','certificate_job_created','known','Add the event call to the central route if it is not yet present.','monitoring-ingest'),
  ('zap_61',107,'monitoring_event','Zoho Creator / Zoho Writer','monitoring.automation_events','certificate output available','Register certificate generation','certificate_generated','partial','Reliable Creator or Writer callback/event still needs configuration.','monitoring-ingest'),
  ('zap_61',108,'monitoring_event','Zoho Creator / e-mailaction','monitoring.automation_events','certificate mail accepted by send action','Register exactly one mail submission','certificate_email_submitted','partial','Reliable post-send-action event still needs configuration.','monitoring-ingest'),
  ('zap_61',109,'monitoring_event','E-mailprovider','monitoring.automation_events','provider confirms send','Register final send confirmation when available','certificate_email_sent','uncertain','Optional until a reliable provider source is connected.','monitoring-ingest')
) AS seeded(workflow_id,dependency_order,dependency_type,source_system,target_system,trigger_or_input,action_summary,output_summary,uncertainty_level,missing_information,evidence_source)
WHERE NOT EXISTS (
  SELECT 1 FROM monitoring.workflow_dependencies existing
  WHERE existing.workflow_id=seeded.workflow_id AND existing.dependency_order=seeded.dependency_order
);

COMMIT;
