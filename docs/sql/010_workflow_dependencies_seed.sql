-- Verified dependency steps for the central SKU 01 claim workflow.
-- Run 009_sku01_central_workflow_registry.sql first.
-- This migration is intentionally not executed by the application.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM monitoring.workflow_registry
    WHERE workflow_id='zap_61' AND lower(status)='active'
  ) THEN
    RAISE EXCEPTION 'Active workflow zap_61 is required before dependency records can be seeded';
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
  WHERE existing.workflow_id=seeded.workflow_id
    AND existing.dependency_order=seeded.dependency_order
    AND existing.dependency_type=seeded.dependency_type
);

DO $$
DECLARE seeded_count integer;
BEGIN
  SELECT count(*) INTO seeded_count
  FROM monitoring.workflow_dependencies
  WHERE workflow_id='zap_61' AND dependency_order BETWEEN 101 AND 109;
  IF seeded_count <> 9 THEN
    RAISE EXCEPTION 'Expected 9 dependency records for zap_61, found %',seeded_count;
  END IF;
END
$$;

COMMIT;
