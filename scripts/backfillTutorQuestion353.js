import { pool } from "../api/db.js";

const REVIEW_ID = 353;
const shouldApply = process.env.APPLY_BACKFILL === "true";
const confirmedId = Number(process.env.CONFIRM_REVIEW_ID);

async function main() {
  const source = await pool.query(
    `
    SELECT id, academy_student_id, course_key, lesson_key, upload_type,
           uploader_name, uploader_email, cropped_file_url, original_file_url,
           verification_status, review_status, public_gallery_status,
           is_visible_in_gallery, points_awarded, created_at_utc
    FROM photo_uploads_review
    WHERE id = $1
    LIMIT 1
    `,
    [REVIEW_ID]
  );

  if (!source.rows.length) throw new Error("Review 353 was not found");
  const row = source.rows[0];
  console.log("Source record (review before applying):", {
    id: row.id,
    academy_student_id: row.academy_student_id,
    course_key: row.course_key,
    lesson_key: row.lesson_key,
    upload_type: row.upload_type,
    verification_status: row.verification_status,
    review_status: row.review_status,
    public_gallery_status: row.public_gallery_status,
    is_visible_in_gallery: row.is_visible_in_gallery,
    points_awarded: row.points_awarded,
    created_at_utc: row.created_at_utc
  });

  const isTutorQuestion =
    row.lesson_key === "tutor_question" ||
    row.upload_type === "question_to_tutor";
  if (!isTutorQuestion) {
    throw new Error("Review 353 is not marked as a tutor question; nothing was changed");
  }
  if (!row.academy_student_id) {
    throw new Error("Review 353 is not linked to an academy student; nothing was changed");
  }

  const before = await pool.query(
    "SELECT id, source_review_id, status, created_at FROM academy_tutor_questions WHERE source_review_id = $1",
    [REVIEW_ID]
  );
  console.log("Existing backfill record:", before.rows[0] || null);

  const sourceUrl = row.cropped_file_url || row.original_file_url;
  if (!sourceUrl || !sourceUrl.startsWith("https://")) {
    throw new Error("Review 353 has no valid HTTPS text URL");
  }
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Question text download failed with HTTP ${response.status}`);
  const questionText = (await response.text()).trim();
  if (!questionText || questionText.length > 5000) {
    throw new Error("Question text is empty or longer than 5000 characters");
  }
  console.log("Question text for confirmation:", questionText);

  if (!shouldApply) {
    console.log("Preview only. Set APPLY_BACKFILL=true and CONFIRM_REVIEW_ID=353 to apply.");
    return;
  }
  if (confirmedId !== REVIEW_ID) {
    throw new Error("Set CONFIRM_REVIEW_ID=353 to confirm the exact source record");
  }

  await pool.query("BEGIN");
  try {
    const inserted = await pool.query(
      `
      INSERT INTO academy_tutor_questions (
        source_review_id, request_id, academy_student_id, course_key, module_key,
        student_name, student_email, question_text,
        tutor_notification_status, created_at
      )
      VALUES ($1, $2, $3, COALESCE($4, 'online_tree_planting'), 'general',
              $5, $6, $7, 'not_configured', COALESCE($8, NOW()))
      ON CONFLICT (source_review_id) DO NOTHING
      RETURNING id, source_review_id, academy_student_id, course_key, module_key,
                status, created_at
      `,
      [
        REVIEW_ID,
        `legacy_review_${REVIEW_ID}`,
        row.academy_student_id,
        row.course_key,
        row.uploader_name,
        row.uploader_email,
        questionText,
        row.created_at_utc
      ]
    );

    await pool.query(
      `
      UPDATE photo_uploads_review
      SET public_gallery_status = 'private',
          is_visible_in_gallery = false,
          points_awarded = 0
      WHERE id = $1
        AND (lesson_key = 'tutor_question' OR upload_type = 'question_to_tutor')
      `,
      [REVIEW_ID]
    );
    await pool.query(
      "DELETE FROM academy_point_events WHERE source_table = 'photo_uploads_review' AND source_id = $1",
      [REVIEW_ID]
    );
    await pool.query("COMMIT");
    console.log(inserted.rows.length ? "Backfill inserted:" : "Backfill already existed:", inserted.rows[0] || null);
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  const after = await pool.query(
    `
    SELECT q.id, q.source_review_id, q.academy_student_id, q.course_key,
           q.module_key, q.status, p.public_gallery_status,
           p.is_visible_in_gallery, p.points_awarded
    FROM academy_tutor_questions q
    JOIN photo_uploads_review p ON p.id = q.source_review_id
    WHERE q.source_review_id = $1
    `,
    [REVIEW_ID]
  );
  console.log("Control after backfill:", after.rows[0] || null);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
