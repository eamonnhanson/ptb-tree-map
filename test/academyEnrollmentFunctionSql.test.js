import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../docs/sql/023_donor_investor_enrollment_function.sql", import.meta.url);
const originalUrl = new URL("../docs/sql/007_academy_courses.sql", import.meta.url);

function functionDefinition(sql) {
  const normalizedSql = sql.replaceAll("\r\n", "\n");
  const match = normalizedSql.match(/CREATE OR REPLACE FUNCTION public\.enroll_academy_student\([\s\S]+?\n\$\$;/);
  assert.ok(match, "enroll_academy_student definition must be present");
  return match[0];
}

function withoutCourseValidation(definition) {
  return definition.replace(
    /  IF p_course_key NOT IN \([\s\S]+?  END IF;\n/,
    "  <course-validation>\n"
  );
}

test("enrollment function accepts both existing courses and donor_investor_funding", async () => {
  const definition = functionDefinition(await readFile(migrationUrl, "utf8"));
  const validation = definition.match(/IF p_course_key NOT IN \(([\s\S]+?)\) THEN/);

  assert.ok(validation);
  assert.match(validation[1], /'online_tree_planting'/);
  assert.match(validation[1], /'arboriculture_1'/);
  assert.match(validation[1], /'donor_investor_funding'/);
});

test("enrollment function still rejects an invalid course key", async () => {
  const definition = functionDefinition(await readFile(migrationUrl, "utf8"));
  assert.match(definition, /IF p_course_key NOT IN \([\s\S]+?\) THEN\s+RAISE EXCEPTION 'Unknown academy course: %', p_course_key;/);
});

test("duplicate enrollment and token behavior is unchanged from migration 007", async () => {
  const [originalSql, migrationSql] = await Promise.all([
    readFile(originalUrl, "utf8"),
    readFile(migrationUrl, "utf8")
  ]);
  const original = withoutCourseValidation(functionDefinition(originalSql));
  const replacement = withoutCourseValidation(functionDefinition(migrationSql));

  assert.equal(replacement, original);
  assert.match(replacement, /WHERE academy_student_id = p_academy_student_id\s+AND course_key = p_course_key\s+AND COALESCE\(cohort, ''\) = COALESCE\(p_cohort, ''\)/);
  assert.match(replacement, /enrollment_token = COALESCE\(enrollment_token, effective_token\)/);
});
