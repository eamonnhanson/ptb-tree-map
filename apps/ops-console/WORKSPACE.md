# Action workspace

## Maintenance first

Existing maintenance workflow: `netlify_ops_console`. Owner: Eamonn Hanson.
Read `docs/workflow_maintenance_inventory.md`, the connection inventory and
DIAGNOSTICS.md before operational changes. User supplied confirmation of the
registry entry and its dependencies on 10 September 2026. No registry write was
executed for this change. Register the new assets and connections below in that
existing record when rolling out.

## What is built

The default index is an English action workspace. Six overview blocks: action
summary, tree sales, subscriptions, certificates, customer records, Academy.
Additional navigation: Tree Map, CSR & partners, Academy and uploader. The
original view is retained at `legacy.html`; original APIs remain compatible.
Original KETSO and Plant N Boom logo files are served locally.

Green means no action was found in connected checks. Red always opens a concrete
follow-up with owner, observed situation and next step. Missing source access is
an explicit repair task, never a zero count. Insufficient runtime evidence is a
monitoring follow-up, not a claim that a customer transaction failed. Backend
health evidence remains unchanged. Process membership currently uses readable
keyword rules in workspace-model.js; review these against registry identities
before interpreting the categories as complete business coverage.

Historic action records retain their dates and are not labelled new failures.
No automatic retry or invented resolution is provided. Historical action flags
must be reconciled through the existing maintenance procedure.

## Sources and operational boundaries

GET `/.netlify/functions/workspace` repeats the existing authentication guard.
It reads monitoring workflows/actions, a free-tree aggregate, pending upload
review aggregate, new tutor-question aggregate and a source-controlled partner
list. Failures are independent. All SQL uses the existing read-only transaction.
No names, emails, questions or uploaded media are fetched for Academy counters.
Refresh happens on page load or the Refresh button only; no background polling.

Free trees: public.trees1, user_id null, blank/null tree_name, non-null lat
and long. The inventory uses tree_code for all rows, including free trees, so it
is deliberately not part of the definition. This is not a count of every
unassigned reserved tree. OPS_CONSOLE_MIN_FREE_TREES controls the
alert floor, default 0. Confirm the operating minimum and count definition with
the allocation owner before setting a larger threshold.

The existing monitoring connection targets ptb_monitoring_test. The free-tree
count uses OPS_CONSOLE_TREE_DATABASE_URL because trees1 is in a separate
database, confirmed as defaultdb on 12 September 2026. Missing relations/permissions are shown as repair actions. The reviewed
grants are in sql/workspace_count_access.sql and have NOT been applied. Create
one read-only defaultdb connection and configure it only in the Ops Console's
Netlify environment. Never replace the monitoring URL with it.

Approvals, tutor replies and uploads open the already working authenticated
screens. This preserves their write permissions, review and notification logic.
No approvals or messages are sent from the new read-only app. The previous
console and existing dashboard remain accessible. Do not decommission either
until the owner confirms the replacement covers the required tasks.

CSR data is configured in functions/_shared/partners.js. Supply approved records
with id, name, type (business/foundation), relationship (supporter/prospect),
target_eur, received_eur, next_action, owner, due_date and instructions. Set
configured true and reviewed_at only when the list has been checked. Empty setup
is deliberately shown as an action. No fictional supporters are shipped and
prospect targets are never counted as confirmed income.

## Changed maintenance assets

- frontend/index.html, workspace.js, workspace-model.js, workspace.css, assets/*:
  Browser navigation, action decisions and identity.
- frontend/legacy.html: previous read-only console.
- functions/workspace.js and _shared/workspace.js: guarded aggregate loader.
- functions/_shared/partners.js: approved CSR data source, currently unconfigured.
- sql/workspace_count_access.sql: optional reviewed permissions, never auto-run.
- tests/workspace.test.js: counts, partial failure, authentication and UI boundaries.

## Rollout

Branch: feature/ops-console-action-workspace. App only: apps/ops-console.
Run npm run check once plus syntax checks for the added modules. No live database
writes, environment changes, email sends or live deployment are part of this
build. AGENTS.md requires explicit authorization for push, merge and production
rollout. Main is protected by pull-request checks. A main merge may also trigger
the original site's build even with an Ops-only diff; verify deployment triggers
before publishing. Do not alter that other site's settings as a shortcut.
