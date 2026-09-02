-- REVIEW ONLY - CUTOVER SEED TEMPLATE - DO NOT EXECUTE AS-IS.
-- DO NOT RUN BEFORE FINAL DELTA CHECK AND EXPLICIT PRODUCTION APPROVAL.
-- Concrete manifest prepared from the reviewed 2026-08-30 Chargebee export
-- and reviewed users1 mapping. The unconditional safety stop rolls back all work.

BEGIN;

DO $seed_block$
DECLARE
  v_expected_rows constant integer := 47;
  v_cutover_at constant timestamptz := TIMESTAMPTZ '2026-08-30T19:29:32Z';
  v_seed jsonb;
  v_count integer;
  v_inserted_rows integer;
BEGIN
  WITH seed (
    chargebee_subscription_id, chargebee_customer_id, user_id,
    customer_email, plan_id, status, started_at, subscription_created_at
  ) AS (
    VALUES
      ('1050829391', '2034122018', 3066, 'willi.palsma@gmail.com',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2021-02-17T12:26:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('1278039216', '2135386214', 3130, 'hjhbeskers@gmail.com',
       '20-euro-24-bomen-abonnement-EUR-Monthly', 'active',
       TIMESTAMPTZ '2021-04-02T18:26:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('1376449712', '1766730621', 3364, 'marcvandie@ziggo.nl',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2021-03-12T07:26:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('1412454412', '891248952', 2971, 'anne_timmermans@hotmail.com',
       '12-5-euro-15-bomen-abonnement-EUR-Monthly', 'active',
       TIMESTAMPTZ '2022-09-30T23:25:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('1724291601', '255713994', 3230, 'bvveen@xs4all.nl',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2022-10-03T10:24:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('1762506707', '2040095378', 2970, 'inekestraatman@outlook.com',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2022-08-20T15:11:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('1831903555', '1329795760', 3264, 'bryn.welham@gmail.com',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2021-03-15T10:51:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('1853415257', '360051102', 3012, 'guusnieuwenhuys@gmail.com',
       '15-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2022-05-31T21:45:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('1893467328', '751706564', 3171, 'p.l.j.smit@planet.nl',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2021-11-08T11:08:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('1903178461', '1038347789', 2913, 'susannelunenburg@gmail.com',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2021-11-03T20:34:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('1939909282', '1601808242', 2915, 'lars.vangarderen@gmail.com',
       '15-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2022-01-21T14:00:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('1981245613', '2101006992', 2844, 'mfnolmans@gmail.com',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2022-02-09T00:48:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('198NwwUCBBqzI2E8m', 'i7YTUCBCW5z2D6b', 3031, 'info@rrbb.nl',
       '1-boom-per-maand-ingang-volgende-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2024-05-08T13:03:00Z', TIMESTAMPTZ '2024-05-08T13:03:00Z'),
      ('198QPDUMY00VQ1LeB', '199UMBTcA5cqj40xd', 3343, 'admin@bezabouw.nl',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2024-08-26T11:26:00Z', TIMESTAMPTZ '2024-08-26T11:26:00Z'),
      ('199PaVURUwwBz6cV0', 'BTUUpAURUxIut6edX', 3227, 'rgmlukassen+boom@gmail.com',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2024-10-17T23:21:00Z', TIMESTAMPTZ '2024-10-17T23:21:00Z'),
      ('199RX8VTOsPZB1xqm', '199Ub0VTOstRnJKv', 3061, 'marco.stoltenborg@online.nl',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2026-08-26T13:14:00Z', TIMESTAMPTZ '2026-08-26T13:14:00Z'),
      ('199Xh8UofJKnD3CyU', 'BTLkTCUofK70d3BNG', 2839, 'mlroelofsen@planet.nl',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2025-06-20T14:58:00Z', TIMESTAMPTZ '2025-06-20T14:58:00Z'),
      ('19A2enVJfXbDsfLx', 'BTUUL9VJfYCtY2S8', 2912, 'b.maarsingh@maarsinghenvansteijn.nl',
       '1-boom-per-maand-ingang-volgende-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2026-05-15T08:50:00Z', TIMESTAMPTZ '2026-05-15T08:50:00Z'),
      ('19A4D9VTgyqsn4pGU', 'BTLzGwVTgzRCb5Iz', 4303, 'r.scheenstra@planet.nl',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2026-08-29T15:33:00Z', TIMESTAMPTZ '2026-08-29T15:33:00Z'),
      ('19A8PsUmgZCSV1cGL', 'BTUStMUmgZl0J1b06', 2874, 'kim.vanderaar@gmail.com',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2025-05-30T15:09:00Z', TIMESTAMPTZ '2025-05-30T15:09:00Z'),
      ('209864129', '1583220067', 2900, 'martinekeotten@hotmail.com',
       '15-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2022-08-26T14:28:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('22127317', '536627530', 4307, 'info@planteenboom.nu',
       '17-5-euro-21-bomen-abonnement-EUR-Monthly', 'cancelled',
       TIMESTAMPTZ '2022-04-30T00:00:00Z', TIMESTAMPTZ '2022-12-01T10:06:00Z'),
      ('225800089', '2131163373', 2903, 'tonvangarderen@ziggo.nl',
       '15-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2022-04-21T09:52:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('278748412', '193319805', 2986, 'jetselesvinges@gmail.com',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2022-12-02T20:59:00Z', TIMESTAMPTZ '2023-01-05T18:38:00Z'),
      ('483689973', '50738877', 2853, 'christinebrantner2018@gmail.com',
       '15-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2022-09-30T19:58:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('564502933', '421167274', 2989, 'anjaplender@gmail.com',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2021-11-09T12:01:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('680170270', '1860408589', 2880, 'anneliescbax@gmail.com',
       '20-euro-24-bomen-abonnement-EUR-Monthly', 'active',
       TIMESTAMPTZ '2021-08-16T17:12:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('749560847', '117097652', 2947, 'gcyh@outlook.com',
       '15-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2022-01-05T13:38:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('761555613', '580866764', 2941, 'rimkegeels@xs4all.nl',
       '750-9-bomen-abonnement-EUR-Monthly', 'active',
       TIMESTAMPTZ '2022-09-30T15:34:00Z', TIMESTAMPTZ '2022-12-01T10:14:00Z'),
      ('772q8TUEozX64XHS', '772q8TUEpf1c4Xdm', 2831, 'a.kwee67@gmail.com',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2023-01-28T13:46:00Z', TIMESTAMPTZ '2023-01-28T13:46:00Z'),
      ('77849V4u9WNs4MP7', '199Hc7V4uAEO2WBD', 4224, 'corenmai@hotmail.com',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2025-12-09T18:35:00Z', TIMESTAMPTZ '2025-12-09T18:35:00Z'),
      ('BTccOOUutVB4bNmo', '19A4xFUutVXmnN1P', 3337, 'jennygroen15@gmail.com',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2025-08-25T16:05:00Z', TIMESTAMPTZ '2025-08-25T16:05:00Z'),
      ('BTcL0WVThziKs5cuz', 'BTUNjaVTi06ufByr', 4304, 'endryvandenberg@yahoo.co.uk',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2026-08-29T19:42:00Z', TIMESTAMPTZ '2026-08-29T19:42:00Z'),
      ('BTcRvDVRnjyDS6rvm', '198M5STlhnCvH1hnk', 2978, 'eamonn_hanson@yahoo.co.uk',
       '1-boom-per-maand-EUR-Monthly', 'cancelled',
       TIMESTAMPTZ '2026-08-09T14:18:00Z', TIMESTAMPTZ '2026-08-09T14:18:00Z'),
      ('BTcWlwUsdp9WR3ZzR', '199H9mUsdqNwu3b5a', 3376, 'toobje7@hotmail.nl',
       '1-boom-per-maand-EUR-Monthly', 'cancelled',
       TIMESTAMPTZ '2025-08-01T18:50:00Z', TIMESTAMPTZ '2025-08-01T18:50:00Z'),
      ('BTcY4eUPY2aYZ7dg3', 'BTUV0qUPY2ttp7dn9', 3090, 'meinkeklarenbeek@hotmail.com',
       '15-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2024-09-27T07:04:00Z', TIMESTAMPTZ '2024-09-27T07:04:00Z'),
      ('BTcYBfUG42mhs3SLJ', 'BTcYBfUG439Ta3SmR', 2965, 'sandhoop@gmail.com',
       '15-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2024-06-18T17:37:00Z', TIMESTAMPTZ '2024-06-18T17:37:00Z'),
      ('BTLrahUBtJ4oYDvjB', '1835747300', 2936, 'l.van.leeuwen16@kpnplanet.nl',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2024-05-05T11:52:00Z', TIMESTAMPTZ '2024-05-05T11:52:00Z'),
      ('BTLt3JUZNmesC16Ti', 'BTUQoVUZNoAnp18hZ', 2975, 'wilmaborculo@gmail.com',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2025-01-09T12:52:00Z', TIMESTAMPTZ '2025-01-09T12:52:00Z'),
      ('BTM7SxUZlud6f1iBT', 'BTLt8TUZlvNyp1gFR', 3106, 'coevering@vergunningenhuis.nl',
       '15-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2025-01-13T15:51:00Z', TIMESTAMPTZ '2025-01-13T15:51:00Z'),
      ('BTU1b4TilTxTX8Qwr', 'BTM2t0TilV5WZ8LiG', 3125, 'markkirkels@gmail.com',
       '1-boom-per-maand-EUR-Monthly', 'cancelled',
       TIMESTAMPTZ '2023-07-01T15:36:00Z', TIMESTAMPTZ '2023-07-01T15:36:00Z'),
      ('BTU1b4TivWRPKBNJS', 'BTU1b4TivWpNMBNQi', 3354, 'gjmengelen@gmail.com',
       'Maandelijkse-bijdrage-1250-euro-EUR-Monthly', 'active',
       TIMESTAMPTZ '2023-07-03T08:45:00Z', TIMESTAMPTZ '2023-07-03T08:45:00Z'),
      ('BTU4NhVQJ06jL2ggX', '19A9IKVQJ1CfiJCr', 2980, 'ari.boersma30@gmail.com',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2026-07-24T17:43:00Z', TIMESTAMPTZ '2026-07-24T17:43:00Z'),
      ('BTUQghUZDA6Vg21Eb', '19A8RxUZDArcn22iG', 2897, 'adriaan_b@live.nl',
       '1-boom-per-maand-EUR-Monthly', 'active',
       TIMESTAMPTZ '2025-01-07T17:13:00Z', TIMESTAMPTZ '2025-01-07T17:13:00Z'),
      ('BTUSjmUf3PRvs74YE', '198M5STlhnCvH1hnk', 2978, 'eamonn_hanson@yahoo.co.uk',
       '1-boom-per-maand-EUR-Monthly', 'cancelled',
       TIMESTAMPTZ '2025-03-10T16:04:00Z', TIMESTAMPTZ '2025-03-10T16:04:00Z'),
      ('BTUSo1UX1qBKo2uLb', '19AGs0UX1qslY2x8C', 3104, 'p.koops82@gmail.com',
       '1-boom-per-maand-EUR-Monthly', 'cancelled',
       TIMESTAMPTZ '2024-12-15T13:47:00Z', TIMESTAMPTZ '2024-12-15T13:47:00Z'),
      ('BTUV0pTnHaGVU148Z', 'BTLYiYTnHadM612nK', 3197, 'dexter@riddlestory.com',
       '1-boom-per-maand-EUR-Monthly', 'cancelled',
       TIMESTAMPTZ '2023-08-18T13:14:00Z', TIMESTAMPTZ '2023-08-18T13:14:00Z')
  )
  SELECT jsonb_agg(to_jsonb(seed) ORDER BY chargebee_subscription_id)
  INTO STRICT v_seed
  FROM seed;

  -- Preflight: every condition is checked before policy or subscription writes.
  SELECT count(*) INTO v_count FROM jsonb_array_elements(v_seed);
  IF v_count <> v_expected_rows THEN
    RAISE EXCEPTION 'Seed row-count mismatch: expected %, found %', v_expected_rows, v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM (
    SELECT row_data->>'chargebee_subscription_id'
    FROM jsonb_array_elements(v_seed) AS row_data
    GROUP BY row_data->>'chargebee_subscription_id'
    HAVING count(*) > 1
  ) AS duplicate_subscription;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Seed contains % duplicate Chargebee Subscription IDs', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM jsonb_to_recordset(v_seed) AS seed(
    chargebee_subscription_id text, chargebee_customer_id text, user_id integer,
    customer_email text, plan_id text, status text, started_at timestamptz,
    subscription_created_at timestamptz
  )
  LEFT JOIN public.users1 AS users ON users.id = seed.user_id
  WHERE seed.chargebee_subscription_id IS NULL OR btrim(seed.chargebee_subscription_id) = ''
     OR seed.chargebee_customer_id IS NULL OR btrim(seed.chargebee_customer_id) = ''
     OR seed.customer_email IS NULL OR btrim(seed.customer_email) = ''
     OR seed.user_id IS NULL OR users.id IS NULL
     OR seed.started_at IS NULL OR seed.subscription_created_at IS NULL
     OR seed.subscription_created_at >= v_cutover_at
     OR seed.status NOT IN ('active', 'cancelled');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Seed contains % rows with missing/invalid identity, user, status or timestamp data', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM jsonb_to_recordset(v_seed) AS seed(plan_id text)
  LEFT JOIN public.chargebee_subscription_plans AS plan
    ON plan.chargebee_plan_id = seed.plan_id AND plan.active
  WHERE seed.plan_id IS NULL OR btrim(seed.plan_id) = ''
     OR plan.chargebee_plan_id IS NULL;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Seed contains % rows with absent or inactive plans', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM jsonb_to_recordset(v_seed) AS seed(chargebee_subscription_id text)
  JOIN public.chargebee_tree_subscriptions AS existing
    ON existing.chargebee_subscription_id = seed.chargebee_subscription_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Seed conflicts with % existing Chargebee subscription rows', v_count;
  END IF;

  INSERT INTO public.chargebee_subscription_cutover_policy (singleton, cutover_at)
  VALUES (true, v_cutover_at);

  INSERT INTO public.chargebee_tree_subscriptions (
    chargebee_subscription_id, chargebee_customer_id, user_id,
    customer_email, current_plan_id,
    current_trees_per_year, current_allocation_pattern, status, started_at,
    initial_side_effects_suppressed, welcome_status,
    successful_payment_event_count, successful_billing_period_count,
    trees_allocated_total
  )
  SELECT seed.chargebee_subscription_id, seed.chargebee_customer_id,
         seed.user_id, seed.customer_email, seed.plan_id,
         plan.trees_per_year, plan.allocation_pattern,
         seed.status, seed.started_at, true, 'not_required', 0, 0, 0
  FROM jsonb_to_recordset(v_seed) AS seed(
    chargebee_subscription_id text, chargebee_customer_id text, user_id integer,
    customer_email text, plan_id text, status text, started_at timestamptz,
    subscription_created_at timestamptz
  )
  JOIN public.chargebee_subscription_plans AS plan
    ON plan.chargebee_plan_id = seed.plan_id AND plan.active
  WHERE seed.subscription_created_at < v_cutover_at;

  GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;
  IF v_inserted_rows <> v_expected_rows THEN
    RAISE EXCEPTION 'Seed row-count mismatch: expected %, inserted %',
      v_expected_rows, v_inserted_rows;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.chargebee_tree_subscriptions AS subscription
  JOIN jsonb_to_recordset(v_seed) AS seed(chargebee_subscription_id text)
    USING (chargebee_subscription_id)
  WHERE subscription.initial_side_effects_suppressed IS NOT TRUE
     OR subscription.welcome_status <> 'not_required'
     OR subscription.successful_billing_period_count <> 0
     OR subscription.successful_payment_event_count <> 0
     OR subscription.trees_allocated_total <> 0;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Post-seed state validation failed for % rows', v_count;
  END IF;
END;
$seed_block$;

-- Post-insert review result must be exactly:
-- 47 seeded, 47 suppressed, 47 welcome not required, and zero for all totals.
SELECT count(*) AS seeded_subscriptions,
  count(*) FILTER (WHERE initial_side_effects_suppressed) AS suppressed_subscriptions,
  count(*) FILTER (WHERE welcome_status = 'not_required') AS welcome_not_required,
  sum(successful_billing_period_count) AS successful_billing_period_count_total,
  sum(successful_payment_event_count) AS successful_payment_event_count_total,
  sum(trees_allocated_total) AS trees_allocated_total
FROM public.chargebee_tree_subscriptions
WHERE chargebee_subscription_id IN (
  VALUES
    ('1050829391'),
    ('1278039216'),
    ('1376449712'),
    ('1412454412'),
    ('1724291601'),
    ('1762506707'),
    ('1831903555'),
    ('1853415257'),
    ('1893467328'),
    ('1903178461'),
    ('1939909282'),
    ('1981245613'),
    ('198NwwUCBBqzI2E8m'),
    ('198QPDUMY00VQ1LeB'),
    ('199PaVURUwwBz6cV0'),
    ('199RX8VTOsPZB1xqm'),
    ('199Xh8UofJKnD3CyU'),
    ('19A2enVJfXbDsfLx'),
    ('19A4D9VTgyqsn4pGU'),
    ('19A8PsUmgZCSV1cGL'),
    ('209864129'),
    ('22127317'),
    ('225800089'),
    ('278748412'),
    ('483689973'),
    ('564502933'),
    ('680170270'),
    ('749560847'),
    ('761555613'),
    ('772q8TUEozX64XHS'),
    ('77849V4u9WNs4MP7'),
    ('BTccOOUutVB4bNmo'),
    ('BTcL0WVThziKs5cuz'),
    ('BTcRvDVRnjyDS6rvm'),
    ('BTcWlwUsdp9WR3ZzR'),
    ('BTcY4eUPY2aYZ7dg3'),
    ('BTcYBfUG42mhs3SLJ'),
    ('BTLrahUBtJ4oYDvjB'),
    ('BTLt3JUZNmesC16Ti'),
    ('BTM7SxUZlud6f1iBT'),
    ('BTU1b4TilTxTX8Qwr'),
    ('BTU1b4TivWRPKBNJS'),
    ('BTU4NhVQJ06jL2ggX'),
    ('BTUQghUZDA6Vg21Eb'),
    ('BTUSjmUf3PRvs74YE'),
    ('BTUSo1UX1qBKo2uLb'),
    ('BTUV0pTnHaGVU148Z')
);

-- REVIEW-ONLY SAFETY STOP. Remove only after the final delta review and
-- separate explicit production approval.
DO $$
BEGIN
  RAISE EXCEPTION 'REVIEW-ONLY SAFETY STOP: seed transaction rolled back';
END;
$$;

ROLLBACK;


