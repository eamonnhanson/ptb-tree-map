const signalCards = [
  {
    title: "Tree allocation",
    system: "Zapier / PostgreSQL / Zoho Mail",
    status: "orange",
    count: 7,
    detail: "Allocatiebewijs bestaat deels, maar mist nog gestandaardiseerde eindlogging.",
    evidence: "trees1 update plus outbox/allocation log"
  },
  {
    title: "Shopify aankopen",
    system: "Shopify / Zapier",
    status: "orange",
    count: 5,
    detail: "SKU 01 en 02 zijn gekoppeld aan workflows; productdekking moet nog worden bevestigd.",
    evidence: "Zapier history, Shopify order export, outbound evidence"
  },
  {
    title: "Abonnementen",
    system: "Chargebee / Zapier",
    status: "orange",
    count: 8,
    detail: "Planmapping is aanwezig, maar allocatie- en mailbewijs is nog niet volledig gekoppeld.",
    evidence: "Chargebee exports, Zapier history, PostgreSQL, Zoho Mail"
  },
  {
    title: "Manual follow-up",
    system: "Zoho Mail",
    status: "red",
    count: 4,
    detail: "Handmatige opvolging is zichtbaar in samples, maar mist een resolved-marker en live folderbewijs.",
    evidence: "Manual Follow-up folder, resolution marker"
  },
  {
    title: "Outbound e-mail",
    system: "Zoho Mail / Zapier",
    status: "orange",
    count: 5,
    detail: "Outbox-signalen zijn bruikbaar, maar moeten per workflow aan brongebeurtenissen worden gekoppeld.",
    evidence: "mail id/message id and expected workflow id"
  },
  {
    title: "Certificaten",
    system: "Zoho Creator / Zoho Mail",
    status: "orange",
    count: 3,
    detail: "Certificaatstromen zijn deels afgeleid uit Zapier en mail, met ontbrekende jobstatus-export.",
    evidence: "Creator record plus outbox attachment"
  },
  {
    title: "Academy onboarding",
    system: "Zoho CRM / PostgreSQL / Zoho Mail",
    status: "red",
    count: 1,
    detail: "Onboarding heeft hoge failure risk zolang upload- en goedkeuringsbewijs niet centraal wordt gelogd.",
    evidence: "CRM, outbox, uploader approval"
  },
  {
    title: "Rapportage",
    system: "Schedule / PostgreSQL / Zoho Mail",
    status: "orange",
    count: 1,
    detail: "Monthly Tree Report heeft historiebewijs, maar mist een finale dashboardstatusregel.",
    evidence: "Zapier history, PostgreSQL trees1, outbound action"
  }
];

const workflows = [
  ["zap_1", "IMCD_NL_TreeCert_Postgres", "ZohoForms", "certificate/tree allocation", "orange", "Zapier history CSV; PostgreSQL users1/trees1"],
  ["zap_15", "IMCD_BEL_TreeCert_Postgres", "ZohoForms", "certificate/tree allocation", "orange", "Zapier history CSV; PostgreSQL users1/trees1"],
  ["zap_29", "Shopify eigenbomen naar PostgreSQL (SKU 02)", "Shopify", "shopify/tree purchase", "orange", "Zapier history CSV; PostgreSQL trees1/users1"],
  ["zap_47", "Shopify tokenized gift tree link (SKU 01)", "Shopify", "shopify/tree purchase", "orange", "gift_claims; Zoho Mail claim link"],
  ["zap_61", "ZAP B gift tree claim form", "ZohoForms", "gift claim", "red", "PostgreSQL gift_claims/users1/SET/trees1"],
  ["zap_95", "Nieuw abonnes chargebee REVERTED", "Chargebee", "subscription", "orange", "Chargebee; PostgreSQL users1/trees1; Zoho Mail"],
  ["zap_124", "Monthly Tree Report", "Schedule", "reporting", "orange", "Zapier history; PostgreSQL trees1; Zoho Mail"],
  ["zap_129", "Forest Hero Photo Email 2025Q4", "Schedule", "outbound photo email", "orange", "email_log; photos/trees/users; Zoho Mail"],
  ["zap_135", "Copy Shopify eigenbomen SKU02", "Shopify", "shopify/tree purchase", "orange", "Zapier history CSV; PostgreSQL trees1/users1"],
  ["zap_141", "Nieuw abonnes shopify handmatig", "ZohoForms", "shopify/tree purchase", "orange", "PostgreSQL users1/trees1; Zoho Mail"],
  ["zap_172", "Webhooks by Zapier", "WebHook", "other", "orange", "Zapier history CSV; Zoho Mail outbound action"],
  ["zap_175", "Zoho CRM Academy onboarding", "ZohoCRM", "academy/onboarding", "red", "process_academy_student_from_crm; Zoho Mail"],
  ["shopify_sku_01", "Geef een boom cadeau", "Shopify", "product catalog", "orange", "Zapier success; gift_claims row; claim-link mail"],
  ["shopify_sku_02", "Koop een boom voor jezelf", "Shopify", "product catalog", "orange", "Zapier success; trees1 update; certificate evidence"],
  ["shopify_sku_05", "Doneer eenmalig", "Shopify", "product catalog", "orange", "outbox thank-you or registry record"],
  ["chargebee_plans", "Chargebee abonnementen", "Chargebee", "subscription", "orange", "subscription, invoice, allocation, outbound evidence"],
  ["zoho_manual_followup", "Manual follow-up required", "Zoho Mail", "manual follow-up", "red", "folder/tag plus completion marker"],
  ["zoho_outbox", "Outbound email monitor", "Zoho Mail", "outbound email", "orange", "message id matched to expected workflow"]
].map(([id, name, system, category, status, evidence]) => ({ id, name, system, category, status, evidence }));

const workflowActions = [
  {
    title: "Final logging voor Zapier workflows",
    system: "Zapier",
    status: "orange",
    owner: "Automation team",
    nextAction: "Voeg eindstatus en job-id toe aan de workflows met allocatiebewijs.",
    urgency: "hoog",
    lastUpdated: "2026-06-01",
    evidence: "Zapier history CSV; PostgreSQL allocation log"
  },
  {
    title: "Zoho Mail folder/tag bewijs",
    system: "Zoho Mail",
    status: "red",
    owner: "Support",
    nextAction: "Leg live folderpaden en afhandelstatus vast voor manual follow-up.",
    urgency: "hoog",
    lastUpdated: "2026-05-31",
    evidence: "Zoho Mail Manual Follow-up folder"
  },
  {
    title: "Shopify productdekking koppelen",
    system: "Shopify",
    status: "orange",
    owner: "Operations",
    nextAction: "Match SKU 01, 02 en 05 met orderbewijs en outbound mailbewijs.",
    urgency: "middel",
    lastUpdated: "2026-05-30",
    evidence: "Shopify order export; Zoho Mail outbound evidence"
  },
  {
    title: "Chargebee plan-to-item mapping",
    system: "Chargebee",
    status: "orange",
    owner: "Finance operations",
    nextAction: "Controleer abonnement, factuur, allocatie en outbound bewijs per plan.",
    urgency: "middel",
    lastUpdated: "2026-05-29",
    evidence: "Chargebee export; PostgreSQL users1/trees1"
  },
  {
    title: "Academy onboarding logging",
    system: "ZohoCRM",
    status: "red",
    owner: "Academy team",
    nextAction: "Koppel CRM-onboarding aan uploadgoedkeuring en mailbewijs.",
    urgency: "hoog",
    lastUpdated: "2026-06-01",
    evidence: "Zoho CRM Academy record; uploader approval"
  }
];

const statusLabel = {
  green: "Groen",
  orange: "Oranje",
  red: "Rood"
};

const studentStatusLabel = {
  nieuw: "Nieuw",
  goedgekeurd: "Goedgekeurd",
  afgewezen: "Afgewezen",
  meer_info_nodig: "Meer info nodig"
};

const studentSignal = {
  nieuw: ["Te beoordelen", "neutral"],
  goedgekeurd: ["Klaar", "green"],
  afgewezen: ["Herhalen", "red"],
  meer_info_nodig: ["Wacht op info", "orange"]
};

const urgencyLabel = {
  hoog: "Hoog",
  middel: "Normaal",
  laag: "Laag"
};

const urgencyStatus = {
  hoog: "red",
  middel: "orange",
  laag: "green"
};

const actionTypeLabel = {
  "student-upload": "Student upload",
  onboarding: "Onboarding",
  workflow: "Workflow/audit"
};

const searchInput = document.getElementById("search");
const statusFilter = document.getElementById("status-filter");
const systemFilter = document.getElementById("system-filter");
const studentSearchInput = document.getElementById("student-search");
const studentStatusFilter = document.getElementById("student-status-filter");
const lessonFilter = document.getElementById("lesson-filter");
const actionTypeFilter = document.getElementById("action-type-filter");
const urgencyFilter = document.getElementById("urgency-filter");
const resetFiltersButton = document.getElementById("reset-filters");
const liveMonitoringSummary = document.getElementById("live-monitoring-summary");
const liveMonitoringSource = document.getElementById("live-monitoring-source");
const outboundMessagesSource = document.getElementById("outbound-messages-source");
const workflowMaintenanceSource = document.getElementById("workflow-maintenance-source");
const workflowMaintenanceSummary = document.getElementById("workflow-maintenance-summary");

const workflowMaintenanceTables = {
  workflows: {
    body: document.getElementById("maintenance-workflows-table"),
    count: document.getElementById("maintenance-workflows-count"),
    columns: [
      "workflow_id",
      "workflow_name",
      "platform",
      "source_system",
      "target_system",
      "status",
      "risk_level",
      "next_review_at"
    ]
  },
  connections: {
    body: document.getElementById("maintenance-connections-table"),
    count: document.getElementById("maintenance-connections-count"),
    columns: [
      "system",
      "connection_name",
      "username",
      "rights_summary",
      "review_status"
    ]
  },
  code_assets: {
    body: document.getElementById("maintenance-code-assets-table"),
    count: document.getElementById("maintenance-code-assets-count"),
    columns: [
      "file_path",
      "asset_type",
      "related_workflows",
      "status",
      "review_status"
    ]
  },
  runbooks: {
    body: document.getElementById("maintenance-runbooks-table"),
    count: document.getElementById("maintenance-runbooks-count"),
    columns: [
      "workflow_id",
      "runbook_file",
      "runbook_title",
      "status"
    ]
  },
  reviews: {
    body: document.getElementById("maintenance-reviews-table"),
    count: document.getElementById("maintenance-reviews-count"),
    columns: [
      "workflow_id",
      "review_type",
      "review_status",
      "findings",
      "action_items"
    ]
  },
  dependencies: {
    body: document.getElementById("maintenance-dependencies-table"),
    count: document.getElementById("maintenance-dependencies-count"),
    columns: [
      "workflow_id",
      "dependency_type",
      "source_system",
      "target_system",
      "action_summary",
      "uncertainty_level"
    ]
  }
};

let studentData = {
  registrations: [],
  uploads: []
};
let liveWorkflowActions = null;
let openActionsSourceLabel = "Statische voorbeelddata";
let openActionsErrorMessage = "";
let liveOutboundActions = null;
let outboundMessagesSourceLabel = "Statische voorbeelddata";
let outboundMessagesErrorMessage = "";
let liveWorkflows = null;
let workflowRegistrySourceLabel = "Statische voorbeelddata";
let workflowRegistryErrorMessage = "";

function getSearchText(item, extraValues = []) {
  return [...Object.values(item), ...extraValues]
    .filter(value => value !== undefined && value !== null)
    .join(" ")
    .toLowerCase();
}

function matchesSearch(item, query, extraValues = []) {
  return !query || getSearchText(item, extraValues).includes(query);
}

function getGeneralQuery() {
  return searchInput.value.trim().toLowerCase();
}

function getStudentQuery() {
  return studentSearchInput.value.trim().toLowerCase();
}

function getActiveFilterSummary(scope = "all") {
  const filters = [];

  if (getGeneralQuery()) {
    filters.push(`zoekterm "${searchInput.value.trim()}"`);
  }

  if (statusFilter.value !== "all") {
    filters.push(`dashboardstatus ${statusLabel[statusFilter.value]}`);
  }

  if (systemFilter.value !== "all") {
    filters.push(`systeem ${systemFilter.value}`);
  }

  if (scope === "all" || scope === "actions") {
    if (actionTypeFilter.value !== "all") {
      filters.push(`actietype ${actionTypeLabel[actionTypeFilter.value]}`);
    }

    if (urgencyFilter.value !== "all") {
      filters.push(`urgentie ${urgencyLabel[urgencyFilter.value]}`);
    }
  }

  if (scope === "all" || scope === "students") {
    if (getStudentQuery()) {
      filters.push(`studentzoekterm "${studentSearchInput.value.trim()}"`);
    }

    if (studentStatusFilter.value !== "all") {
      filters.push(`studentstatus ${studentStatusLabel[studentStatusFilter.value]}`);
    }

    if (lessonFilter.value !== "all") {
      filters.push(`les ${lessonFilter.value}`);
    }
  }

  return filters.length ? filters.join(", ") : "geen actieve filters";
}

function emptyMessage(title, scope = "all") {
  return `<div class="empty"><strong>${title}</strong><span>Actieve filters: ${getActiveFilterSummary(scope)}.</span></div>`;
}

function renderSummary() {
  const totalSignals = signalCards.reduce((sum, card) => sum + card.count, 0);
  const red = signalCards.filter(card => card.status === "red").length;
  const orange = signalCards.filter(card => card.status === "orange").length;
  const systems = new Set(workflows.map(workflow => workflow.system)).size;

  const metrics = [
    [totalSignals, "dashboard-signalen uit docs"],
    [workflows.length, "workflows en productstromen"],
    [orange, "oranje dashboardkaarten"],
    [red, "rode aandachtspunten"],
    [systems, "bronsystemen"]
  ];

  document.getElementById("summary-grid").innerHTML = metrics.map(([value, label]) => `
    <div class="metric">
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `).join("");
}

function renderLiveMonitoringLoading() {
  liveMonitoringSource.textContent = "Live monitoring laden...";
  liveMonitoringSummary.innerHTML = `<div class="live-monitoring-status">Live monitoring laden...</div>`;
}

function renderLiveMonitoringError(message) {
  liveMonitoringSource.textContent = "Niet beschikbaar";
  liveMonitoringSummary.innerHTML = `<div class="live-monitoring-status">${message}</div>`;
}

function renderLiveMonitoringSummary(data) {
  const counts = data.counts || {};
  const metrics = [
    [counts.automation_registry ?? "-", "Automation registry"],
    [counts.automation_events ?? "-", "Automation events"],
    [counts.outbound_messages ?? "-", "Outbound messages"],
    [data.generated_at || "-", "Laatst opgehaald"]
  ];

  liveMonitoringSource.textContent = data.database || data.source || "Monitoring";
  liveMonitoringSummary.innerHTML = metrics.map(([value, label]) => `
    <div class="metric">
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `).join("");
}

function renderOpenActionsSource() {
  const count = document.getElementById("open-action-count");
  const currentCount = count.dataset.count || "";
  const parts = [currentCount, openActionsSourceLabel].filter(Boolean);

  count.textContent = parts.join(" · ");
}

async function loadLiveMonitoringSummary() {
  renderLiveMonitoringLoading();

  try {
    const response = await fetch("/.netlify/functions/monitoring-summary", {
      credentials: "same-origin"
    });

    if (response.status === 401) {
      renderLiveMonitoringError("Live monitoring niet beschikbaar: niet geautoriseerd");
      return;
    }

    if (response.status === 503) {
      renderLiveMonitoringError("Live monitoring niet beschikbaar: databaseconfiguratie of verbinding");
      return;
    }

    if (!response.ok) {
      renderLiveMonitoringError("Live monitoring niet beschikbaar");
      return;
    }

    renderLiveMonitoringSummary(await response.json());
  } catch (error) {
    renderLiveMonitoringError("Live monitoring niet beschikbaar");
  }
}

function severityToUrgency(severity) {
  const severityMap = {
    red: "hoog",
    orange: "middel",
    yellow: "middel",
    green: "laag"
  };

  return severityMap[severity] || "middel";
}

function formatMonitoringDate(value) {
  if (!value) {
    return "-";
  }

  return String(value).slice(0, 10);
}

function mapMonitoringEventToAction(event) {
  const urgency = severityToUrgency(event.severity);

  return {
    type: "workflow",
    id: event.id,
    title: event.summary || event.category || `Monitoring event ${event.id}`,
    system: event.category || "Monitoring",
    status: event.severity || urgencyStatus[urgency],
    owner: event.customer_email || "Automation team",
    nextAction: event.summary || "Controleer dit monitoring event.",
    urgency,
    lastUpdated: formatMonitoringDate(event.event_time),
    evidence: event.evidence || event.entity_id || event.status || "monitoring.automation_events"
  };
}

function renderOpenActionsErrorMessage() {
  if (!openActionsErrorMessage) {
    return "";
  }

  return `<div class="live-actions-status">${openActionsErrorMessage}</div>`;
}

function renderLiveActionsError(status) {
  if (status === 401) {
    openActionsErrorMessage = "Live acties niet beschikbaar: niet geautoriseerd";
  } else if (status === 503) {
    openActionsErrorMessage = "Live acties niet beschikbaar: databaseconfiguratie of verbinding";
  } else {
    openActionsErrorMessage = "Live acties niet beschikbaar";
  }

  openActionsSourceLabel = "Statische voorbeelddata";
  liveWorkflowActions = null;
  renderOpenActions();
}

async function loadLiveMonitoringEvents() {
  try {
    const response = await fetch("/.netlify/functions/monitoring-events", {
      credentials: "same-origin"
    });

    if (!response.ok) {
      renderLiveActionsError(response.status);
      return;
    }

    const data = await response.json();

    if (!data.ok || !Array.isArray(data.events)) {
      renderLiveActionsError();
      return;
    }

    liveWorkflowActions = data.events.map(mapMonitoringEventToAction);
    openActionsSourceLabel = "Live data";
    openActionsErrorMessage = "";
    renderOpenActions();
  } catch (error) {
    renderLiveActionsError();
  }
}

function outboundStatusToUrgency(status) {
  const normalizedStatus = String(status || "").toLowerCase();

  if (["failed", "error", "bounced", "rejected"].includes(normalizedStatus)) {
    return "hoog";
  }

  if (["sent", "delivered", "ok"].includes(normalizedStatus)) {
    return "laag";
  }

  return "middel";
}

function mapOutboundMessageToAction(message) {
  const urgency = outboundStatusToUrgency(message.status);
  const entity = [
    message.related_entity_type,
    message.related_entity_id
  ].filter(Boolean).join(": ");
  const evidence = [
    message.provider,
    message.recipient_email,
    entity,
    message.external_link
  ].filter(Boolean).join("; ");

  return {
    type: "workflow",
    id: message.id,
    title: message.subject || message.message_type || `Outbound bericht ${message.id}`,
    system: message.provider || "Outbound",
    status: urgencyStatus[urgency],
    owner: message.recipient_email || "Automation team",
    nextAction: `Status: ${message.status || "onbekend"}; type: ${message.message_type || "onbekend"}`,
    urgency,
    lastUpdated: formatMonitoringDate(message.message_time),
    evidence: evidence || `monitoring.outbound_messages #${message.id}`
  };
}

function renderOutboundMessagesSource() {
  outboundMessagesSource.textContent = outboundMessagesSourceLabel;
}

function renderOutboundMessagesErrorMessage() {
  if (!outboundMessagesErrorMessage) {
    return "";
  }

  return `<li class="live-actions-status"><strong>${outboundMessagesErrorMessage}</strong><span>Statische voorbeelddata blijft zichtbaar.</span></li>`;
}

function renderLiveOutboundMessagesError(status) {
  if (status === 401) {
    outboundMessagesErrorMessage = "Live outbound berichten niet beschikbaar: niet geautoriseerd";
  } else if (status === 503) {
    outboundMessagesErrorMessage = "Live outbound berichten niet beschikbaar: databaseconfiguratie of verbinding";
  } else {
    outboundMessagesErrorMessage = "Live outbound berichten niet beschikbaar";
  }

  outboundMessagesSourceLabel = "Statische voorbeelddata";
  liveOutboundActions = null;
  renderActions();
}

async function loadLiveOutboundMessages() {
  try {
    const response = await fetch("/.netlify/functions/monitoring-outbound-messages", {
      credentials: "same-origin"
    });

    if (!response.ok) {
      renderLiveOutboundMessagesError(response.status);
      return;
    }

    const data = await response.json();

    if (!data.ok || !Array.isArray(data.messages)) {
      renderLiveOutboundMessagesError();
      return;
    }

    liveOutboundActions = data.messages.map(mapOutboundMessageToAction);
    outboundMessagesSourceLabel = "Live data";
    outboundMessagesErrorMessage = "";
    renderActions();
  } catch (error) {
    renderLiveOutboundMessagesError();
  }
}

function normalizeRegistryStatus(status) {
  const normalizedStatus = String(status || "").toLowerCase();

  if (["active", "ok", "green"].includes(normalizedStatus)) {
    return "green";
  }

  if (["paused", "test", "warning", "orange"].includes(normalizedStatus)) {
    return "orange";
  }

  if (["failed", "error", "red", "inactive"].includes(normalizedStatus)) {
    return "red";
  }

  return "orange";
}

function mapRegistryRecordToWorkflow(record) {
  return {
    id: record.id,
    name: record.flow_name || `Registry record ${record.id}`,
    system: record.system || "Monitoring registry",
    category: record.category || "-",
    status: normalizeRegistryStatus(record.status),
    evidence: record.evidence || record.description || "monitoring.automation_registry"
  };
}

function getWorkflowSource() {
  return liveWorkflows || workflows;
}

function renderWorkflowRegistrySource(count) {
  const parts = [`${count} zichtbaar`, workflowRegistrySourceLabel].filter(Boolean);

  document.getElementById("workflow-count").textContent = parts.join(" · ");
}

function renderWorkflowRegistryErrorMessage() {
  if (!workflowRegistryErrorMessage) {
    return "";
  }

  return `<tr><td colspan="5"><div class="live-monitoring-status">${workflowRegistryErrorMessage}</div></td></tr>`;
}

function renderLiveWorkflowRegistryError(status) {
  if (status === 401) {
    workflowRegistryErrorMessage = "Live workflow registry niet beschikbaar: niet geautoriseerd";
  } else if (status === 503) {
    workflowRegistryErrorMessage = "Live workflow registry niet beschikbaar: databaseconfiguratie of verbinding";
  } else {
    workflowRegistryErrorMessage = "Live workflow registry niet beschikbaar";
  }

  workflowRegistrySourceLabel = "Statische voorbeelddata";
  liveWorkflows = null;
  renderFilters();
  renderWorkflows();
}

async function loadLiveMonitoringRegistry() {
  try {
    const response = await fetch("/.netlify/functions/monitoring-registry", {
      credentials: "same-origin"
    });

    if (!response.ok) {
      renderLiveWorkflowRegistryError(response.status);
      return;
    }

    const data = await response.json();

    if (!data.ok || !Array.isArray(data.registry)) {
      renderLiveWorkflowRegistryError();
      return;
    }

    liveWorkflows = data.registry.map(mapRegistryRecordToWorkflow);
    workflowRegistrySourceLabel = "Live data";
    workflowRegistryErrorMessage = "";
    renderFilters();
    renderWorkflows();
  } catch (error) {
    renderLiveWorkflowRegistryError();
  }
}

function escapeHtml(value) {
  return String(value ?? "-").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[character]));
}

function formatMaintenanceValue(value) {
  if (value === null || value === undefined || value === "") {
  return "-";
}
  return escapeHtml(String(value).slice(0, 400));
}

function renderWorkflowMaintenanceTable(tableKey, rows = []) {
  const table = workflowMaintenanceTables[tableKey];

  table.count.textContent = `${rows.length} zichtbaar`;

  if (!rows.length) {
    table.body.innerHTML = `<tr><td colspan="${table.columns.length}"><div class="empty"><strong>Geen data</strong><span>Geen records gevonden voor deze sectie.</span></div></td></tr>`;
    return;
  }

  table.body.innerHTML = rows.map(row => `
    <tr>
      ${table.columns.map(column => `<td>${formatMaintenanceValue(row[column])}</td>`).join("")}
    </tr>
  `).join("");
}

function renderWorkflowMaintenanceTableMessage(message) {
  Object.values(workflowMaintenanceTables).forEach(table => {
    table.count.textContent = "";
    table.body.innerHTML = `<tr><td colspan="${table.columns.length}"><div class="live-monitoring-status">${message}</div></td></tr>`;
  });
}

function renderWorkflowMaintenanceLoading() {
  workflowMaintenanceSource.textContent = "Workflow maintenance laden...";
  workflowMaintenanceSummary.innerHTML = `<div class="live-monitoring-status">Workflow maintenance laden...</div>`;
  renderWorkflowMaintenanceTableMessage("Workflow maintenance laden...");
}

function getWorkflowMaintenanceErrorMessage(status) {
  if (status === 401) {
    return "Workflow maintenance niet beschikbaar: niet geautoriseerd";
  }

  if (status === 503) {
    return "Workflow maintenance niet beschikbaar: databaseconfiguratie of verbinding";
  }

  return "Workflow maintenance niet beschikbaar";
}

function renderWorkflowMaintenanceError(status) {
  const message = getWorkflowMaintenanceErrorMessage(status);

  workflowMaintenanceSource.textContent = "Niet beschikbaar";
  workflowMaintenanceSummary.innerHTML = `<div class="live-monitoring-status">${message}</div>`;
  renderWorkflowMaintenanceTableMessage(message);
}

function isOpenMaintenanceReview(review) {
  return ["open", "needs_followup", "blocked"].includes(
    String(review.review_status || "").toLowerCase()
  );
}

function renderWorkflowMaintenanceSummary(data) {
  const counts = data.counts || {};
  const openReviews = Array.isArray(data.reviews)
    ? data.reviews.filter(isOpenMaintenanceReview).length
    : 0;
  const metrics = [
    [counts.workflow_registry ?? 0, "Workflows"],
    [counts.workflow_connections ?? 0, "Connections"],
    [counts.workflow_code_assets ?? 0, "Code assets"],
    [counts.workflow_runbooks ?? 0, "Runbooks"],
    [openReviews, "Open reviews"]
  ];

  workflowMaintenanceSummary.innerHTML = metrics.map(([value, label]) => `
    <div class="metric">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </div>
  `).join("");
}

function renderWorkflowMaintenance(data) {
  workflowMaintenanceSource.textContent = data.database || data.source || "Live data";
  renderWorkflowMaintenanceSummary(data);
  renderWorkflowMaintenanceTable("workflows", data.workflows || []);
  renderWorkflowMaintenanceTable("connections", data.connections || []);
  renderWorkflowMaintenanceTable("code_assets", data.code_assets || []);
  renderWorkflowMaintenanceTable("runbooks", data.runbooks || []);
  renderWorkflowMaintenanceTable("reviews", data.reviews || []);
  renderWorkflowMaintenanceTable("dependencies", data.dependencies || []);
}

async function loadWorkflowMaintenance() {
  renderWorkflowMaintenanceLoading();

  try {
    const response = await fetch("/.netlify/functions/workflow-maintenance", {
      credentials: "same-origin"
    });

    if (!response.ok) {
      renderWorkflowMaintenanceError(response.status);
      return;
    }

    const data = await response.json();

    if (!data.ok) {
      renderWorkflowMaintenanceError();
      return;
    }

    renderWorkflowMaintenance(data);
  } catch (error) {
    renderWorkflowMaintenanceError();
  }
}

function renderFilters() {
  const systems = [...new Set(getWorkflowSource().map(workflow => workflow.system))].sort((a, b) => a.localeCompare(b, "nl"));
  const currentValue = systemFilter.value;

  systemFilter.innerHTML = `<option value="all">Alle systemen</option>${systems.map(system => `<option value="${system}">${system}</option>`).join("")}`;
  systemFilter.value = systems.includes(currentValue) ? currentValue : "all";
}

function matchesFilters(item) {
  const query = getGeneralQuery();
  const status = statusFilter.value;
  const system = systemFilter.value;
  const extraValues = [
    statusLabel[item.status],
    item.id,
    item.title,
    item.name
  ];

  return matchesSearch(item, query, extraValues) &&
    (status === "all" || item.status === status) &&
    (system === "all" || item.system === system);
}

function renderSignals() {
  const filtered = signalCards.filter(matchesFilters);
  const board = document.getElementById("signal-board");

  if (!filtered.length) {
    board.innerHTML = emptyMessage("Geen dashboardkaarten voor deze filters.", "all");
    return;
  }

  board.innerHTML = filtered.map(card => `
    <article class="signal-card ${card.status}">
      <div>
        <h3>${card.title}</h3>
        <p>${card.detail}</p>
      </div>
      <div class="signal-meta">
        <span class="badge ${card.status}">${statusLabel[card.status]}</span>
        <span class="badge neutral">${card.count} signalen</span>
      </div>
      <p><strong>Bewijs:</strong> ${card.evidence}</p>
      <p><strong>Bron:</strong> ${card.system}</p>
    </article>
  `).join("");
}

function renderWorkflows() {
  const filtered = getWorkflowSource().filter(matchesFilters);
  const tbody = document.getElementById("workflow-table");
  const errorMessage = renderWorkflowRegistryErrorMessage();

  renderWorkflowRegistrySource(filtered.length);

  if (!filtered.length) {
    tbody.innerHTML = `${errorMessage}<tr><td colspan="5">${emptyMessage("Geen workflowregels voor deze filters.", "all")}</td></tr>`;
    return;
  }

  tbody.innerHTML = `${errorMessage}${filtered.map(workflow => `
    <tr>
      <td><strong>${workflow.name}</strong><small>${workflow.id}</small></td>
      <td>${workflow.system}</td>
      <td>${workflow.category}</td>
      <td><span class="badge ${workflow.status}">${statusLabel[workflow.status]}</span></td>
      <td>${workflow.evidence}</td>
    </tr>
  `).join("")}`;
}

function renderActions() {
  const actionSource = liveOutboundActions || workflowActions;
  const filtered = actionSource
    .map(action => ({ ...action, type: "workflow" }))
    .filter(action => matchesWorkflowActionFilters(action) && matchesActionControls(action));
  const errorMessage = renderOutboundMessagesErrorMessage();

  renderOutboundMessagesSource();

  if (!filtered.length) {
    document.getElementById("action-list").innerHTML = `${errorMessage}<li><strong>Geen audittaken</strong><span>Geen audittaken voor deze filters. Actieve filters: ${getActiveFilterSummary("all")}.</span></li>`;
    return;
  }

  document.getElementById("action-list").innerHTML = `${errorMessage}${filtered.map(action => `
    <li><strong>${action.title}</strong><span>${action.nextAction}</span></li>
  `).join("")}`;
}

function renderStudentSummary() {
  const uploads = studentData.uploads;
  const registrations = studentData.registrations;
  const openFollowUps = [...uploads, ...registrations].filter(hasOpenFollowUp).length;
  const missingScreenshots = uploads.filter(upload => upload.screenshot === "Ontbreekt").length;
  const approvedUploads = uploads.filter(upload => upload.status === "goedgekeurd").length;
  const blockedItems = [...uploads, ...registrations].filter(item => ["afgewezen", "meer_info_nodig"].includes(item.status)).length;
  const metrics = [
    [openFollowUps, "openstaande opvolgacties"],
    [missingScreenshots, "ontbrekende screenshots"],
    [approvedUploads, "goedgekeurde uploads"],
    [blockedItems, "geblokkeerd of extra info"]
  ];

  document.getElementById("student-summary").innerHTML = metrics.map(([value, label]) => `
    <div class="metric">
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `).join("");
}

function hasOpenFollowUp(item) {
  return !item.followUp.toLowerCase().includes("geen openstaande actie");
}

function getStudentActionMeta(item) {
  if (item.urgency && item.lastUpdated && item.owner) {
    return item;
  }

  const fallbackUrgency = {
    afgewezen: "hoog",
    meer_info_nodig: "hoog",
    nieuw: "middel",
    goedgekeurd: "laag"
  };

  return {
    ...item,
    owner: item.owner || "Academy team",
    nextAction: item.nextAction || item.followUp,
    urgency: item.urgency || fallbackUrgency[item.status] || "middel",
    lastUpdated: item.lastUpdated || item.registeredAt || "2026-06-01",
    evidence: item.evidence || item.uploadType || item.program || item.id
  };
}

function renderLessonFilter() {
  const currentValue = lessonFilter.value;
  const lessons = [...new Set(studentData.uploads.map(upload => upload.lesson))].sort((a, b) => a.localeCompare(b, "nl"));
  lessonFilter.innerHTML = `<option value="all">Alle lessen</option>${lessons.map(lesson => `<option value="${lesson}">${lesson}</option>`).join("")}`;
  lessonFilter.value = lessons.includes(currentValue) ? currentValue : "all";
}

function matchesStudentFilters(item) {
  const query = getStudentQuery();
  const generalQuery = getGeneralQuery();
  const status = studentStatusFilter.value;
  const lesson = lessonFilter.value;
  const extraValues = [
    item.id,
    item.studentName,
    item.uploadType,
    item.owner,
    item.nextAction,
    item.followUp,
    item.evidence,
    studentStatusLabel[item.status],
    urgencyLabel[item.urgency],
    urgencyStatus[item.urgency]
  ];

  return matchesSearch(item, generalQuery, extraValues) &&
    matchesSearch(item, query, extraValues) &&
    (status === "all" || item.status === status) &&
    (lesson === "all" || item.lesson === lesson);
}

function matchesRegistrationFilters(item) {
  const query = getStudentQuery();
  const generalQuery = getGeneralQuery();
  const status = studentStatusFilter.value;
  const extraValues = [
    item.id,
    item.studentName,
    item.program,
    item.owner,
    item.nextAction,
    item.followUp,
    item.evidence,
    studentStatusLabel[item.status],
    urgencyLabel[item.urgency],
    urgencyStatus[item.urgency]
  ];

  return matchesSearch(item, generalQuery, extraValues) &&
    matchesSearch(item, query, extraValues) &&
    (status === "all" || item.status === status);
}

function renderStudentSignal(status) {
  const [label, tone] = studentSignal[status] || ["Controleren", "neutral"];
  return `<span class="badge ${tone}">${label}</span>`;
}

function renderUrgencyBadge(urgency) {
  return `<span class="badge urgency-${urgency}">${urgencyLabel[urgency] || "Middel"}</span>`;
}

function formatActionCount(count) {
  return `${count} ${count === 1 ? "actie" : "acties"}`;
}

function renderActionItems(items, emptyText) {
  if (!items.length) {
    return `<li><strong>Geen open acties</strong><span>${emptyText} Actieve filters: ${getActiveFilterSummary("all")}.</span></li>`;
  }

  return items.map(item => `
    <li class="action-card urgency-${item.urgency}">
      <div class="action-card-top">
        <strong>${item.title}</strong>
        <span class="action-card-badges">
          <span class="badge neutral">${actionTypeLabel[item.type]}</span>
          ${renderUrgencyBadge(item.urgency)}
        </span>
      </div>
      <span><strong>Eigenaar:</strong> ${item.owner}</span>
      <span><strong>Eerstvolgende stap:</strong> ${item.nextAction}</span>
      <span><strong>Laatste update:</strong> ${item.lastUpdated}</span>
      <span><strong>Bron/bewijs:</strong> ${item.evidence}</span>
    </li>
  `).join("");
}

function matchesWorkflowActionFilters(item) {
  const query = getGeneralQuery();
  const system = systemFilter.value;
  const extraValues = [
    item.type,
    actionTypeLabel[item.type],
    statusLabel[item.status],
    urgencyLabel[item.urgency],
    urgencyStatus[item.urgency],
    item.evidence,
    item.nextAction,
    item.owner
  ];

  return matchesSearch(item, query, extraValues) &&
    (system === "all" || item.system === system);
}

function matchesActionSearch(item) {
  const extraValues = [
    item.type,
    actionTypeLabel[item.type],
    statusLabel[item.status],
    urgencyLabel[item.urgency],
    urgencyStatus[item.urgency],
    item.owner,
    item.nextAction,
    item.evidence,
    item.id
  ];

  return matchesSearch(item, getGeneralQuery(), extraValues);
}

function matchesActionType(item) {
  return actionTypeFilter.value === "all" || item.type === actionTypeFilter.value;
}

function matchesUrgency(item) {
  return urgencyFilter.value === "all" || item.urgency === urgencyFilter.value;
}

function matchesActionStatus(item) {
  const status = statusFilter.value;

  if (status === "all") {
    return true;
  }

  return (urgencyStatus[item.urgency] || item.status) === status;
}

function matchesActionControls(item) {
  return matchesActionType(item) && matchesUrgency(item) && matchesActionStatus(item);
}

function shouldShowToday(item) {
  return item.urgency === "hoog" || item.lastUpdated === "2026-06-01";
}

function sortActions(items) {
  const urgencyRank = { hoog: 0, middel: 1, laag: 2 };
  return [...items].sort((a, b) => {
    const urgencyDelta = (urgencyRank[a.urgency] ?? 3) - (urgencyRank[b.urgency] ?? 3);

    if (urgencyDelta) {
      return urgencyDelta;
    }

    return b.lastUpdated.localeCompare(a.lastUpdated);
  });
}

function getOpenActionGroups() {
  const uploadActions = studentData.uploads
    .filter(upload => hasOpenFollowUp(upload) && matchesStudentFilters(upload))
    .map(upload => {
      const meta = getStudentActionMeta(upload);
      return {
        type: "student-upload",
        id: upload.id,
        title: `${upload.studentName} - ${upload.lesson}`,
        owner: meta.owner,
        nextAction: meta.nextAction,
        urgency: meta.urgency,
        status: urgencyStatus[meta.urgency],
        lastUpdated: meta.lastUpdated,
        evidence: meta.evidence || `${upload.uploadType}; screenshot ${upload.screenshot.toLowerCase()}`
      };
    })
    .filter(matchesActionSearch)
    .filter(matchesActionControls);
  const onboardingActions = studentData.registrations
    .filter(registration => hasOpenFollowUp(registration) && matchesRegistrationFilters(registration))
    .map(registration => {
      const meta = getStudentActionMeta(registration);
      return {
        type: "onboarding",
        id: registration.id,
        title: `${registration.studentName} - ${registration.program}`,
        owner: meta.owner,
        nextAction: meta.nextAction,
        urgency: meta.urgency,
        status: urgencyStatus[meta.urgency],
        lastUpdated: meta.lastUpdated,
        evidence: meta.evidence || `${registration.program}; ${registration.id}`
      };
    })
    .filter(matchesActionSearch)
    .filter(matchesActionControls);
  const workflowActionSource = liveWorkflowActions || workflowActions;
  const filteredWorkflowActions = workflowActionSource
    .filter(matchesWorkflowActionFilters)
    .map(action => ({ ...action, type: "workflow" }))
    .filter(matchesActionControls);

  return {
    uploadActions: sortActions(uploadActions),
    onboardingActions: sortActions(onboardingActions),
    workflowActions: sortActions(filteredWorkflowActions)
  };
}

function renderOpenActions() {
  const { uploadActions, onboardingActions, workflowActions: filteredWorkflowActions } = getOpenActionGroups();
  const allActions = [...uploadActions, ...onboardingActions, ...filteredWorkflowActions];
  const todayActions = sortActions(allActions.filter(shouldShowToday)).slice(0, 5);
  const totalActions = allActions.length;

  document.getElementById("open-action-count").dataset.count = `${totalActions} zichtbaar`;
  renderOpenActionsSource();
  document.getElementById("today-action-count").textContent = formatActionCount(todayActions.length);
  document.getElementById("student-upload-action-count").textContent = formatActionCount(uploadActions.length);
  document.getElementById("onboarding-action-count").textContent = formatActionCount(onboardingActions.length);
  document.getElementById("workflow-action-count").textContent = formatActionCount(filteredWorkflowActions.length);
  document.getElementById("today-actions").innerHTML = `${renderOpenActionsErrorMessage()}${renderActionItems(todayActions, "Geen open acties voor deze filters.")}`;
  document.getElementById("student-upload-actions").innerHTML = renderActionItems(uploadActions, "Geen open acties voor deze filters.");
  document.getElementById("onboarding-actions").innerHTML = renderActionItems(onboardingActions, "Geen open acties voor deze filters.");
  document.getElementById("workflow-actions").innerHTML = renderActionItems(filteredWorkflowActions, "Geen open acties voor deze filters.");
}

function renderUploads() {
  const filtered = studentData.uploads.filter(matchesStudentFilters);
  const tbody = document.getElementById("upload-table");
  document.getElementById("upload-count").textContent = `${filtered.length} zichtbaar`;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7">${emptyMessage("Geen student uploads voor deze filters.", "students")}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(upload => `
    <tr class="student-row student-${upload.status}">
      <td><strong>${upload.studentName}</strong><small>${upload.id}</small></td>
      <td>${upload.lesson}</td>
      <td>${upload.uploadType}<small>Screenshot: ${upload.screenshot}</small></td>
      <td><span class="badge student-${upload.status}">${studentStatusLabel[upload.status]}</span></td>
      <td><strong>${upload.score}</strong><small>${upload.assessment}</small></td>
      <td>${renderStudentSignal(upload.status)}</td>
      <td>${upload.followUp}</td>
    </tr>
  `).join("");
}

function renderRegistrations() {
  const registrations = studentData.registrations.filter(matchesRegistrationFilters);
  document.getElementById("registration-count").textContent = `${registrations.length} zichtbaar`;

  if (!registrations.length) {
    document.getElementById("registration-list").innerHTML = `<li><strong>Geen registraties</strong><span>Geen onboardingregistraties voor deze filters. Actieve filters: ${getActiveFilterSummary("students")}.</span></li>`;
    return;
  }

  document.getElementById("registration-list").innerHTML = registrations.map(registration => `
    <li class="student-row student-${registration.status}">
      <strong>${registration.studentName}</strong>
      <span>${registration.program} &middot; ${registration.registeredAt} &middot; ${registration.owner}</span>
      <span><span class="badge student-${registration.status}">${studentStatusLabel[registration.status]}</span></span>
      <span>${renderStudentSignal(registration.status)}</span>
      <span>${registration.followUp}</span>
    </li>
  `).join("");
}

function renderStudentModule() {
  renderStudentSummary();
  renderLessonFilter();
  renderUploads();
  renderRegistrations();
  renderOpenActions();
}

async function loadStudentData() {
  try {
    const response = await fetch("student-uploads.json");

    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }

    studentData = await response.json();
    renderStudentModule();
  } catch (error) {
    document.getElementById("student-data-source").textContent = "Voorbeelddata niet geladen";
    document.getElementById("student-summary").innerHTML = `<div class="empty">Het JSON-bestand met student uploads kon niet worden geladen.</div>`;
    document.getElementById("upload-table").innerHTML = `<tr><td colspan="6" class="empty">Geen uploaddata beschikbaar.</td></tr>`;
    document.getElementById("registration-list").innerHTML = `<li><strong>Geen registraties</strong><span>Controleer student-uploads.json.</span></li>`;
  }
}

function renderAll() {
  renderSignals();
  renderWorkflows();
  renderActions();
  renderUploads();
  renderRegistrations();
  renderOpenActions();
}

function resetFilters() {
  searchInput.value = "";
  statusFilter.value = "all";
  systemFilter.value = "all";
  actionTypeFilter.value = "all";
  urgencyFilter.value = "all";
  studentSearchInput.value = "";
  studentStatusFilter.value = "all";
  lessonFilter.value = "all";
  renderAll();
}

renderSummary();
renderFilters();
renderActions();
renderAll();
loadLiveMonitoringSummary();
loadLiveMonitoringEvents();
loadLiveOutboundMessages();
loadLiveMonitoringRegistry();
loadWorkflowMaintenance();
loadStudentData();

[searchInput, statusFilter, systemFilter].forEach(control => {
  control.addEventListener("input", renderAll);
});

[studentSearchInput, studentStatusFilter, lessonFilter].forEach(control => {
  control.addEventListener("input", () => {
    renderUploads();
    renderRegistrations();
    renderOpenActions();
  });
});

[actionTypeFilter, urgencyFilter].forEach(control => {
  control.addEventListener("input", renderOpenActions);
});

resetFiltersButton.addEventListener("click", resetFilters);
