-- Staff photo receipt persistence and idempotency boundary.
-- REVIEW BEFORE EXECUTION. This file is not applied automatically and must not
-- be run against production without a reviewed migration/deployment plan.

BEGIN;

ALTER TABLE public.photo_uploads_review
  ADD COLUMN IF NOT EXISTS staff_category text,
  ADD COLUMN IF NOT EXISTS selected_category text,
  ADD COLUMN IF NOT EXISTS uploaded_by text,
  ADD COLUMN IF NOT EXISTS staff_id text,
  ADD COLUMN IF NOT EXISTS staff_name text,
  ADD COLUMN IF NOT EXISTS staff_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS uploader_role text;

CREATE UNIQUE INDEX IF NOT EXISTS photo_uploads_review_staff_receipt_unique
  ON public.photo_uploads_review (staff_id, cropped_file_url)
  WHERE upload_context = 'staff_upload';

COMMIT;
