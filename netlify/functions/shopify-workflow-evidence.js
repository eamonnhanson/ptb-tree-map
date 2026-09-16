export const SHOPIFY_GIFT_WORKFLOW = Object.freeze({
  key: "shopify_gift_tree_sku01_374491281",
  zapId: "374491281",
  name: "DEV - Shopify → Tokenized Gift Tree Link - Multilingual",
  displayedPublishedVersion: "v4",
  internalZapierVersionId: null,
  editorState: "unpublished draft of Zap 374491281"
});

export const SHOPIFY_OWN_WORKFLOW = Object.freeze({
  key: "shopify_own_tree_sku02",
  zapId: "374807250",
  name: "Zap C - Shopify naar PostgreSQL en Creator - SKU 02",
  sku: "02",
  eventTypes: ["shopify_order_received"]
});
export const SHOPIFY_OWN_WORKFLOW_KEY = SHOPIFY_OWN_WORKFLOW.key;
// An environment value is permitted only when it exactly agrees with the
// verified registry value. This avoids silently accepting an arbitrary Zap.
export function workflowRegistry(env = process.env) {
  const workflows = [{ ...SHOPIFY_GIFT_WORKFLOW, sku: "01", eventTypes: EVIDENCE_EVENT_TYPES }];
  const zapId = String(env.SHOPIFY_OWN_TREE_ZAP_ID || "").trim();
  if (!zapId || zapId === SHOPIFY_OWN_WORKFLOW.zapId) workflows.push(SHOPIFY_OWN_WORKFLOW);
  return workflows;
}

export const EVIDENCE_EVENT_TYPES = Object.freeze([
  "shopify_order_received",
  "gift_claim_created",
  "gift_claim_email_submitted"
]);

export function normalizeShopifyOrderId(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(?:gid:\/\/shopify\/Order\/)?(\d{1,30})$/i);
  return match ? match[1] : null;
}

export function normalizeLanguage(value) {
  const language = String(value ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return ["nl", "en", "fr"].includes(language) ? language : null;
}

const common = new Set(["event_type", "order_id", "occurred_at", "workflow_key", "zap_id"]);
const fields = {
  shopify_order_received: new Set([...common, "created_at", "customer_email", "customer_locale", "sku", "ordered_quantity", "product_title"]),
  gift_claim_created: new Set([...common, "creator_record_id", "creator_record_count", "status"]),
  gift_claim_email_submitted: new Set([...common, "recipient_email", "language", "submission_status", "provider_or_action"])
};
const cleanText = (value, max) => typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
const iso = value => cleanText(value, 40) && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
const email = value => { const result = cleanText(value, 254); return result && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) ? result.toLowerCase() : null; };
const normalizedSku = value => String(value ?? "").trim().replace(/^'+/, "").replace(/^0+/, "") || null;

export function validateEvidencePayload(payload, workflows = workflowRegistry()) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { error: "Ongeldige JSON-payload" };
  const type = payload.event_type;
  if (!EVIDENCE_EVENT_TYPES.includes(type)) return { error: "Onbekend event_type" };
  if (Object.hasOwn(payload, "zap_version")) return { error: "zap_version wordt niet geaccepteerd zolang de interne Zapier-versie-ID niet is geverifieerd" };
  if (Object.keys(payload).some(key => !fields[type].has(key))) return { error: "Payload bevat niet-toegestane velden" };
  const orderId = normalizeShopifyOrderId(payload.order_id);
  const occurredAt = iso(payload.occurred_at);
  if (!orderId || !occurredAt) return { error: "Ongeldig order-ID of tijdstip" };
  const workflow = workflows.find(item => item.key === payload.workflow_key && String(item.zapId) === String(payload.zap_id));
  if (!workflow || !workflow.eventTypes.includes(type)) return { error: "Onbekende workflow-identiteit" };

  const base = { event_type: type, order_id: orderId, occurred_at: occurredAt, workflow_key: workflow.key, zap_id: workflow.zapId, workflow_name: workflow.name };
  if (type === "shopify_order_received") {
    const quantity = Number(payload.ordered_quantity);
    const data = { ...base, created_at: iso(payload.created_at), customer_email: email(payload.customer_email), customer_locale: cleanText(payload.customer_locale, 35), language: normalizeLanguage(payload.customer_locale), sku: cleanText(payload.sku, 40), ordered_quantity: quantity, product_title: cleanText(payload.product_title, 200) };
    if (!data.created_at || !data.customer_email || !data.customer_locale || !data.language || !data.sku || normalizedSku(data.sku) !== normalizedSku(workflow.sku) || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000 || !data.product_title) return { error: "Onvolledige Shopify-orderdata" };
    return { value: data };
  }
  if (type === "gift_claim_created") {
    const count = Number(payload.creator_record_count);
    const status = payload.status || "success";
    if (!Number.isInteger(count) || count < 0 || count > 100 || !["success", "failed"].includes(status)) return { error: "Ongeldige Creator-data" };
    return { value: { ...base, creator_record_id: payload.creator_record_id == null || payload.creator_record_id === "" ? null : cleanText(String(payload.creator_record_id), 100), creator_record_count: count, status } };
  }
  const submissionStatus = payload.submission_status;
  const data = { ...base, recipient_email: email(payload.recipient_email), language: normalizeLanguage(payload.language), submission_status: submissionStatus, provider_or_action: cleanText(payload.provider_or_action, 100) };
  if (!data.recipient_email || !data.language || !["submitted", "failed"].includes(submissionStatus) || !data.provider_or_action) return { error: "Ongeldige e-maildata" };
  return { value: data };
}

export function idempotencyKey(event) {
  return `${event.workflow_key}:${event.event_type}:${event.order_id}`;
}
