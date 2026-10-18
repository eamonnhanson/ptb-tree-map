import test from 'node:test';
import assert from 'node:assert/strict';
import { createManageStaffUploads } from '../api/manageStaffUploads.js';
import { createStaffLoginHandler } from '../api/staffAccess.js';
import { createPhotoReviewGalleryHandler } from '../api/getPhotoReviewGallery.js';
import { localManagementPool, resetManagementDatabase } from './helpers/staffManagementDatabase.js';

const connectionString = process.env.PTB_STAFF_MANAGEMENT_POSTGRES_TEST_URL;
const response = () => ({ code: 200, set() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('migration 026 and staff management on isolated PostgreSQL', {
  skip: !connectionString && 'dedicated local staff management database unavailable'
}, async t => {
  const pool = localManagementPool(connectionString);
  try {
    const { ids, legacyBefore } = await resetManagementDatabase(pool);
    const env = { STAFF_UPLOAD_KEY: 'local-fixture-password' };
    const login = createStaffLoginHandler(env), loginResponse = response();
    login({ body: { password: env.STAFF_UPLOAD_KEY } }, loginResponse);
    assert.equal(loginResponse.code, 200);
    const headers = { authorization: `Bearer ${loginResponse.body.token}` };
    const handler = createManageStaffUploads({ pool, env });
    async function list(query = {}, auth = headers) {
      const res = response(); await handler({ method: 'GET', headers: auth, query }, res); return res;
    }
    async function edit(id, overrides = {}, auth = headers) {
      const res = response(); await handler({ method: 'PATCH', headers: auth, params: { review_id: id }, body: {
        caption: 'Updated legacy seedlings', location: 'Test field', date_taken: '2026-10-01', tags: ['restorable', 'seedling'],
        collections: ['nursery', 'tree-planting'], status: 'active', ...overrides
      } }, res); return res;
    }
    const resultIds = res => res.body.uploads.map(row => String(row.id)).sort();

    await t.test('migration retry preserves every original field and leaves legacy date and assignments unknown', async () => {
      const after = (await pool.query('SELECT * FROM photo_uploads_review WHERE id=$1', [ids.legacy])).rows[0];
      for (const [field, value] of Object.entries(legacyBefore)) assert.deepEqual(after[field], value, field);
      assert.equal(after.date_taken, null); assert.equal(after.staff_archive_status, 'active');
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM staff_upload_collection_memberships WHERE upload_id=$1', [ids.legacy])).rows[0].count, 0);
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM staff_upload_collections')).rows[0].count, 4);
    });
    await t.test('login and server authorization fail closed', async () => {
      const denied = response(); login({ body: { password: 'wrong' } }, denied); assert.equal(denied.code, 401);
      assert.equal((await list({}, {})).code, 401); assert.equal((await edit(ids.legacy, {}, {})).code, 401);
    });
    await t.test('actual rows obey collection and independent status filters, excluding private, student and pending records', async () => {
      assert.deepEqual(resultIds(await list()), [ids.current]);
      assert.deepEqual(resultIds(await list({ collection: 'unassigned' })), [ids.legacy]);
      assert.deepEqual(resultIds(await list({ collection: 'all', status: 'archived' })), [ids.archived]);
      assert.deepEqual(resultIds(await list({ collection: 'all', status: 'all' })), [ids.legacy, ids.current, ids.archived].sort());
      assert.deepEqual(resultIds(await list({ collection: 'training', status: 'all' })), [ids.current, ids.archived].sort());
      assert.deepEqual(resultIds(await list({ collection: 'all', date_to: '2002-01-01' })), [ids.legacy]);
    });
    await t.test('multiple collection assignments persist and preserve original media and upload timestamp', async () => {
      assert.equal((await edit(ids.legacy)).code, 200);
      const uploads = (await list({ collection: 'nursery' })).body.uploads;
      assert.equal(uploads.length, 1); assert.deepEqual(uploads[0].collections, ['nursery', 'tree-planting']);
      assert.equal(uploads[0].date_taken, '2026-10-01'); assert.equal(uploads[0].location, 'Test field');
      const after = (await pool.query('SELECT * FROM photo_uploads_review WHERE id=$1', [ids.legacy])).rows[0];
      for (const field of ['id', 'created_at_utc', 'cropped_file_url', 'original_file_url']) assert.deepEqual(after[field], legacyBefore[field]);
    });
    await t.test('archive remains searchable by caption, location and tag and restores the same row', async () => {
      assert.equal((await edit(ids.legacy, { status: 'archived' })).code, 200);
      assert.deepEqual(resultIds(await list({ collection: 'nursery' })), []);
      for (const search of ['Updated legacy', 'Test field', 'restorable']) {
        for (const status of ['archived', 'all']) assert.deepEqual(resultIds(await list({ collection: 'nursery', status, search })), [ids.legacy]);
      }
      assert.equal((await edit(ids.legacy, { status: 'active' })).code, 200);
      assert.deepEqual(resultIds(await list({ collection: 'nursery' })), [ids.legacy]);
    });
    await t.test('forbidden records and unknown collections do not mutate registry or memberships', async () => {
      for (const id of [ids.private, ids.student, ids.pending]) assert.equal((await edit(id)).code, 404);
      assert.equal((await edit(ids.legacy, { caption: 'Must roll back', collections: ['unknown'] })).code, 400);
      const upload = (await list({ collection: 'nursery' })).body.uploads[0];
      assert.equal(upload.caption, 'Updated legacy seedlings'); assert.deepEqual(upload.collections, ['nursery', 'tree-planting']);
      assert.equal((await edit(ids.legacy, { collections: [], date_taken: null })).code, 200);
      assert.deepEqual(resultIds(await list({ collection: 'unassigned' })), [ids.legacy]);
      assert.equal((await list({ collection: 'unassigned' })).body.uploads[0].date_taken, null);
    });
    await t.test('public gallery stays read-only and management archive does not alter public moderation', async () => {
      const publicGallery = createPhotoReviewGalleryHandler({ dbPool: pool });
      const res = response(); await publicGallery({ method: 'GET', query: { upload_context: 'staff_upload' } }, res);
      assert.equal(res.code, 200);
      const publicIds = res.body.photos.map(row => String(row.id));
      assert.ok(publicIds.includes(ids.archived));
      for (const id of [ids.private, ids.student, ids.pending]) assert.ok(!publicIds.includes(id));
      for (const method of ['PATCH', 'POST', 'DELETE']) {
        const rejected = response(); await publicGallery({ method }, rejected); assert.equal(rejected.code, 405);
      }
    });
  } finally { await pool.end(); }
});
