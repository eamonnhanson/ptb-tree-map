import { timingSafeEqual } from "node:crypto";

export const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

export function json(statusCode, body, extraHeaders = {}) {
  return { statusCode, headers: { ...headers, ...extraHeaders }, body: JSON.stringify(body) };
}

function headerValue(input, name) {
  const pair = Object.entries(input || {}).find(([key]) => key.toLowerCase() === name);
  return pair?.[1] || "";
}

function equal(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authenticate(event) {
  const expectedUser = process.env.OPS_CONSOLE_USER || "";
  const expectedPassword = process.env.OPS_CONSOLE_PASSWORD || "";
  if (!expectedUser || !expectedPassword) {
    return json(503, { ok: false, error: "Operations Console protection is not configured" });
  }

  const authorization = headerValue(event.headers, "authorization");
  if (!authorization.startsWith("Basic ")) return challenge();
  try {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return challenge();
    if (!equal(decoded.slice(0, separator), expectedUser) || !equal(decoded.slice(separator + 1), expectedPassword)) {
      return challenge();
    }
  } catch {
    return challenge();
  }
  return null;
}

function challenge() {
  return json(401, { ok: false, error: "Authentication required" }, {
    "WWW-Authenticate": 'Basic realm="KETSO Operations Console", charset="UTF-8"'
  });
}

export function guardGet(event) {
  const authError = authenticate(event);
  if (authError) return authError;
  if (event.httpMethod !== "GET") return json(405, { ok: false, error: "Method not allowed" }, { Allow: "GET" });
  return null;
}

export function unavailable(message) {
  return json(503, { ok: false, error: message, data_state: "unavailable" });
}
