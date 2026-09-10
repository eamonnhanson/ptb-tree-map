import test from "node:test";
import assert from "node:assert/strict";
import { reportFailure } from "../functions/_shared/diagnostics.js";
import { readHandler } from "../functions/_shared/handler.js";

function record(error, endpoint = "events") {
  const logs = [];
  reportFailure(error, endpoint, (entry) => logs.push(JSON.parse(entry)));
  assert.equal(logs.length, 1);
  return logs[0];
}

test("diagnostics classify actionable database and TLS failures", () => {
  for (const [code, label] of [
    ["28P01", "DB_AUTHENTICATION_FAILED"],
    ["42501", "DB_PERMISSION_DENIED"],
    ["42703", "DB_COLUMN_NOT_FOUND"],
    ["ENOTFOUND", "DB_DNS_FAILED"],
    ["ETIMEDOUT", "DB_CONNECTION_TIMEOUT"],
    ["SELF_SIGNED_CERT_IN_CHAIN", "DB_TLS_UNTRUSTED"],
    ["ERR_TLS_CERT_ALTNAME_INVALID", "DB_TLS_HOSTNAME_MISMATCH"]
  ]) assert.equal(record({ code }).code, label);
  assert.equal(record(new Error("DATABASE_NOT_CONFIGURED")).code, "DB_NOT_CONFIGURED");
  assert.equal(record(new Error("timeout exceeded when trying to connect")).code, "DB_CONNECTION_TIMEOUT");
});

test("diagnostics never serialize arbitrary error or endpoint content", () => {
  const secret = "postgresql://operator:do-not-log@private-host/database";
  for (const code of ["28P01", secret]) {
    const error = { code, message: secret, stack: secret, detail: secret, cause: secret,
      toJSON() { throw new Error("must not serialize error"); } };
    assert.deepEqual(record(error, secret), {
      event: "ops_console_read_failed", endpoint: "unknown",
      code: code === "28P01" ? "DB_AUTHENTICATION_FAILED" : "UNCLASSIFIED_FAILURE"
    });
  }
  for (const error of [null, undefined, "secret", {}, new Error("secret")]) {
    assert.equal(record(error).code, "UNCLASSIFIED_FAILURE");
  }
});

test("a broken logger does not propagate an exception", () => {
  assert.doesNotThrow(() => reportFailure({ code: "28P01" }, "events", () => { throw new Error("logger failed"); }));
});

test("handler logs a safe code but preserves the generic API response", async (t) => {
  const previous = { user: process.env.OPS_CONSOLE_USER, password: process.env.OPS_CONSOLE_PASSWORD };
  t.after(() => {
    for (const [key, value] of [["OPS_CONSOLE_USER", previous.user], ["OPS_CONSOLE_PASSWORD", previous.password]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  process.env.OPS_CONSOLE_USER = "operator";
  process.env.OPS_CONSOLE_PASSWORD = "test-only";
  const logs = [];
  t.mock.method(console, "error", (line) => logs.push(JSON.parse(line)));
  const handler = readHandler(async () => { throw Object.assign(new Error("private payload"), { code: "28P01" }); }, "events");
  const response = await handler({ httpMethod: "GET", headers: { authorization: `Basic ${Buffer.from("operator:test-only").toString("base64")}` } });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(JSON.parse(response.body), { ok: false, error: "Monitoring data unavailable", data_state: "unavailable" });
  assert.deepEqual(logs, [{ event: "ops_console_read_failed", endpoint: "events", code: "DB_AUTHENTICATION_FAILED" }]);
  logs.length = 0;
  assert.equal((await handler({ httpMethod: "GET", headers: {} })).statusCode, 401);
  assert.equal(logs.length, 0);
});
