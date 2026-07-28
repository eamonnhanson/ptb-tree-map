import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPhotoReviewAdminGalleryHandler } from "../api/getPhotoReviewAdminGallery.js";

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function setup(rows = [{ id: 17 }]) {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({
        sql: String(sql).replace(/\s+/g, " ").trim(),
        params
      });
      return { rows };
    }
  };
  return {
    calls,
    handler: createPhotoReviewAdminGalleryHandler(pool)
  };
}

test("admin gallery applies every supported filter with parameterized SQL", async () => {
  const { calls, handler } = setup();
  const res = response();
  await handler({
    query: {
      public_gallery_status: " public ",
      verification_status: "approved",
      review_status: "pending",
      upload_context: "staff_upload",
      linked_entity_type: "tree",
      file_type: "image",
      category: "oak",
      search: " Eamonn ",
      limit: "25"
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, uploads: [{ id: 17 }] });
  assert.deepEqual(calls[0].params, [
    "public",
    "approved",
    "pending",
    "staff_upload",
    "tree",
    "image",
    "oak",
    "%Eamonn%",
    25
  ]);
  assert.match(calls[0].sql, /public_gallery_status = \$1/);
  assert.match(calls[0].sql, /category = \$7/);
  assert.match(calls[0].sql, /uploader_name ILIKE \$8/);
  assert.match(calls[0].sql, /uploader_email ILIKE \$8/);
  assert.match(calls[0].sql, /linked_entity_name ILIKE \$8/);
  assert.match(calls[0].sql, /caption ILIKE \$8/);
  assert.match(calls[0].sql, /ai_description ILIKE \$8/);
  assert.match(calls[0].sql, /LIMIT \$9/);
  assert.doesNotMatch(calls[0].sql, /Eamonn|'staff_upload'|'approved'/);
});

test("admin gallery treats missing and all values as unfiltered and defaults limit", async () => {
  const { calls, handler } = setup([]);
  const res = response();
  await handler({
    query: {
      public_gallery_status: "all",
      verification_status: " ALL ",
      search: "all",
      category: ""
    }
  }, res);

  assert.deepEqual(calls[0].params, [500]);
  assert.doesNotMatch(calls[0].sql, /\bWHERE\b/);
  assert.match(calls[0].sql, /ORDER BY created_at_utc DESC, id DESC LIMIT \$1/);
});

test("admin gallery caps limit at 500 and uses 500 for invalid limits", async () => {
  for (const [requested, expected] of [["900", 500], ["0", 500], ["nope", 500]]) {
    const { calls, handler } = setup();
    await handler({ query: { limit: requested } }, response());
    assert.deepEqual(calls[0].params, [expected]);
  }
});

test("server protects and registers admin gallery before the API 404 guard", async () => {
  const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
  const route = source.indexOf('app.get("/api/photo-review-admin-gallery"');
  const guard = source.indexOf('if (!requireAdmin(req, res)) return;', route);
  const notFound = source.indexOf('app.use("/api",');

  assert.ok(route >= 0);
  assert.ok(guard > route);
  assert.ok(notFound > route);
});
