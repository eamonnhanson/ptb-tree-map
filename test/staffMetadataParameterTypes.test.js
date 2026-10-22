import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateStaffUploadMetadataHandler } from '../api/updateStaffUploadMetadata.js';

// Static coverage of the actual handler query; this does not execute PostgreSQL.
test('metadata SQL pins every shared name/category parameter to text (42P08 regression)', async () => {
  let calls = 0;
  const staff_name = '  José  Mary  ';
  const handler = createUpdateStaffUploadMetadataHandler({ dbPool: { async query(sql, values) {
    calls++;
    for (const [parameter, count] of [[1, 4], [2, 2]]) {
      const uses = [...sql.matchAll(new RegExp('\\$' + parameter + '(?![0-9])(?:::[a-z]+)?', 'g'))];
      assert.equal(uses.length, count);
      assert.ok(uses.every(([use]) => use === `$${parameter}::text`));
    }
    assert.match(sql, /caption = CASE WHEN \$6::boolean THEN \$3::text ELSE caption END/);
    assert.deepEqual(values, [staff_name, 'training', null, 71, 'staff_1', true, true, 'Old', true, 'other', 'Before']);
    return { rows: [{ id: 71, staff_name }] };
  } } });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'PATCH', params: { review_id: '71' }, body: {
    staff_id: 'staff_1', staff_name, category: 'training', caption: null,
    expected: { staff_name: 'Old', category: 'other', caption: 'Before' }
  } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.upload.staff_name, staff_name);
  assert.equal(calls, 1);
});
