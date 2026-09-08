import { clear, element, empty, formatTime, listItem, systemCard, workflowCard, renderStatus } from "./view.js";

const state = document.querySelector("#page-state");
const content = document.querySelector("#content");
const dialog = document.querySelector("#workflow-dialog");
const detail = document.querySelector("#workflow-detail");

async function request(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.error || "Monitoring data unavailable");
  return body;
}

function renderCollection(selector, rows, renderer, emptyText) {
  const target = document.querySelector(selector);
  clear(target);
  if (!rows?.length) target.append(empty(emptyText));
  else rows.forEach((row) => target.append(renderer(row)));
}

export async function loadOverview() {
  state.hidden = false;
  state.className = "notice loading";
  state.textContent = "Loading operational evidence…";
  content.hidden = true;
  try {
    const body = await request("/api/overview");
    const overview = body.overview;
    renderCollection("#workflows", overview.workflows?.rows, (row) => workflowCard(row, openWorkflow), "Workflow registry contains no critical workflows.");
    renderCollection("#actions", overview.actions?.rows, listItem, "No supported open actions were returned.");
    renderCollection("#failures", overview.recent_failures, listItem, "No recent known failures were returned.");
    renderCollection("#systems", overview.systems, systemCard, "No system evidence was returned.");
    const missing = overview.workflows?.missing_registry_ids || [];
    const missingNode = document.querySelector("#missing-workflows");
    missingNode.hidden = missing.length === 0;
    missingNode.textContent = missing.length ? `Workflow registry unavailable for: ${missing.join(", ")}` : "";
    document.querySelector("#updated").textContent = `Evidence retrieved ${formatTime(body.generated_at)}`;
    state.hidden = true;
    content.hidden = false;
  } catch (error) {
    state.className = "notice error";
    state.textContent = error.message || "Monitoring data unavailable";
    document.querySelector("#updated").textContent = "Runtime health unknown";
  }
}

async function openWorkflow(id) {
  clear(detail);
  detail.append(element("p", { text: "Loading workflow evidence…" }));
  dialog.showModal();
  try {
    const body = await request(`/api/workflows/${encodeURIComponent(id)}`);
    renderDetail(body.detail);
  } catch (error) {
    clear(detail);
    detail.append(element("p", { className: "notice error", text: error.message }));
  }
}

function rowsSection(title, collection, mapRow) {
  const rows = collection?.rows || [];
  const section = element("section", { className: "detail-section" }, [element("h3", { text: title })]);
  if (!rows.length) section.append(empty(`No ${title.toLowerCase()} evidence.`));
  else rows.forEach((row) => section.append(mapRow(row)));
  if (collection?.truncated) section.append(element("p", { className: "notice neutral", text: `Results truncated at ${collection.limit}.` }));
  return section;
}

function renderDetail(data) {
  const workflow = data.workflow;
  clear(detail);
  detail.append(renderStatus(workflow.health?.state), element("h2", { text: workflow.workflow_name || workflow.workflow_id, attributes: { id: "dialog-title" } }),
    element("p", { className: "reason", text: workflow.health?.reason }),
    element("p", { className: "meta", text: `ID: ${workflow.workflow_id} · Owner: ${workflow.owner_name || "Not recorded"}` }),
    rowsSection("Dependencies", data.dependencies, (row) => element("div", { className: "detail-row" }, [
      element("p", { text: `${row.dependency_order ?? "–"}. ${row.action_summary || row.dependency_type}` }),
      element("p", { className: "meta", text: `${row.source_system || "Unknown"} → ${row.target_system || "Unknown"} · Evidence: ${row.evidence_source || "Not recorded"}` })
    ])),
    rowsSection("Implementation references", data.implementation?.code_assets, (row) => element("div", { className: "detail-row" }, [
      element("code", { text: row.file_path }), element("p", { className: "meta", text: `${row.status || "Unknown"} · ${row.review_status || "Not reviewed"}` })
    ])),
    rowsSection("Verification", data.verification, (row) => element("div", { className: "detail-row" }, [
      element("p", { text: `${row.review_type || "Review"}: ${row.review_status || "Unknown"}` }),
      element("p", { className: "meta", text: `${formatTime(row.reviewed_at)} · ${row.evidence_source || "No evidence source"}` })
    ])),
    rowsSection("Recent runtime events", data.runtime, (row) => element("div", { className: "detail-row" }, [
      element("p", { text: row.summary || row.status || "Runtime event" }),
      element("p", { className: "meta", text: `${formatTime(row.event_time)} · ${row.source_system || "Unknown source"}` })
    ]))
  );
}

if (typeof document !== "undefined" && document.querySelector("#app")) loadOverview();
