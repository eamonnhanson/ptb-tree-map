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

const actions = [
  ["Voeg final logging toe aan Zapier workflows", "Nodig voor groen/oranje/rood status per workflow."],
  ["Maak Zoho Mail folder/tag bewijs expliciet", "De huidige inventaris gebruikt samples waar live folderpaden nog ontbreken."],
  ["Koppel Shopify productdekking aan orderbewijs", "SKU's bestaan, maar niet elk product heeft volledig workflowbewijs."],
  ["Verifieer Chargebee plan-to-item mapping", "Abonnementen blijven oranje zolang allocatie en outbound bewijs niet matchen."],
  ["Leg manual follow-up resolved status vast", "Zonder afhandelmarker blijft opvolging operationeel onduidelijk."]
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

const searchInput = document.getElementById("search");
const statusFilter = document.getElementById("status-filter");
const systemFilter = document.getElementById("system-filter");
const studentSearchInput = document.getElementById("student-search");
const studentStatusFilter = document.getElementById("student-status-filter");
const lessonFilter = document.getElementById("lesson-filter");

let studentData = {
  registrations: [],
  uploads: []
};

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

function renderFilters() {
  const systems = [...new Set(workflows.map(workflow => workflow.system))].sort((a, b) => a.localeCompare(b, "nl"));
  systemFilter.insertAdjacentHTML("beforeend", systems.map(system => `<option value="${system}">${system}</option>`).join(""));
}

function matchesFilters(item) {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const system = systemFilter.value;
  const haystack = Object.values(item).join(" ").toLowerCase();

  return (!query || haystack.includes(query)) &&
    (status === "all" || item.status === status) &&
    (system === "all" || item.system === system);
}

function renderSignals() {
  const filtered = signalCards.filter(matchesFilters);
  const board = document.getElementById("signal-board");

  if (!filtered.length) {
    board.innerHTML = `<div class="empty">Geen dashboardkaarten voor deze filters.</div>`;
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
  const filtered = workflows.filter(matchesFilters);
  const tbody = document.getElementById("workflow-table");
  document.getElementById("workflow-count").textContent = `${filtered.length} zichtbaar`;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Geen workflows voor deze filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(workflow => `
    <tr>
      <td><strong>${workflow.name}</strong><small>${workflow.id}</small></td>
      <td>${workflow.system}</td>
      <td>${workflow.category}</td>
      <td><span class="badge ${workflow.status}">${statusLabel[workflow.status]}</span></td>
      <td>${workflow.evidence}</td>
    </tr>
  `).join("");
}

function renderActions() {
  document.getElementById("action-list").innerHTML = actions.map(([title, body]) => `
    <li><strong>${title}</strong><span>${body}</span></li>
  `).join("");
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

function renderLessonFilter() {
  const currentValue = lessonFilter.value;
  const lessons = [...new Set(studentData.uploads.map(upload => upload.lesson))].sort((a, b) => a.localeCompare(b, "nl"));
  lessonFilter.innerHTML = `<option value="all">Alle lessen</option>${lessons.map(lesson => `<option value="${lesson}">${lesson}</option>`).join("")}`;
  lessonFilter.value = lessons.includes(currentValue) ? currentValue : "all";
}

function matchesStudentFilters(item) {
  const query = studentSearchInput.value.trim().toLowerCase();
  const status = studentStatusFilter.value;
  const lesson = lessonFilter.value;
  const haystack = Object.values(item).join(" ").toLowerCase();

  return (!query || haystack.includes(query)) &&
    (status === "all" || item.status === status) &&
    (lesson === "all" || item.lesson === lesson);
}

function matchesRegistrationFilters(item) {
  const query = studentSearchInput.value.trim().toLowerCase();
  const status = studentStatusFilter.value;
  const haystack = Object.values(item).join(" ").toLowerCase();

  return (!query || haystack.includes(query)) &&
    (status === "all" || item.status === status);
}

function renderStudentSignal(status) {
  const [label, tone] = studentSignal[status] || ["Controleren", "neutral"];
  return `<span class="badge ${tone}">${label}</span>`;
}

function renderUploads() {
  const filtered = studentData.uploads.filter(matchesStudentFilters);
  const tbody = document.getElementById("upload-table");
  document.getElementById("upload-count").textContent = `${filtered.length} zichtbaar`;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Geen student uploads voor deze filters.</td></tr>`;
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
    document.getElementById("registration-list").innerHTML = `<li><strong>Geen registraties</strong><span>Geen onboardingregistraties voor deze filters.</span></li>`;
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
}

renderSummary();
renderFilters();
renderActions();
renderAll();
loadStudentData();

[searchInput, statusFilter, systemFilter].forEach(control => {
  control.addEventListener("input", renderAll);
});

[studentSearchInput, studentStatusFilter, lessonFilter].forEach(control => {
  control.addEventListener("input", () => {
    renderUploads();
    renderRegistrations();
  });
});
