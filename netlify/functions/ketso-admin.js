import { timingSafeEqual } from "node:crypto";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

const authChallenge = {
  ...jsonHeaders,
  "WWW-Authenticate": 'Basic realm="Plant N Boom automation dashboard", charset="UTF-8"'
};

const VALID_UPLOAD_STATUSES = new Set([
  "pending",
  "submitted_for_review",
  "approved",
  "rejected",
  "all"
]);
const VALID_COURSES = new Set([
  "all",
  "online_tree_planting",
  "arboriculture_1"
]);
const VALID_QUESTION_STATUSES = new Set(["new", "answered", "closed", "all"]);
const REVIEW_ID_PATTERN = /^[1-9]\d*$/;
const DEFAULT_PROXY_TIMEOUT_MS = 10000;
const MIN_PROXY_TIMEOUT_MS = 1000;
const MAX_PROXY_TIMEOUT_MS = 30000;
const TIMEOUT_ERROR =
  "The request timed out. The change may already have been processed. Refresh the queue before trying again.";
const UPSTREAM_ERROR = "The service could not complete the request.";
const SAFE_UPSTREAM_4XX_ERRORS = new Map([
  [400, new Set([
    "Question ID is not valid",
    "Answer and request_id are required",
    "Answer is too long"
  ])],
  [404, new Set([
    "Upload not found",
    "Question not found"
  ])],
  [409, new Set([
    "This question is closed",
    "This question already has an answer",
    "Question was already answered"
  ])]
]);

function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { ...jsonHeaders, ...headers },
    body: JSON.stringify(body)
  };
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer);
}

function getHeader(headers, name) {
  const match = Object.entries(headers || {}).find(
    ([key]) => key.toLowerCase() === name.toLowerCase()
  );
  return match?.[1] || "";
}

function getCredentials(headers) {
  const header = getHeader(headers, "authorization");
  if (!header.startsWith("Basic ")) return null;

  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      user: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

function requireBasicAuth(event, env) {
  const expectedUser = env.AUTOMATION_DASHBOARD_USER;
  const expectedPassword = env.AUTOMATION_DASHBOARD_PASSWORD;
  if (!expectedUser || !expectedPassword) {
    return json(503, {
      ok: false,
      error: "Dashboard API protection is not configured"
    });
  }

  const credentials = getCredentials(event.headers);
  if (
    !credentials ||
    !safeEqual(credentials.user, expectedUser) ||
    !safeEqual(credentials.password, expectedPassword)
  ) {
    return {
      statusCode: 401,
      headers: authChallenge,
      body: JSON.stringify({ ok: false, error: "Authentication required" })
    };
  }
  return null;
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}

function routePath(event) {
  const path = String(event.path || "");
  const markers = [
    "/.netlify/functions/ketso-admin",
    "/automation-dashboard/api/ketso"
  ];
  const marker = markers.find(candidate => path.startsWith(candidate));
  if (!marker) return "/";
  return path.slice(marker.length).replace(/\/+$/, "") || "/";
}

function methodNotAllowed(allow) {
  return json(405, { ok: false, error: "Method not allowed" }, { Allow: allow });
}

function safeUpstreamResponse(response, body) {
  if (response.status >= 500) {
    return json(502, {
      ok: false,
      error: UPSTREAM_ERROR,
      code: "UPSTREAM_ERROR"
    });
  }

  if (response.status === 401 || response.status === 403) {
    return json(502, {
      ok: false,
      error: UPSTREAM_ERROR,
      code: "UPSTREAM_AUTH_ERROR"
    });
  }

  if (response.status >= 400) {
    const error = typeof body?.error === "string" ? body.error : "";
    if (SAFE_UPSTREAM_4XX_ERRORS.get(response.status)?.has(error)) {
      return json(response.status, { ok: false, error });
    }
    return json(response.status, {
      ok: false,
      error: "The service rejected the request.",
      code: "UPSTREAM_REQUEST_REJECTED"
    });
  }

  if (!body) {
    return json(502, {
      ok: false,
      error: UPSTREAM_ERROR,
      code: "UPSTREAM_INVALID_RESPONSE"
    });
  }

  return json(response.status, body);
}

function buildRoute(event) {
  const path = routePath(event);
  const method = String(event.httpMethod || "").toUpperCase();
  const params = event.queryStringParameters || {};

  if (path === "/admin-review/uploads") {
    if (method !== "GET") return { error: methodNotAllowed("GET") };
    const status = String(params.status || "pending");
    const course = String(params.course_key || "all");
    if (!VALID_UPLOAD_STATUSES.has(status) || !VALID_COURSES.has(course)) {
      return { error: json(400, { ok: false, error: "Invalid filter" }) };
    }
    return {
      method,
      upstreamPath: `/api/academy-moderation-queue?status=${encodeURIComponent(status)}&course_key=${encodeURIComponent(course)}`
    };
  }

  if (path === "/tutor-questions") {
    if (method !== "GET") return { error: methodNotAllowed("GET") };
    const status = String(params.status || "new");
    if (!VALID_QUESTION_STATUSES.has(status)) {
      return { error: json(400, { ok: false, error: "Invalid status filter" }) };
    }
    return {
      method,
      upstreamPath: `/api/academy-tutor-questions?status=${encodeURIComponent(status)}`
    };
  }

  const adminAction = path.match(
    /^\/admin-review\/uploads\/([1-9]\d*)\/(approve|reject|hide)$/
  );
  if (adminAction) {
    if (method !== "POST") return { error: methodNotAllowed("POST") };
    const body = parseBody(event);
    if (!body) return { error: json(400, { ok: false, error: "Invalid JSON body" }) };

    const [, reviewId, action] = adminAction;
    if (!REVIEW_ID_PATTERN.test(reviewId)) {
      return { error: json(400, { ok: false, error: "Invalid review ID" }) };
    }

    if (action === "approve") {
      const galleryStatus = body.public_gallery_status;
      if (!["public", "private"].includes(galleryStatus)) {
        return { error: json(400, { ok: false, error: "Invalid gallery status" }) };
      }
      return {
        method,
        upstreamPath: "/api/academy-approve-upload",
        body: {
          review_id: Number(reviewId),
          reviewed_by: "eamonn",
          public_gallery_status: galleryStatus
        }
      };
    }

    const reason = String(body.reason || "").trim().slice(0, 1000);
    return {
      method,
      upstreamPath: action === "reject"
        ? "/api/academy-reject-upload"
        : "/api/academy-hide-upload",
      body: {
        review_id: Number(reviewId),
        reviewed_by: "eamonn",
        rejected_reason: reason || null
      }
    };
  }

  const tutorAction = path.match(
    /^\/tutor-questions\/([1-9]\d*)\/(answer|close)$/
  );
  if (tutorAction) {
    if (method !== "POST") return { error: methodNotAllowed("POST") };
    const [, questionId, action] = tutorAction;
    const body = parseBody(event);
    if (!body) return { error: json(400, { ok: false, error: "Invalid JSON body" }) };

    if (action === "answer") {
      const answer = String(body.answer || "").trim();
      const requestId = String(body.request_id || "").trim();
      if (!answer || answer.length > 10000 || !/^[A-Za-z0-9_-]{16,128}$/.test(requestId)) {
        return { error: json(400, { ok: false, error: "Invalid answer" }) };
      }
      return {
        method,
        upstreamPath: `/api/academy-tutor-questions/${questionId}/answer`,
        body: {
          answer,
          answered_by: "Eamonn",
          request_id: requestId
        }
      };
    }

    return {
      method,
      upstreamPath: `/api/academy-tutor-questions/${questionId}/close`,
      body: {}
    };
  }

  return { error: json(404, { ok: false, error: "Route not allowed" }) };
}

function getConfiguration(env) {
  if (!env.ADMIN_GALLERY_KEY) {
    return { error: "KETSO admin access is not configured" };
  }
  try {
    const baseUrl = new URL(
      env.KETSO_API_BASE_URL || "https://ptb-tree-map.onrender.com"
    );
    if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "localhost") {
      return { error: "KETSO API URL is invalid" };
    }
    baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, "");
    baseUrl.search = "";
    baseUrl.hash = "";
    return {
      baseUrl: baseUrl.toString().replace(/\/$/, ""),
      timeoutMs: proxyTimeoutMs(env.KETSO_ADMIN_PROXY_TIMEOUT_MS)
    };
  } catch {
    return { error: "KETSO API URL is invalid" };
  }
}

function proxyTimeoutMs(value) {
  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    !Number.isInteger(parsed) ||
    parsed < MIN_PROXY_TIMEOUT_MS ||
    parsed > MAX_PROXY_TIMEOUT_MS
  ) {
    return DEFAULT_PROXY_TIMEOUT_MS;
  }
  return parsed;
}

export function createHandler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout
} = {}) {
  return async function handler(event) {
    const authError = requireBasicAuth(event, env);
    if (authError) return authError;

    const configuration = getConfiguration(env);
    if (configuration.error) {
      return json(503, { ok: false, error: configuration.error });
    }

    const route = buildRoute(event);
    if (route.error) return route.error;

    const headers = {
      "Accept": "application/json",
      "X-Admin-Key": env.ADMIN_GALLERY_KEY
    };
    const request = { method: route.method, headers };
    if (route.method === "POST") {
      headers["Content-Type"] = "application/json";
      request.body = JSON.stringify(route.body);
    }

    const controller = new AbortController();
    const timeout = setTimeoutImpl(
      () => controller.abort(),
      configuration.timeoutMs
    );
    request.signal = controller.signal;

    try {
      const response = await fetchImpl(
        `${configuration.baseUrl}${route.upstreamPath}`,
        request
      );
      const rawBody = await response.text();
      let body = null;
      try {
        body = JSON.parse(rawBody);
      } catch {}

      if (response.status >= 500) {
        logger.error("KETSO_ADMIN_PROXY_ERROR", {
          code: "UPSTREAM_ERROR",
          upstream_status: response.status
        });
      } else if (response.status === 401 || response.status === 403) {
        logger.error("KETSO_ADMIN_PROXY_ERROR", {
          code: "UPSTREAM_AUTH_ERROR",
          upstream_status: response.status
        });
      }
      return safeUpstreamResponse(response, body);
    } catch (error) {
      if (controller.signal.aborted && error?.name === "AbortError") {
        logger.error("KETSO_ADMIN_PROXY_ERROR", {
          code: "UPSTREAM_TIMEOUT"
        });
        return json(504, {
          ok: false,
          code: "UPSTREAM_TIMEOUT",
          error: TIMEOUT_ERROR,
          outcome_uncertain: route.method === "POST"
        });
      }
      logger.error("KETSO_ADMIN_PROXY_ERROR", {
        code: "UPSTREAM_NETWORK_ERROR"
      });
      return json(502, { ok: false, error: "KETSO API is not reachable" });
    } finally {
      clearTimeoutImpl(timeout);
    }
  };
}

export const handler = createHandler();
