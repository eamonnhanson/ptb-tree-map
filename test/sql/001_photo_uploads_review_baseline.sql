-- TEST-ONLY BASELINE. Never apply to Aiven or any production database.
--
-- Source: catalog-only inspection of public.photo_uploads_review on Aiven,
-- performed 2026-09-14 with the read-only ptb_schema_inspector role. No
-- application table rows were read. The inspected table has no foreign keys.

CREATE SEQUENCE public.photo_uploads_review_id_seq
  AS bigint
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  START WITH 1
  CACHE 1
  NO CYCLE;

CREATE TABLE public.photo_uploads_review (
  id bigint NOT NULL DEFAULT nextval('public.photo_uploads_review_id_seq'::regclass),
  review_status character varying(30) NOT NULL DEFAULT 'pending'::character varying,
  review_notes text,
  reviewed_by character varying(255),
  reviewed_at_utc timestamp with time zone,
  category character varying(100),
  subcategory character varying(100),
  linked_entity_type character varying(50),
  linked_entity_name text,
  manual_label text,
  user_id integer,
  tree_id integer,
  uploader_name character varying(255),
  uploader_email character varying(255),
  original_file_url text,
  cropped_file_url text,
  original_file_name text,
  cropped_file_name text,
  original_file_size bigint,
  cropped_file_size bigint,
  original_file_hash character varying(128),
  cropped_file_hash character varying(128),
  mime_type character varying(100),
  photographer text,
  caption text,
  is_primary boolean DEFAULT false,
  consent_social boolean DEFAULT false,
  consent_map boolean DEFAULT false,
  shot_at_utc timestamp with time zone,
  gps_lat numeric(10,8),
  gps_long numeric(10,8),
  possible_duplicate boolean DEFAULT false,
  duplicate_of_review_id bigint,
  approved_photo_id bigint,
  created_at_utc timestamp with time zone NOT NULL DEFAULT now(),
  updated_at_utc timestamp with time zone NOT NULL DEFAULT now(),
  original_file_size_bytes integer,
  cropped_file_size_bytes integer,
  ai_description text,
  academy_whatsapp text,
  academy_track text,
  upload_type text,
  consent_given boolean DEFAULT false,
  verification_status text DEFAULT 'pending'::text,
  ai_status text DEFAULT 'not_checked'::text,
  ai_confidence numeric,
  upload_context text,
  academy_student_id integer,
  academy_cohort text,
  student_confirmed_at timestamp with time zone,
  public_gallery_status text DEFAULT 'private'::text,
  lesson_key text,
  interest_area text,
  points_awarded integer DEFAULT 0,
  approved_at_utc timestamp with time zone,
  file_type text,
  file_extension text,
  ai_feedback text,
  is_visible_in_gallery boolean DEFAULT false,
  reviewed_by_admin boolean DEFAULT false,
  approved_at timestamp without time zone,
  rejected_reason text,
  course_key text,
  CONSTRAINT photo_uploads_review_pkey PRIMARY KEY (id)
);

ALTER SEQUENCE public.photo_uploads_review_id_seq
  OWNED BY public.photo_uploads_review.id;

CREATE INDEX idx_photo_uploads_review_category
  ON public.photo_uploads_review USING btree (category);
CREATE INDEX idx_photo_uploads_review_created_at_utc
  ON public.photo_uploads_review USING btree (created_at_utc);
CREATE INDEX idx_photo_uploads_review_possible_duplicate
  ON public.photo_uploads_review USING btree (possible_duplicate);
CREATE INDEX idx_photo_uploads_review_status
  ON public.photo_uploads_review USING btree (review_status);
CREATE INDEX idx_photo_uploads_review_tree_id
  ON public.photo_uploads_review USING btree (tree_id);
CREATE INDEX idx_photo_uploads_review_user_id
  ON public.photo_uploads_review USING btree (user_id);
CREATE INDEX photo_uploads_review_course_key_idx
  ON public.photo_uploads_review USING btree (course_key);
CREATE INDEX photo_uploads_review_student_course_idx
  ON public.photo_uploads_review USING btree (academy_student_id, course_key);
