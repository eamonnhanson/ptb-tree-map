import express from "express";
import { timingSafeEqual } from "crypto";
import {
  ACADEMY_COURSES,
  DEFAULT_ACADEMY_COURSE,
  isKnownCourse,
  isKnownLesson,
  lessonName
} from "./academyCourses.js";

const QUESTION_MAX_LENGTH = 5000;
const ANSWER_MAX_LENGTH = 10000;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const VALID_STATUSES = new Set(["new", "answered", "closed"]);

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer);
}

function publicQuestion(row) {
  return {
    id: row.id,
    student_id: row.academy_student_id,
    student_name: row.student_name,
    course_key: row.course_key,
    course_name: ACADEMY_COURSES[row.course_key]?.name || row.course_key,
    module_key: row.module_key,
    module_name: lessonName(row.course_key, row.module_key),
    question_text: row.question_text,
    status: row.status,
    answer_text: row.answer_text,
    created_at: row.created_at,
    answered_at: row.answered_at,
    closed_at: row.closed_at,
    tutor_notification_status: row.tutor_notification_status,
    student_notification_status: row.student_notification_status
  };
}

function validateRequestId(value) {
  const requestId = String(value || "").trim();
  return REQUEST_ID_PATTERN.test(requestId) ? requestId : null;
}

function validateModule(courseKey, moduleKey) {
  if (moduleKey === "general") return true;
  if (!isKnownLesson(courseKey, moduleKey)) return false;
  return !["onboarding", "tutor_question", "evaluation"].includes(moduleKey);
}

function notificationResult(status, detail = null) {
  return { status, accepted: status === "accepted", detail };
}

async function postWebhook({ url, payload, fetchImpl, timeoutMs, logger, event, questionId }) {
  if (!url) return notificationResult("not_configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) {
      logger.warn(`${event} webhook rejected`, {
        question_id: questionId,
        http_status: response.status
      });
      return notificationResult("failed", `HTTP ${response.status}`);
    }
    return notificationResult("accepted");
  } catch (error) {
    const detail = error?.name === "AbortError" ? "timeout" : "request_failed";
    logger.warn(`${event} webhook failed`, { question_id: questionId, reason: detail });
    return notificationResult("failed", detail);
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveStudent(pool, token, requestedCourse = null) {
  const result = await pool.query(
    `
    WITH exact_enrollment AS (
      SELECT s.id, s.full_name, s.email, e.course_key, e.enrollment_token
      FROM academy_course_enrollments e
      JOIN academy_students s ON s.id = e.academy_student_id
      WHERE e.enrollment_token = $1
      LIMIT 1
    ),
    legacy_student AS (
      SELECT s.id, s.full_name, s.email,
             COALESCE(e.course_key, $3) AS course_key,
             COALESCE(e.enrollment_token, s.upload_token) AS enrollment_token
      FROM academy_students s
      LEFT JOIN LATERAL (
        SELECT course_key, enrollment_token
        FROM academy_course_enrollments
        WHERE academy_student_id = s.id
          AND ($2::text IS NULL OR course_key = $2)
        ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END,
                 enrolled_at DESC, id DESC
        LIMIT 1
      ) e ON true
      WHERE s.upload_token = $1
        AND ($2::text IS NULL OR $2 = $3 OR e.course_key = $2)
      LIMIT 1
    )
    SELECT * FROM exact_enrollment
    UNION ALL
    SELECT * FROM legacy_student
    WHERE NOT EXISTS (SELECT 1 FROM exact_enrollment)
    LIMIT 1
    `,
    [token, requestedCourse, DEFAULT_ACADEMY_COURSE]
  );
  return result.rows[0] || null;
}

function requireTutor(env, req, res) {
  const configuredKey = env.ADMIN_GALLERY_KEY;
  const providedKey = req.get("x-admin-key");
  if (!configuredKey) {
    res.status(500).json({ ok: false, error: "Tutor authentication is not configured" });
    return false;
  }
  if (!providedKey || !safeEqual(providedKey, configuredKey)) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }
  return true;
}

export function createTutorQuestionsRouter({
  pool,
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console
}) {
  const router = express.Router();
  const timeoutMs = Math.min(
    Math.max(Number(env.TUTOR_WEBHOOK_TIMEOUT_MS) || 5000, 1000),
    15000
  );

  router.post("/", async (req, res) => {
    try {
      const token = String(req.body?.token || "").trim();
      const questionText = String(req.body?.question || "").trim();
      const requestId = validateRequestId(req.body?.request_id);
      const submittedCourse = String(req.body?.course_key || "").trim().toLowerCase();
      const moduleKey = String(req.body?.module_key || "").trim();

      if (!token || !questionText || !requestId || !moduleKey) {
        return res.status(400).json({
          ok: false,
          error: "Token, question, module and request_id are required"
        });
      }
      if (questionText.length > QUESTION_MAX_LENGTH) {
        return res.status(400).json({ ok: false, error: "Question is too long" });
      }
      if (submittedCourse && !isKnownCourse(submittedCourse)) {
        return res.status(400).json({ ok: false, error: "Course is not valid" });
      }

      const student = await resolveStudent(pool, token, submittedCourse || null);
      if (!student) {
        return res.status(401).json({ ok: false, error: "Student token is not valid" });
      }
      if (submittedCourse && student.course_key !== submittedCourse) {
        return res.status(403).json({ ok: false, error: "Token does not belong to this course" });
      }
      if (!validateModule(student.course_key, moduleKey)) {
        return res.status(400).json({ ok: false, error: "Module is not valid for this course" });
      }

      const insert = await pool.query(
        `
        INSERT INTO academy_tutor_questions (
          request_id, academy_student_id, course_key, module_key,
          student_name, student_email, question_text
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (request_id) DO NOTHING
        RETURNING *
        `,
        [
          requestId, student.id, student.course_key, moduleKey,
          student.full_name, student.email, questionText
        ]
      );

      if (!insert.rows.length) {
        const duplicate = await pool.query(
          `
          SELECT *
          FROM academy_tutor_questions
          WHERE request_id = $1 AND academy_student_id = $2
          LIMIT 1
          `,
          [requestId, student.id]
        );
        if (!duplicate.rows.length) {
          return res.status(409).json({ ok: false, error: "Request ID is already in use" });
        }
        return res.json({
          ok: true,
          duplicate: true,
          question: publicQuestion(duplicate.rows[0]),
          notification_sent: duplicate.rows[0].tutor_notification_status === "accepted"
        });
      }

      const question = insert.rows[0];
      const tutorEmail = String(env.TUTOR_NOTIFICATION_EMAIL || "").trim();
      const notification = await postWebhook({
        url: tutorEmail ? env.TUTOR_QUESTION_WEBHOOK_URL : null,
        fetchImpl,
        timeoutMs,
        logger,
        event: "tutor_question",
        questionId: question.id,
        payload: {
          event: "academy_tutor_question_created",
          tutor_email: tutorEmail || null,
          question_id: question.id,
          student_name: question.student_name,
          student_id: question.academy_student_id,
          course_key: question.course_key,
          course_name: ACADEMY_COURSES[question.course_key]?.name || question.course_key,
          module_key: question.module_key,
          module_name: lessonName(question.course_key, question.module_key),
          question: question.question_text,
          created_at: question.created_at,
          tutor_queue_url: `${env.KETSO_UPLOADER_BASE_URL || "https://ketso-uploader.pages.dev"}/tutor-questions/`
        }
      });
      const effectiveNotification = tutorEmail
        ? notification
        : notificationResult("not_configured", "tutor_email_missing");

      await pool.query(
        `
        UPDATE academy_tutor_questions
        SET tutor_notification_status = $2,
            tutor_notification_attempted_at = NOW()
        WHERE id = $1
        `,
        [question.id, effectiveNotification.status]
      );
      question.tutor_notification_status = effectiveNotification.status;

      return res.status(201).json({
        ok: true,
        duplicate: false,
        question: publicQuestion(question),
        notification_sent: effectiveNotification.accepted
      });
    } catch (error) {
      logger.error("Tutor question create failed", { code: error?.code || "unknown" });
      return res.status(500).json({ ok: false, error: "Question could not be saved" });
    }
  });

  router.post("/my", async (req, res) => {
    try {
      const token = String(req.body?.token || "").trim();
      if (!token) return res.status(400).json({ ok: false, error: "Missing token" });

      const student = await resolveStudent(pool, token);
      if (!student) {
        return res.status(401).json({ ok: false, error: "Student token is not valid" });
      }
      const result = await pool.query(
        `
        SELECT *
        FROM academy_tutor_questions
        WHERE academy_student_id = $1 AND course_key = $2
        ORDER BY created_at DESC
        `,
        [student.id, student.course_key]
      );
      return res.json({ ok: true, questions: result.rows.map(publicQuestion) });
    } catch (error) {
      logger.error("Student tutor question list failed", { code: error?.code || "unknown" });
      return res.status(500).json({ ok: false, error: "Questions could not be loaded" });
    }
  });

  router.get("/", async (req, res) => {
    if (!requireTutor(env, req, res)) return;
    try {
      const status = String(req.query.status || "new").trim();
      if (status !== "all" && !VALID_STATUSES.has(status)) {
        return res.status(400).json({ ok: false, error: "Status filter is not valid" });
      }
      const values = [];
      const where = status === "all" ? "" : "WHERE status = $1";
      if (where) values.push(status);
      const result = await pool.query(
        `
        SELECT *
        FROM academy_tutor_questions
        ${where}
        ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'answered' THEN 1 ELSE 2 END,
                 created_at DESC
        LIMIT 300
        `,
        values
      );
      return res.json({ ok: true, questions: result.rows.map(publicQuestion) });
    } catch (error) {
      logger.error("Tutor queue failed", { code: error?.code || "unknown" });
      return res.status(500).json({ ok: false, error: "Tutor queue could not be loaded" });
    }
  });

  router.post("/:id/answer", async (req, res) => {
    if (!requireTutor(env, req, res)) return;
    try {
      const questionId = Number(req.params.id);
      const answer = String(req.body?.answer || "").trim();
      const answerRequestId = validateRequestId(req.body?.request_id);
      if (!Number.isSafeInteger(questionId) || questionId <= 0) {
        return res.status(400).json({ ok: false, error: "Question ID is not valid" });
      }
      if (!answer || !answerRequestId) {
        return res.status(400).json({ ok: false, error: "Answer and request_id are required" });
      }
      if (answer.length > ANSWER_MAX_LENGTH) {
        return res.status(400).json({ ok: false, error: "Answer is too long" });
      }

      const existing = await pool.query(
        "SELECT * FROM academy_tutor_questions WHERE id = $1 LIMIT 1",
        [questionId]
      );
      if (!existing.rows.length) {
        return res.status(404).json({ ok: false, error: "Question not found" });
      }
      if (existing.rows[0].answer_request_id === answerRequestId) {
        return res.json({
          ok: true,
          duplicate: true,
          question: publicQuestion(existing.rows[0]),
          notification_sent: existing.rows[0].student_notification_status === "accepted"
        });
      }
      if (existing.rows[0].status === "closed") {
        return res.status(409).json({
          ok: false,
          error: "This question is closed"
        });
      }
      if (existing.rows[0].answer_text) {
        return res.status(409).json({
          ok: false,
          error: "This question already has an answer"
        });
      }

      const update = await pool.query(
        `
        UPDATE academy_tutor_questions
        SET answer_text = $2, status = 'answered', answered_by = $3,
            answered_at = NOW(), answer_request_id = $4
        WHERE id = $1 AND answer_text IS NULL
        RETURNING *
        `,
        [
          questionId, answer,
          String(req.body?.answered_by || "Eamonn").trim().slice(0, 100),
          answerRequestId
        ]
      );
      if (!update.rows.length) {
        return res.status(409).json({ ok: false, error: "Question was already answered" });
      }

      const question = update.rows[0];
      let studentToken = null;
      if (question.student_email) {
        const tokenResult = await pool.query(
          `
          SELECT COALESCE(e.enrollment_token, s.upload_token) AS student_token
          FROM academy_students s
          LEFT JOIN academy_course_enrollments e
            ON e.academy_student_id = s.id AND e.course_key = $2
          WHERE s.id = $1
          ORDER BY CASE WHEN e.status = 'active' THEN 0 ELSE 1 END,
                   e.enrolled_at DESC NULLS LAST, e.id DESC NULLS LAST
          LIMIT 1
          `,
          [question.academy_student_id, question.course_key]
        );
        studentToken = tokenResult.rows[0]?.student_token || null;
      }
      const baseUrl = env.KETSO_UPLOADER_BASE_URL || "https://ketso-uploader.pages.dev";
      const notification = await postWebhook({
        url: question.student_email && studentToken
          ? env.TUTOR_ANSWER_WEBHOOK_URL
          : null,
        fetchImpl,
        timeoutMs,
        logger,
        event: "tutor_answer",
        questionId: question.id,
        payload: {
          event: "academy_tutor_question_answered",
          question_id: question.id,
          student_name: question.student_name,
          student_email: question.student_email,
          course_key: question.course_key,
          course_name: ACADEMY_COURSES[question.course_key]?.name || question.course_key,
          module_key: question.module_key,
          module_name: lessonName(question.course_key, question.module_key),
          question: question.question_text,
          answer: question.answer_text,
          answered_at: question.answered_at,
          student_questions_url: studentToken
            ? `${baseUrl}/my-questions/?token=${encodeURIComponent(studentToken)}`
            : `${baseUrl}/my-questions/`
        }
      });
      const effectiveNotification = question.student_email && studentToken
        ? notification
        : notificationResult("not_configured");

      await pool.query(
        `
        UPDATE academy_tutor_questions
        SET student_notification_status = $2,
            student_notification_attempted_at = NOW()
        WHERE id = $1
        `,
        [question.id, effectiveNotification.status]
      );
      question.student_notification_status = effectiveNotification.status;

      return res.json({
        ok: true,
        duplicate: false,
        question: publicQuestion(question),
        notification_sent: effectiveNotification.accepted
      });
    } catch (error) {
      logger.error("Tutor answer failed", { code: error?.code || "unknown" });
      return res.status(500).json({ ok: false, error: "Answer could not be saved" });
    }
  });

  router.post("/:id/close", async (req, res) => {
    if (!requireTutor(env, req, res)) return;
    try {
      const questionId = Number(req.params.id);
      if (!Number.isSafeInteger(questionId) || questionId <= 0) {
        return res.status(400).json({ ok: false, error: "Question ID is not valid" });
      }
      const result = await pool.query(
        `
        UPDATE academy_tutor_questions
        SET status = 'closed', closed_at = COALESCE(closed_at, NOW())
        WHERE id = $1
        RETURNING *
        `,
        [questionId]
      );
      if (!result.rows.length) {
        return res.status(404).json({ ok: false, error: "Question not found" });
      }
      return res.json({ ok: true, question: publicQuestion(result.rows[0]) });
    } catch (error) {
      logger.error("Tutor question close failed", { code: error?.code || "unknown" });
      return res.status(500).json({ ok: false, error: "Question could not be closed" });
    }
  });

  return router;
}

export const tutorQuestionLimits = {
  question: QUESTION_MAX_LENGTH,
  answer: ANSWER_MAX_LENGTH
};
