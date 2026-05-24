import { pool } from "./db.js";

export default async function getStudentGallery(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    const query = `
     SELECT
  p.id AS upload_id,
  p.academy_student_id AS academy_student_id,
  p.category,
  p.linked_entity_name,
  p.cropped_file_url,
  p.uploader_name,
  p.academy_track,
  p.academy_cohort,
  p.caption,
  p.ai_description,
  p.created_at_utc,

  s.full_name,
  s.onboarding_status,

  r.total_points,
  r.badge_count,
  r.public_badge_count,
  r.badges

FROM photo_uploads_review p

LEFT JOIN academy_students s
  ON s.id = p.academy_student_id

LEFT JOIN academy_student_rewards r
  ON r.academy_student_id = p.academy_student_id

WHERE p.academy_student_id IS NOT NULL
  AND p.verification_status = 'approved'
  AND p.public_gallery_status = 'public'
  AND p.category IN ('academy_onboarding', 'academy_upload')
  AND COALESCE(p.file_type, 'image') = 'image'

ORDER BY p.created_at_utc DESC
LIMIT 200;
`;

    const result = await pool.query(query);

    return res.status(200).json({
      ok: true,
      photos: result.rows
    });
  } catch (err) {
    console.error("getStudentGallery error:", err);

    return res.status(500).json({
      ok: false,
      error: "Internal server error",
      details: err.message
    });
  }
}
