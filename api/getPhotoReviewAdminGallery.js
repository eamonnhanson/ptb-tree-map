import { pool } from "./db.js";

export default async function getPhotoReviewAdminGallery(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const filters = {
      public_gallery_status: normalize(req.query.public_gallery_status),
      verification_status: normalize(req.query.verification_status),
      review_status: normalize(req.query.review_status),
      upload_context: normalize(req.query.upload_context),
      linked_entity_type: normalize(req.query.linked_entity_type),
      file_type: normalize(req.query.file_type),
      category: normalize(req.query.category),
      search: normalize(req.query.search)
    };

    const limit = clampLimit(req.query.limit);

    const conditions = [];
    const values = [];

    addExactFilter(conditions, values, "public_gallery_status", filters.public_gallery_status);
    addExactFilter(conditions, values, "verification_status", filters.verification_status);
    addExactFilter(conditions, values, "review_status", filters.review_status);
    addExactFilter(conditions, values, "upload_context", filters.upload_context);
    addExactFilter(conditions, values, "linked_entity_type", filters.linked_entity_type);
    addExactFilter(conditions, values, "category", filters.category);

    if (filters.file_type && filters.file_type !== "all") {
      values.push(filters.file_type);
      const idx = values.length;

      if (filters.file_type === "image") {
        conditions.push(`(
          file_type = $${idx}
          OR (
            file_type IS NULL
            AND (
              cropped_file_url ~* '\\.(jpg|jpeg|png|webp|gif|avif)(\\?|$)'
              OR original_file_url ~* '\\.(jpg|jpeg|png|webp|gif|avif)(\\?|$)'
            )
          )
        )`);
      } else {
        conditions.push(`file_type = $${idx}`);
      }
    }

    if (filters.search) {
      values.push(`%${filters.search}%`);
      const idx = values.length;

      conditions.push(`(
        CAST(id AS TEXT) ILIKE $${idx}
        OR category ILIKE $${idx}
        OR linked_entity_type ILIKE $${idx}
        OR linked_entity_name ILIKE $${idx}
        OR upload_context ILIKE $${idx}
        OR public_gallery_status ILIKE $${idx}
        OR verification_status ILIKE $${idx}
        OR review_status ILIKE $${idx}
        OR uploader_name ILIKE $${idx}
        OR uploader_email ILIKE $${idx}
        OR caption ILIKE $${idx}
        OR ai_description ILIKE $${idx}
        OR academy_track ILIKE $${idx}
        OR academy_cohort ILIKE $${idx}
        OR lesson_key ILIKE $${idx}
      )`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    values.push(limit);
    const limitIndex = values.length;

    const query = `
      SELECT
        id,
        category,
        linked_entity_type,
        linked_entity_name,
        user_id,
        tree_id,
        cropped_file_url,
        original_file_url,
        original_file_size_bytes,
        cropped_file_size_bytes,
        ROUND(original_file_size_bytes / 1024.0, 1) AS original_kb,
        ROUND(cropped_file_size_bytes / 1024.0, 1) AS cropped_kb,
        uploader_name,
        uploader_email,
        review_status,
        ai_description,
        ai_status,
        ai_confidence,
        academy_whatsapp,
        academy_track,
        upload_type,
        consent_given,
        verification_status,
        public_gallery_status,
        upload_context,
        academy_student_id,
        academy_cohort,
        lesson_key,
        interest_area,
        file_type,
        file_extension,
        points_awarded,
        ai_feedback,
        is_visible_in_gallery,
        reviewed_by_admin,
        approved_at,
        rejected_reason,
        created_at_utc,
        reviewed_at_utc,
        reviewed_by,
        student_confirmed_at
      FROM photo_uploads_review
      ${whereClause}
      ORDER BY created_at_utc DESC NULLS LAST, id DESC
      LIMIT $${limitIndex};
    `;

    console.log("photo-review-admin-gallery filters =", filters);
    console.log("photo-review-admin-gallery params =", values);

    const result = await pool.query(query, values);

    return res.status(200).json({
      ok: true,
      count: result.rowCount,
      photos: result.rows
    });

  } catch (err) {
    console.error("getPhotoReviewAdminGallery error:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
      details: err.message
    });
  }
}

function addExactFilter(conditions, values, column, value) {
  if (!value || value === "all") return;
  values.push(value);
  conditions.push(`${column} = $${values.length}`);
}

function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 500;
  return Math.max(1, Math.min(Math.floor(parsed), 1000));
}

function normalize(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}