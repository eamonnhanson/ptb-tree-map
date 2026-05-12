import { pool } from "./db.js";

export default async function getStudentGallery(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const query = `
      SELECT
        id,
        category,
        linked_entity_name,
        cropped_file_url,
        uploader_name,
        academy_track,
        academy_cohort,
        caption,
        ai_description,
        created_at_utc
      FROM photo_uploads_review
      WHERE category = 'academy_onboarding'
        AND verification_status = 'approved'
        AND public_gallery_status = 'public'
      ORDER BY created_at_utc DESC
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
