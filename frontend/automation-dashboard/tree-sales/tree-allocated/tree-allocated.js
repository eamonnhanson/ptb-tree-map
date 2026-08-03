const form = document.getElementById("filters");
const tbody = document.getElementById("orders");
const state = document.getElementById("state");
const tableWrap = document.getElementById("table-wrap");
const summary = document.getElementById("summary");
let page = 1;
let debounce;

const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const formatDate = value => value ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Niet beschikbaar";
const badge = (tone, icon, text) => `<span class="badge ${tone}"><span aria-hidden="true">${icon}</span> ${escapeHtml(text)}</span>`;
const sourceLabel = value => value === "available" ? "beschikbaar" : value === "connected_no_evidence" ? "gekoppeld, geen bewijs voor deze selectie" : value === "not_configured" ? "niet gekoppeld" : "tijdelijk niet bereikbaar";

function renderDetail(order, links) {
  const trees = order.trees || [];
  const shopifyEvidence = order.shopify_source_available;
  const creatorEvidence = order.creator_source_available;
  const steps = [
    ["Shopify-bestelling ontvangen", "Shopify", shopifyEvidence ? "Bewezen door monitoringevent" : "Bron niet gekoppeld"], ["Product en SKU gecontroleerd", "Shopify/Zapier", shopifyEvidence ? "Bewezen door monitoringevent" : "Bron niet gekoppeld"],
    ["Gebruiker aangemaakt of gevonden", "PostgreSQL", order.user_id ? "Bewezen door brondata" : "Niet geregistreerd"], ["Bomen atomair toegewezen", "PostgreSQL", trees.length ? "Afgeleid uit eindresultaat" : "Niet geregistreerd"],
    ["Boomgegevens voor Zoho voorbereid", "Zapier/Zoho Creator", creatorEvidence ? "Niet geregistreerd" : "Bron niet gekoppeld"], ["Besteld en toegewezen aantal vergeleken", "Shopify/PostgreSQL", shopifyEvidence ? "Niet geregistreerd" : "Bron niet gekoppeld"],
    ["Toewijzingsdatum vastgesteld", "PostgreSQL", trees.some(tree => tree.claimed_at) ? "Bewezen door brondata" : "Niet geregistreerd"], ["Creator-record aangemaakt", "Zoho Creator", creatorEvidence ? "Bewezen door monitoringevent" : "Bron niet gekoppeld"],
    ["Gift-claim e-mail aangeboden", "E-mailactie", order.email_submission_status === "submitted" ? "Bewezen door gift_claim_email_submitted" : order.email_submission_status === "failed" ? "Mislukking geregistreerd" : "Niet geregistreerd"],
    ["Certificaat gegenereerd", "Niet gemonitord", "Niet gemonitord"], ["Certificaatmail aangeboden", "Niet gemonitord", "Niet gemonitord"]
  ];
  const external = [[links?.zap, "Open Zap C"], [links?.history, "Bekijk Zap History"]].filter(([url]) => url).map(([url, text]) => `<a class="secondary-action" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`).join("");
  return `<tr class="order-detail"><td colspan="11"><div class="order-detail-grid"><section><h3>Verkoopgegevens</h3><dl class="data-list"><dt>Klant</dt><dd>${escapeHtml(order.customer_name || "Onbekend")}</dd><dt>E-mail</dt><dd>${escapeHtml(order.email || "Ontbreekt")}</dd><dt>Shopify order-ID</dt><dd>${escapeHtml(order.shopify_order_id)}</dd><dt>Shopify orderdatum</dt><dd>${formatDate(order.order_date)}</dd><dt>Toewijzing waargenomen op</dt><dd>${formatDate(order.allocation_observed_at)}</dd><dt>SKU</dt><dd>${escapeHtml(order.sku || "Niet beschikbaar")}</dd><dt>Besteld aantal</dt><dd>${order.ordered_count ?? "Niet beschikbaar"}</dd><dt>Taal</dt><dd>${escapeHtml(order.language || "Niet beschikbaar")}</dd><dt>PostgreSQL user-ID</dt><dd>${order.user_id ?? "Ontbreekt"}</dd><dt>Creator record-ID</dt><dd>${order.creator_record_id ?? "Niet beschikbaar"}</dd></dl>${external}</section>
  <section><h3>Toegewezen bomen</h3>${trees.length ? `<div class="tree-list">${trees.map(tree => `<article><strong>${escapeHtml(tree.tree_code || `Record ${tree.id}`)}</strong><span>${escapeHtml(tree.tree_type || "Onbekend type")} · record ${escapeHtml(tree.id)}</span><span>Coördinaten: ${escapeHtml(tree.lat ?? "–")}, ${escapeHtml(tree.long ?? "–")}</span><span>Plantdatum: ${escapeHtml(tree.planted_date || "–")} · claimed_at: ${escapeHtml(tree.claimed_at || "–")}</span><span>User ${escapeHtml(tree.user_id || "–")} · order ${escapeHtml(tree.order_id || "–")}</span></article>`).join("")}</div>` : "<p>Geen boomrecords gevonden.</p>"}</section>
  <section><h3>Procesverloop</h3><ol class="process-list">${steps.map(([name, source, proof]) => `<li><strong>${name}</strong><span>${source} · ${proof}</span></li>`).join("")}</ol></section></div></td></tr>`;
}

function renderOrder(order, index, links) {
  const status = order.final_status;
  const tone = status.status === "completed" ? "green" : status.status === "processing" ? "orange" : status.status === "unverifiable" ? "neutral" : "red";
  const icon = status.status === "completed" ? "✓" : status.status === "processing" ? "◷" : status.status === "unverifiable" ? "i" : "!";
  const reason = status.reasons?.[0] || "Alle controles aantoonbaar compleet";
  return `<tr><td><strong>${escapeHtml(order.customer_name || "Onbekende klant")}</strong><small>${escapeHtml(order.email || "E-mail ontbreekt")}</small></td><td><strong>${escapeHtml(order.shopify_order_id)}</strong></td><td>${formatDate(order.order_date)}<small>Toewijzing waargenomen op: ${formatDate(order.allocation_observed_at)}</small></td><td>${escapeHtml(order.sku || "–")}</td><td><strong>${order.allocated_count} van ${order.ordered_count ?? "?"}</strong></td><td>${badge(order.allocated_count ? "green" : "red", order.allocated_count ? "✓" : "!", order.allocated_count ? "Toegewezen" : "Ontbreekt")}</td><td>${order.creator_record_count === 1 ? badge("green", "✓", "1 GiftClaims-record") : order.creator_source_available ? badge("red", "!", `${order.creator_record_count} GiftClaims-records`) : badge("neutral", "?", "Bron niet gekoppeld")}</td><td>${badge("neutral", "i", "Niet gemonitord")}</td><td>${order.email_submission_status === "submitted" ? badge("green", "✓", "Aangeboden voor verzending") : order.email_submission_status === "failed" ? badge("red", "!", "Mislukt") : badge("neutral", "?", "Niet geregistreerd")}</td><td>${badge(tone, icon, status.label)}<small>${escapeHtml(reason)}</small></td><td><button class="detail-toggle" type="button" aria-expanded="false" aria-controls="detail-${index}">Details</button></td></tr>${renderDetail(order, links).replace('<tr class="order-detail"', `<tr id="detail-${index}" class="order-detail" hidden`)} `;
}

function renderOperationalChecks(order, row) {
  row.cells[0].insertAdjacentHTML("beforeend", `<small>${order.user_id ? badge("green", "✓", "Gelukt") : badge("red", "!", "Ontbreekt")}</small>`);
  row.cells[1].insertAdjacentHTML("beforeend", `<small>${order.shopify_source_available ? badge("green", "✓", "Gelukt") : badge("neutral", "?", "Niet gecontroleerd")}</small>`);
  const allocationMatches = order.ordered_count != null && order.allocated_count === order.ordered_count;
  row.cells[5].innerHTML = allocationMatches ? badge("green", "✓", "Gelukt") : badge("red", "!", order.allocated_count ? "Afwijking" : "Ontbreekt");
  row.cells[6].innerHTML = order.creator_record_count === 1 ? badge("green", "✓", "Gelukt") : badge("red", "!", order.creator_record_count == null ? "Ontbreekt" : "Afwijking");
  row.cells[8].innerHTML = order.email_submission_status === "submitted" ? badge("green", "✓", "Gelukt") : badge("red", "!", order.email_submission_status == null ? "Ontbreekt" : "Afwijking");
}

async function load() {
  state.hidden = false; state.innerHTML = "Gegevens laden…"; tableWrap.hidden = true;
  const params = new URLSearchParams(new FormData(form)); params.set("page", page); params.set("page_size", "25");
  for (const [key, value] of [...params]) if (!value) params.delete(key);
  try {
    const response = await fetch(`/.netlify/functions/tree-allocated?${params}`, { credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Status ${response.status}`);
    document.getElementById("last-updated").textContent = `Laatst vernieuwd: ${formatDate(data.generated_at)}`;
    document.getElementById("period-label").textContent = data.period.key === "all" ? "Periode: alle perioden" : `Periode: ${data.period.from} t/m ${data.period.to}`;
    document.getElementById("source-banner").innerHTML = `<strong>Bronstatus:</strong> PostgreSQL ${sourceLabel(data.source_status.postgresql)} · Shopify ${sourceLabel(data.source_status.shopify)} · Zoho Creator ${sourceLabel(data.source_status.creator)}${data.limitations?.length ? `<span>${escapeHtml(data.limitations.join(" "))}</span>` : ""}`;
    summary.innerHTML = [[data.counts.new,"Nieuwe boomverkopen"],[data.counts.completed,"Volledig"],[data.counts.processing,"In verwerking"],[data.counts.unverifiable,"Niet volledig controleerbaar"],[data.counts.action_required,"Actie nodig"]].map(([value,label]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join("");
    document.getElementById("result-count").textContent = `${data.pagination.total} orders`;
    if (!data.orders.length) { state.innerHTML = "Geen orders gevonden voor deze filters. Pas de periode of filters aan."; return; }
    tbody.innerHTML = data.orders.map((order,index) => renderOrder(order,index,data.workflow_links)).join("");
    [...tbody.children].filter(row => !row.classList.contains("order-detail")).forEach((row, index) => renderOperationalChecks(data.orders[index], row));
    state.hidden = true; tableWrap.hidden = false;
    document.querySelectorAll(".detail-toggle").forEach(button => button.addEventListener("click", () => { const detail = document.getElementById(button.getAttribute("aria-controls")); const open = button.getAttribute("aria-expanded") === "true"; button.setAttribute("aria-expanded", String(!open)); button.textContent = open ? "Details" : "Sluiten"; detail.hidden = open; }));
    const pages = Math.max(1, Math.ceil(data.pagination.total / data.pagination.page_size)); document.getElementById("pagination").hidden = pages === 1; document.getElementById("page-label").textContent = `Pagina ${page} van ${pages}`; document.getElementById("previous").disabled = page === 1; document.getElementById("next").disabled = page >= pages;
  } catch (error) { state.innerHTML = `<strong>Gegevens konden niet worden geladen.</strong><span>${escapeHtml(error.message)}</span><button class="secondary-action" id="retry" type="button">Opnieuw proberen</button>`; document.getElementById("retry").addEventListener("click", load); document.getElementById("source-banner").textContent = "De bronbeschikbaarheid kon niet worden vastgesteld."; }
}

form.addEventListener("input", () => { clearTimeout(debounce); page = 1; debounce = setTimeout(load, 300); });
form.addEventListener("reset", () => setTimeout(() => { page = 1; document.querySelectorAll(".custom-date").forEach(el => el.hidden = true); load(); }));
document.getElementById("period").addEventListener("change", event => document.querySelectorAll(".custom-date").forEach(el => el.hidden = event.target.value !== "custom"));
document.getElementById("reload").addEventListener("click", load);
document.getElementById("previous").addEventListener("click", () => { page -= 1; load(); }); document.getElementById("next").addEventListener("click", () => { page += 1; load(); });
load();
