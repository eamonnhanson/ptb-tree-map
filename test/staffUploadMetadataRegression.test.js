import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createUpdateStaffUploadMetadataHandler } from '../api/updateStaffUploadMetadata.js';
import { STAFF_SCOPE } from '../api/manageStaffUploads.js';

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const request = body => ({ method: 'PATCH', params: { review_id: '71' }, body: { staff_id: 'staff_1', expected: Object.fromEntries(['staff_name','category','caption'].filter(key => Object.hasOwn(body,key)).map(key => [key,null])), ...body } });

test('partial PATCH binds omitted values separately from explicit caption clearing', async () => {
  for (const [body, expected] of [
    [{ caption: 'Description' }, [null, null, 'Description', 71, 'staff_1', true]],
    [{ staff_name: 'New Name' }, ['New Name', null, null, 71, 'staff_1', false]],
    [{ category: 'training' }, [null, 'training', null, 71, 'staff_1', false]],
    [{ staff_name: 'New Name', caption: 'Description' }, ['New Name', null, 'Description', 71, 'staff_1', true]],
    [{ caption: '' }, [null, null, '', 71, 'staff_1', true]],
    [{ caption: null }, [null, null, null, 71, 'staff_1', true]]
  ]) {
    const handler = createUpdateStaffUploadMetadataHandler({ dbPool: { async query(sql, values) {
      assert.deepEqual(values, [...expected, Object.hasOwn(body,'staff_name'), null, Object.hasOwn(body,'category'), null, null]);
      assert.match(sql, /caption = CASE WHEN \$6 THEN \$3 ELSE caption END/);
      assert.match(sql, /staff_name = COALESCE\(\$1, staff_name\)/);
      assert.match(sql, /staff_category = COALESCE\(\$2, staff_category\)/);
      assert.match(sql, /staff_id = \$5/); assert.match(sql, /academy_student_id IS NULL/);
      assert.ok(sql.includes(STAFF_SCOPE.replaceAll('p.', '')));
      assert.doesNotMatch(sql, /mime_type|duration_seconds/);
      assert.equal((sql.match(/UPDATE /g) || []).length, 1);
      assert.doesNotMatch(sql.split('WHERE')[0], /(?:cropped_file_url|public_gallery_status|staff_id)\s*=/);
      return { rows: [{ id: 71 }] };
    } } });
    const res = response(); await handler(request(body), res); assert.equal(res.statusCode, 200);
  }
});

test('database failures stay failures and return only bounded diagnostic codes', async () => {
  const logs = [], log = console.error;
  console.error = (...args) => logs.push(args);
  try {
    for (const [code, diagnostic] of [['42703','SCHEMA_MISMATCH'], ['42501','DATABASE_PERMISSION_DENIED'],
      ['42P01','SCHEMA_MISMATCH'], ['23505','METADATA_CONFLICT'], ['57014','DATABASE_TIMEOUT'],
      ['unknown','DATABASE_ERROR'], ['__proto__','DATABASE_ERROR'], ['toString','DATABASE_ERROR']]) {
      const handler = createUpdateStaffUploadMetadataHandler({ dbPool: { async query() {
        throw Object.assign(new Error('postgres://secret'), { code, detail: 'sensitive metadata' });
      } } });
      const res = response(); await handler(request({ caption: 'Description' }), res);
      assert.equal(res.statusCode, 500); assert.deepEqual(res.body, { ok: false, error: 'STAFF_METADATA_UPDATE_FAILED', diagnostic });
    }
    assert.doesNotMatch(JSON.stringify(logs), /secret|sensitive/);
  } finally { console.error = log; }
});

test('long descriptions are preserved and excessive or non-string captions fail before SQL', async () => {
  let calls = 0;
  const handler = createUpdateStaffUploadMetadataHandler({ dbPool: { async query(sql, values) {
    calls++; assert.equal(values[2].length, 2000); return { rows: [{ id: 71 }] };
  } } });
  const res = response(); await handler(request({ staff_name: 'Changed Name', caption: 'x'.repeat(2000) }), res);
  assert.equal(res.statusCode, 200);
  for (const caption of ['x'.repeat(2001), {}, [], 42, false]) {
    const invalid = response(); await handler(request({ caption }), invalid); assert.equal(invalid.statusCode, 400);
  }
  assert.equal(calls, 1);
});

test('invalid partial fields and identities fail before database access', async () => {
  const handler = createUpdateStaffUploadMetadataHandler({ dbPool: { query() { assert.fail('invalid request reached database'); } } });
  for (const body of [
    { staff_name: '' }, { staff_name: null }, { category: '' }, { category: null },
    { category: 'invalid' }, { staff_id: '' }, { staff_id: null },
    { uploader_name: 'Forbidden' }, { public_gallery_status: 'public' }
  ]) {
    const res = response(); await handler(request(body), res); assert.equal(res.statusCode, 400);
  }
  const invalidId = response(); await handler({ ...request({ caption: 'Test' }), params: { review_id: 'invalid' } }, invalidId);
  assert.equal(invalidId.statusCode, 400);
  const wrongMethod = response(); await handler({ ...request({}), method: 'POST' }, wrongMethod);
  assert.equal(wrongMethod.statusCode, 405);
});

test('staff metadata route retains authentication before invoking the writer', async () => {
  const server = await readFile(new URL('../server.js', import.meta.url), 'utf8');
  assert.match(server, /app\.patch\("\/api\/staff-uploads\/:review_id", \(req, res\) => \{\s*if \(!requireStaff\(req, res\)\) return;\s*return updateStaffUploadMetadata\(req, res\);/);
});
