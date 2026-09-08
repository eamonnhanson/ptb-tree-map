import { read } from "./db.js";
import { evaluateWorkflow, outcomeKind } from "./health.js";

export const CRITICAL_WORKFLOW_IDS = Object.freeze([
  "zap_95",
  "shopify_monthly_donation_subscription_payment",
  "zap_175"
]);

const WORKFLOW_LIMIT = 200;
const EVENT_LIMIT = 100;
const ACTION_LIMIT = 100;

const workflowSelect = `
  select
    wr.workflow_id, wr.workflow_name, wr.platform, wr.source_system,
    wr.target_system, wr.trigger_description, wr.business_purpose,
    wr.owner_name, wr.status, wr.risk_level, wr.reads_from, wr.writes_to,
    wr.runbook_file, wr.last_tested_at, wr.next_review_at,
    wr.related_automation_registry_flow_name, wr.notes,
    review.last_verified_at,
    runtime.last_success_at, runtime.last_failure_at, runtime.last_event_at,
    runtime.last_event_status, runtime.last_event_severity
  from monitoring.workflow_registry wr
  left join lateral (
    select max(coalesce(reviewed_at, created_at)) as last_verified_at
    from monitoring.workflow_reviews
    where workflow_id = wr.workflow_id
      and lower(review_status) in ('passed', 'closed')
  ) review on true
  left join lateral (
    select
      max(event_time) filter (where lower(status) in ('ok','success','succeeded','completed','healthy') and lower(severity) <> 'red') as last_success_at,
      max(event_time) filter (where lower(status) in ('failed','error','blocked','halted') or lower(severity) = 'red') as last_failure_at,
      max(event_time) as last_event_at,
      (array_agg(status order by event_time desc, id desc))[1] as last_event_status,
      (array_agg(severity order by event_time desc, id desc))[1] as last_event_severity
    from monitoring.automation_events
    where entity_id = wr.workflow_id
       or (wr.related_automation_registry_flow_name is not null and flow_name = wr.related_automation_registry_flow_name)
  ) runtime on true
`;

function freshnessHours() {
  const value = Number(process.env.OPS_CONSOLE_FRESHNESS_HOURS || 72);
  return Number.isFinite(value) && value > 0 ? value : 72;
}

function enrich(row) {
  return { ...row, health: evaluateWorkflow(row, { freshnessHours: freshnessHours() }) };
}

export function limited(rows, limit) {
  return { rows: rows.slice(0, limit), truncated: rows.length > limit, limit };
}

export async function listWorkflows({ criticalOnly = false } = {}) {
  const values = criticalOnly ? [CRITICAL_WORKFLOW_IDS, WORKFLOW_LIMIT + 1] : [WORKFLOW_LIMIT + 1];
  const where = criticalOnly ? "where wr.workflow_id = any($1::text[])" : "";
  const limitPosition = criticalOnly ? "$2" : "$1";
  const result = await read(`${workflowSelect} ${where} order by wr.workflow_name limit ${limitPosition}`, values);
  const output = limited(result.rows.map(enrich), WORKFLOW_LIMIT);
  if (criticalOnly) {
    const found = new Set(output.rows.map((row) => row.workflow_id));
    output.missing_registry_ids = CRITICAL_WORKFLOW_IDS.filter((id) => !found.has(id));
  }
  return output;
}

export async function getWorkflow(id) {
  const workflowResult = await read(`${workflowSelect} where wr.workflow_id = $1`, [id]);
  if (!workflowResult.rows[0]) return null;
  const [dependencies, codeAssets, runbooks, reviews, events] = await Promise.all([
    read(`select dependency_order, dependency_type, source_system, target_system, trigger_or_input,
      action_summary, output_summary, reads_from, writes_to, uncertainty_level,
      missing_information, evidence_source
      from monitoring.workflow_dependencies where workflow_id = $1
      order by dependency_order nulls last limit 201`, [id]),
    read(`select file_path, asset_type, purpose, status, review_status, last_reviewed_at
      from monitoring.workflow_code_assets
      where strpos(lower(coalesce(related_workflows, '')), lower($1)) > 0
      order by file_path limit 101`, [id]),
    read(`select runbook_file, runbook_title, runbook_type, purpose, safe_test_steps,
      status, last_reviewed_at from monitoring.workflow_runbooks
      where workflow_id = $1 order by updated_at desc limit 101`, [id]),
    read(`select review_type, review_status, reviewed_by, reviewed_at, findings,
      action_items, evidence_source from monitoring.workflow_reviews
      where workflow_id = $1 order by coalesce(reviewed_at, created_at) desc limit 101`, [id]),
    read(`select id, event_time, category, severity, status, source_system, flow_name,
      entity_type, entity_id, summary, action_required,
      case when nullif(error_message, '') is not null then error_message
           when nullif(external_link, '') is not null then external_link else null end as evidence
      from monitoring.automation_events
      where entity_id = $1 or flow_name = $2
      order by event_time desc, id desc limit 101`, [id, workflowResult.rows[0].related_automation_registry_flow_name])
  ]);
  return {
    workflow: enrich(workflowResult.rows[0]),
    dependencies: limited(dependencies.rows, 200),
    implementation: { code_assets: limited(codeAssets.rows, 100), runbooks: limited(runbooks.rows, 100) },
    verification: limited(reviews.rows, 100),
    runtime: limited(events.rows, 100)
  };
}

export async function listEvents() {
  const result = await read(`select id, event_time, category, severity, status, source_system,
    flow_name, entity_type, entity_id, summary, action_required,
    case when nullif(error_message, '') is not null then error_message
         when nullif(external_link, '') is not null then external_link else null end as evidence
    from monitoring.automation_events order by event_time desc, id desc limit $1`, [EVENT_LIMIT + 1]);
  return limited(result.rows, EVENT_LIMIT);
}

export async function listActions() {
  const result = await read(`
    select * from (
      select 'event'::text as source, id::text as source_id, event_time as occurred_at,
        flow_name as workflow, severity, status, summary as detail,
        case when nullif(error_message, '') is not null then error_message
             when nullif(external_link, '') is not null then external_link else null end as evidence
      from monitoring.automation_events where action_required = true
      union all
      select 'outbound_message', id::text, message_time, null, 'red', status,
        concat_ws(' · ', message_type, provider, subject),
        case when nullif(error_message, '') is not null then error_message
             when nullif(external_link, '') is not null then external_link else null end
      from monitoring.outbound_messages where lower(status) in ('failed','error','blocked')
    ) actions order by occurred_at desc nulls last limit $1`, [ACTION_LIMIT + 1]);
  return limited(result.rows, ACTION_LIMIT);
}

export async function getSystemVisibility() {
  const systems = ["PostgreSQL", "Zapier", "Shopify", "Chargebee", "Zoho CRM", "KETSO uploader"];
  const result = await read(`select source_system, event_time, status, severity
    from monitoring.automation_events
    where lower(source_system) = any($1::text[])
    order by event_time desc, id desc limit 500`, [systems.map((system) => system.toLowerCase())]);
  return systems.map((system) => {
    const event = result.rows.find((row) => String(row.source_system).toLowerCase() === system.toLowerCase());
    if (!event) return { system, state: "UNKNOWN", reason: "No recent evidence", last_event_at: null };
    const kind = outcomeKind(event.status, event.severity);
    const state = kind === "failure" ? "RED" : "UNKNOWN";
    return {
      system,
      state,
      reason: kind === "failure" ? "Latest known evidence is a failure" : "An event exists, but no system health endpoint proves health",
      last_event_at: event.event_time
    };
  });
}
