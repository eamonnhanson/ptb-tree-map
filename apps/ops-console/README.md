# KETSO Operations Console

The default UI is now the action workspace described in [WORKSPACE.md](WORKSPACE.md).
It includes Tree Map, CSR and Academy navigation. The original evidence UI is
retained at `legacy.html`. The health model below describes backend evidence,
not the new owner-facing red/green action labels.


Internal, read-only operational monitoring for KETSO and Plant N Boom. This application answers a narrow question: what needs attention today, and what runtime evidence supports that conclusion?

It is a controlled greenfield application. It does not import frontend code, functions, build settings or routes from the Tree Map, uploader or current automation dashboard.

## Architecture

```text
Browser
  -> Ops Console static frontend
  -> Ops Console Netlify functions
  -> read-only monitoring and registry queries
  -> shared PostgreSQL database
```

The browser receives minimized fields only. Full event payloads, `changed_fields`, credentials and unnecessary personal data are not returned.

## Local development

Use Node.js 20 or newer.

```bash
cd apps/ops-console
npm ci
cp .env.example .env
npm run dev
```

Never commit `.env`. Point local development at a safe test database or a database role with explicit read-only grants.
The development command obtains Netlify CLI on demand, keeping the deployable package small.

Run verification:

```bash
npm test
npm run build
npm run check
```

`npm run build` copies only `frontend/` to the local `dist/` directory. It does not invoke the repository root build and cannot publish the existing Tree Map, uploader or dashboard.

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `OPS_CONSOLE_DATABASE_URL` | yes | PostgreSQL connection using a dedicated read-only role |
| `OPS_CONSOLE_DATABASE_CA_BASE64` | depends on host | Base64-encoded trusted CA certificate for verified TLS |
| `OPS_CONSOLE_USER` | yes | Basic-auth username for the internal site and API |
| `OPS_CONSOLE_PASSWORD` | yes | Strong Basic-auth password |
| `OPS_CONSOLE_FRESHNESS_HOURS` | no | Runtime success freshness threshold, default 72 hours |

The application fails closed if authentication or database access is not configured. Secrets belong in the new Netlify site's environment, not in git.

## API

All routes accept `GET` only and return `Cache-Control: no-store`.

| Route | Purpose |
|---|---|
| `/api/overview` | Critical workflows, actions, recent failures and system visibility |
| `/api/workflows` | Registry-first workflow list with evidence layers |
| `/api/workflows/:id` | Identity, dependencies, implementation, verification and runtime evidence |
| `/api/actions` | Action-required events and failed outbound messages |
| `/api/events` | Recent minimized runtime events |

Responses say `data_state: unavailable` on database failure. An unavailable query is never converted to an empty or healthy result. Lists expose `truncated`, `limit` and their returned rows.

## Health model

Four evidence layers remain separate:

1. `CONFIGURED`: the workflow exists in `monitoring.workflow_registry`.
2. `IMPLEMENTED`: registry status provides implementation evidence.
3. `VERIFIED`: a valid test/review timestamp exists. This does not prove current runtime health.
4. `HEALTHY`: recent successful runtime evidence exists and no newer failure exists.

Visible states:

| State | Meaning |
|---|---|
| `GREEN` | A recent successful runtime event exists and no newer failure exists. |
| `ORANGE` | The workflow is implemented, but success evidence is absent or stale. |
| `RED` | A known failure is newer than the last success, or the registry explicitly says failed/blocked. |
| `UNKNOWN` | Registry, implementation or runtime outcome evidence is insufficient or malformed. Neutral, not failure. |

`last_tested_at` can support the `VERIFIED` layer but can never create `GREEN`. Invalid timestamps are ignored. The freshness threshold defaults to 72 hours and should later be tuned per workflow cadence.

## Data sources and meaning

| Table | Used | Evidence class | Fields/purpose |
|---|---:|---|---|
| `monitoring.workflow_registry` | yes | Configuration | Authoritative workflow identity, lifecycle, owner and references |
| `monitoring.workflow_dependencies` | yes | Configuration/documentation | Dependency steps and uncertainty |
| `monitoring.workflow_connections` | no in v1 | Configuration/security inventory | Intentionally excluded from health |
| `monitoring.workflow_code_assets` | yes | Implementation reference | Known source assets, not runtime proof |
| `monitoring.workflow_runbooks` | yes | Documentation | Operational instructions, not runtime proof |
| `monitoring.workflow_reviews` | yes | Verification/history | Passed/closed reviews and timestamps |
| `monitoring.automation_registry` | no in v1 | Configuration/legacy registry | Its name may be referenced by `workflow_registry`; it is not treated as health |
| `monitoring.automation_events` | yes | Runtime/historical evidence | Recent outcomes, failures and action-required events |
| `monitoring.outbound_messages` | yes | Runtime/historical evidence | Failed/error/blocked message attempts become actions |

The application does not read business payloads or expose `customer_email`. V1 does not query upload/student business tables because a stable, minimized operational evidence view is not yet source-controlled.

## Database permissions

Use a dedicated role such as `ops_console_reader`. A reviewed example is in `sql/ops_console_reader.sql`. It is documentation only and must not be run automatically. The application also begins every query transaction with `BEGIN READ ONLY` as defense in depth.

## Independent Netlify deployment

Create a new Netlify site for this application. Do not attach it to an existing production site.

Recommended monorepo settings:

- repository: `eamonnhanson/ptb-tree-map`
- production branch: select only after review
- base/package directory: `apps/ops-console`
- configuration file: `apps/ops-console/netlify.toml`
- build command: inherited as `npm run build`
- publish directory: inherited as `dist`
- functions directory: inherited as `functions`
- edge functions directory: inherited as `edge-functions`
- environment variables: only the `OPS_CONSOLE_*` variables above

The scoped ignore command prevents unrelated repository changes from building this site. Existing Netlify configuration at repository root remains untouched. Connect `ops.ketso.nl` manually only after the isolated site, authentication and read-only credentials have been reviewed. No DNS is configured here.

## Security

The whole site is protected by an Ops Console-specific edge function. Every API function repeats the authentication check. Security headers disable framing, cross-origin sources and caching. Basic Auth is appropriate for this small initial internal deployment when served only over Netlify HTTPS with a strong unique password. A future identity provider can replace it without coupling to the old dashboard.

## Future write operations

V1 contains no approvals, retries, responses or other writes. Add them only after separate authorization, least-privilege roles, CSRF protection and an immutable audit trail exist. Read-only and write APIs should use different credentials.

## Relationship to existing applications

The Tree Map, uploader and current automation dashboard remain independent protected applications and references only. They are not moved or refactored. See [ARCHITECTURE.md](ARCHITECTURE.md).
