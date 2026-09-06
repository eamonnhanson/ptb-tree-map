BEGIN;

-- Backwards-compatible schema support for the existing donor_investor_funding
-- course identifier. This migration does not rewrite enrollment or upload data.
ALTER TABLE public.academy_course_enrollments
  DROP CONSTRAINT IF EXISTS academy_course_enrollments_course_key_check;

ALTER TABLE public.academy_course_enrollments
  ADD CONSTRAINT academy_course_enrollments_course_key_check
  CHECK (course_key IN (
    'online_tree_planting',
    'arboriculture_1',
    'donor_investor_funding'
  ));

COMMIT;
