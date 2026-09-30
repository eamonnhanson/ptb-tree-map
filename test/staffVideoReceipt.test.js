import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createSavePhotoReviewHandler } from "../api/savePhotoReview.js";

const videoUpload = {
  category: "staff_upload",
  staff_id: "ketso_staff_7",
  uploaded_by: "ketso_staff_7",
  staff_name: "KETSO Staff",
  staff_category: "field",
  selected_category: "field",
  caption: "Field update from the nursery",
  linked_entity_type: "staff",
  linked_entity_name: "KETSO Staff",
  upload_context: "staff_upload",
  file_type: "video",
  upload_type: "video",
  file_url: "https://media.example.test/staff/video-1.mp4",
  original_file_url: "https://media.example.test/staff/video-1.mp4",
  original_filename: "field-update.mp4",
  mime_type: "video/mp4",
  original_file_size_bytes: 75 * 1024 * 1024,
  duration_seconds: 60
};

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function setup() {
  const calls = [];
  return {
    calls,
    handler: createSavePhotoReviewHandler({
      dbPool: {
        async query(sql, values) {
          calls.push({ sql: String(sql).replace(/\s+/g, " ").trim(), values });
          return { rows: [{ id: 301 }] };
        }
      }
    })
  };
}

test("valid MP4 staff video persists generic media metadata and a durable receipt", async () => {
  const { calls, handler } = setup();
  const res = response();
  await handler({ method: "POST", body: videoUpload }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.review_id, 301);
  assert.equal(res.body.public_gallery_status, "private");
  assert.equal(res.body.verification_status, "pending");
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /mime_type, original_file_name, duration_seconds/);
  assert.ok(calls[0].values.includes("video/mp4"));
  assert.ok(calls[0].values.includes("field-update.mp4"));
  assert.ok(calls[0].values.includes(60));
  assert.ok(calls[0].values.includes("video"));
});

test("staff video rejects invalid media before the receipt write", async () => {
  const cases = [
    ["VIDEO_TOO_LARGE", { original_file_size_bytes: 75 * 1024 * 1024 + 1 }],
    ["VIDEO_TOO_LONG", { duration_seconds: 60.01 }],
    ["UNSUPPORTED_VIDEO_TYPE", { mime_type: "video/avi" }],
    ["STAFF_IDENTITY_REQUIRED", { staff_id: "", uploaded_by: "" }]
  ];

  for (const [error, patch] of cases) {
    const { calls, handler } = setup();
    const res = response();
    await handler({ method: "POST", body: { ...videoUpload, ...patch } }, res);
    assert.equal(res.statusCode, 400, error);
    assert.equal(res.body.error, error);
    assert.equal(calls.length, 0, error);
  }
});

test("staff video does not report success when durable receipt persistence fails", async () => {
  const handler = createSavePhotoReviewHandler({
    dbPool: { async query() { throw new Error("database unavailable"); } }
  });
  const res = response();
  await handler({ method: "POST", body: videoUpload }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, "RECEIPT_PERSISTENCE_FAILED");
  assert.equal(res.body.ok, false);
});

test("staff video migration is additive and keeps duration separate from image fields", async () => {
  const sql = await readFile(new URL("../docs/sql/025_staff_video_uploads.sql", import.meta.url), "utf8");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS duration_seconds numeric/);
  assert.match(sql, /REVIEW BEFORE EXECUTION/);
});
