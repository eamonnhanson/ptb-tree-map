import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { KETSO_VIEWS, allowedView } from "../frontend/automation-dashboard/ketso/ketso-shell.js";

const expectedViews = {
  "staff-upload": "https://ketso-uploader.pages.dev/staff-upload-dashboard/",
  "content-uploader": "https://ketso-uploader.pages.dev/",
  "ketso-gallery": "https://ketso-uploader.pages.dev/gallery",
  "student-gallery": "https://ketso-uploader.pages.dev/student-gallery/",
  "academy-onboarding": "https://ketso-uploader.pages.dev/academy-onboarding/",
  "admin-review": "/automation-dashboard/ketso/admin-review/",
  "admin-gallery": "https://ketso-uploader.pages.dev/admin-gallery/"
};

test("KETSO shell exposes only the fixed target allowlist", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(KETSO_VIEWS).map(([id, view]) => [id, view.url])),
    expectedViews
  );
  assert.equal(allowedView("admin-gallery"), "admin-gallery");
  assert.equal(allowedView("https://attacker.invalid"), null);
  assert.equal(allowedView("../admin-review"), null);
  assert.equal(allowedView(null), null);
});

test("KETSO shell links use view identifiers and preserve standalone access", async () => {
  const html = await readFile(
    new URL("../frontend/automation-dashboard/ketso/index.html", import.meta.url),
    "utf8"
  );

  for (const id of Object.keys(expectedViews)) {
    assert.match(html, new RegExp(`data-ketso-view="${id}"`));
    assert.match(html, new RegExp(`href="\\?view=${id}"`));
  }
  assert.match(html, /data-ketso-external target="_blank" rel="noopener"/);
  assert.match(html, /data-ketso-frame title="KETSO functie"/);
});
