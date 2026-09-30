const STAFF_CATEGORIES = new Set([
  "forest_hero", "nursery", "training", "vocational_training", "charcoal_making",
  "truck", "wilde_ganzen", "hoorn_foundation", "josephina_foundation",
  "care_international", "woord_en_daad", "plant_een_boom", "other"
]);
const ALLOWED_FIELDS = new Set(["staff_id", "staff_name", "category", "caption"]);

export function createUpdateStaffUploadMetadataHandler({ dbPool = null } = {}) {
  return async function updateStaffUploadMetadata(req, res) {
    if (req.method !== "PATCH") return res.status(405).json({ ok: false, error: "Method not allowed" });
    const body = req.body || {};
    const reviewId = positiveInteger(req.params?.review_id || body.review_id);
    const staffId = text(body.staff_id, 48);
    const unexpected = Object.keys(body).filter(key => !ALLOWED_FIELDS.has(key) && key !== "review_id");
    if (unexpected.length) return res.status(400).json({ ok: false, error: "FORBIDDEN_METADATA_FIELD" });
    if (!reviewId) return res.status(400).json({ ok: false, error: "INVALID_REVIEW_ID" });
    if (!staffId) return res.status(400).json({ ok: false, error: "STAFF_IDENTITY_REQUIRED" });
    const staffName = text(body.staff_name, 80);
    const category = text(body.category, 100);
    const caption = optionalText(body.caption, 500);
    if (!staffName) return res.status(400).json({ ok: false, error: "INVALID_STAFF_NAME" });
    if (!STAFF_CATEGORIES.has(category)) return res.status(400).json({ ok: false, error: "INVALID_STAFF_CATEGORY" });
    try {
      if (!dbPool) ({ pool: dbPool } = await import("./db.js"));
      const result = await dbPool.query(`
        UPDATE photo_uploads_review
        SET staff_name = $1, uploader_name = $1,
            linked_entity_name = CASE WHEN linked_entity_type = 'staff' THEN $1 ELSE linked_entity_name END,
            staff_category = $2, selected_category = $2, caption = $3, updated_at_utc = now()
        WHERE id = $4 AND staff_id = $5 AND upload_context = 'staff_upload'
        RETURNING id, staff_id, staff_name, uploader_name, staff_category, selected_category, caption,
          cropped_file_url, original_file_url, file_type, mime_type, duration_seconds,
          created_at_utc, verification_status, review_status, public_gallery_status, upload_context;
      `, [staffName, category, caption, reviewId, staffId]);
      if (!result.rows.length) return res.status(404).json({ ok: false, error: "STAFF_UPLOAD_NOT_FOUND" });
      return res.status(200).json({ ok: true, review_id: result.rows[0].id, upload: result.rows[0] });
    } catch (err) {
      console.error("updateStaffUploadMetadata error:", err);
      return res.status(500).json({ ok: false, error: "STAFF_METADATA_UPDATE_FAILED" });
    }
  };
}

export default createUpdateStaffUploadMetadataHandler();

function text(value, max) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function optionalText(value, max) { return value == null ? null : text(value, max); }
function positiveInteger(value) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : null; }
