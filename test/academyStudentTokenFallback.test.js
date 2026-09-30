import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("academy student lookup supports enrollment and legacy upload tokens without a pre-query reference", async () => {
  const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
  const route = source.slice(source.indexOf('app.get("/api/academy-student"'), source.indexOf('app.get("/api/academy-student-search"'));

  assert.match(route, /WHERE e\.enrollment_token = \$1\s+OR s\.upload_token = \$1/);
  assert.match(route, /const result = await pool\.query/);
  assert.match(route, /error: "Student not found"/);
  assert.doesNotMatch(route, /result\.rows\[0\]\.(?:upload_type|lesson_key)[\s\S]*const result/);
  assert.match(route, /course_key: DEFAULT_ACADEMY_COURSE/);
  assert.match(route, /status: row\.enrollment_status/);
});
