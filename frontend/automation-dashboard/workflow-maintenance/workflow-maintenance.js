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
    showState(`Dependencies konden niet worden geladen. ${error.message}`, true);
  }
}

loadDependencies();
