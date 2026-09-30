import test from "node:test";
import assert from "node:assert/strict";
import { createUpdateStaffUploadMetadataHandler } from "../api/updateStaffUploadMetadata.js";

function response() { return { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
function request(body, id = "71") { return { method: "PATCH", params: { review_id: id }, body }; }
const valid = { staff_id: "staff_1", staff_name: "Amara Sesay", category: "nursery", caption: "Updated description" };

test("metadata patch updates only display fields and preserves receipt/media/status fields", async () => {
  const calls = [];
  const handler = createUpdateStaffUploadMetadataHandler({ dbPool: { async query(sql, values) { calls.push({ sql, values }); return { rows: [{ id: 71, ...valid, cropped_file_url: "https://example.test/photo.jpg", original_file_url: "https://example.test/original.jpg", file_type: "video", mime_type: "video/mp4", duration_seconds: 10, public_gallery_status: "private", review_status: "pending", verification_status: "pending" }] }; } } });
  const res = response(); await handler(request(valid), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.review_id, 71); assert.match(calls[0].sql, /WHERE id = \$4 AND staff_id = \$5/);
  assert.doesNotMatch(calls[0].sql.split("WHERE")[0], /(?:file_type|cropped_file_url|public_gallery_status)/);
});

test("metadata patch rejects other staff, unknown uploads, invalid category and forbidden fields", async () => {
  const handler = createUpdateStaffUploadMetadataHandler({ dbPool: { async query() { return { rows: [] }; } } });
  for (const body of [{ ...valid, category: "invalid" }, { ...valid, file_type: "image" }]) { const res = response(); await handler(request(body), res); assert.equal(res.statusCode, 400); }
  const res = response(); await handler(request(valid), res); assert.equal(res.statusCode, 404);
});
