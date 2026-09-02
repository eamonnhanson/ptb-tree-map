-- Production-equivalent Academy onboarding completion layer for zap_175,
-- documented on 2026-09-02.
-- Do not execute: this file records the configuration already in production.
-- This migration does not modify academy_students or external systems.

BEGIN;

CREATE TABLE IF NOT EXISTS public.academy_onboarding_completions (
  id bigserial PRIMARY KEY,
  workflow_key text NOT NULL DEFAULT 'zap_175'
    CHECK (workflow_key = 'zap_175'),
  zoho_contact_id text NOT NULL UNIQUE,
  academy_student_id integer NOT NULL UNIQUE REFERENCES public.academy_students(id),
  ketso_student_id integer NOT NULL,
  email_external_id text,
  initial_crm_external_id text,
  final_crm_external_id text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.academy_onboarding_completions IS
  'One idempotent completion row per zap_175 contact, written after all preceding Zap actions succeeded; this is not proof of inbox delivery.';

CREATE INDEX IF NOT EXISTS academy_onboarding_completions_completed_at_idx
  ON public.academy_onboarding_completions (completed_at DESC);

CREATE OR REPLACE FUNCTION public.complete_academy_onboarding(
  p_zoho_contact_id text,
  p_ketso_student_id integer,
  p_email_external_id text DEFAULT NULL,
  p_initial_crm_external_id text DEFAULT NULL,
  p_final_crm_external_id text DEFAULT NULL
)
RETURNS public.academy_onboarding_completions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_contact_id text := btrim(p_zoho_contact_id);
  v_student_id integer;
  v_match_count integer;
  v_existing public.academy_onboarding_completions%ROWTYPE;
  v_completion public.academy_onboarding_completions%ROWTYPE;
BEGIN
  IF v_contact_id IS NULL OR v_contact_id = '' THEN
    RAISE EXCEPTION 'Zoho contact id is required';
  END IF;
  IF p_ketso_student_id IS NULL THEN
    RAISE EXCEPTION 'KETSO student id is required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'academy-onboarding:' || v_contact_id, 0
  ));

  SELECT count(*), min(student.id)
  INTO v_match_count, v_student_id
  FROM public.academy_students student
  WHERE btrim(student.zoho_contact_id::text) = v_contact_id
    AND student.ketso_student_id::integer = p_ketso_student_id;

  IF v_match_count <> 1 THEN
    RAISE EXCEPTION
      'Expected one academy student for Zoho contact % and KETSO student %, found %',
      v_contact_id, p_ketso_student_id, v_match_count;
  END IF;

  SELECT completion.* INTO v_existing
  FROM public.academy_onboarding_completions completion
  WHERE completion.zoho_contact_id = v_contact_id
  FOR UPDATE;

  IF FOUND AND v_existing.academy_student_id <> v_student_id THEN
    RAISE EXCEPTION
      'Zoho contact % is already completed for a different academy student',
      v_contact_id;
  END IF;

  INSERT INTO public.academy_onboarding_completions (
    zoho_contact_id, academy_student_id, ketso_student_id,
    email_external_id, initial_crm_external_id, final_crm_external_id
  ) VALUES (
    v_contact_id, v_student_id, p_ketso_student_id,
    NULLIF(btrim(p_email_external_id), ''),
    NULLIF(btrim(p_initial_crm_external_id), ''),
    NULLIF(btrim(p_final_crm_external_id), '')
  )
  ON CONFLICT (zoho_contact_id) DO UPDATE
  SET ketso_student_id = EXCLUDED.ketso_student_id,
      email_external_id = COALESCE(EXCLUDED.email_external_id, academy_onboarding_completions.email_external_id),
      initial_crm_external_id = COALESCE(EXCLUDED.initial_crm_external_id, academy_onboarding_completions.initial_crm_external_id),
      final_crm_external_id = COALESCE(EXCLUDED.final_crm_external_id, academy_onboarding_completions.final_crm_external_id),
      updated_at = now()
  RETURNING * INTO v_completion;

  RETURN v_completion;
END;
$$;

COMMENT ON FUNCTION public.complete_academy_onboarding(text, integer, text, text, text) IS
  'Idempotently records zap_175 completion after validating the existing academy_students identity; retries preserve completed_at and do not modify academy_students.';

REVOKE ALL ON FUNCTION public.complete_academy_onboarding(text, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_academy_onboarding(text, integer, text, text, text) TO zapier_user;

COMMIT;
