import test from "node:test";
import assert from "node:assert/strict";
import { readHandler } from "../functions/_shared/handler.js";
import { authenticate, guardGet } from "../functions/_shared/http.js";
import { limited } from "../functions/_shared/repository.js";

const original = { user: process.env.OPS_CONSOLE_USER, password: process.env.OPS_CONSOLE_PASSWORD };
const authorized = () => ({ httpMethod: "GET", headers: { authorization: `Basic ${Buffer.from("operator:secret").toString("base64")}` } });

test.beforeEach(() => { process.env.OPS_CONSOLE_USER = "operator"; process.env.OPS_CONSOLE_PASSWORD = "secret"; });
test.after(() => { process.env.OPS_CONSOLE_USER = original.user; process.env.OPS_CONSOLE_PASSWORD = original.password; });

test("authentication rejects missing credentials", () => assert.equal(authenticate({ headers: {} }).statusCode, 401));
test("authentication fails closed when protection is not configured", () => {
  delete process.env.OPS_CONSOLE_PASSWORD;
  assert.equal(authenticate(authorized()).statusCode, 503);
});
test("API rejects write methods", () => assert.equal(guardGet({ ...authorized(), httpMethod: "POST" }).statusCode, 405));
test("API returns populated responses", async () => {
  const response = await readHandler(async () => ({ rows: [{ workflow_id: "zap_95" }] }), "workflows")(authorized());
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).workflows.rows.length, 1);
});
test("API preserves an empty table response", async () => {
  const response = await readHandler(async () => ({ rows: [], truncated: false }), "events")(authorized());
  assert.deepEqual(JSON.parse(response.body).events.rows, []);
});
test("database unavailable is not reported as zero incidents", async () => {
  const response = await readHandler(async () => { throw new Error("connection refused"); }, "events")(authorized());
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 503);
  assert.equal(body.data_state, "unavailable");
  assert.equal("events" in body, false);
});
test("truncated results are explicit", () => {
  const result = limited([{ id: 1 }, { id: 2 }, { id: 3 }], 2);
  assert.equal(result.truncated, true);
  assert.equal(result.rows.length, 2);
});
test("malformed collections are not silently normalized", () => assert.throws(() => limited(null, 2)));
