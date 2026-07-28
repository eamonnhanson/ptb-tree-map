const FILTER_COLUMNS = [
  "public_gallery_status",
  "verification_status",
  "review_status",
  "upload_context",
  "linked_entity_type",
  "file_type",
  "category"
];

export function createPhotoReviewAdminGalleryHandler(dbPool) {
  if (!dbPool || typeof dbPool.query !== "function") {
    throw new TypeError("A database pool is required");
  }

  return async function getPhotoReviewAdminGallery(req, res) {
    try {
      const conditions = [];
      const values = [];

      for (const column of FILTER_COLUMNS) {
        const value = normalize(req.query?.[column]);
        if (value && value.toLowerCase() !== "all") {
          values.push(value);
          conditions.push(`${column} = $${values.length}`);
        }
      }

      const search = normalize(req.query?.search);
      if (search && search.toLowerCase() !== "all") {
        values.push(`%${search}%`);
        const placeholder = `$${values.length}`;
        conditions.push(`(
          uploader_name ILIKE ${placeholder}
          OR uploader_email ILIKE ${placeholder}
          OR linked_entity_name ILIKE ${placeholder}
          OR category ILIKE ${placeholder}
          OR caption ILIKE ${placeholder}
          OR ai_description ILIKE ${placeholder}
        )`);
      }

      const limit = normalizeLimit(req.query?.limit);
      values.push(limit);

      const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

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
          course_key,
          caption,
          created_at_utc,
          reviewed_at_utc,
          reviewed_by,
          student_confirmed_at
        FROM photo_uploads_review
        ${whereClause}
        ORDER BY created_at_utc DESC, id DESC
        LIMIT $${values.length};
      `;

      const result = await dbPool.query(query, values);
      return res.status(200).json({ ok: true, uploads: result.rows });
    } catch (err) {
      console.error("getPhotoReviewAdminGallery error:", err);
      return res.status(500).json({
        ok: false,
        error: "Internal server error"
      });
    }
  };
}

function normalize(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizeLimit(value) {
  const normalized = normalize(value);
  if (!normalized || normalized.toLowerCase() === "all") return 500;

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 500;
  return Math.min(parsed, 500);
}
