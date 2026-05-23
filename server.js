// server.js

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import treesHandler from "./api/trees.js";
import treesByCodesHandler from "./api/treesByCodes.js";
import treeByAdHandler from "./api/treeByAd.js";
import forestHeroes from "./api/forestHeroes.js";
import forestHeroSearch from "./api/forestHeroSearch.js";
import savePhotoReview from "./api/savePhotoReview.js";
import getPhotoReviewGallery from "./api/getPhotoReviewGallery.js";
import getStudentGallery from "./api/getStudentGallery.js";
import { pool } from "./api/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// =====================================================
// parsers
// =====================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================
// cors
// =====================================================

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:5500",
  "https://eamonnhanson.github.io",
  "https://courageous-centaur-f7d1ea.netlify.app",
  "https://map.planteenboom.nu",
  "https://ketso-uploader.pages.dev"
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      if (
        allowedOrigins.includes(origin) ||
        /\.netlify\.app$/.test(origin)
      ) {
        return cb(null, true);
      }

      console.log("❌ Blocked by CORS:", origin);

      return cb(new Error("Not allowed by CORS"));
    },
  })
);

// =====================================================
// health
// =====================================================

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    msg: "Server running"
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// =====================================================
// API routes
// =====================================================
function requireAdmin(req, res) {
  const key =
    req.headers["x-admin-key"] ||
    req.query.admin_key;

  if (!process.env.ADMIN_GALLERY_KEY) {
    res.status(500).json({
      ok: false,
      error: "ADMIN_GALLERY_KEY is not configured"
    });
    return false;
  }

  if (!key || key !== process.env.ADMIN_GALLERY_KEY) {
    res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
    return false;
  }

  return true;
}

app.get("/api/trees", treesHandler);

app.get("/api/trees/by-codes", treesByCodesHandler);

app.get("/api/trees/:id", treeByAdHandler);

app.get("/api/forest-hero-search", forestHeroSearch);

app.get("/api/photo-review-gallery", getPhotoReviewGallery);
app.get("/api/student-gallery", getStudentGallery);

app.post("/api/save-photo-review", savePhotoReview);

app.use("/api/forest-heroes", forestHeroes);

async function notifyApproval(upload) {
  if (!process.env.ZAPIER_APPROVAL_WEBHOOK_URL) {
    console.warn("ZAPIER_APPROVAL_WEBHOOK_URL is not configured");
    return;
  }

  try {
    const response = await fetch(process.env.ZAPIER_APPROVAL_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        event: "academy_upload_approved",
        review_id: upload.id,
        name: upload.uploader_name,
        email: upload.uploader_email,
        academy_track: upload.academy_track,
        academy_cohort: upload.academy_cohort,
        gallery_url: "https://ketso-uploader.pages.dev/student-gallery/",
        approved_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      console.error("Zapier webhook failed:", response.status, await response.text());
    }

  } catch (err) {
    console.error("Zapier approval notification failed:", err);
  }
}

async function syncApprovedUploadPoint(upload) {
  if (!upload?.id || !upload?.academy_student_id) return;

  const eventKey = `approved_upload_${upload.id}`;

  try {
    if (
      upload.verification_status === "approved" &&
      upload.public_gallery_status === "public"
    ) {
      await pool.query(
        `
        UPDATE academy_point_events
        SET
          points = 1,
          metadata = $4::jsonb
        WHERE source_table = 'photo_uploads_review'
          AND source_id = $3
        `,
        [
          upload.academy_student_id,
          eventKey,
          upload.id,
          JSON.stringify({
            review_id: upload.id,
            category: upload.category || null,
            upload_context: upload.upload_context || null
          })
        ]
      );

      await pool.query(
        `
        INSERT INTO academy_point_events (
          academy_student_id,
          event_key,
          event_label,
          points,
          source_table,
          source_id,
          metadata
        )
        SELECT
          $1,
          $2,
          'Approved public upload',
          1,
          'photo_uploads_review',
          $3,
          $4::jsonb
        WHERE NOT EXISTS (
          SELECT 1
          FROM academy_point_events
          WHERE source_table = 'photo_uploads_review'
            AND source_id = $3
        )
        `,
        [
          upload.academy_student_id,
          eventKey,
          upload.id,
          JSON.stringify({
            review_id: upload.id,
            category: upload.category || null,
            upload_context: upload.upload_context || null
          })
        ]
      );
      return;
    }

    await pool.query(
      `
      DELETE FROM academy_point_events
      WHERE source_table = 'photo_uploads_review'
        AND source_id = $1
      `,
      [upload.id]
    );
  } catch (err) {
    console.warn("Could not sync academy_point_events:", err.message);
  }
}
// =====================================================
// academy upload review
// =====================================================

app.get("/api/academy-upload-review", async (req, res) => {
  try {
    const reviewId = req.query.review_id;

    if (!reviewId) {
      return res.status(400).json({
        ok: false,
        error: "Missing review_id"
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        uploader_name,
        uploader_email,
        academy_track,
        academy_cohort,
        cropped_file_url,
        original_file_url,
        verification_status
      FROM photo_uploads_review
      WHERE id = $1
      LIMIT 1
      `,
      [reviewId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Upload not found"
      });
    }

    res.json({
      ok: true,
      upload: {
        ...result.rows[0],
        file_url: result.rows[0].cropped_file_url
      }
    });

  } catch (err) {
    console.error("academy-upload-review error:", err);

    res.status(500).json({
      ok: false,
      error: "Server error"
    });
  }
});

// =====================================================
// academy submit upload
// =====================================================

app.post("/api/academy-submit-upload", async (req, res) => {
  try {
    const { review_id } = req.body;

    if (!review_id) {
      return res.status(400).json({
        ok: false,
        error: "Missing review_id"
      });
    }

    const result = await pool.query(
      `
      UPDATE photo_uploads_review
      SET
        verification_status = 'submitted_for_review',
        student_confirmed_at = NOW()
      WHERE id = $1
      RETURNING id, verification_status
      `,
      [review_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Upload not found"
      });
    }

    res.json({
      ok: true,
      upload: result.rows[0]
    });

  } catch (err) {
    console.error("academy-submit-upload error:", err);

    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// =====================================================
// academy student lookup by token
// =====================================================

app.get("/api/academy-student", async (req, res) => {
  const token = String(req.query.token || "").trim();

  if (!token) {
    return res.status(400).json({
      ok: false,
      error: "Missing token"
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        zoho_contact_id,
        ketso_student_id,
        full_name,
        first_name,
        last_name,
        email,
        whatsapp,
        track,
        primary_stream,
        cohort,
        status,
        upload_token
      FROM public.academy_students
      WHERE upload_token = $1
      LIMIT 1
      `,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Student not found"
      });
    }

    return res.json({
      ok: true,
      student: result.rows[0]
    });

  } catch (e) {
    console.error("academy-student error:", {
      code: e.code,
      message: e.message,
      detail: e.detail
    });

    return res.status(500).json({
      ok: false,
      error: "Server error",
      code: e.code || null,
      message: e.message || null
    });
  }
});

// =====================================================
// diagnose endpoints
// =====================================================

// 1) basis DB-info

app.get("/api/diag/info", (_req, res) => {
  try {
    const u = new URL(process.env.DATABASE_URL);

    res.json({
      ok: true,
      host: u.hostname,
      db: u.pathname.slice(1),
      ssl: process.env.NODE_ENV === "production"
    });

  } catch {
    res.status(500).json({
      ok: false,
      error: "DATABASE_URL ongeldig of ontbreekt"
    });
  }
});

// 2) ping + kolommen

app.get("/api/diag/db", async (_req, res) => {
  try {
    const ping = await pool.query("select now() as now");

    const cols = await pool.query(`
      select table_schema, table_name, column_name
      from information_schema.columns
      where table_name in ('users1','trees1')
      order by table_schema, table_name, ordinal_position
    `);

    res.json({
      ok: true,
      now: ping.rows[0].now,
      columns: cols.rows
    });

  } catch (e) {
    console.error("diag db error:", {
      code: e.code,
      message: e.message,
      detail: e.detail,
      errno: e.errno,
      address: e.address,
      port: e.port
    });

    res.status(500).json({
      ok: false,
      code: e.code || null,
      message: e.message || null,
      detail: e.detail || null,
      errno: e.errno || null,
      address: e.address || null,
      port: e.port || null
    });
  }
});

// 3) heroes preview

app.get("/api/diag/heroes", async (req, res) => {
  const params = [];

  const where = [
    "u.subscription_type IS NOT NULL",
    "t.lat IS NOT NULL",
    "t.long IS NOT NULL"
  ];

  if (req.query.user_id && /^\d+$/.test(req.query.user_id)) {
    params.push(parseInt(req.query.user_id, 10));
    where.push(`u.id = $${params.length}`);
  }

  if (req.query.email) {
    params.push(req.query.email.trim());
    where.push(`LOWER(u.email) = LOWER($${params.length})`);
  }

  const sqlCount = `
    select count(*)::int as n
    from public.trees1 t
    join public.users1 u on u.id = t.user_id
    where ${where.join(" and ")}
  `;

  const sqlPreview = `
    select
      t.id,
      t.lat,
      t.long,
      t.tree_code,
      t.tree_type,
      t.tree_name,
      u.id as user_id,
      u.email
    from public.trees1 t
    join public.users1 u on u.id = t.user_id
    where ${where.join(" and ")}
    order by t.id asc
    limit 1
  `;

  try {
    const [{ rows: [cnt] }, { rows: prev }] = await Promise.all([
      pool.query(sqlCount, params),
      pool.query(sqlPreview, params)
    ]);

    res.json({
      ok: true,
      count: cnt?.n ?? 0,
      preview: prev?.[0] ?? null
    });

  } catch (e) {
    console.error("diag heroes error:", {
      code: e.code,
      message: e.message,
      detail: e.detail
    });

    res.status(500).json({
      ok: false,
      code: e.code || null,
      message: e.message || null,
      detail: e.detail || null
    });
  }
});
app.post("/api/academy-approve-upload", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { review_id, reviewed_by, public_gallery_status } = req.body;
    const nextGalleryStatus = public_gallery_status === "private" ? "private" : "public";

    if (!review_id) {
      return res.status(400).json({
        ok: false,
        error: "Missing review_id"
      });
    }

    const result = await pool.query(
      `
      UPDATE photo_uploads_review
      SET
      verification_status = 'approved',
      review_status = 'approved',
      public_gallery_status = $3,
      is_visible_in_gallery = $3 = 'public',
      reviewed_at_utc = NOW(),
      approved_at = NOW(),
      reviewed_by = $2,
      points_awarded = CASE
        WHEN academy_student_id IS NOT NULL AND $3 = 'public' THEN 1
        ELSE 0
      END
      WHERE id = $1
      RETURNING
        id,
        category,
        upload_context,
        uploader_name,
        uploader_email,
        academy_student_id,
        academy_track,
        academy_cohort,
        verification_status,
        public_gallery_status,
        cropped_file_url
      `,
      [review_id, reviewed_by || "eamonn", nextGalleryStatus]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Upload not found"
      });
    }

    const upload = result.rows[0];

    await syncApprovedUploadPoint(upload);

    if (nextGalleryStatus === "public") {
      await notifyApproval(upload);
    }

    res.json({
      ok: true,
      upload
    });

  } catch (err) {
    console.error("academy-approve-upload error:", err);
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});
app.get("/api/academy-moderation-queue", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const status = String(req.query.status || "pending").trim();

    const values = [];
    const conditions = [];

    if (status !== "all") {
      values.push(status);
      conditions.push(`verification_status = $${values.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const query = `
      SELECT
        p.id,
        p.uploader_name,
        p.uploader_email,
        p.academy_student_id,
        p.academy_track,
        p.academy_cohort,
        p.interest_area,
        p.lesson_key,
        p.upload_type,
        p.file_type,
        p.cropped_file_url,
        p.original_file_url,
        p.verification_status,
        p.review_status,
        p.public_gallery_status,
        p.is_visible_in_gallery,
        p.points_awarded,
        p.created_at_utc,
        p.student_confirmed_at,
        p.reviewed_at_utc,
        p.reviewed_by,
        p.caption,
        p.ai_description,
        p.ai_feedback,
        COALESCE(existing_onboarding.approved_count, 0)::int AS existing_approved_onboarding_count,
        existing_onboarding.latest_approved_onboarding_id
      FROM photo_uploads_review p
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS approved_count,
          MAX(id) AS latest_approved_onboarding_id
        FROM photo_uploads_review approved
        WHERE approved.academy_student_id = p.academy_student_id
          AND approved.id <> p.id
          AND approved.category = 'academy_onboarding'
          AND approved.verification_status = 'approved'
          AND approved.public_gallery_status = 'public'
      ) existing_onboarding ON p.academy_student_id IS NOT NULL
      ${whereClause}
      ORDER BY
        p.student_confirmed_at DESC NULLS LAST,
        p.created_at_utc DESC
      LIMIT 300;
    `;

    const result = await pool.query(query, values);

    res.json({
      ok: true,
      uploads: result.rows
    });

  } catch (err) {
    console.error("academy-moderation-queue error:", err);
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});
app.post("/api/academy-reject-upload", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { review_id, reviewed_by, rejected_reason } = req.body;
    if (!review_id) {
      return res.status(400).json({
        ok: false,
        error: "Missing review_id"
      });
    }

    const result = await pool.query(
      `
      UPDATE photo_uploads_review
SET
  verification_status = 'rejected',
  review_status = 'rejected',
  public_gallery_status = 'hidden',
  is_visible_in_gallery = false,
  points_awarded = 0,
  reviewed_at_utc = NOW(),
  reviewed_by = $2,
  rejected_reason = $3
WHERE id = $1
RETURNING
  id,
  academy_student_id,
  verification_status,
  review_status,
  public_gallery_status
      `,
      [
      review_id,
      reviewed_by || "eamonn",
      rejected_reason || null
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Upload not found"
      });
    }

    await syncApprovedUploadPoint(result.rows[0]);

    res.json({
      ok: true,
      upload: result.rows[0]
    });

  } catch (err) {
    console.error("academy-reject-upload error:", err);
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});
app.post("/api/academy-hide-upload", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { review_id, reviewed_by, rejected_reason } = req.body;

    if (!review_id) {
      return res.status(400).json({
        ok: false,
        error: "Missing review_id"
      });
    }

    const result = await pool.query(
      `
      UPDATE photo_uploads_review
      SET
        public_gallery_status = 'hidden',
        is_visible_in_gallery = false,
        points_awarded = 0,
        reviewed_at_utc = NOW(),
        reviewed_by = $2,
        rejected_reason = COALESCE($3, rejected_reason)
      WHERE id = $1
      RETURNING
        id,
        academy_student_id,
        verification_status,
        public_gallery_status
      `,
      [review_id, reviewed_by || "eamonn", rejected_reason || null]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Upload not found"
      });
    }

    await syncApprovedUploadPoint(result.rows[0]);

    res.json({
      ok: true,
      upload: result.rows[0]
    });
  } catch (err) {
    console.error("academy-hide-upload error:", err);
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});
app.get("/api/student-profile/:id", async (req, res) => {
  try {
    const studentId = Number(req.params.id);

    if (!Number.isFinite(studentId)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid student id"
      });
    }

    const studentResult = await pool.query(
      `
      SELECT
        s.id,
        s.full_name,
        s.email,
        s.whatsapp,
        s.track,
        s.cohort,
        s.status,
        COALESCE(SUM(p.points_awarded), 0)::int AS total_points
      FROM academy_students s
      LEFT JOIN photo_uploads_review p
        ON p.academy_student_id = s.id
       AND p.review_status = 'approved'
      WHERE s.id = $1
      GROUP BY s.id
      LIMIT 1
      `,
      [studentId]
    );

    if (!studentResult.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Student not found"
      });
    }

    const uploadsResult = await pool.query(
      `
      SELECT
        id,
        lesson_key,
        interest_area,
        upload_type,
        file_type,
        cropped_file_url,
        original_file_url,
        ai_description,
        ai_feedback,
        points_awarded,
        approved_at,
        created_at_utc
      FROM photo_uploads_review
      WHERE academy_student_id = $1
        AND review_status = 'approved'
        AND is_visible_in_gallery = true
      ORDER BY approved_at DESC NULLS LAST, created_at_utc DESC
      `,
      [studentId]
    );

    return res.json({
      ok: true,
      student: studentResult.rows[0],
      uploads: uploadsResult.rows
    });

  } catch (err) {
    console.error("student-profile error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});
// =====================================================
// 404 guard
// =====================================================

app.use("/api", (_req, res) => {
  res.status(404).json({
    error: "not found"
  });
});

// =====================================================
// static frontend
// =====================================================

const feDir = path.join(__dirname, "frontend", "en");

app.use(express.static(feDir));

app.get("/map", (_req, res) => {
  res.sendFile(path.join(feDir, "index.html"));
});

// =====================================================
// start server
// =====================================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
