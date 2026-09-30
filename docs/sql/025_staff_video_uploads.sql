-- Staff video receipt metadata. REVIEW BEFORE EXECUTION.
-- This additive migration is not applied automatically and must not be run
-- against production without a reviewed migration/deployment plan.

BEGIN;

ALTER TABLE public.photo_uploads_review
  ADD COLUMN IF NOT EXISTS duration_seconds numeric;

COMMIT;
