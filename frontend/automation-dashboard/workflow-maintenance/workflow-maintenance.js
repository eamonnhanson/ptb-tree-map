"use strict";

const DEPENDENCIES_ENDPOINT = "/.netlify/functions/workflow-maintenance";
const dependencyFields = [
  "workflow_id",
  "dependency_order",
  "dependency_type",
  "source_system",
  "target_system",
  "trigger_or_input",
  "action_summary",
  "output_summary",
  "uncertainty_level",
  "missing_information"
];

const dependenciesBody = document.getElementById("dependencies");
const dependenciesState = document.getElementById("dependencies-state");
const dependenciesTableWrap = document.getElementById("dependencies-table-wrap");
const criticalWorkflows = document.getElementById("critical-workflows");
const criticalWorkflowsState = document.getElementById("critical-workflows-state");

const criticalWorkflowDefinitions = [
  {
    workflowId: "zap_95",
    label: "Chargebee payment → PostgreSQL MVP",
    requiredSqlEvidence: ["docs/sql/014_chargebee_subscription_payment_allocation.sql"]
  },
  {
    workflowId: "shopify_monthly_donation_subscription_payment",
    label: "Shopify subscriptions → Tree allocation",
    requiredSqlEvidence: ["docs/sql/011_shopify_subscription_tree_allocation.sql"]
  },
  {
    workflowId: "zap_175",
    label: "Zoho CRM Academy onboarding → PostgreSQL",
    requiredSqlEvidence: [
      "docs/sql/021_process_academy_student_from_crm.sql",
      "docs/sql/020_academy_onboarding_completion.sql"
    ],
    requiresRuntimeCompletion: true
  }
];

function evidenceStatus(workflow, dependencies, definition) {
  if (!workflow) return "UNKNOWN";

  const registryStatus = String(workflow.status || "").toLowerCase();
  if (["failed", "blocked"].includes(registryStatus)) return "RED";

  const postgresEvidence = definition.requiredSqlEvidence.every(evidenceSource =>
    dependencies.some(dependency =>
      dependency.workflow_id === definition.workflowId &&
      String(dependency.target_system || "").toLowerCase().includes("postgresql") &&
      dependency.evidence_source === evidenceSource
    )
  );

  if (!postgresEvidence) return "UNKNOWN";
  if (definition.requiresRuntimeCompletion && !workflow.last_tested_at) return "ORANGE";
  if (registryStatus === "implemented" && workflow.last_tested_at) return "GREEN";
  return "ORANGE";
}

function statusExplanation(status, workflow, definition) {
  if (status === "GREEN") return "PostgreSQL-implementatie en testdatum zijn in de registry vastgelegd.";
  if (status === "RED") return "De registry markeert deze workflow als failed of blocked.";
  if (status === "ORANGE" && definition.requiresRuntimeCompletion && !workflow?.last_tested_at) return "Zap en completionlaag bestaan; een nieuwe succesvolle post-change runtime completion is nog niet aangetoond.";
  if (status === "ORANGE") return `Review-only PostgreSQL-evidence: ${definition.requiredSqlEvidence.join(", ")}; live uitvoering is niet bewezen.`;
  if (!workflow) return "Workflow ontbreekt in de centrale maintenance registry.";
  return "Geen directe, source-controlled PostgreSQL-definitie aangetroffen; alleen workflow- of Zap-referenties zijn onvoldoende.";
}

function renderCriticalWorkflows(workflows, dependencies) {
  criticalWorkflows.replaceChildren();

  for (const definition of criticalWorkflowDefinitions) {
    const workflow = workflows.find(item => item.workflow_id === definition.workflowId);
    const status = evidenceStatus(workflow, dependencies, definition);
    const card = document.createElement("article");
    const title = document.createElement("strong");
    const badge = document.createElement("span");
    const explanation = document.createElement("span");
    const evidence = document.createElement("span");

    card.classList.add("reference-block");
    card.dataset.status = status;
    title.textContent = definition.label;
    badge.classList.add("badge", status.toLowerCase() === "unknown" ? "neutral" : status.toLowerCase());
    badge.textContent = status;
    explanation.textContent = statusExplanation(status, workflow, definition);
    evidence.textContent = `Registry: ${definition.workflowId} · PostgreSQL reads/writes: ${displayValue(workflow?.reads_from)} → ${displayValue(workflow?.writes_to)}`;
    card.appendChild(title);
    card.appendChild(badge);
    card.appendChild(explanation);
    card.appendChild(evidence);
    criticalWorkflows.appendChild(card);
  }

  criticalWorkflowsState.hidden = true;
}

function displayValue(value) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function renderDependencies(dependencies) {
  dependenciesBody.replaceChildren();

  for (const dependency of dependencies) {
    const row = document.createElement("tr");

    for (const field of dependencyFields) {
      const cell = document.createElement("td");
      cell.textContent = displayValue(dependency?.[field]);
      row.appendChild(cell);
    }

    dependenciesBody.appendChild(row);
  }
}

function showState(message, isError = false) {
  dependenciesState.textContent = message;
  dependenciesState.classList.toggle("error", isError);
  dependenciesState.hidden = false;
  dependenciesTableWrap.hidden = true;
}

async function loadDependencies() {
  showState("Dependencies laden…");

  try {
    const response = await fetch(DEPENDENCIES_ENDPOINT, {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.error || `API-verzoek mislukt (status ${response.status})`);
    }

    const dependencies = Array.isArray(data.dependencies) ? data.dependencies : [];
    const workflows = Array.isArray(data.workflows) ? data.workflows : [];

    renderCriticalWorkflows(workflows, dependencies);

    if (!dependencies.length) {
      dependenciesBody.replaceChildren();
      showState("Geen dependencies geregistreerd.");
      return;
    }

    renderDependencies(dependencies);
    dependenciesState.hidden = true;
    dependenciesTableWrap.hidden = false;
  } catch (error) {
    dependenciesBody.replaceChildren();
    criticalWorkflows.replaceChildren();
    criticalWorkflowsState.textContent = "Kritieke workflowstatus niet beschikbaar: de registry-API kon niet worden geladen.";
    criticalWorkflowsState.classList.toggle("error", true);
    criticalWorkflowsState.hidden = false;
    showState(`Dependencies konden niet worden geladen. ${error.message}`, true);
  }
}

loadDependencies();
