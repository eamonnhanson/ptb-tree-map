import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ACADEMY_COURSES,
  courseName,
  isKnownCourse,
  isKnownLesson
} from "../api/academyCourses.js";
import { createSavePhotoReviewHandler } from "../api/savePhotoReview.js";

const COURSE_KEY = "donor_investor_funding";

test("donor and investor course uses the existing canonical identifier and four modules", () => {
  assert.equal(isKnownCourse(COURSE_KEY), true);
  assert.equal(courseName(COURSE_KEY), "Communicate effectively with donors and investors");
  assert.deepEqual(ACADEMY_COURSES[COURSE_KEY].requiredLessons, [
    "donor_module_1_report_writing",
    "donor_module_2_proposal_writing",
    "donor_module_3_business_plan",
    "donor_module_4_income_generation_fundraising"
  ]);

  for (const lessonKey of ["onboarding", ...ACADEMY_COURSES[COURSE_KEY].requiredLessons]) {
    assert.equal(isKnownLesson(COURSE_KEY, lessonKey), true);
  }
  assert.equal(isKnownLesson(COURSE_KEY, "lesson_1_child_protection"), false);
});

test("donor course migration only expands the enrollment course constraint", async () => {
  const sql = await readFile(new URL("../docs/sql/022_donor_investor_academy_course.sql", import.meta.url), "utf8");
  assert.match(sql, /CHECK\s*\(course_key IN\s*\([\s\S]*'donor_investor_funding'/);
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE)\b/i);
  assert.doesNotMatch(sql, /CREATE OR REPLACE FUNCTION/i);
});


test("upload, approval, gallery and profile retain the canonical course context", async () => {
  const [saveSource, serverSource, gallerySource] = await Promise.all([
    readFile(new URL("../api/savePhotoReview.js", import.meta.url), "utf8"),
    readFile(new URL("../server.js", import.meta.url), "utf8"),
    readFile(new URL("../api/getStudentGallery.js", import.meta.url), "utf8")
  ]);

  const writes = [];
  const handler = createSavePhotoReviewHandler({
    dbPool: {
      async query(sql, values) {
        if (/FROM academy_students s/.test(sql)) {
          return {
            rows: [{
              id: 42,
              full_name: "Course context student",
              email: "student@example.test",
              cohort: "2026",
              track: "fundraising",
              whatsapp: null
            }]
          };
        }
        writes.push({ sql, values });
        return { rows: [{ id: 99 }] };
      }
    },
    describeImage: async () => "A course submission"
  });
  const response = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };

  await handler({
    method: "POST",
    body: {
      category: "academy_upload",
      course_key: COURSE_KEY,
      lesson_key: "donor_module_1_report_writing",
      file_url: "https://example.test/submission.jpg",
      uploader_name: "Course context student",
      uploader_email: "student@example.test",
      academy_track: "fundraising",
      upload_type: "lesson_evidence",
      consent_given: true
    }
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.course_key, COURSE_KEY);
  assert.equal(writes.length, 1);
  const insertColumns = writes[0].sql.match(/INSERT INTO photo_uploads_review\s*\((.*?)\)\s*VALUES/is)[1]
    .split(",").map(column => column.trim());
  assert.equal(writes[0].values[insertColumns.indexOf("course_key")], COURSE_KEY);

  assert.match(saveSource, /if \(submitted_course_key && !isKnownCourse\(submitted_course_key\)\)/);
  assert.match(saveSource, /if \(!isKnownLesson\(course_key, lesson_key\)\)/);
  assert.match(serverSource, /app\.post\("\/api\/academy-approve-upload"/);
  assert.match(serverSource, /RETURNING[\s\S]*?course_key,[\s\S]*?verification_status/);
  assert.match(serverSource, /COALESCE\(course_key, '[^']+'\) = \$2/);
  assert.match(serverSource, /requiredLessonKeys = course\.requiredLessons/);
  assert.match(gallerySource, /COALESCE\(p\.course_key, '[^']+'\) = \$1/);
  assert.match(gallerySource, /\$1::text AS course_key/);
});
