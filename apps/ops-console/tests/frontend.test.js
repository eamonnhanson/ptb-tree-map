import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatTime } from "../frontend/view.js";

const frontend = (name) => readFile(new URL(`../frontend/${name}`, import.meta.url), "utf8");

test("frontend defines loading, unavailable and empty states", async () => {
  const [html, app] = await Promise.all([frontend("index.html"), frontend("app.js")]);
  assert.match(html, /Loading operational evidence/);
  assert.match(app, /Monitoring data unavailable/);
  assert.match(app, /No supported open actions were returned/);
  assert.match(app, /Runtime health unknown/);
  assert.match(app, /content\.hidden = true/);
});

test("frontend supports GREEN, ORANGE, RED and neutral UNKNOWN", async () => {
  const [view, styles] = await Promise.all([frontend("view.js"), frontend("styles.css")]);
  for (const state of ["GREEN", "ORANGE", "RED", "UNKNOWN"]) {
    assert.match(`${view}\n${styles}`, new RegExp(state));
  }
  assert.match(styles, /--unknown/);
});

test("database content is assigned through textContent and never innerHTML", async () => {
  const [app, view] = await Promise.all([frontend("app.js"), frontend("view.js")]);
  assert.match(view, /node\.textContent = String\(options\.text\)/);
  assert.doesNotMatch(`${app}\n${view}`, /\.innerHTML\s*=/);
});

test("timestamp display distinguishes missing and invalid evidence", () => {
  assert.equal(formatTime(null), "No evidence");
  assert.equal(formatTime("broken"), "Invalid timestamp");
  assert.notEqual(formatTime("2026-09-08T08:00:00Z"), "No evidence");
});

test("workflow detail exposes truncation and missing evidence", async () => {
  const app = await frontend("app.js");
  assert.match(app, /Results truncated at/);
  assert.match(app, /No \$\{title\.toLowerCase\(\)\} evidence/);
});
