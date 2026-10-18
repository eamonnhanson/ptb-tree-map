-- Apply only after deployment approval, to the same database as migration 022.
BEGIN;
ALTER TABLE public.photo_uploads_review
  ADD COLUMN IF NOT EXISTS staff_location text,
  ADD COLUMN IF NOT EXISTS date_taken date,
  ADD COLUMN IF NOT EXISTS staff_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS staff_archive_status text NOT NULL DEFAULT 'active'
    CHECK (staff_archive_status IN ('active', 'archived'));
CREATE TABLE IF NOT EXISTS public.staff_upload_collections (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.staff_upload_collection_memberships (
  upload_id bigint NOT NULL REFERENCES public.photo_uploads_review(id),
  collection_id text NOT NULL REFERENCES public.staff_upload_collections(id),
  PRIMARY KEY (upload_id, collection_id)
);
INSERT INTO public.staff_upload_collections (id, name, sort_order) VALUES
  ('tree-planting', 'Tree planting', 10), ('nursery', 'Nursery', 20),
  ('training', 'Training', 30), ('student-work', 'Student work', 40)
ON CONFLICT (id) DO NOTHING;
-- No project assignments or dates are inferred for legacy records.
COMMIT;
