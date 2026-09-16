import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ACADEMY_COURSES,
  courseName,
  isKnownCourse,
  isKnownLesson
} from "../api/academyCourses.js";

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

  assert.match(saveSource, /if \(submitted_course_key && !isKnownCourse\(submitted_course_key\)\)/);
  assert.match(saveSource, /if \(!isKnownLesson\(course_key, lesson_key\)\)/);
  assert.match(saveSource, /rejected_reason,\s*course_key\s*\)/);
  assert.match(serverSource, /app\.post\("\/api\/academy-approve-upload"/);
  assert.match(serverSource, /COALESCE\(course_key, '[^']+'\) = \$2/);
  assert.match(serverSource, /requiredLessonKeys = course\.requiredLessons/);
  assert.match(gallerySource, /COALESCE\(p\.course_key, '[^']+'\) = \$1/);
});
