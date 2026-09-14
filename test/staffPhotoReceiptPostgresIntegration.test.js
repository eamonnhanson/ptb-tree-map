import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { createSavePhotoReviewHandler } from "../api/savePhotoReview.js";
import { createPhotoReviewGalleryHandler } from "../api/getPhotoReviewGallery.js";

const { Pool } = pg;
const connectionString = process.env.PTB_STAFF_PHOTO_POSTGRES_INTEGRATION_URL;
const baselineUrl = new URL("./sql/001_photo_uploads_review_baseline.sql", import.meta.url);
const migrationUrl = new URL("../docs/sql/022_staff_photo_receipts.sql", import.meta.url);

function validateLocalTestUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!localHosts.has(url.hostname)) {
    throw new Error("PTB_STAFF_PHOTO_POSTGRES_INTEGRATION_URL must use a loopback host");
  }
  if (!/^ptb_staff_photo_receipts_test(?:_[a-z0-9_]+)?$/i.test(database)) {
    throw new Error("PTB_STAFF_PHOTO_POSTGRES_INTEGRATION_URL must target a dedicated ptb_staff_photo_receipts_test database");
  }
  return url.toString();
}

const localUrl = validateLocalTestUrl(connectionString);

const photoUrl = "https://pub-146513161ecf43ebbf81dda0cf702fde.r2.dev/staff_uploads/test_staff/attempt/photo.jpg";
const payload = {
  category: "staff_upload",
  staff_category: "nursery",
  selected_category: "nursery",
  caption: "Seedlings ready for planting",
  file_url: photoUrl,
  original_file_url: "https://pub-146513161ecf43ebbf81dda0cf702fde.r2.dev/staff_uploads/test_staff/attempt/original.jpg",
  original_file_size_bytes: 1000,
  cropped_file_size_bytes: 750,
  linked_entity_type: "staff",
  linked_entity_name: "Test Staff",
  uploader_name: "Test Staff",
  upload_type: "staff_photo",
  upload_context: "staff_upload",
  uploaded_by: "test_staff",
  staff_id: "test_staff",
  staff_name: "Test Staff",
  staff_created_at: "2026-09-14T10:00:00Z",
  uploader_role: "staff"
};

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("staff photo receipts on isolated PostgreSQL", {
  skip: !localUrl && "local isolated PostgreSQL prerequisite unavailable"
}, async t => {
  const pool = new Pool({ connectionString: localUrl, ssl: false });
  const [baseline, migration] = await Promise.all([
    readFile(baselineUrl, "utf8"),
    readFile(migrationUrl, "utf8")
  ]);

  try {
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public");
    await pool.query(baseline);
    await pool.query(migration);

    const save = createSavePhotoReviewHandler({
      dbPool: pool,
      describeImage: async () => "A staff photo"
    });
    const gallery = createPhotoReviewGalleryHandler({ dbPool: pool });

    await t.test("identical valid payloads create one row and return one review id", async () => {
      const first = response();
      const retry = response();
      await save({ method: "POST", body: payload }, first);
      await save({ method: "POST", body: payload }, retry);

      assert.equal(first.statusCode, 200);
      assert.equal(retry.statusCode, 200);
      assert.ok(Number.isInteger(first.body.review_id) && first.body.review_id > 0);
      assert.equal(retry.body.review_id, first.body.review_id);
      const count = await pool.query(
        "SELECT count(*)::int AS count FROM public.photo_uploads_review WHERE staff_id = $1 AND cropped_file_url = $2",
        [payload.staff_id, photoUrl]
      );
      assert.equal(count.rows[0].count, 1);
    });

    await t.test("all staff receipt columns and the partial unique index exist", async () => {
      const columns = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'photo_uploads_review'
          AND column_name = ANY($1::text[])
        ORDER BY column_name
      `, [["staff_category", "selected_category", "uploaded_by", "staff_id", "staff_name", "staff_created_at", "uploader_role"]]);
      assert.deepEqual(columns.rows.map(row => row.column_name), [
        "selected_category", "staff_category", "staff_created_at", "staff_id",
        "staff_name", "uploaded_by", "uploader_role"
      ]);
      const index = await pool.query(`
        SELECT i.indisunique AS is_unique, pg_get_expr(i.indpred, i.indrelid) AS predicate
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = 'photo_uploads_review_staff_receipt_unique'
      `);
      assert.deepEqual(index.rows[0], {
        is_unique: true,
        predicate: "(upload_context = 'staff_upload'::text)"
      });
    });

    await t.test("gallery returns the exact R2 receipt and staff identity", async () => {
      const res = response();
      await gallery({ method: "GET", query: { upload_context: "staff_upload" } }, res);
      assert.equal(res.statusCode, 200);
      const upload = res.body.photos.find(row => row.cropped_file_url === photoUrl);
      assert.ok(upload);
      assert.ok(Number.isInteger(upload.id) && upload.id > 0);
      assert.equal(upload.staff_id, payload.staff_id);
      assert.equal(upload.uploaded_by, payload.uploaded_by);
      assert.equal(upload.category, "staff_upload");
    });

    await t.test("missing staff identity returns HTTP 400 without an insert", async () => {
      const before = await pool.query("SELECT count(*)::int AS count FROM public.photo_uploads_review");
      const res = response();
      await save({ method: "POST", body: { ...payload, staff_id: null, uploaded_by: null } }, res);
      const after = await pool.query("SELECT count(*)::int AS count FROM public.photo_uploads_review");
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.ok, false);
      assert.equal(after.rows[0].count, before.rows[0].count);
    });

    await t.test("lost-response receipt recovery reads one existing row without another insert", async () => {
      const before = await pool.query("SELECT count(*)::int AS count FROM public.photo_uploads_review");
      const res = response();
      await gallery({ method: "GET", query: { upload_context: "staff_upload" } }, res);
      const received = res.body.photos.find(upload =>
        upload.staff_id === payload.staff_id &&
        upload.cropped_file_url === photoUrl &&
        Number.isInteger(upload.id) && upload.id > 0
      );
      const after = await pool.query("SELECT count(*)::int AS count FROM public.photo_uploads_review");
      assert.ok(received);
      assert.equal(after.rows[0].count, before.rows[0].count);
    });
  } finally {
    await pool.end();
  }
});
