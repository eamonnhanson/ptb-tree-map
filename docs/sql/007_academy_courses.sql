BEGIN;

CREATE TABLE IF NOT EXISTS public.academy_course_enrollments (
  id bigserial PRIMARY KEY,
  academy_student_id bigint NOT NULL REFERENCES public.academy_students(id),
  course_key text NOT NULL,
  cohort text,
  status text NOT NULL DEFAULT 'active',
  enrollment_token text UNIQUE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT academy_course_enrollments_course_key_check
    CHECK (course_key IN ('online_tree_planting', 'arboriculture_1')),
  CONSTRAINT academy_course_enrollments_status_check
    CHECK (status IN ('invited', 'active', 'completed', 'withdrawn'))
);

ALTER TABLE public.photo_uploads_review
  ADD COLUMN IF NOT EXISTS course_key text;

UPDATE public.photo_uploads_review
SET course_key = 'online_tree_planting'
WHERE course_key IS NULL
  AND (
    academy_student_id IS NOT NULL
    OR category IN ('academy_onboarding', 'academy_upload', 'student_onboarding')
    OR category LIKE 'academy_lesson_%'
    OR category LIKE 'student_lesson_%'
    OR upload_context LIKE 'academy_%'
  );

CREATE INDEX IF NOT EXISTS photo_uploads_review_course_key_idx
  ON public.photo_uploads_review(course_key);

CREATE INDEX IF NOT EXISTS photo_uploads_review_student_course_idx
  ON public.photo_uploads_review(academy_student_id, course_key);

CREATE INDEX IF NOT EXISTS academy_course_enrollments_student_idx
  ON public.academy_course_enrollments(academy_student_id);

CREATE UNIQUE INDEX IF NOT EXISTS academy_course_enrollments_identity_idx
  ON public.academy_course_enrollments(
    academy_student_id,
    course_key,
    COALESCE(cohort, '')
  );

CREATE INDEX IF NOT EXISTS academy_course_enrollments_token_idx
  ON public.academy_course_enrollments(enrollment_token);

INSERT INTO public.academy_course_enrollments (
  academy_student_id, course_key, cohort, status
)
SELECT id, 'online_tree_planting', cohort, 'active'
FROM public.academy_students
ON CONFLICT DO NOTHING;

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
  IF p_course_key NOT IN ('online_tree_planting', 'arboriculture_1') THEN
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
