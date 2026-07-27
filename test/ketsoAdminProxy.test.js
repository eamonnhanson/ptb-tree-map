import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../netlify/functions/ketso-admin.js";

const env = {
  AUTOMATION_DASHBOARD_USER: "dashboard-user",
  AUTOMATION_DASHBOARD_PASSWORD: "dashboard-password",
  ADMIN_GALLERY_KEY: "server-admin-key",
  KETSO_API_BASE_URL: "https://api.example.invalid"
};

function basicHeader(user = env.AUTOMATION_DASHBOARD_USER, password = env.AUTOMATION_DASHBOARD_PASSWORD) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

function event(path, method = "GET", {
  authenticated = true,
  query = {},
  body
} = {}) {
  return {
    path: `/.netlify/functions/ketso-admin${path}`,
    httpMethod: method,
    headers: authenticated ? { authorization: basicHeader() } : {},
    queryStringParameters: query,
    body: body === undefined ? null : JSON.stringify(body)
  };
}

function testHandler() {
  const calls = [];
  const handler = createHandler({
    env,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, upstream: true })
      };
    },
    logger: { error() {} }
  });
  return { handler, calls };
}

test("proxy requires valid dashboard basic authentication", async () => {
  const { handler, calls } = testHandler();
  const missing = await handler(event("/tutor-questions", "GET", {
    authenticated: false
  }));
  assert.equal(missing.statusCode, 401);
  assert.match(missing.headers["WWW-Authenticate"], /^Basic /);

  const wrong = await handler({
    ...event("/tutor-questions"),
    headers: { authorization: basicHeader("dashboard-user", "wrong") }
  });
  assert.equal(wrong.statusCode, 401);
  assert.equal(calls.length, 0);
});

test("proxy forwards only the allowed admin review list route", async () => {
  const { handler, calls } = testHandler();
  const response = await handler(event("/admin-review/uploads", "GET", {
    query: { status: "pending", course_key: "arboriculture_1" }
  }));
  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://api.example.invalid/api/academy-moderation-queue?status=pending&course_key=arboriculture_1"
  );
  assert.equal(calls[0].options.headers["X-Admin-Key"], env.ADMIN_GALLERY_KEY);
  assert.equal(calls[0].options.headers.authorization, undefined);
});

test("proxy accepts the original same-origin rewrite path", async () => {
  const { handler, calls } = testHandler();
  const response = await handler({
    ...event("/tutor-questions"),
    path: "/automation-dashboard/api/ketso/tutor-questions",
    queryStringParameters: { status: "new" }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(
    calls[0].url,
    "https://api.example.invalid/api/academy-tutor-questions?status=new"
  );
});

test("proxy normalizes allowed admin review mutations", async () => {
  const { handler, calls } = testHandler();
  const approve = await handler(event(
    "/admin-review/uploads/353/approve",
    "POST",
    {
      body: {
        review_id: 999,
        reviewed_by: "attacker",
        public_gallery_status: "public",
        admin_key: "browser-key"
      }
    }
  ));
  const reject = await handler(event(
    "/admin-review/uploads/354/reject",
    "POST",
    { body: { reason: "Needs a clearer photo", reviewed_by: "attacker" } }
  ));
  const hide = await handler(event(
    "/admin-review/uploads/355/hide",
    "POST",
    { body: { reason: "Hidden after review" } }
  ));

  assert.equal(approve.statusCode, 200);
  assert.equal(reject.statusCode, 200);
  assert.equal(hide.statusCode, 200);
  assert.equal(calls[0].url, "https://api.example.invalid/api/academy-approve-upload");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    review_id: 353,
    reviewed_by: "eamonn",
    public_gallery_status: "public"
  });
  assert.doesNotMatch(calls[0].options.body, /browser-key|attacker|999/);
  assert.equal(calls[1].url, "https://api.example.invalid/api/academy-reject-upload");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    review_id: 354,
    reviewed_by: "eamonn",
    rejected_reason: "Needs a clearer photo"
  });
  assert.equal(calls[2].url, "https://api.example.invalid/api/academy-hide-upload");
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    review_id: 355,
    reviewed_by: "eamonn",
    rejected_reason: "Hidden after review"
  });
});

test("proxy allows tutor list, answer and close with fixed upstream routes", async () => {
  const { handler, calls } = testHandler();
  await handler(event("/tutor-questions", "GET", {
    query: { status: "answered" }
  }));
  await handler(event("/tutor-questions/7/answer", "POST", {
    body: {
      answer: "Checked answer",
      request_id: "answer_request_0000001",
      answered_by: "attacker"
    }
  }));
  await handler(event("/tutor-questions/7/close", "POST", { body: {} }));

  assert.deepEqual(calls.map(call => call.url), [
    "https://api.example.invalid/api/academy-tutor-questions?status=answered",
    "https://api.example.invalid/api/academy-tutor-questions/7/answer",
    "https://api.example.invalid/api/academy-tutor-questions/7/close"
  ]);
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    answer: "Checked answer",
    answered_by: "Eamonn",
    request_id: "answer_request_0000001"
  });
});

test("proxy rejects unknown routes, filters and HTTP methods without forwarding", async () => {
  const { handler, calls } = testHandler();
  const unknown = await handler(event("/anything", "GET"));
  const wrongMethod = await handler(event("/admin-review/uploads", "POST", {
    body: {}
  }));
  const badFilter = await handler(event("/admin-review/uploads", "GET", {
    query: { status: "drop table", course_key: "all" }
  }));
  const wrongTutorMethod = await handler(event("/tutor-questions", "DELETE"));
  const freeProxy = await handler(event("/admin-review/uploads/1/../../health", "GET"));

  assert.equal(unknown.statusCode, 404);
  assert.equal(wrongMethod.statusCode, 405);
  assert.equal(wrongMethod.headers.Allow, "GET");
  assert.equal(badFilter.statusCode, 400);
  assert.equal(wrongTutorMethod.statusCode, 405);
  assert.equal(wrongTutorMethod.headers.Allow, "GET");
  assert.equal(freeProxy.statusCode, 404);
  assert.equal(calls.length, 0);
});

test("proxy aborts a stuck Render request at the safe default timeout", async () => {
  let configuredDelay;
  let clearedTimer;
  let receivedSignal;
  let fetchCalls = 0;
  const handler = createHandler({
    env,
    fetchImpl: async (_url, options) => {
      fetchCalls += 1;
      receivedSignal = options.signal;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    },
    setTimeoutImpl: (callback, delay) => {
      configuredDelay = delay;
      queueMicrotask(callback);
      return 73;
    },
    clearTimeoutImpl: timer => {
      clearedTimer = timer;
    },
    logger: { error() {} }
  });

  const response = await handler(event(
    "/tutor-questions/7/close",
    "POST",
    { body: {} }
  ));
  const data = JSON.parse(response.body);

  assert.equal(configuredDelay, 10000);
  assert.equal(fetchCalls, 1);
  assert.equal(receivedSignal.aborted, true);
  assert.equal(clearedTimer, 73);
  assert.equal(response.statusCode, 504);
  assert.deepEqual(data, {
    ok: false,
    code: "UPSTREAM_TIMEOUT",
    error: "The request timed out. The change may already have been processed. Refresh the queue before trying again.",
    outcome_uncertain: true
  });
});

test("proxy accepts a reasonable configured timeout and rejects unreasonable values", async () => {
  async function observedTimeout(value) {
    let configuredDelay;
    const handler = createHandler({
      env: { ...env, KETSO_ADMIN_PROXY_TIMEOUT_MS: value },
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true })
      }),
      setTimeoutImpl: (_callback, delay) => {
        configuredDelay = delay;
        return 91;
      },
      clearTimeoutImpl() {},
      logger: { error() {} }
    });
    await handler(event("/tutor-questions"));
    return configuredDelay;
  }

  assert.equal(await observedTimeout("2500"), 2500);
  assert.equal(await observedTimeout("not-a-number"), 10000);
  assert.equal(await observedTimeout("999"), 10000);
  assert.equal(await observedTimeout("30001"), 10000);
});

test("proxy keeps ordinary upstream failures separate from timeout uncertainty", async () => {
  let timerCleared = false;
  const handler = createHandler({
    env,
    fetchImpl: async () => {
      throw new TypeError("network unavailable");
    },
    setTimeoutImpl: () => 44,
    clearTimeoutImpl: timer => {
      assert.equal(timer, 44);
      timerCleared = true;
    },
    logger: { error() {} }
  });

  const response = await handler(event(
    "/admin-review/uploads/353/approve",
    "POST",
    { body: { public_gallery_status: "private" } }
  ));
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 502);
  assert.deepEqual(data, {
    ok: false,
    error: "KETSO API is not reachable"
  });
  assert.equal(timerCleared, true);
});

test("proxy shields sensitive JSON details from upstream 5xx responses", async () => {
  const logged = [];
  const handler = createHandler({
    env,
    fetchImpl: async () => ({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({
        ok: false,
        error: "password authentication failed for user database_admin",
        detail: "SELECT * FROM academy_students",
        stack: "internal stack trace"
      })
    }),
    logger: {
      error(...args) {
        logged.push(args);
      }
    }
  });

  const response = await handler(event("/tutor-questions"));
  assert.equal(response.statusCode, 502);
  assert.deepEqual(JSON.parse(response.body), {
    ok: false,
    error: "The service could not complete the request.",
    code: "UPSTREAM_ERROR"
  });
  assert.doesNotMatch(response.body, /password|database_admin|SELECT|stack/i);
  assert.deepEqual(logged, [[
    "KETSO_ADMIN_PROXY_ERROR",
    { code: "UPSTREAM_ERROR", upstream_status: 500 }
  ]]);
});

test("proxy shields text and HTML upstream 5xx responses", async () => {
  for (const upstreamBody of [
    "database connection failed at postgres://internal-host",
    "<html><body><pre>SQLSTATE 42P01 internal_table</pre></body></html>"
  ]) {
    const handler = createHandler({
      env,
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        text: async () => upstreamBody
      }),
      logger: { error() {} }
    });

    const response = await handler(event("/admin-review/uploads"));
    assert.equal(response.statusCode, 502);
    assert.deepEqual(JSON.parse(response.body), {
      ok: false,
      error: "The service could not complete the request.",
      code: "UPSTREAM_ERROR"
    });
    assert.doesNotMatch(response.body, /postgres|internal-host|SQLSTATE|internal_table/i);
  }
});

test("proxy forwards only expected safe upstream 4xx errors", async () => {
  const safeHandler = createHandler({
    env,
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({
        ok: false,
        error: "Question not found"
      })
    }),
    logger: { error() {} }
  });
  const safeResponse = await safeHandler(event(
    "/tutor-questions/999/close",
    "POST",
    { body: {} }
  ));
  assert.equal(safeResponse.statusCode, 404);
  assert.deepEqual(JSON.parse(safeResponse.body), {
    ok: false,
    error: "Question not found"
  });

  const unsafeHandler = createHandler({
    env,
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({
        ok: false,
        error: "SQL constraint academy_secret_key failed",
        detail: "internal detail"
      })
    }),
    logger: { error() {} }
  });
  const unsafeResponse = await unsafeHandler(event(
    "/admin-review/uploads/353/approve",
    "POST",
    { body: { public_gallery_status: "private" } }
  ));
  assert.equal(unsafeResponse.statusCode, 400);
  assert.deepEqual(JSON.parse(unsafeResponse.body), {
    ok: false,
    error: "The service rejected the request.",
    code: "UPSTREAM_REQUEST_REJECTED"
  });
  assert.doesNotMatch(unsafeResponse.body, /SQL|academy_secret_key|internal detail/i);
});

test("proxy handles upstream authentication failures without exposing details", async () => {
  const handler = createHandler({
    env,
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({
        ok: false,
        error: "Invalid admin key: server-admin-key"
      })
    }),
    logger: { error() {} }
  });

  const response = await handler(event("/tutor-questions"));
  assert.equal(response.statusCode, 502);
  assert.deepEqual(JSON.parse(response.body), {
    ok: false,
    error: "The service could not complete the request.",
    code: "UPSTREAM_AUTH_ERROR"
  });
  assert.doesNotMatch(response.body, /admin key|server-admin-key/i);
});
