BEGIN;

CREATE OR REPLACE FUNCTION public.enroll_academy_student(
  p_academy_student_id bigint,
  p_course_key text,
  p_cohort text,
  p_enrollment_token text,
  p_status text DEFAULT 'active'
)
RETURNS public.academy_course_enrollments
LANGUAGE plpgsql
AS $$
DECLARE
  result public.academy_course_enrollments;
  effective_token text;
BEGIN
  IF p_course_key NOT IN (
    'online_tree_planting',
    'arboriculture_1',
    'donor_investor_funding'
  ) THEN
    RAISE EXCEPTION 'Unknown academy course: %', p_course_key;
  END IF;

  effective_token := COALESCE(
    NULLIF(TRIM(p_enrollment_token), ''),
    SUBSTRING(MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text || p_academy_student_id::text), 1, 24)
  );

  SELECT * INTO result
  FROM public.academy_course_enrollments
  WHERE academy_student_id = p_academy_student_id
    AND course_key = p_course_key
    AND COALESCE(cohort, '') = COALESCE(p_cohort, '')
  LIMIT 1;

  IF result.id IS NOT NULL THEN
    UPDATE public.academy_course_enrollments
    SET status = p_status,
        enrollment_token = COALESCE(enrollment_token, effective_token)
    WHERE id = result.id
    RETURNING * INTO result;
    RETURN result;
  END IF;

  INSERT INTO public.academy_course_enrollments (
    academy_student_id, course_key, cohort, enrollment_token, status
  ) VALUES (
    p_academy_student_id, p_course_key, p_cohort, effective_token, p_status
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$;

COMMIT;
