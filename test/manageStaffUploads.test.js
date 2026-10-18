import test from 'node:test';
import assert from 'node:assert/strict';
import { createManageStaffUploads, STAFF_SCOPE } from '../api/manageStaffUploads.js';
import { issueStaffToken, requireStaff } from '../api/staffAccess.js';
import { createPhotoReviewGalleryHandler } from '../api/getPhotoReviewGallery.js';

const env = { STAFF_UPLOAD_KEY: 'local-test-password' };
const auth = { authorization: `Bearer ${issueStaffToken(env.STAFF_UPLOAD_KEY)}` };
const response = () => ({ code: 200, set() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const metadata = { caption: 'Nursery', location: 'Freetown', date_taken: null, tags: ['seedlings'], collections: ['nursery', 'training'], status: 'archived' };

test('public gallery rejects writes without reaching the registry', async () => {
  const handler = createPhotoReviewGalleryHandler({ dbPool: { query() { assert.fail('public write reached database'); } } });
  for (const method of ['PATCH', 'POST', 'DELETE']) {
    const res = response(); await handler({ method }, res); assert.equal(res.code, 405);
  }
});

test('staff sessions reject missing, forged, expired and wrong-key tokens', () => {
  for (const token of ['', 'forged.token', issueStaffToken('other'), issueStaffToken(env.STAFF_UPLOAD_KEY, Date.now() - 9 * 3600000)]) {
    const res = response(); assert.equal(requireStaff({ headers: { authorization: `Bearer ${token}` } }, res, env), false); assert.equal(res.code, 401);
  }
  assert.equal(requireStaff({ headers: auth }, response(), env), true);
});

test('unauthenticated listing and edits cannot access the database', async () => {
  const handler = createManageStaffUploads({ env, pool: { query() { assert.fail('unauthorized database access'); } } });
  for (const method of ['GET', 'PATCH']) {
    const res = response(); await handler({ method, headers: {} }, res); assert.equal(res.code, 401);
  }
});

test('listing defaults to active assigned projects and independently supports archive, unassigned, search and dates', async () => {
  const calls = [];
  const handler = createManageStaffUploads({ env, pool: { async query(sql, values) { calls.push({ sql, values }); return { rows: [] }; } } });
  for (const query of [{}, { status: 'archived', collection: 'unassigned', search: 'seedling' }, { status: 'all', collection: 'all' }, { status: 'active', collection: 'nursery', date_from: '2000-01-01' }]) {
    const res = response(); await handler({ method: 'GET', headers: auth, query }, res); assert.equal(res.code, 200);
  }
  const listings = calls.filter(call => call.values);
  assert.deepEqual(listings[0].values, ['active']);
  assert.match(listings[0].sql, /AND EXISTS/);
  assert.match(listings[1].sql, /NOT EXISTS/); assert.deepEqual(listings[1].values, ['archived', '%seedling%']);
  assert.match(listings[1].sql, /staff_tags/); assert.match(listings[1].sql, /staff_location/);
  assert.deepEqual(listings[2].values, []); assert.doesNotMatch(listings[2].sql, /staff_archive_status =/);
  assert.deepEqual(listings[3].values, ['active', 'nursery', '2000-01-01']);
  for (const listing of listings) {
    assert.ok(listing.sql.includes(STAFF_SCOPE));
    assert.doesNotMatch(listing.sql, /LIMIT 300|now\(\).*interval/);
  }
});

test('edits atomically assign multiple collections, archive and restore without replacing media or timestamp', async () => {
  const calls = [];
  const client = { async query(sql, values) {
    calls.push({ sql, values });
    return { rows: sql.startsWith('SELECT p.id') ? [{ id: 71 }] : sql.startsWith('SELECT id') ? [{ id: 'nursery' }, { id: 'training' }] : [] };
  }, release() { calls.push({ sql: 'release' }); } };
  const handler = createManageStaffUploads({ env, pool: { async connect() { return client; } } });
  for (const status of ['archived', 'active']) {
    const res = response(); await handler({ method: 'PATCH', headers: auth, params: { review_id: '71' }, body: { ...metadata, status } }, res); assert.equal(res.code, 200);
  }
  const updates = calls.filter(call => call.sql.startsWith('UPDATE'));
  assert.equal(updates[0].values[5], 'archived'); assert.equal(updates[1].values[5], 'active');
  for (const update of updates) assert.doesNotMatch(update.sql, /created_at_utc|file_url|verification_status|public_gallery_status/);
  assert.deepEqual(calls.find(call => call.sql.startsWith('INSERT')).values, ['71', ['nursery', 'training']]);
  assert.match(calls.find(call => call.sql.startsWith('SELECT p.id')).sql, /FOR UPDATE/);
  assert.equal(calls.filter(call => call.sql === 'COMMIT').length, 2);
});

test('inaccessible uploads return 404 and unknown collections roll back before writes', async () => {
  for (const accessible of [false, true]) {
    const calls = [];
    const client = { async query(sql) { calls.push(sql); return { rows: accessible && sql.startsWith('SELECT p.id') ? [{ id: 71 }] : [] }; }, release() {} };
    const handler = createManageStaffUploads({ env, pool: { async connect() { return client; } } });
    const res = response(); await handler({ method: 'PATCH', headers: auth, params: { review_id: '71' }, body: metadata }, res);
    assert.equal(res.code, accessible ? 400 : 404); assert.ok(calls.includes('ROLLBACK')); assert.ok(!calls.some(sql => /^(UPDATE|DELETE|INSERT)/.test(sql)));
  }
});

test('invalid dates and moderation fields are rejected', async () => {
  const handler = createManageStaffUploads({ env, pool: { connect() { assert.fail('invalid input reached database'); } } });
  for (const body of [{ ...metadata, date_taken: '2026-02-30' }, { ...metadata, public_gallery_status: 'public' }, { ...metadata, tags: 'unsafe' }]) {
    const res = response(); await handler({ method: 'PATCH', headers: auth, params: { review_id: '71' }, body }, res); assert.equal(res.code, 400);
  }
});
