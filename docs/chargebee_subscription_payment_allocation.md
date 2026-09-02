# Chargebee subscription allocation MVP — REVIEW ONLY

Do not execute these SQL files against production, change `zap_95`, perform the
seed, commit, or push until the package and cutover manifest are approved.

## MVP model

The tested payment-event/billing-period architecture remains intact. The only
new operational classification is
`chargebee_tree_subscriptions.initial_side_effects_suppressed` plus the
singleton `chargebee_subscription_cutover_policy.cutover_at`.

- Cutover-seeded subscriptions have suppression `true`, `welcome_status =
  'not_required'`, and all counters zero. No historic payments are invented.
- A subscription first seen by the processor must include authoritative
  Chargebee `subscription.created_at`. Missing policy or timestamp fails closed.
- If `created_at < cutover_at`, the unseen subscription is a missed seed and the
  entire call fails for manual review. Equality is post-cutover/new.
- An already persisted subscription keeps its original classification; later
  payloads never reclassify it.
- Initial effects are required only when the persisted billing-period counter is
  zero and suppression is false. Therefore `billing_period_number = 1` alone is
  never evidence that the customer is new.

## Source authority and seed

Chargebee Subscriptions export supplies subscription ID, plan ID, status,
`started_at`, `created_at`, customer identity and the export-as-of timestamp.
PostgreSQL supplies the matched `users1.id` and normalized-email diagnostics.
`users1.subscription_info.started_at` is not authoritative.

Use `016_chargebee_subscription_backfill_dry_run.sql` for SELECT-only matching
and validation. Build an explicit exception queue; user IDs 4278 and 3452 are
reporting/reconciliation hints only. Resolve each exception or intentionally
exclude it for manual review. Never add exception IDs to the processor.

`017_chargebee_subscription_cutover_seed.sql` is a review template containing
placeholders and an unconditional rollback safety stop. Its insert has no
conflict-upsert path, joins to an active plan, reports expected versus inserted
rows, and inserts the singleton cutoff. An approved deployment copy must use the
exact reviewed timestamp and manifest count.

Full payment history is unnecessary: the seed explicitly says initial customer
effects are not required, while counters begin at zero and describe only
post-cutover processing. Historic certificates/welcome evidence does not need to
be converted into synthetic transaction rows.

## Processor contract

`process_chargebee_subscription_payment(...)` adds the final optional parameter
`p_subscription_created_at timestamptz`. Existing persisted subscriptions do not
need it. Unseen subscriptions require it and the configured cutoff.

Allocation is unchanged: the period boundary is unique on subscription plus
`billing_period_start`; transaction ID remains the event boundary; pattern index
is the calendar-month difference between authoritative persisted `started_at`
and billing-period start modulo 12. A paid-at fallback remains permitted only
when billing-period start is absent.

The zero-tree first-period guard applies only to genuinely new subscriptions
whose initial side effects are required. A seeded old subscription may safely
land on a zero allocation position without being misclassified.

## `zap_95` mapping after approval

Keep every existing mapping and add:

| Function input | Chargebee value | Rule |
|---|---|---|
| `p_subscription_created_at` | `subscription.created_at` | Convert the Chargebee epoch/time to `timestamptz`; do not substitute `started_at`, invoice date, or payment date. |

Treat a processor error containing `manual review`, missing creation timestamp,
or missing cutoff policy as a stopped payment requiring operator review. Do not
send welcome/certificate or allocate outside the function. Continue to send
welcome/certificate only when their returned `*_required` flag is true. Existing
transaction replay remains idempotent.

The Zapier database role should receive `EXECUTE` on the two approved functions
and no direct `UPDATE` privilege on `chargebee_tree_subscriptions` or the cutoff
policy. In particular, suppression is not a Zapier input and the processor never
changes it for an existing row. Seed/correction writes belong to a separate,
restricted deployment role and reviewed runbook.

## Exact staged cutover

1. Freeze and export Chargebee subscriptions immediately before cutover.
2. Match every export row to `users1`, validate plan registry coverage and
   authoritative timestamps, and reconcile the exception queue.
3. Review the seed manifest count and exact UTC cutoff. Pause `zap_95` before
   applying any database change so no payment can cross an ambiguous boundary.
4. Apply reviewed `014`, configure the singleton cutoff, and seed every
   pre-cutover subscription with suppression true in one controlled transaction.
5. Run the post-seed queries in `016`; require exact manifest count, zero invalid
   seed rows, and one correct cutoff row.
6. Update `zap_95` to pass `subscription.created_at`, then resume it. Do not
   replay events until the mapping and policy checks pass.
7. Monitor all fail-closed/manual-review errors, duplicate events, allocations,
   and side-effect states. Resolve a missed old subscription by pausing/reviewing
   and inserting an approved suppressed seed row; never retry it as new.

## Tests and rollback

`015` and the PostgreSQL Node harness cover seeded-old suppression, unseen-old
rejection with rollback, boundary-new behavior, transaction/period idempotency,
concurrency, inventory rollback, patterns, plan changes, counters and terminal
side effects. The static suite checks the migration and review-only reporting.

Before Zapier resumes, rollback can drop the new Chargebee objects according to
dependency order in a separately reviewed rollback. After live payments exist,
do not drop or rewrite ledgers: pause Zapier, preserve rows, investigate, and
deploy a forward correction. Removing the cutoff or changing seeded suppression
is not an operational rollback and requires explicit reconciliation.
