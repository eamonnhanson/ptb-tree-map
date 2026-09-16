export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  for (const [name, value] of Object.entries(options.attributes || {})) node.setAttribute(name, String(value));
  for (const child of children) if (child) node.append(child);
  return node;
}

export function formatTime(value) {
  if (!value) return "No evidence";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Invalid timestamp";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(date);
}

export function empty(text) {
  return element("p", { className: "notice neutral", text });
}

export function renderStatus(state) {
  return element("span", { className: "status", text: state || "UNKNOWN", attributes: { "data-state": state || "UNKNOWN" } });
}

export function workflowCard(workflow, onOpen) {
  const health = workflow.health || { state: "UNKNOWN", reason: "Health evidence unavailable", evidence: {} };
  const layers = [
    ["Configured", health.evidence?.configured], ["Implemented", health.evidence?.implemented],
    ["Verified", health.evidence?.verified], ["Healthy", health.state === "GREEN"]
  ].map(([label, on]) => element("span", { className: `layer${on ? " on" : ""}`, text: label }));
  const button = element("button", { className: "link", text: "View evidence", attributes: { type: "button" } });
  button.addEventListener("click", () => onOpen(workflow.workflow_id));
  return element("article", { className: "card", attributes: { "data-state": health.state } }, [
    renderStatus(health.state), element("h3", { text: workflow.workflow_name || workflow.workflow_id }),
    element("p", { className: "reason", text: health.reason }), element("div", { className: "layers" }, layers),
    element("p", { className: "meta", text: `Last success: ${formatTime(health.evidence?.last_success_at)}` }), button
  ]);
}

export function listItem(item) {
  return element("article", { className: "list-item" }, [
    renderStatus(String(item.severity).toLowerCase() === "red" ? "RED" : "ORANGE"),
    element("p", { className: "detail", text: item.detail || item.summary || "Operational item" }),
    element("p", { className: "meta", text: `${item.workflow || item.source_system || item.source || "Unknown source"} · ${formatTime(item.occurred_at || item.event_time)}` }),
    item.evidence ? element("p", { className: "meta", text: item.evidence }) : null
  ]);
}

export function systemCard(item) {
  return element("article", { className: "system" }, [element("strong", { text: item.system }), renderStatus(item.state),
    element("p", { className: "reason", text: item.reason }), element("p", { className: "meta", text: formatTime(item.last_event_at) })]);
}
