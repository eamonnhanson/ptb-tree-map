export const STATES = Object.freeze({ GREEN: "GREEN", ORANGE: "ORANGE", RED: "RED", UNKNOWN: "UNKNOWN" });
const IMPLEMENTED_STATUSES = new Set(["implemented", "partially_audited", "verified"]);
const FAILURE_STATUSES = new Set(["failed", "error", "blocked", "halted"]);
const SUCCESS_STATUSES = new Set(["ok", "success", "succeeded", "completed", "healthy"]);

export function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function evaluateWorkflow(input, options = {}) {
  if (!input?.workflow_id) return unknown("Workflow registry evidence is missing");
  const configured = true;
  const registryStatus = String(input.status || "").toLowerCase();
  const implemented = IMPLEMENTED_STATUSES.has(registryStatus);
  const verifiedAt = validDate(input.last_verified_at || input.last_tested_at);
  const verified = Boolean(verifiedAt);
  const successAt = validDate(input.last_success_at);
  const failureAt = validDate(input.last_failure_at);
  const eventAt = validDate(input.last_event_at);
  const hours = Number(options.freshnessHours ?? 72);
  const now = validDate(options.now) || new Date();
  const cutoff = new Date(now.getTime() - (Number.isFinite(hours) && hours > 0 ? hours : 72) * 3600000);

  const evidence = {
    configured,
    implemented,
    verified,
    last_verified_at: verifiedAt?.toISOString() || null,
    last_success_at: successAt?.toISOString() || null,
    last_failure_at: failureAt?.toISOString() || null,
    last_event_at: eventAt?.toISOString() || null
  };

  if (registryStatus === "failed" || registryStatus === "blocked") {
    return { state: STATES.RED, reason: `Registry status is ${registryStatus}`, evidence };
  }
  if (failureAt && (!successAt || failureAt > successAt)) {
    return { state: STATES.RED, reason: "A known failure is newer than the last success", evidence };
  }
  if (!implemented) {
    return { state: STATES.UNKNOWN, reason: "Implementation evidence is insufficient", evidence };
  }
  if (successAt && successAt >= cutoff && (!failureAt || successAt > failureAt)) {
    return { state: STATES.GREEN, reason: "Recent successful runtime evidence with no newer failure", evidence };
  }
  if (successAt && successAt < cutoff) {
    return { state: STATES.ORANGE, reason: "Last successful runtime evidence is stale", evidence };
  }
  if (eventAt && !successAt && !failureAt) {
    return { state: STATES.UNKNOWN, reason: "Runtime event exists but its outcome is not reliable", evidence };
  }
  return { state: STATES.ORANGE, reason: "Implemented, but no recent runtime evidence is available", evidence };
}

function unknown(reason) {
  return {
    state: STATES.UNKNOWN,
    reason,
    evidence: { configured: false, implemented: false, verified: false, last_verified_at: null, last_success_at: null, last_failure_at: null, last_event_at: null }
  };
}

export function outcomeKind(status, severity) {
  const normalizedStatus = String(status || "").toLowerCase();
  const normalizedSeverity = String(severity || "").toLowerCase();
  if (FAILURE_STATUSES.has(normalizedStatus) || normalizedSeverity === "red") return "failure";
  if (SUCCESS_STATUSES.has(normalizedStatus) && normalizedSeverity !== "red") return "success";
  return "unknown";
}
