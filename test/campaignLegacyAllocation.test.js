import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Execute both existing allocators rather than just matching their source text.
for (const provider of ['shopify', 'chargebee']) {
 test(`${provider} subscription cannot consume test trees, including when production is empty`, async () => {
  const db = new PGlite();
  try {
   await db.exec(`CREATE TABLE users1 (
    id serial PRIMARY KEY, email text NOT NULL UNIQUE, first_name text, last_name text,
    chargebee_id text, subscription_type text, subscription_info jsonb,
    created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
   CREATE UNIQUE INDEX users1_normalized_email_unique_idx ON users1(lower(trim(email)));
   CREATE TABLE trees1 (
    id serial PRIMARY KEY, user_id integer REFERENCES users1(id), area text, lat numeric, "long" numeric,
    planted_date date, purchase_date timestamp, tree_code text UNIQUE, tree_id integer, tree_name text,
    tree_type text, unclaimed_user_id integer, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(),
    order_id varchar(50), reserved_token text, claimed_token text, claimed_at timestamptz,
    claim_email_sent_at timestamptz, is_claimed boolean DEFAULT false);`);
   const filename = provider === 'shopify' ? '011_shopify_subscription_tree_allocation.sql' : '014_chargebee_subscription_payment_allocation.sql';
   await db.exec(await readFile(new URL(`../docs/sql/${filename}`, import.meta.url),'utf8'));
   await db.exec(await readFile(new URL('../docs/sql/027_campaign_test_trees.sql',import.meta.url),'utf8'));
   if (provider === 'chargebee') await db.exec("INSERT INTO chargebee_subscription_cutover_policy(singleton,cutover_at) VALUES(true,'2026-01-01T00:00:00Z')");
   // Fake tree comes first: an unguarded ORDER BY id would select it.
   await db.exec(`INSERT INTO trees1(tree_code,tree_type,lat,"long",is_test) VALUES
    ('TEST-WZDB-00000001','TEST',0,-30,true), ('REAL-SUB-1','Cashew',9,-12,false);`);
   const call = n => provider === 'shopify'
    ? db.query(`SELECT * FROM process_shopify_subscription_payment($1,$2,'53296965419338',
      'synthetic@example.invalid','2026-08-20T08:00:00Z',10,NULL,NULL,'EUR','ptb_subscription')`, [`900${n}`,`800${n}`])
    : db.query(`SELECT * FROM process_chargebee_subscription_payment(
      $1,$2,'1-boom-per-maand-EUR-Monthly','synthetic@example.invalid',
      '2026-01-02T10:00:00Z','2026-01-01T00:00:00Z','2026-02-01T00:00:00Z',
      $3,'line-test','customer-test','Test','Customer','active','2026-01-01T00:00:00Z',1000,'EUR','2026-01-01T00:00:00Z')`,[`txn-${n}`,`sub-${n}`,`invoice-${n}`]);
   await call(1);
   const fakeBefore=(await db.query('SELECT * FROM trees1 WHERE is_test=true')).rows;
   assert.equal((await db.query("SELECT is_claimed FROM trees1 WHERE tree_code='REAL-SUB-1'")).rows[0].is_claimed,true);
   assert.equal(fakeBefore[0].user_id,null);
   await assert.rejects(call(2),/Insufficient free trees/);
   assert.deepEqual((await db.query('SELECT * FROM trees1 WHERE is_test=true')).rows,fakeBefore);
   assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${provider}_subscription_payments`)).rows[0].n,1);
  } finally {await db.close();}
 });
}
