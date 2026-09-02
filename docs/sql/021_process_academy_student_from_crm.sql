-- Source-control snapshot of the function already deployed in production.
-- Captured read-only on 2026-09-02. Do not execute this file automatically.

CREATE OR REPLACE FUNCTION public.process_academy_student_from_crm(p_zoho_contact_id text, p_first_name text DEFAULT NULL::text, p_last_name text DEFAULT NULL::text, p_full_name text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_whatsapp text DEFAULT NULL::text, p_academy_batch text DEFAULT NULL::text, p_cohort text DEFAULT NULL::text, p_track text DEFAULT NULL::text, p_primary_stream text DEFAULT NULL::text, p_test_mode boolean DEFAULT false)
RETURNS TABLE(academy_student_id integer, ketso_student_id integer, upload_token text, onboarding_url text, automation_status text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_id INTEGER;
v_ketso_student_id INTEGER;
v_upload_token TEXT;
v_full_name TEXT;
v_onboarding_url TEXT;
BEGIN
IF p_test_mode = TRUE THEN
RETURN QUERY
SELECT
NULL::INTEGER,
NULL::INTEGER,
'test_token_no_write'::TEXT,
'https://ketso-uploader.pages.dev/academy-onboarding/?token=test_token_no_write'::TEXT,
'Test mode'::TEXT,
'No database write was performed'::TEXT;
RETURN;
END IF;
IF p_zoho_contact_id IS NULL OR TRIM(p_zoho_contact_id) = '' THEN
RAISE EXCEPTION 'zoho_contact_id is required';
END IF;
v_full_name :=
COALESCE(
NULLIF(TRIM(p_full_name), ''),
NULLIF(TRIM(CONCAT_WS(' ', NULLIF(TRIM(p_first_name), ''), NULLIF(TRIM(p_last_name), ''))), ''),
'Unknown student'
);
INSERT INTO academy_students (
zoho_contact_id,
first_name,
last_name,
full_name,
email,
whatsapp,
academy_batch,
cohort,
track,
primary_stream,
status,
onboarding_status,
created_at_utc,
updated_at_utc
)
VALUES (
TRIM(p_zoho_contact_id),
NULLIF(TRIM(p_first_name), ''),
NULLIF(TRIM(p_last_name), ''),
v_full_name,
NULLIF(TRIM(p_email), ''),
NULLIF(TRIM(p_whatsapp), ''),
NULLIF(TRIM(p_academy_batch), ''),
COALESCE(NULLIF(TRIM(p_cohort), ''), 'FH1'),
COALESCE(NULLIF(TRIM(p_track), ''), 'Forest Heroes'),
NULLIF(TRIM(p_primary_stream), ''),
'registered',
'not_started',
NOW(),
NOW()
)
ON CONFLICT (zoho_contact_id)
DO UPDATE SET
first_name = COALESCE(EXCLUDED.first_name, academy_students.first_name),
last_name = COALESCE(EXCLUDED.last_name, academy_students.last_name),
full_name = COALESCE(EXCLUDED.full_name, academy_students.full_name),
email = COALESCE(EXCLUDED.email, academy_students.email),
whatsapp = COALESCE(EXCLUDED.whatsapp, academy_students.whatsapp),
academy_batch = COALESCE(EXCLUDED.academy_batch, academy_students.academy_batch),
cohort = COALESCE(EXCLUDED.cohort, academy_students.cohort),
track = COALESCE(EXCLUDED.track, academy_students.track),
primary_stream = COALESCE(EXCLUDED.primary_stream, academy_students.primary_stream),
updated_at_utc = NOW()
RETURNING academy_students.id INTO v_id;
UPDATE academy_students AS s
SET
ketso_student_id = COALESCE(s.ketso_student_id, s.id),
upload_token = COALESCE(
NULLIF(s.upload_token, ''),
SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 16)
),
onboarding_status = COALESCE(s.onboarding_status, 'not_started'),
updated_at_utc = NOW()
WHERE s.id = v_id
RETURNING
s.ketso_student_id,
s.upload_token
INTO
v_ketso_student_id,
v_upload_token;
v_onboarding_url :=
'https://ketso-uploader.pages.dev/academy-onboarding/?token=' || v_upload_token;
RETURN QUERY
SELECT
v_id,
v_ketso_student_id,
v_upload_token,
v_onboarding_url,
'Processed'::TEXT,
'Student processed successfully'::TEXT;
END;
$function$
