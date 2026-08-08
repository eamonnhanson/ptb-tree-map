import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const scriptUrl = new URL(
  "../frontend/automation-dashboard/workflow-maintenance/workflow-maintenance.js",
  import.meta.url
);

function element(tagName = "div") {
  return {
    tagName,
    textContent: "",
    hidden: false,
    children: [],
    classList: {
      values: new Set(),
      toggle(name, enabled) {
        enabled ? this.values.add(name) : this.values.delete(name);
      },
      contains(name) {
        return this.values.has(name);
      }
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(...children) {
      this.children = children;
    }
  };
}

async function runFrontend(fetchImpl) {
  const elements = {
    dependencies: element("tbody"),
    "dependencies-state": element(),
    "dependencies-table-wrap": element()
  };
  const created = [];
  const source = await readFile(scriptUrl, "utf8");
  const context = vm.createContext({
    document: {
      getElementById(id) {
        return elements[id];
      },
      createElement(tagName) {
        const createdElement = element(tagName);
        Object.defineProperty(createdElement, "innerHTML", {
          set() {
            throw new Error("Database values must not use innerHTML");
          }
        });
        created.push(createdElement);
        return createdElement;
      }
    },
    fetch: fetchImpl,
    console
  });

  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { elements, created };
}

function response(dependencies) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { ok: true, dependencies };
    }
  };
}

function dependency(order, overrides = {}) {
  return {
    workflow_id: "zap_61",
    dependency_order: order,
    dependency_type: "automation_step",
    source_system: "Shopify",
    target_system: "PostgreSQL",
    trigger_or_input: "Order created",
    action_summary: "Link order",
    output_summary: "Linked record",
    uncertainty_level: "low",
    missing_information: null,
    ...overrides
  };
}

test("renders dependencies from the same-origin workflow maintenance API", async () => {
  let request;
  const { elements } = await runFrontend(async (url, options) => {
    request = { url, options };
    return response([dependency(101)]);
  });

  assert.equal(request.url, "/.netlify/functions/workflow-maintenance");
  assert.equal(request.options.credentials, "same-origin");
  assert.equal(elements.dependencies.children.length, 1);
  assert.deepEqual(
    elements.dependencies.children[0].children.map(cell => cell.textContent),
    ["zap_61", "101", "automation_step", "Shopify", "PostgreSQL", "Order created", "Link order", "Linked record", "low", "—"]
  );
  assert.equal(elements["dependencies-state"].hidden, true);
  assert.equal(elements["dependencies-table-wrap"].hidden, false);
});

test("shows an empty state for an empty dependencies response", async () => {
  const { elements } = await runFrontend(async () => response([]));

  assert.equal(elements["dependencies-state"].textContent, "Geen dependencies geregistreerd.");
  assert.equal(elements["dependencies-table-wrap"].hidden, true);
});

test("shows an error state when the API fails", async () => {
  const { elements } = await runFrontend(async () => ({
    ok: false,
    status: 503,
    async json() {
      return { ok: false, error: "Database niet bereikbaar" };
    }
  }));

  assert.match(elements["dependencies-state"].textContent, /Database niet bereikbaar/);
  assert.equal(elements["dependencies-state"].classList.contains("error"), true);
  assert.equal(elements["dependencies-table-wrap"].hidden, true);
});

test("handles database values as text without interpreting markup", async () => {
  const unsafe = '<img src=x onerror="alert(1)">';
  const { elements } = await runFrontend(async () => response([
    dependency(101, { action_summary: unsafe })
  ]));

  assert.equal(elements.dependencies.children[0].children[6].textContent, unsafe);
});

test("renders zap_61 dependency orders 101 through 109 returned by the API", async () => {
  const records = Array.from({ length: 9 }, (_, index) => dependency(101 + index));
  const { elements } = await runFrontend(async () => response(records));

  assert.equal(elements.dependencies.children.length, 9);
  assert.deepEqual(
    elements.dependencies.children.map(row => row.children[1].textContent),
    ["101", "102", "103", "104", "105", "106", "107", "108", "109"]
  );
  assert.ok(elements.dependencies.children.every(row => row.children[0].textContent === "zap_61"));
});
