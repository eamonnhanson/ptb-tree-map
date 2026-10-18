import pg from 'pg';
import { readFile } from 'node:fs/promises';

// Never accepts a production URL, an ordinary local database, or an alternate
// role. Both callers intentionally reset this disposable database's schema.
export function localManagementPool(connectionString) {
  const url = new URL(connectionString);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !/^ptb_staff_management_test(?:_[a-z0-9_]+)?$/.test(url.pathname.slice(1)) ||
      url.username !== 'ketso_test') throw new Error('Dedicated loopback staff management test database required');
  return new pg.Pool({ connectionString, ssl: false });
}

export async function resetManagementDatabase(pool) {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  for (const file of ['../sql/001_photo_uploads_review_baseline.sql', '../../docs/sql/022_staff_photo_receipts.sql', '../../docs/sql/024_donor_report_submission_section.sql', '../../docs/sql/025_staff_video_uploads.sql']) {
    await pool.query(await readFile(new URL(file, import.meta.url), 'utf8'));
  }
  const legacy = await pool.query(`INSERT INTO photo_uploads_review
    (caption, cropped_file_url, original_file_url, upload_context, public_gallery_status,
     verification_status, review_status, staff_id, staff_name, uploader_name, created_at_utc)
    VALUES ('Legacy nursery seedlings', '/fixture/tree.svg', '/fixture/original.svg', 'staff_upload', 'public',
      'not_required', 'not_required', 'fixture_staff', 'Test Staff', 'Test Staff', '2001-01-01T12:00:00Z') RETURNING *`);
  const migration = await readFile(new URL('../../docs/sql/026_staff_upload_collections.sql', import.meta.url), 'utf8');
  await pool.query(migration);
  await pool.query(migration); // Safe retry must retain rows and definitions.
  const ids = { legacy: String(legacy.rows[0].id) };
  for (const [name, visibility, student, review] of [
    ['current', 'public', null, 'approved'], ['archived', 'public', null, 'approved'],
    ['private', 'private', null, 'approved'], ['student', 'public', 77, 'approved'],
    ['pending', 'public', null, 'pending']
  ]) {
    const result = await pool.query(`INSERT INTO photo_uploads_review
      (caption, cropped_file_url, original_file_url, upload_context, public_gallery_status,
       verification_status, review_status, academy_student_id, staff_id, staff_name, staff_archive_status, staff_location, staff_tags)
      VALUES ($1, $6, '/fixture/original.svg', 'staff_upload', $2, $4::text, $4::text, $3, 'fixture_staff', 'Test Staff', $5, 'Test nursery', ARRAY['seedlings']) RETURNING id`,
    [`${name} training seedlings`, visibility, student, review, name === 'archived' ? 'archived' : 'active', `/fixture/${name}.svg`]);
    ids[name] = String(result.rows[0].id);
  }
  for (const name of ['current', 'archived', 'private', 'student', 'pending']) {
    await pool.query('INSERT INTO staff_upload_collection_memberships VALUES ($1, $2)', [ids[name], 'training']);
  }
  return { ids, legacyBefore: legacy.rows[0] };
}
