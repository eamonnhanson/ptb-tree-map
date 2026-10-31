# Rollback plan – demo map – 31 October 2026

## Stable recovery point

The pre-demo public tree-map application is permanently preserved at:

- branch: `stable/tree-map-2026-10-31`
- commit: `ef13fe290f3fefbd77bd267e169b660f227f4744`

This is the known stable application state before temporary demo reservations were made visible on the public map.

## Scope of the reversible change

The reversible demo-map release changes only:

- `api/trees.js`
- `frontend/app.js`

It does **not** change the PostgreSQL schema or demo reservation data.

The current PostgreSQL demo tables/functions created manually in Beekeeper therefore remain untouched by this map release.

## Immediate emergency stop

If anything behaves incorrectly after release:

1. Set Shopify product SKU `test` to DRAFT.
2. Turn the Zap `TEST – Shopify → 24h demo tree` off / leave it unpublished.
3. Roll the application deployment back to branch `stable/tree-map-2026-10-31` or revert the demo-map merge commit.

After application rollback the public map ignores `demo_orders` and `demo_order_trees` and behaves exactly as before the map change.

Existing normal customer tree ownership in `v_user_trees` is not changed by the demo-map code.

## Database recovery boundary

The demo-map PR performs no database writes or migrations.

Important: the earlier manual release of 600 trees cannot be reconstructed from Git because the user explicitly chose to remove those ownership links without an audit trail. If an exact database restore to a point before that manual release is ever required, use an Aiven database backup from before the release.

From this recovery point onward, no new production database migration should be applied without:

1. a backup/snapshot or reversible migration;
2. a corresponding rollback script;
3. verification on staging/test data first.

## Verification after rollback

Check:

- normal customer email lookup still returns normal trees;
- `/en/`, `/nl/` and `/fr/` map pages load;
- Forest Heroes still load;
- no DEMO marker appears;
- SKU02 checkout and existing tree allocation continue unchanged.
