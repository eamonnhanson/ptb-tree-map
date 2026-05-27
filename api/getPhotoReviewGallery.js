import { pool } from "./db.js";

export default async function getPhotoReviewGallery(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const category = normalize(req.query.category);
    const date_from = normalize(req.query.date_from);
    const date_to = normalize(req.query.date_to);
    const search = normalize(req.query.search);
    const anonymousOnboarding = req.query.anonymous_onboarding === "1";

    console.log("photo-review-gallery endpoint called");
    console.log("photo-review-gallery selected category:", category || "all");

    const conditions = anonymousOnboarding
      ? [
        "(verification_status = 'approved' OR review_status = 'approved')",
        "public_gallery_status = 'public'",
        "academy_student_id IS NULL",
        "COALESCE(NULLIF(TRIM(uploader_name), ''), NULLIF(TRIM(uploader_email), '')) IS NULL",
        `(
          category IN ('student_onboarding', 'academy_onboarding')
          OR upload_context = 'academy_onboarding'
          OR lesson_key = 'onboarding'
        )`
      ]
      : [
        "verification_status = 'approved'",
        "public_gallery_status = 'public'",
        "academy_student_id IS NULL",
        "(upload_context IN ('photo_review', 'legacy_photo_import', 'staff_upload') OR upload_context IS NULL)"
      ];
    const values = [];

    if (category && category !== "all") {
      values.push(category);
      conditions.push(`category = $${values.length}`);
    }

    if (date_from) {
      values.push(date_from);
      conditions.push(`created_at_utc >= $${values.length}::date`);
    }

    if (date_to) {
      values.push(date_to);
      conditions.push(`created_at_utc < ($${values.length}::date + interval '1 day')`);
    }

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(
        category ILIKE $${values.length}
        OR linked_entity_name ILIKE $${values.length}
        OR uploader_name ILIKE $${values.length}
        OR uploader_email ILIKE $${values.length}
        OR caption ILIKE $${values.length}
        OR ai_description ILIKE $${values.length}
        OR academy_track ILIKE $${values.length}
        OR academy_cohort ILIKE $${values.length}
        OR verification_status ILIKE $${values.length}
        OR public_gallery_status ILIKE $${values.length}
      )`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const query = `
      SELECT
        id,
        category,
        linked_entity_type,
        linked_entity_name,
        cropped_file_url,
        original_file_url,
        original_file_size_bytes,
        cropped_file_size_bytes,
        ROUND(original_file_size_bytes / 1024.0, 1) AS original_kb,
        ROUND(cropped_file_size_bytes / 1024.0, 1) AS cropped_kb,
        review_status,
        verification_status,
        public_gallery_status,
        upload_context,
        academy_student_id,
        academy_track,
        academy_cohort,
        lesson_key,
        uploader_name,
        uploader_email,
        caption,
        ai_description,
        created_at_utc,
        reviewed_at_utc,
        reviewed_by,
        student_confirmed_at
      FROM photo_uploads_review
      ${whereClause}
      ORDER BY created_at_utc DESC
      LIMIT 300;
    `;

    console.log("photo-review-gallery SQL params:", values);
    const result = await pool.query(query, values);
    console.log("photo-review-gallery row count returned:", result.rowCount);

    return res.status(200).json({
      ok: true,
      photos: result.rows
    });

  } catch (err) {
    console.error("getPhotoReviewGallery error:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
      details: err.message
    });
  }
}

function normalize(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
