export const DEFAULT_PROCESSING_WINDOW_HOURS = 24;

export function determineTreeAllocatedStatus(order, now = new Date(), windowHours = DEFAULT_PROCESSING_WINDOW_HOURS) {
  const reasons = [];
  const ordered = Number.isInteger(order.ordered_count) ? order.ordered_count : null;
  const allocated = Number(order.allocated_count || 0);
  const creatorCount = Number.isInteger(order.creator_record_count) ? order.creator_record_count : null;
  const ageHours = order.order_date
    ? Math.max(0, (now.getTime() - new Date(order.order_date).getTime()) / 36e5)
    : null;
  const overdue = ageHours !== null && ageHours > windowHours;

  if (!order.email) reasons.push("E-mailadres ontbreekt");
  if (order.email_match_count > 1) reasons.push("E-mailadres komt dubbel voor");
  if (!order.user_id) reasons.push("Geen gekoppelde klant");
  if (ordered !== null && allocated !== ordered) {
    reasons.push(`${allocated} van ${ordered} bomen toegewezen`);
  }
  if (ordered !== null && allocated > ordered) {
    reasons[reasons.length - 1] = `${allocated} bomen toegewezen, ${ordered} besteld`;
  }
  if (order.mismatched_order_count > 0) reasons.push("Bomen hebben verschillende Shopify order-ID's");
  if (creatorCount > 1) reasons.push(`${creatorCount} Creator-records gevonden`);
  if (creatorCount === 0) reasons.push("Creator-record ontbreekt");
  if (order.email_submitted === false) reasons.push("E-mailaanbieding is mislukt");
  if (order.technical_error) reasons.push(order.technical_error);

  const sourcesComplete = ordered !== null && creatorCount !== null && order.email_submitted !== null;
  const requiredSourceUnavailable = order.shopify_source_available === false ||
    order.creator_source_available === false;
  const complete = order.shopify_source_available === true && order.creator_source_available === true &&
    order.user_id && ordered !== null && ordered > 0 && ordered === allocated &&
    order.mismatched_order_count === 0 && creatorCount === 1 &&
    order.email_submitted === true && !order.technical_error;

  if (complete) return { status: "completed", label: "Gift-claim afgerond", reasons: [] };
  if (reasons.length) return { status: "action_required", label: "Actie nodig", reasons };
  if (requiredSourceUnavailable) {
    return {
      status: "unverifiable",
      label: "Niet volledig controleerbaar",
      reasons: ["Shopify- en/of Creator-bron niet gekoppeld"]
    };
  }
  if (!sourcesComplete && overdue) {
    return { status: "unverifiable", label: "Niet volledig controleerbaar", reasons: ["Vereiste brondata ontbreekt"] };
  }
  return { status: "processing", label: "In verwerking", reasons: ["Vervolgstappen nog niet volledig bewezen"] };
}
