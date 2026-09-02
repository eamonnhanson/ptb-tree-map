# Chargebee cutover seed review package

REVIEW ONLY. The freeze-time export, `users1` mapping, cutoff, exceptions and
manifest must be approved before any production-changing work. Historic payment
and billing-period rows are never reconstructed.

## Required input

| Column | Authority and rule |
| --- | --- |
| `source_row_number` | Review manifest; stable export trace. |
| `export_as_of` | Chargebee export manifest; exact UTC freeze time. |
| `chargebee_subscription_id` | Chargebee; required unique primary subscription key. |
| `chargebee_customer_id` | Chargebee; required identity evidence. |
| `customer_email` | Chargebee; required mapping evidence after lowercase/trim, never subscription identity. |
| `plan_id` | Chargebee; required active registry match. |
| `status` | Chargebee; required; cancelled pre-cutoff rows remain eligible. |
| `started_at` | Chargebee; required authoritative timestamp, never legacy JSON. |
| `subscription_created_at` | Chargebee; required authoritative `created_at`. |
| `approved_cutover_at` | Approved manifest; exact UTC cutoff, identical on every row. |

PostgreSQL contributes only the resolved `users1.id`. Normalized email and
`users1.chargebee_id` are matching evidence; they must resolve to one user and
must not conflict. An optional exclusion log has
`chargebee_subscription_id`, `justification`, and `approved_by`; it should be
empty by default and is only for explicitly reviewed no-billing-history cases.

## Reconciliation and output

The SELECT-only [016 workflow](sql/016_chargebee_subscription_backfill_dry_run.sql)
classifies every frozen export row as `READY_TO_SEED`, `MANUAL_REVIEW`, or
`EXCLUDE_NO_BILLING_HISTORY_ONLY_IF_EXPLICITLY_JUSTIFIED` and emits reason codes.
It requires review relations populated from the frozen export and exclusion log.

Every ready row outputs source identity/status/timestamps, resolved `user_id`,
plan snapshot (`trees_per_year`, `allocation_pattern`) and fixed values:

- `initial_side_effects_suppressed = true`
- `welcome_status = 'not_required'`
- `successful_payment_event_count = 0`
- `successful_billing_period_count = 0`
- `trees_allocated_total = 0`

Cancelled status never causes exclusion. Missing/duplicate subscription ID,
no/multiple/conflicting user match, missing/inactive plan, missing timestamps,
non-pre-cutoff `created_at`, or an already-present subscription requires review.

## Current-known counts

The repository's 2026-05-31 export is historical, not a cutover export:

- 35 rows; 35 distinct subscription IDs; all 35 active.
- Zero missing subscription ID, customer ID, email, plan, `started_at`, or `created_at`.
- All 35 plan IDs map to migration 014's active registry: monthly-12 (21),
  monthly-18 (9), monthly-24 (2), monthly-15 (2), and monthly-9 (1).
- READY/manual/exclusion counts remain unknown until the freeze-time export,
  approved cutoff and production `users1` mapping are available.
- User IDs 4278 and 3452 remain review hints only, never automatic exclusions.

## Validation checklist

- Record export checksum, row count, UTC `export_as_of`, and one UTC cutoff.
- Require export count = READY + MANUAL + approved exclusions.
- Require every subscription ID nonempty and unique.
- Require every ready row to resolve to exactly one `users1.id`, with agreeing evidence.
- Require an active plan and valid allocation snapshot for every ready row.
- Require authoritative valid timestamps and `created_at < cutover_at`.
- Retain cancelled pre-cutoff rows when identity is reliable.
- Require named approval and specific evidence for every exclusion.
- Require the five fixed seed-state values above and no historic ledger rows.
- Require the reviewed ready count to equal template 017's expected count.

## Exact final pre-cutover sequence

1. Freeze Chargebee subscription changes and export immediately before cutoff.
2. Record checksum, row count, UTC export time and proposed UTC cutoff.
3. Populate isolated review relations and obtain a read-only `users1` mapping snapshot.
4. Run 016 read-only reconciliation and resolve every manual row.
5. Approve each exclusion explicitly; otherwise return it to manual review.
6. Review the exact ready count and prepare a separate deployment copy of 017.
7. Keep 017's safety stop until separate production-change approval.
8. Pause the old payment route before database changes.
9. Apply 014, the singleton cutoff and approved seed in one controlled transaction.
10. Validate counts, identities, plans, timestamps, fixed state, and empty history.
11. Map authoritative Chargebee `created_at`, activate the new route, and monitor.

Steps 8–11 require separate explicit production approval.

## Cutover schedule — Sunday 30 August / Monday 31 August 2026

All local times below are Europe/Amsterdam (CEST, UTC+02:00). The approved
policy candidate `2026-08-31T08:00:00Z` is therefore **10:00 local time**. It is
the new-route boundary, not the time at which migration or seed preparation
starts.

### Sunday 30 August — review only

- Technical MVP is complete and locally verified.
- Make no further production changes.
- Prepare and review the cutover documentation only.

### Monday 31 August

| Local time | Action | Required gate/evidence |
| --- | --- | --- |
| 08:30 | Leave the legacy Chargebee Zap running. Freeze and export a new complete Chargebee `Subscriptions.csv`. | Record export timestamp, checksum and row count. |
| 08:30–09:00 | Compare the export with the currently expected 47 subscriptions, identify additions since Sunday, reconcile `users1`, and finalize classifications. | The number 47 is an expectation until the fresh export proves it. Require export total = READY + MANUAL + approved exclusions. |
| 09:00–09:30 | Generate the final seed SQL from READY rows and review counts and Subscription IDs. | Duplicate IDs = 0. Exceptions = 0, or each exception is explicitly isolated and approved. Do not use email as subscription identity. |
| 09:30 | Pause the legacy Chargebee allocation Zap and perform a final Chargebee delta check. | Record pause time and delta-export evidence. Any delta must be reconciled before proceeding. |
| 09:35–09:50 | Apply migration 014, configure the policy candidate, seed all approved pre-cutover subscriptions, and run database validation. | This is production-changing and needs separate explicit approval. Require exact seed count, fixed suppression/counters, active plan matches, unique IDs and no historic ledger rows. |
| 09:50–10:00 | Hold point. Keep both allocation routes from processing beyond the reviewed state. | Confirm policy is exactly `2026-08-31T08:00:00Z`, which is 10:00 CEST, and all database gates are green. |
| 10:00 | Activate the new Zap; keep the legacy route disabled. | Confirm the new mapping supplies authoritative Chargebee `subscription.created_at`. |
| 10:00–10:30 | Observe the first events. | Verify allocation, transaction replay/idempotency, billing-period behavior, and welcome/certificate required flags. Investigate any fail-closed/manual-review response before retrying. |

### Go/no-go rules

- No-go if the fresh export count does not reconcile exactly.
- No-go if any READY row lacks one unambiguous `users1.id`, active plan, valid
  authoritative `started_at`/`created_at`, or has `created_at >= cutover_at`.
- No-go if a Subscription ID is duplicated or conflicts with an existing row.
- No-go if the 09:30 delta check differs from the reviewed manifest until that
  delta has been classified and the seed regenerated/re-reviewed.
- Cancelled pre-cutover subscriptions remain in READY when identity is reliable.
- An exception may be excluded only with specific no-billing-history evidence
  and named approval; otherwise it remains MANUAL_REVIEW and blocks cutover.
