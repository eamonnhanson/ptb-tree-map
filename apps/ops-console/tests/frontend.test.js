import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

function setup() {
  const dom = new JSDOM("<!doctype html><body><main id='root'></main></body>");
  global.document = dom.window.document;
  global.window = dom.window;
  return dom;
}

test("frontend renders GREEN, ORANGE, RED and UNKNOWN without HTML interpretation", async () => {
  setup();
  const { workflowCard } = await import("../frontend/view.js");
  const root = document.querySelector("#root");
  for (const state of ["GREEN", "ORANGE", "RED", "UNKNOWN"]) {
    root.append(workflowCard({ workflow_id: state, workflow_name: `<img src=x onerror=alert('${state}')>`, health: { state, reason: "Evidence", evidence: {} } }, () => {}));
  }
  assert.equal(root.querySelectorAll("article").length, 4);
  assert.equal(root.querySelectorAll("img").length, 0);
  assert.match(root.textContent, /<img src=x/);
});

test("timestamp display distinguishes missing and invalid evidence", async () => {
  setup();
  const { formatTime } = await import("../frontend/view.js");
  assert.equal(formatTime(null), "No evidence");
  assert.equal(formatTime("broken"), "Invalid timestamp");
  assert.notEqual(formatTime("2026-09-08T08:00:00Z"), "No evidence");
});

test("empty state is rendered as neutral", async () => {
  setup();
  const { empty } = await import("../frontend/view.js");
  const node = empty("No evidence returned.");
  assert.match(node.className, /neutral/);
  assert.equal(node.textContent, "No evidence returned.");
});

test("render helpers never use unsafe innerHTML", async () => {
  setup();
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../frontend/view.js", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
});

test("application shows loading then unavailable without showing empty data", async () => {
  const dom = new JSDOM(`<!doctype html><body>
    <p id="updated"></p><main id="app"><section id="page-state"></section>
    <div id="content"><div id="workflows"></div><div id="actions"></div><div id="failures"></div><div id="systems"></div><p id="missing-workflows"></p></div></main>
    <dialog id="workflow-dialog"></dialog><div id="workflow-detail"></div></body>`);
  global.document = dom.window.document;
  global.window = dom.window;
  global.fetch = async () => ({ ok: false, json: async () => ({ ok: false, error: "Monitoring data unavailable" }) });
  await import(`../frontend/app.js?unavailable=${Date.now()}`);
  assert.match(document.querySelector("#page-state").textContent, /Loading operational evidence|Monitoring data unavailable/);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(document.querySelector("#page-state").textContent, "Monitoring data unavailable");
  assert.equal(document.querySelector("#content").hidden, true);
  assert.equal(document.querySelector("#updated").textContent, "Runtime health unknown");
});
