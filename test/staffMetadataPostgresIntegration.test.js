import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateStaffUploadMetadataHandler } from '../api/updateStaffUploadMetadata.js';

// Reuses the repository's guarded, disposable loopback database fixture.
const connectionString = process.env.PTB_STAFF_MANAGEMENT_POSTGRES_TEST_URL;
const approved = process.env.PTB_STAFF_METADATA_TEST_RESET_APPROVED === 'yes';
test('staff metadata survives independent PostgreSQL reads and preserves unrelated columns', {
  skip: (!connectionString || !approved) && 'explicitly approved disposable PostgreSQL unavailable'
}, async t => {
  const { localManagementPool, resetManagementDatabase } = await import('./helpers/staffManagementDatabase.js');
  const pool = localManagementPool(connectionString);
  try {
    const { ids } = await resetManagementDatabase(pool);
    // Deliberately exercise the photo schema without optional return columns.
    // The guarded fixture above resets ONLY the approved disposable database.
    await pool.query('ALTER TABLE photo_uploads_review DROP COLUMN duration_seconds, DROP COLUMN mime_type');
    await pool.query("UPDATE photo_uploads_review SET linked_entity_type = 'staff', linked_entity_name = staff_name WHERE id = $1", [ids.legacy]);
    const handler = createUpdateStaffUploadMetadataHandler({ dbPool: pool });
    async function edit(body, id = ids.legacy) {
      const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      await handler({ method: 'PATCH', params: { review_id: id }, body: { staff_id: 'fixture_staff', ...body } }, res);
      return res;
    }
    for (const [name, patch, fields] of [
      ['description only', { caption: 'New description' }, ['caption']],
      ['name only', { staff_name: 'Renamed Staff' }, ['staff_name', 'uploader_name', 'linked_entity_name']],
      ['category only', { category: 'training' }, ['staff_category', 'selected_category']],
      ['simultaneous name and description', { staff_name: 'Another Name', caption: 'x'.repeat(2000) }, ['staff_name', 'uploader_name', 'linked_entity_name', 'caption']],
      ['name only preserves long caption', { staff_name: 'Final Name' }, ['staff_name', 'uploader_name', 'linked_entity_name']]
    ]) {
      await t.test(name, async () => {
        const before = (await pool.query('SELECT * FROM photo_uploads_review WHERE id=$1', [ids.legacy])).rows[0];
        const res = await edit(patch); assert.equal(res.code, 200);
        // A separate connection/read models the next page load after a save.
        const reader = localManagementPool(connectionString);
        let after;
        try { after = (await reader.query('SELECT * FROM photo_uploads_review WHERE id=$1', [ids.legacy])).rows[0]; }
        finally { await reader.end(); }
        for (const [key, value] of Object.entries(before)) {
          if (!fields.includes(key) && key !== 'updated_at_utc') assert.deepEqual(after[key], value, key);
        }
        if ('caption' in patch) assert.equal(after.caption, patch.caption);
        if ('staff_name' in patch) assert.equal(after.staff_name, patch.staff_name);
        if ('staff_name' in patch) assert.equal(after.linked_entity_name, patch.staff_name);
        if ('category' in patch) assert.equal(after.staff_category, patch.category);
        assert.equal(res.body.upload.caption, after.caption);
      });
    }
    await t.test('wrong owner and student/private/pending records remain unchanged', async () => {
      const before = (await pool.query('SELECT * FROM photo_uploads_review ORDER BY id')).rows;
      for (const id of [ids.private, ids.student, ids.pending]) assert.equal((await edit({ caption: 'Forbidden' }, id)).code, 404);
      assert.equal((await edit({ staff_id: 'another_staff', caption: 'Forbidden' })).code, 404);
      assert.deepEqual((await pool.query('SELECT * FROM photo_uploads_review ORDER BY id')).rows, before);
    });
    await t.test('a real SQL constraint failure cannot partially save the name', async () => {
      await pool.query("ALTER TABLE photo_uploads_review ADD CONSTRAINT fixture_caption_check CHECK (caption <> 'Rejected caption')");
      const before = (await pool.query('SELECT * FROM photo_uploads_review WHERE id=$1', [ids.legacy])).rows[0];
      const res = await edit({ staff_name: 'Must not persist', caption: 'Rejected caption' });
      assert.equal(res.code, 500);
      assert.deepEqual((await pool.query('SELECT * FROM photo_uploads_review WHERE id=$1', [ids.legacy])).rows[0], before);
    });
    await t.test('database failure returns failure', async () => {
      const failing = createUpdateStaffUploadMetadataHandler({ dbPool: { async query() { throw Object.assign(new Error('test failure'), { code: '42501' }); } } });
      const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
      await failing({ method: 'PATCH', params: { review_id: ids.legacy }, body: { staff_id: 'fixture_staff', caption: 'Unwritten' } }, res);
      assert.equal(res.code, 500); assert.equal(res.body.ok, false);
      assert.equal((await pool.query('SELECT caption FROM photo_uploads_review WHERE id=$1', [ids.legacy])).rows[0].caption, 'x'.repeat(2000));
    });
    await t.test('explicit empty and null captions clear the persisted description', async () => {
      for (const caption of ['', null]) {
        assert.equal((await edit({ caption })).code, 200);
        assert.equal((await pool.query('SELECT caption FROM photo_uploads_review WHERE id=$1', [ids.legacy])).rows[0].caption, caption);
      }
    });
  } finally { await pool.end(); }
});
