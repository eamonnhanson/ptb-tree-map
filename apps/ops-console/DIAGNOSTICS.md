# Ops Console read failure runbook

Start with the existing Workflow maintenance records and
`docs/workflow_connections_inventory.md`. This document supplements that
inventory for the Ops Console; it is not another workflow registry.

## Known configuration and evidence

- Technical owner: KETSO. Operational owner: Eamonn Hanson.
- Site: `ketso-ops-console`, base `apps/ops-console`.
- Monitoring database: Aiven `ptb_monitoring_test`, not local PostgreSQL or `defaultdb`.
- Role: `ops_console_reader`. Credentials: this site's `OPS_CONSOLE_DATABASE_URL`.
- CA: this site's `OPS_CONSOLE_DATABASE_CA_BASE64`. Never copy secrets into a report.
- User-supplied verification on 2026-09-09: reader login succeeded, default
  read-only was on, registry count was 28; seven required tables had SELECT
  and no table-level write/control privileges in the inspected database.
- No accessible non-system functions appeared in the supplied privilege result.
  These checks are not a cluster-wide privilege audit.
- Events column check with LIMIT 0 succeeded. It did not test a complete
  Netlify query execution or prove the environment variables are correct.
- Netlify build and deployment succeeded but `/api/events` returned unavailable.
  The original handler suppressed the underlying exception. Root cause remains unknown.

## Safe diagnostics

Read endpoints using the shared `readHandler` log one JSON record on a caught loader failure:
`event=ops_console_read_failed`, a fixed endpoint label, and a fixed error code.
The client still receives the generic 503 unavailable response. No error
message, stack, SQL, request, event data, URL, certificate or environment value
is logged. Unrecognized failures are `UNCLASSIFIED_FAILURE`, not guesses.
Netlify supplies the log timestamp. There is no new public diagnostic endpoint.

The custom `workflow-detail` handler does not use this shared logger. Its
`Invalid workflow id` response is an input validation failure before database access.

## Preview verification on 2026-09-10

- User-provided evidence from PR #37 showed `DB_URL_INVALID` for events.
  Replacing the Deploy Previews database URL with a correctly constructed URL
  and redeploying resolved it: events returned `ok: true`, and the overview loaded.
  The exact defect in the previous secret value was not inspected.
- Workflow maintenance identifies the Chargebee workflow as `zap_95`
  (`docs/workflow_maintenance_registry.csv`). View evidence returned
  `Invalid workflow id`, while the authenticated direct request
  `/.netlify/functions/workflow-detail?id=zap_95` returned `ok: true` and that record.
- The frontend now calls this direct same-origin function route with an encoded
  explicit `id`. This avoids the wildcard rewrite used by the previous request.
  The precise reason the previous route lost or rejected the ID remains unconfirmed.
  Verify View evidence on a newly built preview before production publication.
- Production connection configuration and authoritative maintenance registration
  remain pending. The existing Tree Map site's builds were temporarily stopped
  by the user; restoring them remains a rollout follow-up.

After an explicitly approved isolated deployment, request `/api/events` once
while authenticated. Inspect the matching function log in **ketso-ops-console**.
Share only the code, endpoint, log time and deployment ID.

| Code | Targeted next check |
| --- | --- |
| DB_NOT_CONFIGURED | Variable name, deploy context and Functions availability |
| DB_URL_INVALID | Privately check URL syntax and password URL encoding |
| DB_AUTHENTICATION_FAILED / DB_AUTHORIZATION_FAILED | User, password and server target |
| DB_PERMISSION_DENIED | Required role grants for the failed query |
| DB_DATABASE_NOT_FOUND | Database component of the connection URL |
| DB_RELATION_NOT_FOUND / DB_COLUMN_NOT_FOUND | Compare query and authoritative schema |
| DB_TLS_UNTRUSTED / DB_CA_INVALID | CA belongs to target Aiven service; valid Base64 PEM |
| DB_TLS_EXPIRED / DB_TLS_HOSTNAME_MISMATCH | Certificate validity or hostname; keep TLS verification enabled |
| DB_DNS_FAILED / DB_CONNECTION_REFUSED / DB_CONNECTION_RESET | Target and network access |
| DB_CONNECTION_TIMEOUT / DB_CONNECTION_LIMIT | Network or connection capacity |
| DB_QUERY_CANCELLED | Statement timeout or cancellation; not necessarily a connection fault |
| UNCLASSIFIED_FAILURE | Reproduce safely; extend the classifier only after review, never dump the error |

## Deployment and maintenance gates

Do not merge, push, or deploy this diagnostic change without the agreed approval.
The existing Tree Map site previously deployed automatically after an Ops-only
merge. Independent directories do not prevent that trigger. Do not change its
configuration in this task. A preview must be proven isolated from existing sites
before use. Database privileges, DNS and production environments remain unchanged
by this code patch.

Before treating the integration as production-maintained, update the existing
Workflow maintenance connection/code-asset/runbook records under separately
authorized registry writes. That registration is still pending; no authoritative
Ops Console workflow ID has been confirmed. Record the diagnosed cause, actual
deployment and verification date there. Next review: before diagnostic deployment.
