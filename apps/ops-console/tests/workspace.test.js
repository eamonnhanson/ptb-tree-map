import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadWorkspace } from '../functions/_shared/workspace.js';
import { buildTasks } from '../frontend/workspace-model.js';
import { handler } from '../functions/workspace.js';

const rows=()=>Promise.resolve({rows:[],truncated:false,limit:100});
test('workspace isolates missing permissions and preserves genuine zero counts',async t=>{
  t.mock.method(console,'error',()=>{});
  const result=await loadWorkspace({listActions:rows,listWorkflows:rows,read:async sql=>{
    if(sql.includes('trees1'))throw Object.assign(new Error('private'),{code:'42501'});
    return {rows:[{count:'0'}]};
  }});
  assert.equal(result.sources.trees.available,false);
  assert.equal(result.sources.trees.data,null);
  assert.equal(result.sources.uploads.data.count,0);
  assert.equal(result.sources.questions.data.count,0);
  assert.equal(JSON.stringify(result).includes('private'),false);
});
test('tree count uses the dedicated Tree Map read path', async () => {
  const calls = [];
  const result = await loadWorkspace({
    listActions: rows,
    listWorkflows: rows,
    read: async () => ({ rows: [{ count: '4' }] }),
    readTrees: async (sql) => { calls.push(sql); return { rows: [{ count: '316' }] }; }
  });
  assert.equal(result.sources.trees.data.count, 316);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /public\.trees1/);
});
test('IMCD credit counts both linked countries once and makes a threshold action', async () => {
  const result = await loadWorkspace({
    listActions: rows, listWorkflows: rows, read: async () => ({ rows: [{ count: '0' }] }),
    readTrees: async sql => sql.includes('ops_console_tree_credits') ? { rows: [{ starts_at: '2026-09-09T22:00:00.000Z', opening_trees: '25', alert_threshold: '5', account_manager: 'Eamonn Hanson', topup_trees: '0', nl_trees: '2', be_trees: '18', balance: '5' }] } : { rows: [{ count: '10' }] }
  });
  assert.deepEqual(result.sources.imcd_credit.data, { starts_at: '2026-09-09T22:00:00.000Z', opening_trees: 25, alert_threshold: 5, account_manager: 'Eamonn Hanson', topup_trees: 0, nl_trees: 2, be_trees: 18, balance: 5 });
  assert.equal(buildTasks(result).find(t => t.id === 'imcd-tree-credit').title, 'IMCD has 5 trees remaining');
});
test('IMCD unavailable data is a repair action, never a zero balance', () => {
  const tasks = buildTasks({ sources: { imcd_credit: { available: false, data: null } }, partners: { configured: true, records: [] }, minimum_free_trees: 0 });
  assert.ok(tasks.some(t => t.id === 'imcd-tree-credit-repair'));
});
test('IMCD action thresholds include zero and negative balances but not six', () => {
  const source = balance => ({ sources: { imcd_credit: { available: true, data: { balance, alert_threshold: 5, account_manager: 'Eamonn Hanson' } } }, partners: { configured: true, records: [] }, minimum_free_trees: 0 });
  assert.equal(buildTasks(source(6)).some(t => t.id === 'imcd-tree-credit'), false);
  assert.match(buildTasks(source(0)).find(t => t.id === 'imcd-tree-credit').title, /used its tree credit/);
  assert.match(buildTasks(source(-2)).find(t => t.id === 'imcd-tree-credit').title, /2 trees beyond/);
});

test('free tree SQL treats a populated inventory code as compatible with free status', async () => {
  const source = readFileSync(new URL('../functions/_shared/workspace.js', import.meta.url), 'utf8');
  assert.match(source, /user_id is null[\s\S]*tree_name/);
  assert.doesNotMatch(source, /nullif\(trim\(tree_code\)/);
});

test('Tree Map uses its bundled public Aiven CA instead of a second large environment variable', () => {
  const database = readFileSync(new URL('../functions/_shared/db.js', import.meta.url), 'utf8');
  const certificate = readFileSync(new URL('../functions/_shared/tree-database-ca.js', import.meta.url), 'utf8');
  assert.match(database, /TREE_DATABASE_CA/);
  assert.match(certificate, /BEGIN CERTIFICATE/);
  assert.match(database, /withoutTlsUrlParameters/);
  assert.match(database, /sslmode/);
});

test('malformed aggregate counts are unavailable rather than zero',async t=>{
  t.mock.method(console,'error',()=>{});
  const r=await loadWorkspace({listActions:rows,listWorkflows:rows,read:async()=>({rows:[{count:null}]})});
  assert.equal(r.sources.trees.available,false);
});
test('missing monitoring becomes a specific follow-up, never a fake order failure',()=>{
  const tasks=buildTasks({sources:{},partners:{configured:false},minimum_free_trees:0});
  assert.ok(tasks.some(t=>t.id==='source-trees'));
  assert.ok(tasks.some(t=>t.id==='csr-setup'));
  assert.ok(!tasks.some(t=>t.id==='stock'));
  assert.ok(tasks.every(t=>t.action&&t.owner));
});
test('successful empty queues need no action while low stock and pending queues do',()=>{
  const available=data=>({available:true,data});
  const data={sources:{workflows:available({rows:[{workflow_id:'all',workflow_name:'Shopify subscription certificate CRM',health:{state:'GREEN'}}]}),actions:available({rows:[]}),trees:available({count:20}),imcd_credit:available({balance:6,alert_threshold:5,account_manager:'Eamonn Hanson'}),uploads:available({count:0}),questions:available({count:0})},partners:{configured:true,records:[]},minimum_free_trees:10};
  assert.deepEqual(buildTasks(data),[]);
  data.sources.trees.data.count=10;data.sources.uploads.data.count=3;
  assert.deepEqual(buildTasks(data).map(t=>t.id),['stock','uploads']);
});
test('new workspace rejects unauthenticated and write requests',async t=>{
  const before={user:process.env.OPS_CONSOLE_USER,password:process.env.OPS_CONSOLE_PASSWORD};
  t.after(()=>{for(const [key,value] of [['OPS_CONSOLE_USER',before.user],['OPS_CONSOLE_PASSWORD',before.password]])if(value===undefined)delete process.env[key];else process.env[key]=value;});
  process.env.OPS_CONSOLE_USER='test';process.env.OPS_CONSOLE_PASSWORD='test';
  assert.equal((await handler({httpMethod:'GET',headers:{}})).statusCode,401);
  assert.equal((await handler({httpMethod:'POST',headers:{authorization:'Basic '+Buffer.from('test:test').toString('base64')}})).statusCode,405);
});
test('new UI renders source content as text and ships no external scripts or demo data',()=>{
  const read=file=>readFileSync(new URL('../frontend/'+file,import.meta.url),'utf8');
  assert.doesNotMatch(read('workspace.js'),/\.innerHTML\s*=/);
  assert.doesNotMatch(read('workspace.js'),/examplePartners|saleOpen|1042/);
  assert.doesNotMatch(read('index.html'),/<script[^>]+src="https:/);
  assert.match(read('index.html'),/legacy.html/);
  for(const route of ['tree-map','csr','academy','upload'])assert.ok(read('index.html').includes('#'+route));
});
