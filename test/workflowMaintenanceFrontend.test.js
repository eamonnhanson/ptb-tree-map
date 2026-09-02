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
    dataset: {},
    children: [],
    classList: {
      values: new Set(),
      add(...names) {
        names.forEach(name => this.values.add(name));
      },
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
    "dependencies-table-wrap": element(),
    "critical-workflows": element(),
    "critical-workflows-state": element()
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

function response(dependencies, workflows = []) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { ok: true, dependencies, workflows };
    }
  };
}

function workflow(workflowId, overrides = {}) {
  return {
    workflow_id: workflowId,
    status: "partially_audited",
    reads_from: "payment payload; users1; trees1",
    writes_to: "payment ledger; trees1",
    last_tested_at: null,
    ...overrides
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

test("renders conservative PostgreSQL evidence statuses for critical workflows", async () => {
  const dependencies = [
    dependency(40, {
      workflow_id: "zap_95",
      target_system: "PostgreSQL",
      evidence_source: "docs/sql/014_chargebee_subscription_payment_allocation.sql"
    }),
    dependency(30, {
      workflow_id: "shopify_monthly_donation_subscription_payment",
      target_system: "PostgreSQL",
      evidence_source: "docs/sql/011_shopify_subscription_tree_allocation.sql"
    }),
    dependency(30, {
      workflow_id: "zap_175",
      target_system: "PostgreSQL",
      evidence_source: "docs/sql/021_process_academy_student_from_crm.sql"
    }),
    dependency(70, {
      workflow_id: "zap_175",
      target_system: "PostgreSQL",
      evidence_source: "docs/sql/020_academy_onboarding_completion.sql"
    })
  ];
  const workflows = [
    workflow("zap_95"),
    workflow("shopify_monthly_donation_subscription_payment"),
    workflow("zap_175")
  ];
  const { elements } = await runFrontend(async () => response(dependencies, workflows));

  assert.deepEqual(
    elements["critical-workflows"].children.map(card => card.dataset.status),
    ["ORANGE", "ORANGE", "ORANGE"]
  );
  assert.match(elements["critical-workflows"].children[0].children[2].textContent, /Review-only PostgreSQL-evidence/);
  assert.match(elements["critical-workflows"].children[2].children[0].textContent, /Zoho CRM Academy onboarding → PostgreSQL/);
  assert.match(elements["critical-workflows"].children[2].children[2].textContent, /runtime completion/);
});

test("uses GREEN only for implemented and tested PostgreSQL evidence", async () => {
  const dependencies = [dependency(40, {
    workflow_id: "zap_95",
    target_system: "PostgreSQL",
    evidence_source: "docs/sql/014_chargebee_subscription_payment_allocation.sql"
  })];
  const workflows = [workflow("zap_95", { status: "implemented", last_tested_at: "2026-09-02" })];
  const { elements } = await runFrontend(async () => response(dependencies, workflows));

  assert.equal(elements["critical-workflows"].children[0].dataset.status, "GREEN");
  assert.equal(elements["critical-workflows"].children[1].dataset.status, "UNKNOWN");
});

test("keeps Academy ORANGE without a demonstrated runtime completion", async () => {
  const dependencies = [
    dependency(30, {
      workflow_id: "zap_175",
      target_system: "PostgreSQL",
      evidence_source: "docs/sql/021_process_academy_student_from_crm.sql"
    }),
    dependency(70, {
      workflow_id: "zap_175",
      target_system: "PostgreSQL",
      evidence_source: "docs/sql/020_academy_onboarding_completion.sql"
    })
  ];
  const workflows = [workflow("zap_175", { status: "partially_audited", last_tested_at: null })];
  const { elements } = await runFrontend(async () => response(dependencies, workflows));

  assert.equal(elements["critical-workflows"].children[2].dataset.status, "ORANGE");
});

test("uses GREEN for Academy after registered post-change runtime verification", async () => {
  const dependencies = [
    dependency(30, {
      workflow_id: "zap_175",
      target_system: "PostgreSQL",
      evidence_source: "docs/sql/021_process_academy_student_from_crm.sql"
    }),
    dependency(70, {
      workflow_id: "zap_175",
      target_system: "PostgreSQL",
      evidence_source: "docs/sql/020_academy_onboarding_completion.sql"
    })
  ];
  const workflows = [workflow("zap_175", { status: "implemented", last_tested_at: "2026-09-02" })];
  const { elements } = await runFrontend(async () => response(dependencies, workflows));

  assert.equal(elements["critical-workflows"].children[2].dataset.status, "GREEN");
});

test("uses UNKNOWN when either required Academy SQL source is missing", async () => {
  const dependencies = [dependency(70, {
    workflow_id: "zap_175",
    target_system: "PostgreSQL",
    evidence_source: "docs/sql/020_academy_onboarding_completion.sql"
  })];
  const workflows = [workflow("zap_175", { status: "partially_audited" })];
  const { elements } = await runFrontend(async () => response(dependencies, workflows));

  assert.equal(elements["critical-workflows"].children[2].dataset.status, "UNKNOWN");
});

test("uses RED for failed Academy before evaluating SQL evidence", async () => {
  const workflows = [workflow("zap_175", { status: "failed" })];
  const { elements } = await runFrontend(async () => response([], workflows));

  assert.equal(elements["critical-workflows"].children[2].dataset.status, "RED");
});

test("uses RED only for an explicit failed or blocked registry status", async () => {
  const workflows = [workflow("zap_95", { status: "blocked" })];
  const { elements } = await runFrontend(async () => response([], workflows));

  assert.equal(elements["critical-workflows"].children[0].dataset.status, "RED");
});

test("does not treat the Chargebee publishing no-op as a business dependency", async () => {
  const source = await readFile(new URL("../docs/sql/019_critical_workflows_registry.sql", import.meta.url), "utf8");

  assert.doesNotMatch(source, /Technical no-op|publishing no-op|step 12/i);
  assert.match(source, /mark_chargebee_subscription_payment_side_effect/);
});

test("does not register the Academy publishing no-op as a business dependency", async () => {
  const source = await readFile(new URL("../docs/sql/019_critical_workflows_registry.sql", import.meta.url), "utf8");

  assert.match(source, /Zoho CRM Academy onboarding → PostgreSQL/);
  assert.doesNotMatch(source, /Technical no-op|publishing no-op/i);
});

test("changed dashboard and registry sources contain no literal mojibake", async () => {
  const urls = [
    scriptUrl,
    new URL("../frontend/automation-dashboard/app.js", import.meta.url),
    new URL("../docs/sql/019_critical_workflows_registry.sql", import.meta.url)
  ];
  const source = (await Promise.all(urls.map(url => readFile(url, "utf8")))).join("\n");

  assert.doesNotMatch(source, /ÔåÆ|â†’|├·|ÔÇö/);
  assert.match(source, /→/);
  assert.match(source, /·/);
  assert.match(source, /—/);
});
