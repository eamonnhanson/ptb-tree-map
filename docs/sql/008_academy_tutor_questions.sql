BEGIN;

CREATE TABLE IF NOT EXISTS academy_tutor_questions (
  id BIGSERIAL PRIMARY KEY,
  source_review_id BIGINT UNIQUE,
  request_id TEXT NOT NULL UNIQUE,
  answer_request_id TEXT UNIQUE,
  academy_student_id BIGINT NOT NULL REFERENCES academy_students(id),
  course_key TEXT NOT NULL,
  module_key TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_email TEXT,
  question_text TEXT NOT NULL CHECK (char_length(question_text) BETWEEN 1 AND 5000),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'answered', 'closed')),
  answer_text TEXT CHECK (answer_text IS NULL OR char_length(answer_text) BETWEEN 1 AND 10000),
  answered_by TEXT,
  tutor_notification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (tutor_notification_status IN ('pending', 'accepted', 'failed', 'not_configured')),
  student_notification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (student_notification_status IN ('pending', 'accepted', 'failed', 'not_configured')),
  tutor_notification_attempted_at TIMESTAMPTZ,
  student_notification_attempted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

ALTER TABLE academy_tutor_questions
  ADD COLUMN IF NOT EXISTS lesson_key TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS answer_request_id TEXT,
  ADD COLUMN IF NOT EXISTS module_key TEXT,
  ADD COLUMN IF NOT EXISTS tutor_notification_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS student_notification_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS tutor_notification_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS student_notification_attempted_at TIMESTAMPTZ;

UPDATE academy_tutor_questions
SET request_id = COALESCE(request_id, 'legacy_question_' || id::text),
    module_key = COALESCE(
      module_key,
      CASE
        WHEN lesson_key IS NOT NULL AND lesson_key <> 'tutor_question' THEN lesson_key
        ELSE 'general'
      END
    )
WHERE request_id IS NULL OR module_key IS NULL;

ALTER TABLE academy_tutor_questions
  ALTER COLUMN request_id SET NOT NULL,
  ALTER COLUMN module_key SET NOT NULL,
  ALTER COLUMN student_email DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS academy_tutor_questions_request_id_uidx
  ON academy_tutor_questions (request_id);

CREATE UNIQUE INDEX IF NOT EXISTS academy_tutor_questions_answer_request_id_uidx
  ON academy_tutor_questions (answer_request_id)
  WHERE answer_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS academy_tutor_questions_student_course_idx
  ON academy_tutor_questions (academy_student_id, course_key, created_at DESC);

CREATE INDEX IF NOT EXISTS academy_tutor_questions_status_idx
  ON academy_tutor_questions (status, created_at DESC);

COMMIT;
