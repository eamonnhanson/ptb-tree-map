import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const academySqlUrl = new URL(
  "../docs/sql/020_academy_onboarding_completion.sql",
  import.meta.url
);
const stepsUrl = new URL(
  "../docs/zapier_postgresql_completion_steps.md",
  import.meta.url
);
const registryUrl = new URL(
  "../docs/sql/019_critical_workflows_registry.sql",
  import.meta.url
);
const processorUrl = new URL(
  "../docs/sql/021_process_academy_student_from_crm.sql",
  import.meta.url
);

test("Academy processor snapshot preserves the production contract", async () => {
  const sql = await readFile(processorUrl, "utf8");

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.process_academy_student_from_crm/i);
  assert.match(sql, /p_test_mode boolean DEFAULT false/i);
  assert.match(sql, /RETURNS TABLE\(academy_student_id integer, ketso_student_id integer, upload_token text, onboarding_url text, automation_status text, message text\)/i);
  assert.match(sql, /SECURITY DEFINER/i);
  assert.match(sql, /SET search_path TO 'public'/i);
  assert.match(sql, /ON CONFLICT \(zoho_contact_id\)/i);
  assert.match(sql, /Source-control snapshot of the function already deployed in production/i);
});

test("Academy completion is one idempotent row tied to an existing student", async () => {
  const sql = await readFile(academySqlUrl, "utf8");

  assert.match(sql, /zoho_contact_id text NOT NULL UNIQUE/i);
  assert.match(sql, /academy_student_id integer NOT NULL UNIQUE REFERENCES public\.academy_students\(id\)/i);
  assert.match(sql, /ketso_student_id integer NOT NULL/i);
  assert.match(sql, /ON CONFLICT \(zoho_contact_id\) DO UPDATE/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /v_match_count <> 1/i);
  assert.doesNotMatch(sql, /UPDATE\s+public\.academy_students/i);
  assert.doesNotMatch(sql, /INSERT INTO\s+public\.academy_students/i);
});

test("Academy retries preserve first completion timestamps", async () => {
  const sql = await readFile(academySqlUrl, "utf8");
  const updateClause = sql.match(/ON CONFLICT \(zoho_contact_id\) DO UPDATE[\s\S]*?RETURNING \*/i)?.[0] || "";

  assert.ok(updateClause);
  assert.doesNotMatch(updateClause, /student_processed_at\s*=/i);
  assert.doesNotMatch(updateClause, /onboarding_email_completed_at\s*=/i);
  assert.doesNotMatch(updateClause, /crm_updates_completed_at\s*=/i);
  assert.doesNotMatch(updateClause, /completed_at\s*=/i);
  assert.doesNotMatch(sql, /student_processed_at/i);
  assert.doesNotMatch(sql, /onboarding_email_completed_at/i);
  assert.doesNotMatch(sql, /crm_updates_completed_at/i);
});

test("Academy completion function has the production security contract", async () => {
  const sql = await readFile(academySqlUrl, "utf8");

  assert.match(sql, /p_ketso_student_id integer/i);
  assert.match(sql, /SECURITY DEFINER/i);
  assert.match(sql, /SET search_path = pg_catalog, public/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.complete_academy_onboarding\(text, integer, text, text, text\) FROM PUBLIC/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.complete_academy_onboarding\(text, integer, text, text, text\) TO zapier_user/i);
});

test("Shopify completion reuses both existing side-effect markers after Writer", async () => {
  const steps = await readFile(stepsUrl, "utf8");

  assert.match(steps, /Immediately after \*\*Zoho Writer — Merge a Template and Send Email\*\*/);
  assert.match(steps, /'certificate',\s*\n\s*'completed'/);
  assert.match(steps, /'welcome_email',\s*\n\s*'completed'/);
  assert.match(steps, /WITH certificate_marked AS MATERIALIZED/);
});

test("Academy completion step is explicitly after the final CRM update", async () => {
  const steps = await readFile(stepsUrl, "utf8");

  assert.match(steps, /Production step 8[\s\S]*after the final \*\*Zoho CRM - Update Module\s+Entry\*\*/);
  assert.match(steps, /public\.complete_academy_onboarding/);
  assert.match(steps, /p_email_external_id` → SQL `NULL`/);
});

test("Academy registry uses the production name and excludes the publishing no-op", async () => {
  const registry = await readFile(registryUrl, "utf8");
  const academyRegistry = registry.match(/'zap_175'[\s\S]*?\)\n\) AS dependency/i)?.[0] || "";

  assert.match(registry, /'zap_175', 'Zoho CRM Academy onboarding → PostgreSQL'/);
  assert.match(academyRegistry, /Call process_academy_student_from_crm/);
  assert.match(academyRegistry, /Call complete_academy_onboarding/);
  assert.match(academyRegistry, /academy_onboarding_completions/);
  assert.match(academyRegistry, /docs\/sql\/021_process_academy_student_from_crm\.sql/);
  assert.match(academyRegistry, /docs\/sql\/020_academy_onboarding_completion\.sql/);
  assert.match(academyRegistry, /docs\/zapier_postgresql_completion_steps\.md/);
  assert.doesNotMatch(academyRegistry, /docs\/zapier_workflow_registry\.csv/);
  assert.doesNotMatch(academyRegistry, /Technical no-op|publishing no-op/i);
});
