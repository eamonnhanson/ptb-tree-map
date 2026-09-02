-- REVIEW ONLY - READ-ONLY DRY-RUN REPORTING.
-- Requires review.chargebee_subscription_export and
-- review.chargebee_seed_exclusions, populated from reviewed snapshots.
-- No historic payment or billing-period rows are reconstructed.
-- Export columns: source_row_number bigint, export_as_of timestamptz,
-- chargebee_subscription_id text, chargebee_customer_id text,
-- customer_email text, plan_id text, status text, started_at timestamptz,
-- subscription_created_at timestamptz, approved_cutover_at timestamptz.
-- Exclusion columns: chargebee_subscription_id text, justification text,
-- approved_by text. This relation should normally contain zero rows.

WITH export_rows AS (
  SELECT source_row_number, export_as_of,
    btrim(chargebee_subscription_id) AS chargebee_subscription_id,
    nullif(btrim(chargebee_customer_id), '') AS chargebee_customer_id,
    lower(btrim(customer_email)) AS customer_email,
    btrim(plan_id) AS plan_id, btrim(status) AS status,
    started_at, subscription_created_at, approved_cutover_at
  FROM review.chargebee_subscription_export
), subscription_counts AS (
  SELECT chargebee_subscription_id, count(*) AS source_row_count
  FROM export_rows GROUP BY chargebee_subscription_id
), user_evidence AS (
  SELECT e.source_row_number, u.id AS user_id, 'customer_id' AS evidence
  FROM export_rows e JOIN public.users1 u
    ON e.chargebee_customer_id IS NOT NULL
   AND btrim(u.chargebee_id::text) = e.chargebee_customer_id
  UNION ALL
  SELECT e.source_row_number, u.id, 'email'
  FROM export_rows e JOIN public.users1 u
    ON e.customer_email <> '' AND lower(btrim(u.email)) = e.customer_email
), user_matches AS (
  SELECT source_row_number, count(DISTINCT user_id) AS match_count,
    min(user_id) AS user_id,
    min(user_id) FILTER (WHERE evidence = 'customer_id') AS customer_id_user_id,
    min(user_id) FILTER (WHERE evidence = 'email') AS email_user_id,
    count(*) FILTER (WHERE evidence = 'customer_id') AS customer_matches,
    count(*) FILTER (WHERE evidence = 'email') AS email_matches
  FROM user_evidence GROUP BY source_row_number
), classified AS (
  SELECT e.*, sc.source_row_count, coalesce(um.match_count, 0) AS user_match_count,
    um.user_id, p.trees_per_year, p.allocation_pattern,
    x.justification AS exclusion_justification, x.approved_by AS exclusion_approved_by,
    CASE
      WHEN x.chargebee_subscription_id IS NOT NULL
       AND nullif(btrim(x.justification), '') IS NOT NULL
       AND nullif(btrim(x.approved_by), '') IS NOT NULL
        THEN 'EXCLUDE_NO_BILLING_HISTORY_ONLY_IF_EXPLICITLY_JUSTIFIED'
      WHEN e.chargebee_subscription_id IS NULL OR e.chargebee_subscription_id = ''
        OR sc.source_row_count <> 1 OR e.chargebee_customer_id IS NULL
        OR e.customer_email = '' OR e.plan_id = '' OR p.chargebee_plan_id IS NULL
        OR p.active IS NOT TRUE OR e.started_at IS NULL
        OR e.subscription_created_at IS NULL OR e.approved_cutover_at IS NULL
        OR e.subscription_created_at >= e.approved_cutover_at
        OR coalesce(um.match_count, 0) <> 1
        OR (um.customer_matches > 0 AND um.email_matches > 0
            AND um.customer_id_user_id <> um.email_user_id)
        OR existing.id IS NOT NULL THEN 'MANUAL_REVIEW'
      ELSE 'READY_TO_SEED'
    END AS reconciliation_status,
    array_remove(ARRAY[
      CASE WHEN sc.source_row_count <> 1 THEN 'duplicate_subscription_id' END,
      CASE WHEN e.chargebee_subscription_id IS NULL OR e.chargebee_subscription_id = '' THEN 'missing_subscription_id' END,
      CASE WHEN e.chargebee_customer_id IS NULL THEN 'missing_customer_id' END,
      CASE WHEN e.customer_email = '' THEN 'missing_customer_email' END,
      CASE WHEN p.chargebee_plan_id IS NULL THEN 'missing_plan' WHEN p.active IS NOT TRUE THEN 'inactive_plan' END,
      CASE WHEN e.started_at IS NULL THEN 'missing_started_at' END,
      CASE WHEN e.subscription_created_at IS NULL THEN 'missing_created_at' END,
      CASE WHEN e.approved_cutover_at IS NULL THEN 'missing_cutover_at'
           WHEN e.subscription_created_at >= e.approved_cutover_at THEN 'not_pre_cutover' END,
      CASE WHEN coalesce(um.match_count, 0) = 0 THEN 'no_users1_match'
           WHEN um.match_count > 1 THEN 'multiple_users1_matches' END,
      CASE WHEN um.customer_matches > 0 AND um.email_matches > 0
             AND um.customer_id_user_id <> um.email_user_id THEN 'identity_conflict' END,
      CASE WHEN existing.id IS NOT NULL THEN 'subscription_already_present' END
    ], NULL) AS review_reasons
  FROM export_rows e JOIN subscription_counts sc
    ON sc.chargebee_subscription_id IS NOT DISTINCT FROM e.chargebee_subscription_id
  LEFT JOIN user_matches um USING (source_row_number)
  LEFT JOIN public.chargebee_subscription_plans p ON p.chargebee_plan_id = e.plan_id
  LEFT JOIN public.chargebee_tree_subscriptions existing
    ON existing.chargebee_subscription_id = e.chargebee_subscription_id
  LEFT JOIN review.chargebee_seed_exclusions x
    ON x.chargebee_subscription_id = e.chargebee_subscription_id
)
SELECT reconciliation_status, review_reasons, source_row_number, export_as_of,
  approved_cutover_at, chargebee_subscription_id, chargebee_customer_id,
  customer_email, plan_id, status, started_at, subscription_created_at, user_id,
  trees_per_year, allocation_pattern, true AS initial_side_effects_suppressed,
  'not_required'::text AS welcome_status,
  0::integer AS successful_payment_event_count,
  0::integer AS successful_billing_period_count,
  0::integer AS trees_allocated_total,
  exclusion_justification, exclusion_approved_by
FROM classified
ORDER BY reconciliation_status, chargebee_subscription_id, source_row_number;
