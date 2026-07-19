import { pool } from "./db.js";
import { generateImageDescription } from "./generateImageDescription.js";
import {
  DEFAULT_ACADEMY_COURSE,
  isKnownCourse,
  isKnownLesson,
  lessonName,
  normalizeCourseKey
} from "./academyCourses.js";

const VALID_VERIFICATION_STATUSES = new Set([
  "pending",
  "submitted_for_review",
  "approved",
  "rejected",
  "not_required"
]);

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
let linked_entity_name = normalize(body.linked_entity_name);

let uploader_name = normalize(body.uploader_name);
let uploader_email = normalize(body.uploader_email);

    const user_id = normalizeNumber(body.user_id);
    const tree_id = normalizeNumber(body.tree_id);

    const original_file_size_bytes = normalizeNumber(body.original_file_size_bytes);
    const cropped_file_size_bytes = normalizeNumber(body.cropped_file_size_bytes);

    let academy_student_id = normalizeNumber(body.academy_student_id);
    let academy_cohort = normalize(body.academy_cohort);

    let academy_whatsapp = normalize(body.academy_whatsapp);
    let academy_track = normalize(body.academy_track);

    const upload_type = normalize(body.upload_type);
    const lesson_key = normalize(body.lesson_key);
    const submitted_course_key = normalize(body.course_key);
    let course_key = normalizeCourseKey(submitted_course_key);
    let interest_area = normalize(body.interest_area) || academy_track;
    const consent_given = normalizeBoolean(body.consent_given);

    const upload_context =
      normalize(body.upload_context) ||
      (category === "academy_upload"
        ? "academy_upload"
        : category === "academy_onboarding"
          ? "academy_onboarding"
          : "photo_review");

    const isStaffUpload =
      category === "staff_upload" ||
      upload_context === "staff_upload" ||
      linked_entity_type === "staff";

    const verification_status = isStaffUpload
      ? "not_required"
      : normalizeStatus(body.verification_status, VALID_VERIFICATION_STATUSES, "pending");

    const review_status = isStaffUpload
      ? "not_required"
      : "pending";

    const public_gallery_status = isStaffUpload
      ? "public"
      : "private";

    let ai_status = normalize(body.ai_status) || "not_checked";

    const file_type = inferFileType(upload_type, cropped_file_url || original_file_url);
    const file_extension = inferFileExtension(cropped_file_url || original_file_url);

    const points_awarded = 0;
    const is_visible_in_gallery = false;
    const reviewed_by_admin = false;
    const approved_at = null;
    const rejected_reason = null;

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

    const isAcademyUpload = Boolean(
      academy_student_id ||
      category === "academy_onboarding" ||
      category === "academy_upload" ||
      category === "student_onboarding" ||
      String(category || "").startsWith("academy_lesson_") ||
      String(category || "").startsWith("student_lesson_") ||
      String(upload_context || "").startsWith("academy_")
    );

    if (submitted_course_key && !isKnownCourse(submitted_course_key)) {
      return res.status(400).json({ ok: false, error: "Unknown academy course" });
    }

    if (!isAcademyUpload) course_key = null;

    if (isAcademyUpload) {
      try {
        let studentLookup = { rows: [] };

        if (academy_student_id) {
          studentLookup = await pool.query(
            `
            SELECT
              s.id,
              s.full_name,
              s.email,
              s.cohort,
              s.track,
              COALESCE(
                NULLIF(TRIM(to_jsonb(s)->>'whatsapp_number'), ''),
                NULLIF(TRIM(to_jsonb(s)->>'whatsapp'), ''),
                NULLIF(TRIM(to_jsonb(s)->>'academy_whatsapp'), '')
              ) AS whatsapp
            FROM academy_students s
            WHERE s.id = $1
            LIMIT 1
            `,
            [academy_student_id]
          );
        }

        if (studentLookup.rows.length === 0 && uploader_email) {
          studentLookup = await pool.query(
            `
            SELECT
              s.id,
              s.full_name,
              s.email,
              s.cohort,
              s.track,
              COALESCE(
                NULLIF(TRIM(to_jsonb(s)->>'whatsapp_number'), ''),
                NULLIF(TRIM(to_jsonb(s)->>'whatsapp'), ''),
                NULLIF(TRIM(to_jsonb(s)->>'academy_whatsapp'), '')
              ) AS whatsapp
            FROM academy_students s
            WHERE s.email IS NOT NULL
              AND LOWER(TRIM(s.email)) = LOWER(TRIM($1))
            ORDER BY s.id ASC
            LIMIT 2
            `,
            [uploader_email]
          );
        }

        if (studentLookup.rows.length === 1) {
          const student = studentLookup.rows[0];

          const officialName = normalize(student.full_name);
          const officialEmail = normalize(student.email);

          academy_student_id =
            academy_student_id || student.id;

          academy_cohort =
            academy_cohort || normalize(student.cohort);

          academy_whatsapp =
            academy_whatsapp || normalize(student.whatsapp);

          academy_track =
            academy_track || normalize(student.track);

          interest_area =
            interest_area || academy_track;

          uploader_name =
            officialName || uploader_name;

          uploader_email =
            officialEmail || uploader_email;

          linked_entity_name =
            officialName ||
            linked_entity_name ||
            uploader_name;
        } else if (!linked_entity_name && uploader_name) {
          linked_entity_name = uploader_name;
        }
      } catch (err) {
        console.warn(
          "Could not resolve academy student details:",
          err.message
        );
      }

      if (!uploader_name) {
        return res.status(400).json({
          ok: false,
          error: `${category} requires uploader_name`
        });
      }

      if (!uploader_email) {
        return res.status(400).json({
          ok: false,
          error: `${category} requires uploader_email`
        });
      }

      /*
       * WhatsApp is useful, but a missing number must not
       * prevent a student upload from being saved.
       */
      if (!academy_whatsapp) {
        console.warn(
          `${category} upload saved without academy_whatsapp`,
          {
            academy_student_id,
            uploader_email
          }
        );
      }

      if (!academy_track && !interest_area) {
        return res.status(400).json({
          ok: false,
          error: `${category} requires academy_track or interest_area`
        });
      }

      if (!upload_type) {
        return res.status(400).json({
          ok: false,
          error: `${category} requires upload_type`
        });
      }

      if (!consent_given) {
        return res.status(400).json({
          ok: false,
          error: `${category} requires consent_given`
        });
      }

      if (!lesson_key) {
        return res.status(400).json({
          ok: false,
          error: "Academy uploads require lesson_key"
        });
      }

      if (!isKnownLesson(course_key, lesson_key)) {
        return res.status(400).json({
          ok: false,
          error: `Lesson ${lesson_key} does not belong to ${course_key}`
        });
      }
    }

    let ai_description = null;
    let ai_feedback = null;
    const ai_confidence = null;

    try {
      ai_status = "checking";

      if (file_type === "image") {
        ai_description = await generateImageDescription(cropped_file_url, {
          courseKey: course_key || DEFAULT_ACADEMY_COURSE,
          lessonKey: lesson_key
        });
      }

      if (!ai_description) {
        ai_description = buildFallbackDescription({
          upload_type,
          lesson_key,
          interest_area
        });
      }

      ai_feedback = buildAcademyFeedback({
        category,
        upload_type,
        lesson_key,
        interest_area,
        course_key,
        ai_description
      });

      ai_status = "checked";

      console.log("AI description:", ai_description);
      console.log("AI feedback:", ai_feedback);
    } catch (err) {
      ai_status = "failed";
      ai_feedback = null;
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
        course_key
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,
        $26,$27,$28,$29,$30,
        $31,$32,$33,$34,$35
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
      course_key
    ];

    console.log("savePhotoReview staff status check =", {
      isStaffUpload,
      category,
      linked_entity_type,
      upload_context,
      public_gallery_status,
      verification_status,
      review_status
    });

    console.log("savePhotoReview query values =", values);

    const result = await pool.query(query, values);
    const reviewId = result.rows[0]?.id;

    return res.status(200).json({
      ok: true,
      success: true,
      review_id: reviewId,
      public_gallery_status,
      verification_status,
      review_status,
      ai_status,
      ai_description,
      ai_feedback,
      course_key
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

function normalizeStatus(value, validValues, fallback) {
  const normalized = normalize(value);

  if (!normalized) return fallback;
  if (!validValues.has(normalized)) return fallback;

  return normalized;
}

function inferFileExtension(url) {
  if (!url || typeof url !== "string") return null;

  const cleanUrl = url.split("?")[0];
  const lastPart = cleanUrl.split("/").pop() || "";
  const dotIndex = lastPart.lastIndexOf(".");

  if (dotIndex === -1) return null;

  return lastPart.slice(dotIndex + 1).toLowerCase();
}

function inferFileType(uploadType, url) {
  const normalizedUploadType = normalize(uploadType);

  if (normalizedUploadType === "image_photo") return "image";
  if (normalizedUploadType === "text") return "text";
  if (normalizedUploadType === "document") return "document";
  if (normalizedUploadType === "video") return "video";

  const ext = inferFileExtension(url);

  if (["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext)) {
    return "image";
  }

  if (["pdf", "doc", "docx", "txt"].includes(ext)) {
    return ext === "txt" ? "text" : "document";
  }

  if (["mp4", "mov", "webm"].includes(ext)) {
    return "video";
  }

  return "file";
}

function buildAcademyFeedback({
  category,
  upload_type,
  lesson_key,
  interest_area,
  course_key,
  ai_description
}) {
  if (!course_key) {
    return null;
  }

  const lessonLabel = lessonName(course_key, lesson_key);
  const interestLabel = interestLabelFromKey(interest_area);
  const uploadLabel = uploadLabelFromKey(upload_type);

  const detected = ai_description
    ? `AI detection: ${ai_description}`
    : "AI detection: no clear description was generated.";

  const improvementHint = improvementHintFromLesson(course_key, lesson_key);

  return [
    `Upload type: ${uploadLabel}.`,
    `Topic: ${lessonLabel}.`,
    `Course: ${course_key === "arboriculture_1" ? "Arboriculture I" : "Online tree planting"}.`,
    `Interest area: ${interestLabel}.`,
    detected,
    improvementHint
  ].join("\n");
}

function lessonLabelFromKey(value) {
  const map = {
    onboarding: "Onboarding",
    lesson_1_climate_change: "Lesson 1 Climate Change",
    lesson_2_tree_health: "Lesson 2 Tree Health",
    lesson_3_tree_planting: "Lesson 3 Tree Planting",
    lesson_4_co2_increase: "Lesson 4 We cause Carbon Dioxide Increase",
    evaluation: "Evaluation"
  };

  return map[value] || value || "Not selected";
}

function interestLabelFromKey(value) {
  const map = {
    online_tree_planting: "Online tree planting",
    distance_certificate_course: "Distance certificate course",
    donor_investor_funding: "Donor and investor funding",
    networking_advocacy: "Networking & Advocacy"
  };

  return map[value] || value || "Not selected";
}

function uploadLabelFromKey(value) {
  const map = {
    image_photo: "Image or photo",
    text: "Text",
    document: "Document",
    video: "Video",
    selfie: "Selfie",
    favourite_object: "Favourite object"
  };

  return map[value] || value || "Unknown upload type";
}

function improvementHintFromLesson(courseKey, value) {
  if (courseKey === "arboriculture_1") {
    const arboricultureHints = {
      onboarding: "Improvement suggestion: introduce yourself and explain why you want to learn about trees.",
      arb1_module_1_tree_biology: "Improvement suggestion: identify the tree part or biological process and explain how it affects tree survival.",
      arb1_module_2_tree_identification: "Improvement suggestion: show identifying features such as leaves, bark, buds, fruit or tree form.",
      arb1_module_3_soil_and_roots: "Improvement suggestion: describe soil texture, drainage, root condition and available oxygen.",
      arb1_module_4_tree_selection: "Improvement suggestion: connect the selected species to the site, available space, soil and intended purpose.",
      arb1_module_5_tree_planting: "Improvement suggestion: show planting depth, root position, backfill, watering and protection.",
      arb1_module_6_tree_care: "Improvement suggestion: explain watering, mulching, weed control and protection during establishment.",
      arb1_module_7_tree_health: "Improvement suggestion: support your assessment with visible signs from leaves, stem, roots, soil and surroundings.",
      arb1_module_8_pruning: "Improvement suggestion: identify the pruning objective and show where a correct cut should be made.",
      evaluation: "Improvement suggestion: explain what you learned and how you will apply it in practical tree care."
    };
    return arboricultureHints[value] || "Improvement suggestion: connect the evidence more clearly to the selected Arboriculture I module.";
  }

  const map = {
    onboarding:
      "Improvement suggestion: make sure your upload clearly introduces who you are or what object represents your learning journey.",
    lesson_1_climate_change:
      "Improvement suggestion: connect your answer more clearly to climate change, local observations, rainfall, heat, flooding or farming conditions.",
    lesson_2_tree_health:
      "Improvement suggestion: show or explain signs of tree health more clearly, such as leaf colour, new growth, pests, water stress or soil condition.",
    lesson_3_tree_planting:
      "Improvement suggestion: make the planting method clearer, including spacing, hole preparation, watering, mulch or protection from animals.",
    lesson_4_co2_increase:
      "Improvement suggestion: explain more clearly how human activities increase carbon dioxide, such as burning fuel, deforestation or charcoal making.",
    evaluation:
      "Improvement suggestion: reflect more clearly on what you learned, what changed in your thinking and what you want to do next."
  };

  return map[value] || "Improvement suggestion: make the connection to the selected lesson clearer.";
}

function buildFallbackDescription({ upload_type, lesson_key, interest_area }) {
  const uploadLabel = uploadLabelFromKey(upload_type);
  const lessonLabel = lessonLabelFromKey(lesson_key);
  const interestLabel = interestLabelFromKey(interest_area);

  return `Upload received. AI could not confidently describe the content yet. Upload type: ${uploadLabel}. Topic: ${lessonLabel}. Interest area: ${interestLabel}.`;
}
