import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { createTreesByCodesHandler } from '../api/treesByCodes.js';
import { labelTree } from '../api/treeLookup.js';
import { COUNT_QUERIES, IMCD_CREDIT_QUERY } from '../apps/ops-console/functions/_shared/workspace.js';

const migration = await readFile(new URL('../docs/sql/027_campaign_test_trees.sql', import.meta.url), 'utf8');
test('campaign migration and allocation on isolated embedded PostgreSQL', async t => {
 const db = new PGlite();
 const notices = [];
 const query = (sql, args=[]) => db.query(sql,args,{onNotice:n=>notices.push(n)});
 try {
 await db.exec(`CREATE TABLE users1(id serial PRIMARY KEY, email text UNIQUE, first_name text, last_name text, subscription_type text, created_at timestamp, updated_at timestamp);
 CREATE TABLE trees1(id serial PRIMARY KEY, tree_code text UNIQUE, tree_type text, area text, tree_name text,
 lat numeric, "long" numeric, planted_date date, user_id integer, order_id varchar(50),
 is_claimed boolean DEFAULT false, purchase_date timestamp, reserved_token text, claimed_at timestamptz,
 unclaimed_user_id integer, updated_at timestamp);`);
 await db.exec(`INSERT INTO trees1(tree_code,lat,"long",user_id,order_id) VALUES ('HISTORIC',9,-12,42,'12345');`);
 const historic=(await query("SELECT * FROM trees1 WHERE tree_code='HISTORIC'")).rows[0];
 await db.exec(migration);
 await t.test('migration preserves existing ownership and defaults old records to production; rerun is safe',async()=>{
  const after=(await query("SELECT * FROM trees1 WHERE tree_code='HISTORIC'")).rows[0];
  assert.equal(after.is_test,false);
  const {is_test,source_sku,...original}=after; assert.deepEqual(original,historic);
  await db.exec(migration);
  assert.equal((await query("SELECT count(*)::int AS n FROM pg_indexes WHERE indexname IN ('trees1_campaign_free_pool_idx','trees1_campaign_order_idx')")).rows[0].n,2);
 });
 await db.exec('SET client_min_messages=log');
 await db.exec(`INSERT INTO campaign_products VALUES
 ('PNB-WAAR-ZIJN-DE-BOMEN','100','101',false,10,true),
 ('PNB-WAAR-ZIJN-DE-BOMEN-TEST','200','201',true,0,true);
 INSERT INTO trees1(tree_code,lat,"long") VALUES ('REAL-1',9,-12),('REAL-2',9,-12);
 SELECT replenish_campaign_test_pool('CREATE FAKE WZDB TREES', 2);`);
 const allocate = (order, isTest, overrides={}) => {
  const x={order,sku:'PNB-WAAR-ZIJN-DE-BOMEN'+(isTest?'-TEST':''),product:isTest?'200':'100',variant:isTest?'201':'101',quantity:1,price:isTest?0:10,currency:'EUR',email:'synthetic@example.invalid',...overrides};
  return query('SELECT allocate_campaign_order($1,$2,$3,$4,$5,$6,$7,$8) AS result',Object.values(x)).then(r=>r.rows[0].result);
 };
 let first;
 await t.test('€0 test purchase assigns only fake tree and records user/order',async()=>{
  first=await allocate('1000',true);
  assert.equal(first.is_test,true); assert.equal(first.assigned_trees.length,1);
  assert.match(first.assigned_trees[0].tree_code,/^TEST-WZDB-/);
  assert.match(first.assigned_trees[0].warning,/not a real planted tree/);
  const row=(await query("SELECT * FROM trees1 WHERE order_id='1000'")).rows[0];
  const log=notices.map(n=>{try{return JSON.parse(n.message)}catch{return null}}).find(n=>n?.order_id==='1000');
  assert.equal(log.allocation_environment,'TEST');assert.equal(log.result,'ALLOCATED');
  assert.deepEqual(log.tree_codes,[row.tree_code]);
  assert.equal(row.is_claimed,true); assert.ok(row.user_id); assert.equal(row.source_sku,'PNB-WAAR-ZIJN-DE-BOMEN-TEST');
 });
 await t.test('production purchase only assigns real tree',async()=>{
  const r=await allocate('1001',false);assert.equal(r.assigned_trees[0].is_test,false);
  assert.equal(r.assigned_trees[0].tree_code,'REAL-1');
 });
 await t.test('retry returns same tree; conflicting replay is rejected',async()=>{
  const r=await allocate('1000',true); assert.equal(r.duplicate,true);assert.deepEqual(r.assigned_trees,first.assigned_trees);
  await assert.rejects(allocate('1000',true,{quantity:2}),/Conflicting/);
 });
 await t.test('identity, zero production price and null inputs fail closed',async()=>{
  await assert.rejects(allocate('1002',true,{variant:'101'}),/identity/);
  await assert.rejects(allocate('1002',false,{price:0}),/price/);
  await assert.rejects(allocate('1002',true,{sku:null}),/identity/);
  await assert.rejects(allocate('1002',true,{quantity:null}),/Invalid/);
 });
 await t.test('insufficient test pool rolls back without touching production or ledger',async()=>{
  await assert.rejects(allocate('1003',true,{quantity:2}),/TEST_POOL_EMPTY/);
  assert.equal((await query("SELECT count(*)::int AS n FROM campaign_orders WHERE order_id='1003'")).rows[0].n,0);
  assert.equal((await query("SELECT count(*)::int AS n FROM trees1 WHERE is_test=false AND user_id IS NULL")).rows[0].n,1);
  await allocate('1004',true);
  const before=(await query('SELECT * FROM trees1 WHERE is_test=false ORDER BY id')).rows;
  const usersBefore=(await query('SELECT * FROM users1 ORDER BY id')).rows;
  await assert.rejects(allocate('1005',true),/TEST_POOL_EMPTY/);
  assert.deepEqual((await query('SELECT * FROM trees1 WHERE is_test=false ORDER BY id')).rows,before);
  assert.deepEqual((await query('SELECT * FROM users1 ORDER BY id')).rows,usersBefore);
  assert.equal((await query("SELECT count(*)::int AS n FROM campaign_orders WHERE order_id='1005'")).rows[0].n,0);
  const log=notices.map(n=>{try{return JSON.parse(n.message)}catch{return null}}).find(n=>n?.order_id==='1005');
  assert.equal(log?.allocation_environment,'TEST');assert.equal(log?.result,'TEST_POOL_EMPTY');
  assert.deepEqual(log.tree_ids,[]);assert.equal('email' in log,false);
 });
 await t.test('legacy SQL and reclassification cannot assign fake trees',async()=>{
  await query("SELECT replenish_campaign_test_pool('CREATE FAKE WZDB TREES',1)");
  await assert.rejects(query("UPDATE trees1 SET user_id=1,is_claimed=true WHERE is_test AND user_id IS NULL"),/matching campaign order/);
  await assert.rejects(query("UPDATE trees1 SET reserved_token='legacy-gift' WHERE is_test AND user_id IS NULL"),/matching campaign order/);
  await assert.rejects(query("INSERT INTO trees1(tree_code,is_test,user_id) VALUES('TEST-WZDB-99999999',true,1)"),/matching campaign order/);
  await assert.rejects(query("UPDATE trees1 SET is_test=true WHERE tree_code='REAL-2'"),/immutable/);
  await assert.rejects(query("SELECT replenish_campaign_test_pool(NULL,100)"),/confirmation/);
 });
 await t.test('map by-code search returns actual allocated fake tree with warning',async()=>{
  const handler=createTreesByCodesHandler(query);
  const res={status(c){this.statusCode=c;return this},json(v){this.body=v;return this}};
  await handler({query:{codes:first.assigned_trees[0].tree_code}},res);
  assert.equal(res.body.count,1); assert.equal(res.body.items[0].is_test,true);
  assert.match(res.body.items[0].warning,/TEST TREE/);
  await handler({query:{codes:"x'); DROP TABLE trees1; --"}},res);
  assert.equal(res.body.count,0);
 });
 await t.test('map Forest Hero search SQL remains executable and exposes explicit test flag',async()=>{
  await query("UPDATE users1 SET subscription_type='training' WHERE email='synthetic@example.invalid'");
  const source=await readFile(new URL('../api/forestHeroSearch.js',import.meta.url),'utf8');
  const sql=source.match(/const sql = `([\s\S]*?)`;/)[1];
  const rows=(await query(sql,[first.assigned_trees[0].tree_code])).rows;
  assert.equal(rows.length,1); assert.equal(rows[0].is_test,true);
 });
 await t.test('production pool exhaustion cannot take remaining fake trees',async()=>{
  await allocate('1006',false);
  await assert.rejects(allocate('1007',false),/PRODUCTION_POOL_EMPTY/);
  assert.equal((await query("SELECT count(*)::int AS n FROM trees1 WHERE is_test AND user_id IS NULL")).rows[0].n,1);
 });
 await t.test('replenishment creates 100 fake trees with no planted date in a separate ocean cluster',async()=>{
  await query("SELECT replenish_campaign_test_pool('CREATE FAKE WZDB TREES',100)");
  const r=(await query("SELECT count(*)::int AS n FROM trees1 WHERE is_test AND planted_date IS NULL AND lat BETWEEN 0 AND 1 AND \"long\" BETWEEN -31 AND -29")).rows[0];
  assert.equal(r.n,103);
  await query("UPDATE campaign_products SET enabled=false WHERE is_test");
  await assert.rejects(query("SELECT replenish_campaign_test_pool('CREATE FAKE WZDB TREES',100)"),/disabled/);
 });
 await t.test('legacy writer remains able to update real trees without private ledger access',async()=>{
  await db.exec('CREATE ROLE campaign_legacy; GRANT USAGE ON SCHEMA public TO campaign_legacy; GRANT SELECT, UPDATE ON trees1 TO campaign_legacy; SET ROLE campaign_legacy;');
  try {
   await query("UPDATE trees1 SET tree_name='Production tree' WHERE tree_code='REAL-2'");
   await assert.rejects(query("SELECT replenish_campaign_test_pool('CREATE FAKE WZDB TREES',1)"),/permission denied/);
  } finally {await db.exec('RESET ROLE');}
 });
 await t.test('credit reporting excludes fake allocations to the same customer',async()=>{
  await db.exec(`CREATE TABLE ops_console_tree_credits(customer_code text, starts_at timestamptz, opening_trees integer, alert_threshold integer, account_manager text);
   CREATE TABLE ops_console_tree_credit_topups(credit_code text, trees integer);
   CREATE TABLE ops_console_tree_credit_accounts(credit_code text, user_id integer, region text);
   INSERT INTO ops_console_tree_credits VALUES('imcd_benelux',now()-interval '1 day',10,2,'Synthetic');
   INSERT INTO ops_console_tree_credit_accounts SELECT 'imcd_benelux',id,'NL' FROM users1 WHERE email='synthetic@example.invalid';`);
  const row=(await query(IMCD_CREDIT_QUERY)).rows[0];
  assert.equal(Number(row.nl_trees),2);assert.equal(Number(row.balance),8);
 });
 await t.test('production count excludes synthetic cluster',async()=>{
  assert.equal((await query(COUNT_QUERIES.trees)).rows[0].count,'0');
  assert.equal((await query('SELECT count(*)::int AS n FROM trees1 WHERE is_test=false')).rows[0].n,3);
  assert.equal(labelTree({tree_code:'TEST-WZDB-00000001'}).is_test,true);
 });
 } finally {await db.close();}
});

test('map actually renders a distinct TEST marker and popup warning',async()=>{
 const source=await readFile(new URL('../frontend/app.js',import.meta.url),'utf8');
 const render=source.slice(source.indexOf('function renderTrees(rows)'),source.indexOf('// 🧼'));
 const rendered=[];
 const context={markers:{clearLayers(){},addLayer(){}},markersByCode:new Map(),clearSelection(){},ensureCodePanel(){},renderCodeList(){},
  text:{intlLocale:'en',treeCount:n=>String(n)},msg:{},map:{fitBounds(){}},treeIcon:{real:true},
  L:{divIcon:x=>x,marker(coords,options){return {options,bindPopup(popup){rendered.push({options,popup});return this},on(){}}}}};
 vm.runInNewContext(source.split('\n').slice(0,2).join('\n')+'\n'+render+";renderTrees([{tree_code:'TEST-WZDB-00000001',is_test:true,lat:0,long:-30},{tree_code:'REAL-1',is_test:false,lat:9,long:-12}]);",context);
 assert.match(rendered[0].popup,/TEST TREE – not a real planted tree/);
 assert.equal(rendered[0].options.testIcon.html,'TEST');
 assert.doesNotMatch(rendered[1].popup,/TEST TREE/);
 assert.equal(rendered[1].options.testIcon,null);
 assert.match(context.msg.textContent,/^1 · TEST TREE: 1 training records$/);
});
