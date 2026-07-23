import { pool } from "./db.js";
import { DEFAULT_ACADEMY_COURSE, normalizeCourseKey } from "./academyCourses.js";

export default async function getStudentGallery(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const courseKey = normalizeCourseKey(req.query.course_key);

  try {
    const query = `
      WITH eligible AS (
        SELECT p.*
        FROM photo_uploads_review p
        WHERE p.academy_student_id IS NOT NULL
          AND p.verification_status = 'approved'
          AND p.public_gallery_status = 'public' AND p.upload_type IS DISTINCT FROM 'question_to_tutor' AND p.lesson_key IS DISTINCT FROM 'tutor_question'
          AND COALESCE(p.course_key, '${DEFAULT_ACADEMY_COURSE}') = $1
      ),
      representatives AS (
        SELECT DISTINCT ON (academy_student_id)
          id, academy_student_id, category, linked_entity_name,
          cropped_file_url, uploader_name, academy_track, academy_cohort,
          caption, ai_description, created_at_utc
        FROM eligible
        WHERE COALESCE(file_type, 'image') = 'image'
        ORDER BY academy_student_id,
          CASE WHEN lesson_key = 'onboarding' THEN 0 ELSE 1 END,
          created_at_utc DESC
      ),
      totals AS (
        SELECT academy_student_id, COALESCE(SUM(points_awarded), 0)::int AS total_points
        FROM eligible
        GROUP BY academy_student_id
      )
      SELECT
        r.*,
        $1::text AS course_key,
        t.total_points,
        rewards.badge_count,
        rewards.public_badge_count,
        rewards.badges
      FROM representatives r
      JOIN totals t ON t.academy_student_id = r.academy_student_id
      LEFT JOIN academy_student_rewards rewards
        ON rewards.academy_student_id = r.academy_student_id
      ORDER BY r.created_at_utc DESC
      LIMIT 200;
    `;

    const result = await pool.query(query, [courseKey]);
    return res.status(200).json({ ok: true, course_key: courseKey, photos: result.rows });
  } catch (err) {
    console.error("getStudentGallery error:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
      details: err.message
    });
  }
}
