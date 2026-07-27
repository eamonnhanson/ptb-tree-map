import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createTutorQuestionsRouter } from "../api/tutorQuestions.js";
import { readFile } from "node:fs/promises";

function createFakePool() {
  const questions = [];
  const queries = [];
  const students = new Map([
    ["token-a", {
      id: 1, full_name: "Test Student A", email: "student-a@example.invalid",
      course_key: "online_tree_planting", enrollment_token: "token-a"
    }],
    ["token-b", {
      id: 2, full_name: "Test Student B", email: "student-b@example.invalid",
      course_key: "online_tree_planting", enrollment_token: "token-b"
    }]
  ]);
  let nextId = 1;

  const pool = {
    questions,
    queries,
    beforeAnswerUpdate: null,
    answerUpdateCount: 0,
    async query(sql, params = []) {
      const compact = String(sql).replace(/\s+/g, " ").trim();
      queries.push({ sql: compact, params: [...params] });
      if (compact.startsWith("WITH exact_enrollment")) {
        return { rows: students.has(params[0]) ? [{ ...students.get(params[0]) }] : [] };
      }
      if (compact.startsWith("INSERT INTO academy_tutor_questions") &&
          compact.includes("ON CONFLICT (request_id)")) {
        if (questions.some(question => question.request_id === params[0])) return { rows: [] };
        const row = {
          id: nextId++, request_id: params[0], academy_student_id: params[1],
          course_key: params[2], module_key: params[3], student_name: params[4],
          student_email: params[5], question_text: params[6], status: "new",
          answer_text: null, answer_request_id: null, answered_at: null, closed_at: null,
          tutor_notification_status: "pending", student_notification_status: "pending",
          created_at: new Date().toISOString()
        };
        questions.push(row);
        return { rows: [{ ...row }] };
      }
      if (compact.includes("WHERE request_id = $1 AND academy_student_id = $2")) {
        return { rows: questions.filter(q => q.request_id === params[0] && q.academy_student_id === params[1]).map(q => ({ ...q })) };
      }
      if (compact.startsWith("UPDATE academy_tutor_questions") &&
          compact.includes("tutor_notification_status")) {
        const row = questions.find(q => q.id === params[0]);
        if (row) row.tutor_notification_status = params[1];
        return { rows: [] };
      }
      if (compact.startsWith("SELECT * FROM academy_tutor_questions") &&
          compact.includes("academy_student_id = $1 AND course_key = $2")) {
        return { rows: questions.filter(q => q.academy_student_id === params[0] && q.course_key === params[1]).map(q => ({ ...q })) };
      }
      if (compact.startsWith("SELECT id, academy_student_id, student_name") &&
          compact.includes("BTRIM(answer_text) <> ''")) {
        return {
          rows: questions
            .filter(q => ["answered", "closed"].includes(q.status))
            .filter(q => q.answer_text !== null && q.answer_text.trim() !== "")
            .filter(q => q.answered_at !== null)
            .filter(q => params[0] === null || q.course_key === params[0])
            .sort((a, b) => String(b.answered_at).localeCompare(String(a.answered_at)))
            .slice(0, 300)
            .map(q => ({
              id: q.id,
              academy_student_id: q.academy_student_id,
              student_name: q.student_name,
              course_key: q.course_key,
              module_key: q.module_key,
              question_text: q.question_text,
              answer_text: q.answer_text,
              created_at: q.created_at,
              answered_at: q.answered_at
            }))
        };
      }
      if (compact.startsWith("SELECT * FROM academy_tutor_questions") &&
          compact.includes("ORDER BY CASE status")) {
        const status = params[0];
        return { rows: questions.filter(q => !status || q.status === status).map(q => ({ ...q })) };
      }
      if (compact === "SELECT * FROM academy_tutor_questions WHERE id = $1 LIMIT 1") {
        const row = questions.find(q => q.id === params[0]);
        return { rows: row ? [{ ...row }] : [] };
      }
      if (compact.startsWith("UPDATE academy_tutor_questions") &&
          compact.includes("answer_request_id = $4")) {
        await pool.beforeAnswerUpdate?.();
        const row = questions.find(q =>
          q.id === params[0] && q.answer_text === null && q.status === "new"
        );
        if (!row) return { rows: [] };
        pool.answerUpdateCount += 1;
        row.answer_text = params[1];
        row.answered_by = params[2];
        row.answer_request_id = params[3];
        row.status = "answered";
        row.answered_at = new Date().toISOString();
        return { rows: [{ ...row }] };
      }
      if (compact.startsWith("SELECT COALESCE(e.enrollment_token")) {
        const student = [...students.values()].find(item => item.id === params[0] && item.course_key === params[1]);
        return { rows: student ? [{ student_token: student.enrollment_token }] : [] };
      }
      if (compact.startsWith("UPDATE academy_tutor_questions") &&
          compact.includes("student_notification_status")) {
        const row = questions.find(q => q.id === params[0]);
        if (row) row.student_notification_status = params[1];
        return { rows: [] };
      }
      if (compact.startsWith("UPDATE academy_tutor_questions") &&
          compact.includes("status = 'closed'")) {
        const row = questions.find(q => q.id === params[0]);
        if (!row) return { rows: [] };
        row.status = "closed";
        row.closed_at ||= new Date().toISOString();
        return { rows: [{ ...row }] };
      }
      throw new Error(`Unhandled SQL in fake pool: ${compact}`);
    }
  };
  return pool;
}

async function startTestApp({ webhookResponse = 200 } = {}) {
  const pool = createFakePool();
  const webhookCalls = [];
  const fetchImpl = async (_url, options) => {
    webhookCalls.push(JSON.parse(options.body));
    return { ok: webhookResponse >= 200 && webhookResponse < 300, status: webhookResponse };
  };
  const app = express();
  app.use(express.json());
  app.use("/api/academy-tutor-questions", createTutorQuestionsRouter({
    pool,
    fetchImpl,
    env: {
      ADMIN_GALLERY_KEY: "test-admin-key",
      TUTOR_QUESTION_WEBHOOK_URL: "https://example.invalid/question",
      TUTOR_ANSWER_WEBHOOK_URL: "https://example.invalid/answer",
      TUTOR_NOTIFICATION_EMAIL: "tutor@example.invalid",
      KETSO_UPLOADER_BASE_URL: "https://example.invalid"
    },
    logger: { warn() {}, error() {} }
  }));
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    pool, webhookCalls, baseUrl,
    close: () => new Promise(resolve => server.close(resolve))
  };
}

async function api(baseUrl, path, { method = "POST", body, admin = false } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(admin ? { "X-Admin-Key": "test-admin-key" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, data: await response.json() };
}

const questionA = {
  token: "token-a",
  course_key: "online_tree_planting",
  module_key: "lesson_3_tree_health",
  request_id: "question_request_a_0001",
  question: "<script>alert('xss')</script> Is this leaf healthy?"
};

function seedQuestion(pool, overrides = {}) {
  const row = {
    id: 1,
    request_id: "question_seed_request_0001",
    academy_student_id: 1,
    course_key: "online_tree_planting",
    module_key: "lesson_3_tree_health",
    student_name: "Test Student A",
    student_email: "student-a@example.invalid",
    question_text: "Is this leaf healthy?",
    status: "new",
    answer_text: null,
    answer_request_id: null,
    answered_by: null,
    answered_at: null,
    closed_at: null,
    tutor_notification_status: "accepted",
    student_notification_status: "pending",
    created_at: new Date().toISOString(),
    ...overrides
  };
  pool.questions.push(row);
  return row;
}

function answerBody(requestId = "answer_request_seed_0001") {
  return {
    answer: "This is a checked tutor answer.",
    answered_by: "Tutor",
    request_id: requestId
  };
}

function answerNotifications(app) {
  return app.webhookCalls.filter(call => call.event === "academy_tutor_question_answered");
}

test("create, ownership, tutor queue, answer, close and idempotency", async t => {
  const app = await startTestApp();
  t.after(app.close);

  const wrongToken = await api(app.baseUrl, "/api/academy-tutor-questions", {
    body: { ...questionA, token: "wrong-token", request_id: "question_wrong_00001" }
  });
  assert.equal(wrongToken.status, 401);

  const createdA = await api(app.baseUrl, "/api/academy-tutor-questions", { body: questionA });
  assert.equal(createdA.status, 201);
  assert.equal(createdA.data.notification_sent, true);
  assert.equal(app.pool.questions.length, 1);

  const duplicateA = await api(app.baseUrl, "/api/academy-tutor-questions", { body: questionA });
  assert.equal(duplicateA.status, 200);
  assert.equal(duplicateA.data.duplicate, true);
  assert.equal(app.pool.questions.length, 1);
  assert.equal(app.webhookCalls.length, 1);

  const createdB = await api(app.baseUrl, "/api/academy-tutor-questions", {
    body: { ...questionA, token: "token-b", request_id: "question_request_b_0001" }
  });
  assert.equal(createdB.status, 201);

  const mineA = await api(app.baseUrl, "/api/academy-tutor-questions/my", {
    body: { token: "token-a" }
  });
  assert.deepEqual(mineA.data.questions.map(q => q.student_id), [1]);
  assert.equal(mineA.data.questions[0].question_text, questionA.question);

  const unauthorizedQueue = await api(app.baseUrl, "/api/academy-tutor-questions?status=new", {
    method: "GET"
  });
  assert.equal(unauthorizedQueue.status, 401);
  const queue = await api(app.baseUrl, "/api/academy-tutor-questions?status=new", {
    method: "GET", admin: true
  });
  assert.equal(queue.data.questions.length, 2);

  const answerBody = {
    answer: "This is a checked tutor answer.",
    answered_by: "Tutor",
    request_id: "answer_request_a_000001"
  };
  const answered = await api(app.baseUrl, "/api/academy-tutor-questions/1/answer", {
    admin: true, body: answerBody
  });
  assert.equal(answered.status, 200);
  assert.equal(answered.data.notification_sent, true);
  const duplicateAnswer = await api(app.baseUrl, "/api/academy-tutor-questions/1/answer", {
    admin: true, body: answerBody
  });
  assert.equal(duplicateAnswer.data.duplicate, true);
  assert.equal(app.webhookCalls.length, 3);

  const closed = await api(app.baseUrl, "/api/academy-tutor-questions/1/close", {
    admin: true
  });
  assert.equal(closed.data.question.status, "closed");
});

test("failed webhook does not lose a saved question", async t => {
  const app = await startTestApp({ webhookResponse: 500 });
  t.after(app.close);
  const result = await api(app.baseUrl, "/api/academy-tutor-questions", { body: questionA });
  assert.equal(result.status, 201);
  assert.equal(result.data.notification_sent, false);
  assert.equal(result.data.question.tutor_notification_status, "failed");
  assert.equal(app.pool.questions.length, 1);
});

test("public gallery exposes only answered tutor questions and /my remains private", async t => {
  const app = await startTestApp();
  t.after(app.close);

  await api(app.baseUrl, "/api/academy-tutor-questions", { body: questionA });
  await api(app.baseUrl, "/api/academy-tutor-questions", {
    body: { ...questionA, token: "token-b", request_id: "question_request_b_0002" }
  });

  const beforeAnswer = await api(app.baseUrl, "/api/academy-tutor-questions/public", {
    method: "GET"
  });
  assert.equal(beforeAnswer.status, 200);
  assert.deepEqual(beforeAnswer.data.questions, []);

  const answerText = "The leaf looks healthy; keep monitoring its colour.";
  await api(app.baseUrl, "/api/academy-tutor-questions/1/answer", {
    admin: true,
    body: {
      answer: answerText,
      answered_by: "Tutor",
      request_id: "public_answer_request_0001"
    }
  });

  const publicResult = await api(app.baseUrl, "/api/academy-tutor-questions/public", {
    method: "GET"
  });
  assert.equal(publicResult.status, 200);
  assert.equal(publicResult.data.questions.length, 1);
  assert.equal(publicResult.data.questions[0].question_text, questionA.question);
  assert.equal(publicResult.data.questions[0].answer_text, answerText);
  assert.equal(publicResult.data.questions[0].type, "tutor_question");
  assert.deepEqual(
    Object.keys(publicResult.data.questions[0]).sort(),
    [
      "answer_text", "answered_at", "course_key", "course_name", "created_at", "id",
      "module_key", "module_name", "question_text", "student_id", "student_name", "type"
    ]
  );

  const matchingCourse = await api(
    app.baseUrl,
    "/api/academy-tutor-questions/public?course_key=ONLINE_TREE_PLANTING",
    { method: "GET" }
  );
  assert.equal(matchingCourse.data.questions.length, 1);
  const otherCourse = await api(
    app.baseUrl,
    "/api/academy-tutor-questions/public?course_key=arboriculture_1",
    { method: "GET" }
  );
  assert.deepEqual(otherCourse.data.questions, []);
  const invalidCourse = await api(
    app.baseUrl,
    "/api/academy-tutor-questions/public?course_key=unknown",
    { method: "GET" }
  );
  assert.equal(invalidCourse.status, 400);

  const mine = await api(app.baseUrl, "/api/academy-tutor-questions/my", {
    body: { token: "token-b" }
  });
  assert.equal(mine.status, 200);
  assert.equal(mine.data.questions.length, 1);
  assert.equal(mine.data.questions[0].status, "new");
  assert.equal(mine.data.questions[0].answer_text, null);
  });
test("open question is answered atomically and sends exactly one student notification", async t => {
  const app = await startTestApp();
  t.after(app.close);
  const question = seedQuestion(app.pool);

  const result = await api(
    app.baseUrl,
    `/api/academy-tutor-questions/${question.id}/answer`,
    { admin: true, body: answerBody() }
  );

  assert.equal(result.status, 200);
  assert.equal(result.data.duplicate, false);
  assert.equal(result.data.question.status, "answered");
  assert.equal(question.status, "answered");
  assert.equal(question.answer_text, "This is a checked tutor answer.");
  assert.equal(app.pool.answerUpdateCount, 1);
  assert.equal(answerNotifications(app).length, 1);
});

test("closed question cannot be answered, remains closed and sends no notification", async t => {
  const app = await startTestApp();
  t.after(app.close);
  const question = seedQuestion(app.pool, {
    status: "closed",
    closed_at: new Date().toISOString()
  });

  const result = await api(
    app.baseUrl,
    `/api/academy-tutor-questions/${question.id}/answer`,
    { admin: true, body: answerBody() }
  );

  assert.equal(result.status, 409);
  assert.equal(result.data.error, "This question is closed");
  assert.equal(question.status, "closed");
  assert.equal(question.answer_text, null);
  assert.equal(app.pool.answerUpdateCount, 0);
  assert.equal(answerNotifications(app).length, 0);
});

test("answered question cannot be answered again and sends no second notification", async t => {
  const app = await startTestApp();
  t.after(app.close);
  const question = seedQuestion(app.pool, {
    status: "answered",
    answer_text: "The first answer.",
    answer_request_id: "answer_request_original_001",
    answered_at: new Date().toISOString(),
    student_notification_status: "accepted"
  });

  const result = await api(
    app.baseUrl,
    `/api/academy-tutor-questions/${question.id}/answer`,
    { admin: true, body: answerBody("answer_request_second_0001") }
  );

  assert.equal(result.status, 409);
  assert.equal(result.data.error, "This question already has an answer");
  assert.equal(question.answer_text, "The first answer.");
  assert.equal(app.pool.answerUpdateCount, 0);
  assert.equal(answerNotifications(app).length, 0);
});

test("answering a missing question returns the existing not-found error", async t => {
  const app = await startTestApp();
  t.after(app.close);

  const result = await api(app.baseUrl, "/api/academy-tutor-questions/999/answer", {
    admin: true,
    body: answerBody()
  });

  assert.equal(result.status, 404);
  assert.deepEqual(result.data, { ok: false, error: "Question not found" });
  assert.equal(app.pool.answerUpdateCount, 0);
  assert.equal(answerNotifications(app).length, 0);
});

test("two concurrent answer attempts perform at most one update and notification", async t => {
  const app = await startTestApp();
  t.after(app.close);
  const question = seedQuestion(app.pool);

  const [first, second] = await Promise.all([
    api(app.baseUrl, `/api/academy-tutor-questions/${question.id}/answer`, {
      admin: true,
      body: answerBody("answer_request_race_a_001")
    }),
    api(app.baseUrl, `/api/academy-tutor-questions/${question.id}/answer`, {
      admin: true,
      body: answerBody("answer_request_race_b_001")
    })
  ]);

  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  assert.equal(app.pool.answerUpdateCount, 1);
  assert.equal(answerNotifications(app).length, 1);
  assert.equal(question.status, "answered");
});

test("close-first race makes the answer update change zero rows and sends no notification", async t => {
  const app = await startTestApp();
  t.after(app.close);
  const question = seedQuestion(app.pool);
  let releaseAnswerUpdate;
  let markAnswerUpdateStarted;
  const answerUpdateStarted = new Promise(resolve => {
    markAnswerUpdateStarted = resolve;
  });
  const answerUpdateRelease = new Promise(resolve => {
    releaseAnswerUpdate = resolve;
  });
  app.pool.beforeAnswerUpdate = async () => {
    markAnswerUpdateStarted();
    await answerUpdateRelease;
  };

  const pendingAnswer = api(
    app.baseUrl,
    `/api/academy-tutor-questions/${question.id}/answer`,
    { admin: true, body: answerBody() }
  );
  await answerUpdateStarted;
  const closed = await api(
    app.baseUrl,
    `/api/academy-tutor-questions/${question.id}/close`,
    { admin: true }
  );
  releaseAnswerUpdate();
  const answered = await pendingAnswer;

  assert.equal(closed.status, 200);
  assert.equal(answered.status, 409);
  assert.equal(answered.data.error, "This question is closed");
  assert.equal(app.pool.answerUpdateCount, 0);
  assert.equal(question.status, "closed");
  assert.equal(question.answer_text, null);
  assert.equal(answerNotifications(app).length, 0);
});

test("answer SQL atomically allows only new questions without an answer", async t => {
  const app = await startTestApp();
  t.after(app.close);
  const question = seedQuestion(app.pool);

  await api(app.baseUrl, `/api/academy-tutor-questions/${question.id}/answer`, {
    admin: true,
    body: answerBody()
  });

  const answerUpdate = app.pool.queries.find(query =>
    query.sql.startsWith("UPDATE academy_tutor_questions") &&
    query.sql.includes("answer_request_id = $4")
  );
  assert.ok(answerUpdate);
  assert.match(
    answerUpdate.sql,
    /WHERE id = \$1 AND answer_text IS NULL AND status = 'new' RETURNING \*/
  );
});

test("gallery query excludes tutor questions", async () => {
  const studentGallery = await readFile(new URL("../api/getStudentGallery.js", import.meta.url), "utf8");
  const generalGallery = await readFile(new URL("../api/getPhotoReviewGallery.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
  for (const source of [studentGallery, generalGallery, server]) {
    assert.match(source, /upload_type IS DISTINCT FROM 'question_to_tutor'|upload_type === "question_to_tutor"/);
    assert.match(source, /lesson_key IS DISTINCT FROM 'tutor_question'|lesson_key === "tutor_question"/);
  }
  assert.match(studentGallery, /public_gallery_status = 'public'/);
});
