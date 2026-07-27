import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createTutorQuestionsRouter } from "../api/tutorQuestions.js";

function createFakePool() {
  const questions = [];
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

  return {
    questions,
    async query(sql, params = []) {
      const compact = String(sql).replace(/\s+/g, " ").trim();
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
        const row = questions.find(q => q.id === params[0] && !q.answer_text);
        if (!row) return { rows: [] };
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
