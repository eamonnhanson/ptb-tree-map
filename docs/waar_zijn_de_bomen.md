# Waar zijn de bomen? — implementation and rollout

Status: repository implementation; **not deployed and no production SQL executed**. Two Shopify products now exist in the connected `planteenboom.nu` store as DRAFT only: production campaign product `16155239973194` / variant `64172816367946`, and internal TEST product `16155240005962` / variant `64172819480906`. Neither is active or purchasable. The verified normal one-off tree price is €10 (current SKU `02`). Active Zap versions, deployed view definition and database roles remain unverified. Do not enable or seed the training pool before completing the rollout gates below.


## A. Architecture

The exported workflow inventory and `sku01_order_link_runbook.md` show Shopify `new_paid_order_v3` → exact line-item SKU filters (`01` gift; `02` own) → Zapier PostgreSQL queries → `trees1` and `users1` → Zoho Creator/Writer/email. Zap 47 step 50 historically only selects free trees; the proposed atomic order reservation is documented but live adoption is unknown. Zap 61 steps 75/85 claim gift reservations and preserve `order_id`. Owned orders use Zaps 29/135; verify which copy is active. No HTTP allocator exists in this repository. Do not invent a webhook just for this campaign.

Subscriptions differ: Shopify subscription variants, not SKU, drive `process_shopify_subscription_payment`; Chargebee uses another payment ledger. Both reuse `trees1`. Those SQL definitions now exclude test rows. Historical integration harnesses already require isolated localhost databases; they are not Shopify checkout sandboxes.

`order_id` is Shopify's internal numeric ID stored as text, not the visible order name. `user_id` links `users1`. Existing tree codes and coordinates identify trees. `api/trees.js` reads `v_user_trees` for email/user lookup; Forest Heroes reads `trees1` joined to subscription users. The by-code and detail handlers were placeholders; they now return actual allocated records with explicit warnings. Campaign owned-tree purchases are claimed immediately, following the owned-tree journey; gift-token claiming is not part of this campaign.

`027_campaign_test_trees.sql` adds backwards-compatible `trees1.is_test NOT NULL DEFAULT false`, `source_sku`, a code-prefix constraint (NOT VALID avoids scanning/rejecting historical data during migration), campaign product configuration and order ledger. It does not seed or rewrite existing rows. Classification cannot be changed after insertion. An update guard blocks legacy assignment of fake trees unless an explicit matching campaign ledger entry exists.

`allocate_campaign_order` reuses the existing user upsert/free-tree predicates and Shopify advisory lock pattern. It validates configured SKU **and** product/variant identity, quantity, currency and exact unit price; locks an exact pool (`is_test = policy.is_test`), assigns the user/order and preserves tree identity. All failures roll back; `TEST_POOL_EMPTY` never falls back. Order retries return the same trees; changed SKU, quantity or email rejects a replay. A mixed cart must be rejected before invocation: one campaign line per order, quantity 1–100. No browser-supplied flag controls classification. The authenticated Zap must use a fresh Shopify Get Order response, not line properties, notes, tags, a URL flag or customer email patterns.

The ledger stores order ID, explicit SKU/classification, user, email, tree IDs and timestamp. Restrict table access to the authenticated automation role; the ledger contains personal data. Allocation and replenishment are SECURITY INVOKER and revoked from PUBLIC. The read-only trigger guard is SECURITY DEFINER with a fixed search path and schema-qualified objects so existing production writers do not need access to the private campaign ledger. Its owner must be a trusted migration role. Grant EXECUTE only to the dedicated Zap database role; grant the required SELECT/INSERT/UPDATE permissions for registry/ledger/users/trees and sequence access after reviewing the actual role. Grant no maintenance-function access to the web/map role. Registry writes and replenishment belong only to a trusted operator. Logs contain order/SKU/classification/tree IDs on success and SQLSTATE on failure, not email. Tree codes are in the returned `assigned_trees`; correlate by order and tree IDs.

The full [allocation/reporting audit](campaign_separation_audit.md) lists every discovered writer, query node, certificate route, filter and unresolved external dependency. It supersedes the earlier assumption that only Shopify/Chargebee and gift sales needed review.

## B. Production product

Upload `shopify/sections/waar-zijn-de-bomen.liquid` and its `product.waar-zijn-de-bomen.json` template into a **theme preview**. A dedicated DRAFT one-variant product now exists with SKU `PNB-WAAR-ZIJN-DE-BOMEN`, product ID `16155239973194`, variant ID `64172816367946`, verified existing normal tree price €10, EUR, and no subscription selling plan. Keep it DRAFT until the remaining gates pass, then assign the campaign template before activation. Do not guess the price from monthly donation amounts. Check nomination contact form delivery, mobile layout and add-to-cart against the actual theme before publishing.

The page uses Shopify's normal product form/cart/checkout. Purchases allocate real trees in Sierra Leone; the Dutch location nomination does not promise planting there. Product and variant IDs plus price live in `campaign_products`, not application source. Insert the two verified registry records with `enabled=false` using bound parameters; production `is_test=false, unit_price>0`; test `is_test=true, unit_price=0`. Production allocation uses the same owned-tree user/order association and existing downstream customer delivery steps.

## C. Hidden €0 test product

A separate DRAFT one-variant product now exists, SKU `PNB-WAAR-ZIJN-DE-BOMEN-TEST`, product ID `16155240005962`, variant ID `64172819480906`, price **€0.00**, EUR. Assign `product.waar-zijn-de-bomen-test.json`; its section always labels the order as training and only renders for logged-in customers tagged `pnb-training`.

Use Shopify's **Unlisted** product status if supported by this store: direct URL only, omitted from native search, collections and sitemap. Remove all navigation/recommendation/manual-collection references and audit third-party search feeds. Set `seo.hidden=1` where applicable. If Unlisted or equivalent exclusion cannot be verified, keep the product unpublished and use a separate development store for checkout testing until a supported hidden checkout is configured. An unpublished product normally cannot be bought through the storefront; do not assume otherwise.

**Liquid access checks are not checkout authorization.** A customer can submit a variant ID directly to cart. The connected store is on Shopify Basic. Shopify documentation states that stores on any plan can use public App Store apps containing Shopify Functions, but custom apps containing Shopify Function APIs require Shopify Plus. Therefore this Basic store cannot rely on a bespoke private/custom Cart and Checkout Validation Function for the TEST variant. Before enabling the €0 product, choose one of two supported routes: **(A)** use a separate Shopify development/staging store connected only to a staging database/Zap path, or **(B)** install a public Shopify App Store product-lock/checkout-validation app that can server-side require an authenticated `pnb-training` customer, prohibit mixed carts, and constrain quantity for this variant. Verify direct-cart and accelerated-checkout attempts as an untagged customer fail. Without one of these controls, keep the TEST product DRAFT and registry disabled. Do not create public zero-price discounts or zero-price production variants. Theme gating alone does not meet the requirement.

## D. Shopify setup

Manual steps only after separate rollout approval: the connected store is confirmed as `planteenboom.nu`, Shopify Basic, EUR, and the normal one-off tree price is verified at €10. The two distinct products/variants/SKUs already exist as DRAFT. Preview the two section/template pairs and keep the TEST product DRAFT initially. Use the recorded numeric product/variant IDs and insert disabled registry entries using the version-controlled `028_campaign_product_registry.sql` only after migration 027 has been reviewed/applied in the target environment. Verify Unlisted/native and third-party search exclusions, account eligibility, direct cart and accelerated checkout server-side restrictions, no mixed carts and no campaign discounts. Confirm €0 order trigger semantics. Do not enable the test variant or registry until the database, Zapier, reports and certificate gates below pass. A theme preview alone cannot prove checkout authorization.

## E. Zapier changes

1. Export the **current live** Zaps and keep existing `01`/`02` filters. Verify their exact-match behavior; never globally replace them with “all orders”. Historical source is not proof of live status.
2. Extend the existing owned-tree orchestration with a mutually exclusive campaign path matching either full campaign SKU. Preserve the old paths. Retrieve the full order using Shopify Get Order by ID and require exactly one campaign line and no other lines. Use its internal order ID, line SKU/product ID/variant ID/quantity, unit price, EUR currency and customer email. Normalize numeric GIDs to their numeric suffix. Reject mismatched identities before SQL. Do not let the campaign path also run legacy allocation.
3. Verify a completed €0 order fires the current `New Paid Order` trigger. If not, use Shopify New Order for a **test-only** path requiring the exact configured test SKU/product/variant, total zero and completed/paid status; retrieve Get Order and call the same allocator. Keep production's paid-order trigger. Two triggers must not run duplicate downstream delivery; the function returns `duplicate` to filter replays.
4. Invoke through the authenticated PostgreSQL action using actual parameter binding:

   ```sql
   SELECT public.allocate_campaign_order(
     $1::text, $2::text, $3::text, $4::text,
     $5::integer, $6::numeric, $7::text, $8::text
   ) AS allocation;
   ```

   Parameters in order: internal Shopify order ID, exact SKU, Shopify product ID, variant ID, line quantity, **pre-discount unit price**, currency, customer email from Get Order. Require no discounts on these campaign lines. Stop on exceptions. If the Zapier action cannot bind parameters, use a supported prepared-query action; do not paste unescaped customer fields into SQL templates.
5. Consume `allocation.assigned_trees` as existing `Assigned_Trees`, retain `allocation.order_id` and explicit `is_test`. Stop downstream steps when `duplicate=true`. For tests, ensure every Creator job, Writer template, email subject/body and CRM record prominently includes **TEST TREE – not a real planted tree** and the explicit test flag. Never pass tests into an unlabelled certificate, donor workflow or impact aggregator. Until those external templates/filters are updated, stop the test path before those side effects. Configure retry separately for delivery failures (duplicate allocation is intentionally not a delivery retry queue).
6. Before introducing fake trees, update **all live** free-tree queries (Zaps 29/47/95/135/141 and any additional writers found in the live export) with `AND is_test = FALSE`. Apply the updated subscription function bodies where installed after schema review; editing historical SQL does not update deployed functions. Do not rerun migration seeds/backfills just to update a function. The test-tree trigger is a fail-closed backstop; an unmodified legacy query might select fake rows and fail a real sale, so it does not replace this audit.

The required audit also covers historical IMCD Zaps 1/15, all manual subscription branches, Zap 61 production certificate reads and reporting Zaps 124/129. Use the exact step inventory in [the audit](campaign_separation_audit.md). Every production free-tree selector **and ID-based writer** must enforce FALSE; row-ID update actions without conditional WHERE need to become guarded prepared SQL retaining their existing field mappings. Do not edit the historical export as if it changed live Zapier. Record current active/paused status and safely test current live copies in an isolated environment.

## F. Database migration

Repository impact counts in ops workspace available-tree totals and IMCD credit usage now exclude tests, with a JSON column lookup that works before migration. Subscription free pools and the SKU01 reservation runbook exclude tests as well. SKU01/02 operational allocation counts and the heroes diagnostic count also exclude test rows. Detailed diagnostic history may retain test codes for diagnosis; use the campaign ledger for the campaign route. Existing ops SKU01/02 trackers do not automatically become campaign trackers.

External donor reports, Shopify sales/customer analytics, Creator/CRM dashboards and live SQL/view definitions cannot be audited here. Before activation, enumerate them and filter out test order IDs/SKUs and `is_test=true` rows; tag Shopify test orders explicitly through the verified automation. Use `WHERE is_test = FALSE` for planted/available/claimed/impact trees and `WHERE is_test = FALSE` for campaign order sales/customer counts. Shopify platform-wide customer counts can still include training customers; do not present unfiltered platform analytics as production impact. Do not enable the registry until this gate and certificate labels are verified.

Migration 027 is review-only and has **NOT been applied** to production. In a disposable test database, review the live-schema equivalent and run the version-controlled file twice. Verify existing ownership/order rows remain byte-for-byte equivalent and receive `is_test=FALSE`, never TRUE. New flags have NOT NULL / FALSE defaults. The code-prefix constraint uses NOT VALID to avoid scanning/rejecting historical rows; it still checks new writes. Incompatible pre-existing schema requires review, not a bulk UPDATE/backfill.

The partial `(is_test,id)` index covers the full free-tree predicate and ordered LIMIT selection. A partial order-ID index supports the idempotency lookup. Index creation and ALTER TABLE acquire locks: schedule and assess live table size, available disk, role privileges and query plans before any separately approved production migration. The index is intentionally not built concurrently inside this transaction. Functions use CREATE OR REPLACE; tables/indexes/constraint/trigger have guarded creation so an identical migration can be rerun. This is not a general schema-reconciliation tool; inspect any pre-existing object with the same name.

No migration UPDATE/DELETE changes existing ownership, order, claim, coordinate or code fields. The migration does not call replenishment, enable registry entries, seed real data or apply old subscription backfills. The test-only insert is inside an explicit owner-only function. Revoke PUBLIC execute, grant the dedicated transport/maintenance roles narrowly, and verify map read permissions. Re-apply only reviewed function definitions for installed 011/014 allocators; do not replay their seed/backfill migrations automatically.

Review schema compatibility (including required insert columns, tree code length, view joins and unique codes), backup and migration on a disposable database first. Deploy API/map code and reviewed SQL through the current verified deployment process; do not rely on historical staging notes. Apply reviewed live-query/function/report changes, configure checkout restrictions and downstream labels, then enable registry entries. Only afterwards may the owner create fake trees:

## G. Creating/replenishing test trees

```sql
SELECT public.replenish_campaign_test_pool('CREATE FAKE WZDB TREES', 100);
```

The function is owner-only by default, requires explicit confirmation, an enabled test product and count 1–100. It inserts only `is_test=TRUE` rows with `TEST-WZDB-########` codes, NULL planted date and a labelled synthetic cluster at 0°N, 30°W (ocean, outside Sierra Leone). Repeated calls replenish the pool without erasing orders/claims/history. There is deliberately no reset/delete endpoint. Stop using an old training order after its demo; use a new Shopify order for another allocation.

## H. End-to-end test procedure

An authorized tagged team member opens the configured hidden product URL and checks out for €0. Confirm the Zap trigger and exact identity mapping, successful allocator result and ledger classification; retrieve `campaign_orders` by internal Shopify ID and inspect `tree_ids`. Enter the returned `TEST-WZDB-...` code in the existing map search; check the TEST result label, yellow marker and popup warning. Email/user map lookup depends on the existing `v_user_trees` definition and must be verified against the live view. Test customers need not be Forest Heroes subscribers.

Database recognition:

```sql
SELECT order_id, sku, is_test, user_id, tree_ids, created_at
FROM public.campaign_orders WHERE is_test = TRUE ORDER BY created_at DESC;
SELECT id, tree_code, is_test, source_sku, order_id, user_id
FROM public.trees1 WHERE is_test = TRUE ORDER BY id;
```

Use synthetic customer email addresses and restrict ledger queries. Verify the production SKU uses the normal price and only real trees, test exhaustion produces `TEST_POOL_EMPTY`, unknown variant/price rejects before mutation, replay returns the same trees, and untagged direct-cart attempts cannot buy the test variant. No production trees should be consumed to test the implementation.

Local release-blocking proof: a valid TEST order with **zero** free fake trees and free real rows raises `TEST_POOL_EMPTY`; tests compare all production row fields, users and order ledger before/after and inspect the structured error log. Production succeeds with both pools available and fails with only fake rows available. The existing Shopify and Chargebee functions are also executed against fake-first mixed pools and empty production pools. Native PostgreSQL 16 CI additionally verifies campaign concurrency with independent connections. These are calls to the actual PostgreSQL allocation entrypoints; no separate HTTP allocator was added.

Native PostgreSQL concurrency is now also exercised automatically in CI against PostgreSQL 16 using independent connections. The campaign integration job verifies concurrent distinct TEST orders, concurrent duplicate idempotency, `SKIP LOCKED` behavior and TEST-pool exhaustion without crossing into production. Repeat the end-to-end acceptance in staging against the actual deployed schema/roles, then verify real Shopify → Zapier → allocation → labelled customer evidence → map against the staging/test store, without consuming production trees.

## I. Rollback procedure

This describes a future operator action, not an action performed in this task. Stop accepting new campaign/test checkouts and pause only the campaign Zap branches; keep legacy production sales paths intact. Disable both campaign registry entries under the dedicated operator identity. Inspect in-flight orders and reconcile allocations before allowing retries. Keep test records and the immutable ledger for diagnosis; do not reset/delete trees, clear ownership or replay orders to a different pool.

Prefer a forward fix. Retain the additive `is_test` column/default, code constraint, indexes and fake-tree guard. **Never roll production selectors or impact filters back to unfiltered versions while test records exist.** Do not revert the guard or drop the ledger with allocated test rows. If rolling back frontend/API builds, keep an explicit TEST warning and distinct labels or make training lookup unavailable until repaired; an old map build may display fake records without warnings. Do not expose them through an old unlabelled map. Review any schema removal separately after disabling training and auditing every reader/writer. No destructive down migration is supplied.

## J. Go/no-go checklist

All unchecked items remain rollout gates. Local automated proof does not tick off external acceptance.

- [ ] TEST order with test trees succeeds
- [ ] TEST order with empty test pool fails safely
- [ ] TEST order never allocates production tree
- [ ] Production order never allocates test tree
- [ ] Production order with empty production pool fails safely
- [ ] Test tree visible and clearly labelled on map
- [ ] Test tree excluded from reporting
- [ ] Existing production checkout still works
- [ ] Existing subscription allocation still works
- [ ] Zapier distinguishes test SKU correctly
- [ ] Current active/paused writers audited, including Zaps 1/15/29/47/61/95/135/141
- [ ] Monthly report 124 and customer photo/count workflow 129 exclude tests
- [ ] Creator/Writer/email outputs exclude or visibly label TEST records
- [ ] Shopify direct-cart and accelerated checkout eligibility enforced server-side
- [ ] Verified live schema, backups, role grants, migration rerun and index-lock plan reviewed
- [x] Native PostgreSQL 16 concurrency CI passed
- [ ] Staging checkout/claim/evidence/map acceptance completed
- [ ] Rollback preserves pool guards, production filters and visible map labels
- [ ] Separate approval obtained for any external rollout

## Local verification and scope-test comparison

`npm test` includes `test/campaignAllocation.test.js` using embedded PostgreSQL (PGlite), with no external credentials. It executes the migration, both allocations, replay and invalid identity/price rejection, empty-pool rollback, fake-tree legacy-write protection, replenishment confirmation and a real SQL-backed map code lookup. Native PostgreSQL concurrency and live Shopify/Zapier checkout still require the isolated staging acceptance above. No final sales-representative instructions are included here.

The earlier two-failure classification has been corrected by a clean comparison against fetched main at `ef13fe2`. Main: **301 passed, 0 failed, 5 skipped (306 total)**. Feature before fixes: **314 passed, 1 failed, 5 skipped (320 total)**. The working-tree assertion is caused by this campaign, not pre-existing main failure. The former branch-history assertion was caused by a stale local origin/main and disappears after fetching current main. Full exact names, messages, paths and remediation are in [the audit](campaign_separation_audit.md).

Strict ops-only deployment enforcement was moved to `npm run check:scope --prefix apps/ops-console`, also the first step of the ops `check` command. It still rejects the actual campaign branch with no scope exception; both named tests now prove the enforcement against accepted and rejected fixtures, and the existing temporary-git regression still tests real working/staged/committed paths. No test is skipped to make this feature pass. The root suite can exercise unrelated application features without asserting that every branch is an ops-only deployment.

Final suite counts and commit/PR details are recorded in the draft PR and task handoff. Five native database integration harnesses skip without their explicit isolated URLs. Nothing has been deployed; migration 027 has not been applied; Shopify/Zapier/Render/Netlify/Cloudflare/production PostgreSQL remain unchanged.


Final verification on this implementation: `npm test` — **324 total, 319 passed, 0 failed, 5 skipped**. Focused campaign/migration/map/reporting checks: **16 passed**; executed existing Shopify/Chargebee mixed-pool and exhaustion checks: **2 passed**. `git diff --check` passes. The explicit ops-only `check:scope` command rejects this mixed-scope branch by design; it is not a failing unit test or authorization to deploy.
