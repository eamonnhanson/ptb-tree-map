import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createSavePhotoReviewHandler } from "../api/savePhotoReview.js";

const staffUpload = {
  category: "staff_upload",
  staff_category: "nursery",
  selected_category: "nursery",
  caption: "Seedlings ready for planting",
  file_url: "https://pub.example.test/staff_uploads/test_staff/attempt/photo.jpg",
  original_file_url: "https://pub.example.test/staff_uploads/test_staff/attempt/original.jpg",
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

function setup(query) {
  const calls = [];
  const handler = createSavePhotoReviewHandler({
    dbPool: {
      async query(sql, values) {
        calls.push({ sql: String(sql).replace(/\s+/g, " ").trim(), values });
        return query(sql, values);
      }
    },
    describeImage: async () => "A staff photo"
  });
  return { calls, handler };
}

test("staff receipt stores identity and metadata and returns one durable id on retry", async () => {
  const { calls, handler } = setup(async () => ({ rows: [{ id: 91 }] }));

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = response();
    await handler({ method: "POST", body: staffUpload }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.review_id, 91);
  }

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /caption, staff_category, selected_category, uploaded_by, staff_id, staff_name, staff_created_at, uploader_role/);
  assert.match(calls[0].sql, /ON CONFLICT \(staff_id, cropped_file_url\) WHERE upload_context = 'staff_upload' DO UPDATE SET staff_id = photo_uploads_review.staff_id/);
  assert.deepEqual(calls[0].values.slice(35), [
    "Seedlings ready for planting", "nursery", "nursery", "test_staff",
    "test_staff", "Test Staff", "2026-09-14T10:00:00.000Z", "staff"
  ]);

  const insertShape = calls[0].sql.match(/INSERT INTO photo_uploads_review \((.*?)\) VALUES \((.*?)\)/);
  assert.ok(insertShape, "the receipt write must retain an INSERT column/value shape");
  const targetColumns = insertShape[1].split(",").map(value => value.trim());
  const placeholders = insertShape[2].split(",").map(value => value.trim());
  assert.equal(targetColumns.length, calls[0].values.length);
  assert.deepEqual(placeholders, Array.from(
    { length: calls[0].values.length },
    (_, index) => `$${index + 1}`
  ));
});

test("staff receipt fails closed before a database write without staff identity", async () => {
  const { calls, handler } = setup(async () => ({ rows: [{ id: 1 }] }));
  const res = response();
  await handler({ method: "POST", body: { ...staffUpload, staff_id: "", uploaded_by: "" } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, false);
  assert.equal(calls.length, 0);
});

test("staff receipt returns an error when the durable database write fails", async () => {
  const { handler } = setup(async () => { throw new Error("database unavailable"); });
  const res = response();
  await handler({ method: "POST", body: staffUpload }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.ok, false);
});

test("migration creates the staff receipt uniqueness boundary", async () => {
  const sql = await readFile(new URL("../docs/sql/022_staff_photo_receipts.sql", import.meta.url), "utf8");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS staff_id text/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS photo_uploads_review_staff_receipt_unique/);
  assert.match(sql, /\(staff_id, cropped_file_url\)\s+WHERE upload_context = 'staff_upload'/);
  assert.match(sql, /REVIEW BEFORE EXECUTION/);
});

test("staff identity is selected by both gallery feeds", async () => {
  const [gallery, adminGallery] = await Promise.all([
    readFile(new URL("../api/getPhotoReviewGallery.js", import.meta.url), "utf8"),
    readFile(new URL("../api/getPhotoReviewAdminGallery.js", import.meta.url), "utf8")
  ]);

  for (const source of [gallery, adminGallery]) {
    assert.match(source, /staff_id,/);
    assert.match(source, /uploaded_by,/);
    assert.match(source, /staff_category,/);
  }
});
