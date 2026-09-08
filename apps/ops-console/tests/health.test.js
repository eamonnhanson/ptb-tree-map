import test from "node:test";
import assert from "node:assert/strict";
import { evaluateWorkflow } from "../functions/_shared/health.js";

const now = "2026-09-08T10:00:00.000Z";
const base = { workflow_id: "zap_95", status: "implemented", last_tested_at: "2026-09-07" };
const evaluate = (extra) => evaluateWorkflow({ ...base, ...extra }, { now, freshnessHours: 72 });

test("recent success becomes GREEN", () => assert.equal(evaluate({ last_success_at: "2026-09-08T09:00:00Z" }).state, "GREEN"));
test("newer failure becomes RED", () => assert.equal(evaluate({ last_success_at: "2026-09-08T08:00:00Z", last_failure_at: "2026-09-08T09:00:00Z" }).state, "RED"));
test("implementation without runtime evidence becomes ORANGE", () => assert.equal(evaluate({}).state, "ORANGE"));
test("missing registry evidence becomes UNKNOWN", () => assert.equal(evaluateWorkflow(null, { now }).state, "UNKNOWN"));
test("invalid runtime timestamps do not become healthy", () => assert.equal(evaluate({ last_success_at: "not-a-date" }).state, "ORANGE"));
test("stale success becomes ORANGE", () => assert.equal(evaluate({ last_success_at: "2026-08-01T09:00:00Z" }).state, "ORANGE"));
test("old test date alone does not become HEALTHY", () => assert.equal(evaluate({ last_tested_at: "2024-01-01" }).state, "ORANGE"));
test("configuration alone does not become GREEN", () => assert.equal(evaluate({ status: "unknown", last_tested_at: null }).state, "UNKNOWN"));
test("unknown runtime outcome remains neutral", () => assert.equal(evaluate({ last_event_at: "2026-09-08T09:00:00Z" }).state, "UNKNOWN"));
