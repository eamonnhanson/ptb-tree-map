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
    const { review_id, reviewed_by } = req.body;

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
        public_gallery_status = 'public',
        reviewed_at_utc = NOW(),
        reviewed_by = $2
      WHERE id = $1
      RETURNING
        id,
        uploader_name,
        uploader_email,
        academy_track,
        academy_cohort,
        verification_status,
        public_gallery_status,
        cropped_file_url
      `,
      [review_id, reviewed_by || "eamonn"]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Upload not found"
      });
    }

    const upload = result.rows[0];

    await notifyApproval(upload);

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
    const status = String(req.query.status || "submitted_for_review").trim();

    const values = [];
    const conditions = [`category = 'academy_onboarding'`];

    if (status !== "all") {
      values.push(status);
      conditions.push(`verification_status = $${values.length}`);
    }

    const query = `
      SELECT
        id,
        uploader_name,
        uploader_email,
        academy_student_id,
        academy_track,
        academy_cohort,
        cropped_file_url,
        original_file_url,
        verification_status,
        public_gallery_status,
        created_at_utc,
        student_confirmed_at,
        reviewed_at_utc,
        reviewed_by,
        caption,
        ai_description
      FROM photo_uploads_review
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        student_confirmed_at DESC NULLS LAST,
        created_at_utc DESC
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
    const { review_id, reviewed_by } = req.body;

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
        public_gallery_status = 'private',
        reviewed_at_utc = NOW(),
        reviewed_by = $2
      WHERE id = $1
      RETURNING id, verification_status, public_gallery_status
      `,
      [review_id, reviewed_by || "eamonn"]
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
    console.error("academy-reject-upload error:", err);
    res.status(500).json({
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
