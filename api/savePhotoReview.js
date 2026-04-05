import { pool } from "./db.js";

export default async function savePhotoReview(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    console.log("savePhotoReview called. body =", req.body);

    const body = req.body || {};

    const category = normalize(body.category);
    const cropped_file_url = normalize(body.cropped_file_url) || normalize(body.file_url);
    const original_file_url = normalize(body.original_file_url);
    const linked_entity_type = normalize(body.linked_entity_type);
    const linked_entity_name = normalize(body.linked_entity_name);
    const uploader_name = normalize(body.uploader_name);
    const uploader_email = normalize(body.uploader_email);

    const user_id = normalizeNumber(body.user_id);
    const tree_id = normalizeNumber(body.tree_id);

    if (!cropped_file_url) {
      return res.status(400).json({
        ok: false,
        error: "cropped_file_url or file_url is required"
      });
    }

    if (!category) {
      return res.status(400).json({
        ok: false,
        error: "category is required"
      });
    }

    if (category === "forest_hero") {
      if (!user_id || !tree_id) {
        return res.status(400).json({
          ok: false,
          error: "forest_hero requires user_id and tree_id"
        });
      }
    }

    const query = `
      INSERT INTO photo_uploads_review (
        category,
        linked_entity_type,
        linked_entity_name,
        user_id,
        tree_id,
        cropped_file_url,
        original_file_url,
        uploader_name,
        uploader_email,
        review_status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
      RETURNING id;
    `;

    const values = [
      category,
      linked_entity_type,
      linked_entity_name,
      user_id,
      tree_id,
      cropped_file_url,
      original_file_url,
      uploader_name,
      uploader_email
    ];

    console.log("savePhotoReview query values =", values);

    const result = await pool.query(query, values);
    const reviewId = result.rows[0]?.id;

    console.log("savePhotoReview inserted id =", reviewId);

    return res.status(200).json({
      ok: true,
      success: true,
      review_id: reviewId
    });
  } catch (err) {
    console.error("savePhotoReview error:", err);

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

function normalizeNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
