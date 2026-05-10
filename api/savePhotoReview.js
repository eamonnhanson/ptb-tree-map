Vervang je hele `save-photo-review.js` door deze versie.

Vooraf moet je database deze extra kolommen hebben:

```sql
ALTER TABLE photo_uploads_review
ADD COLUMN IF NOT EXISTS academy_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS academy_track TEXT,
ADD COLUMN IF NOT EXISTS upload_type TEXT,
ADD COLUMN IF NOT EXISTS consent_given BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT 'not_checked',
ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC,
ADD COLUMN IF NOT EXISTS upload_context TEXT;
```

```js
import { pool } from "./db.js";
import { generateImageDescription } from "./generateImageDescription.js";

export default async function savePhotoReview(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    console.log("savePhotoReview called. body =", req.body);

    const body = req.body || {};

    const category = normalize(body.category);
    const cropped_file_url =
      normalize(body.cropped_file_url) ||
      normalize(body.file_url);

    const original_file_url = normalize(body.original_file_url);
    const linked_entity_type = normalize(body.linked_entity_type);
    const linked_entity_name = normalize(body.linked_entity_name);
    const uploader_name = normalize(body.uploader_name);
    const uploader_email = normalize(body.uploader_email);

    const user_id = normalizeNumber(body.user_id);
    const tree_id = normalizeNumber(body.tree_id);

    const original_file_size_bytes = normalizeNumber(body.original_file_size_bytes);
    const cropped_file_size_bytes = normalizeNumber(body.cropped_file_size_bytes);

    // Academy onboarding fields
    const academy_whatsapp = normalize(body.academy_whatsapp);
    const academy_track = normalize(body.academy_track);
    const upload_type = normalize(body.upload_type);
    const consent_given = normalizeBoolean(body.consent_given);

    const verification_status =
      normalize(body.verification_status) || "pending";

    let ai_status =
      normalize(body.ai_status) || "not_checked";

    const upload_context =
      normalize(body.upload_context) ||
      (category === "academy_onboarding" ? "academy_onboarding" : "photo_review");

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

    if (category === "academy_onboarding") {
      if (!uploader_name) {
        return res.status(400).json({
          ok: false,
          error: "academy_onboarding requires uploader_name"
        });
      }

      if (!uploader_email) {
        return res.status(400).json({
          ok: false,
          error: "academy_onboarding requires uploader_email"
        });
      }

      if (!academy_whatsapp) {
        return res.status(400).json({
          ok: false,
          error: "academy_onboarding requires academy_whatsapp"
        });
      }

      if (!academy_track) {
        return res.status(400).json({
          ok: false,
          error: "academy_onboarding requires academy_track"
        });
      }

      if (!upload_type) {
        return res.status(400).json({
          ok: false,
          error: "academy_onboarding requires upload_type"
        });
      }

      if (!consent_given) {
        return res.status(400).json({
          ok: false,
          error: "academy_onboarding requires consent_given"
        });
      }
    }

    let ai_description = null;
    let ai_confidence = null;

    try {
      ai_status = "checking";
      ai_description = await generateImageDescription(cropped_file_url);
      ai_status = "checked";

      console.log("AI description:", ai_description);
    } catch (err) {
      ai_status = "failed";
      console.log("AI failed:", err.message);
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
        upload_context
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11,'pending',$12,$13,$14,
        $15,$16,$17,$18,$19,
        $20
      )
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
      original_file_size_bytes,
      cropped_file_size_bytes,
      uploader_name,
      uploader_email,
      ai_description,
      ai_status,
      ai_confidence,
      academy_whatsapp,
      academy_track,
      upload_type,
      consent_given,
      verification_status,
      upload_context
    ];

    console.log("savePhotoReview query values =", values);

    const result = await pool.query(query, values);
    const reviewId = result.rows[0]?.id;

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

function normalizeBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
}
```
