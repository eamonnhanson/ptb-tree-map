-- REVIEW BEFORE EXECUTION. This migration is idempotent and has not been applied.
ALTER TABLE public.photo_uploads_review
  ADD COLUMN IF NOT EXISTS submission_section text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photo_uploads_review_submission_section_check') THEN
    ALTER TABLE public.photo_uploads_review ADD CONSTRAINT photo_uploads_review_submission_section_check
      CHECK (
        submission_section IS NULL
        OR (
          course_key = 'donor_investor_funding'
          AND submission_section IN ('onboarding','cover_page','results','impact','conclusions','finances')
        )
      );
  END IF;
END $$;
