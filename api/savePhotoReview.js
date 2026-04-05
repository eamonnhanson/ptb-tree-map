import { pool } from "./db.js";

export default async function savePhotoReview(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      category,
      file_url,
      original_file_url,
      user_id,
      tree_id,
      linked_entity_type,
      linked_entity_name,
      uploader_name,
      uploader_email
    } = req.body;

    if (!file_url) {
      return res.status(400).json({ error: "file_url is required" });
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
      category || null,
      linked_entity_type || null,
      linked_entity_name || null,
      user_id || null,
      tree_id || null,
      file_url,
      original_file_url || null,
      uploader_name || null,
      uploader_email || null
    ];

    const result = await pool.query(query, values);

    return res.json({
      success: true,
      review_id: result.rows[0].id
    });

  } catch (err) {
    console.error("savePhotoReview error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
