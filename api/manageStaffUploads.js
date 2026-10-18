import { requireStaff } from './staffAccess.js';

// Same visibility boundary as the existing public staff feed. The shared staff
// password does not establish a personal identity or grant moderation access.
export const STAFF_SCOPE = `p.upload_context = 'staff_upload'
  AND p.public_gallery_status = 'public' AND p.academy_student_id IS NULL
  AND (p.verification_status IN ('approved','not_required') OR p.review_status IN ('approved','not_required'))
  AND p.upload_type IS DISTINCT FROM 'question_to_tutor'
  AND p.lesson_key IS DISTINCT FROM 'tutor_question'`;
const fields = `p.id, p.caption, p.staff_location AS location, p.date_taken::text,
  p.staff_tags AS tags, p.staff_archive_status AS status, p.created_at_utc,
  p.cropped_file_url, p.original_file_url, p.file_type, p.staff_name,
  COALESCE((SELECT json_agg(m.collection_id ORDER BY m.collection_id)
    FROM staff_upload_collection_memberships m WHERE m.upload_id = p.id), '[]') AS collections`;

export function createManageStaffUploads({ pool, env = process.env }) {
  return async (req, res) => {
    if (!requireStaff(req, res, env)) return;
    if (!['GET', 'PATCH'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Method not allowed' });
    let client;
    try {
      if (req.method === 'GET') {
        const query = req.query || {};
        const status = query.status || 'active';
        const collection = query.collection || 'current';
        if (!['active', 'archived', 'all'].includes(status)) throw new TypeError('Invalid status');
        const values = [];
        const bind = value => { values.push(value); return `$${values.length}`; };
        const conditions = [STAFF_SCOPE];
        if (status !== 'all') conditions.push(`p.staff_archive_status = ${bind(status)}`);
        // Current projects contains assigned uploads; Unassigned preserves legacy access.
        if (collection === 'current') conditions.push(`EXISTS (SELECT 1 FROM staff_upload_collection_memberships m WHERE m.upload_id = p.id)`);
        else if (collection === 'unassigned') conditions.push(`NOT EXISTS (SELECT 1 FROM staff_upload_collection_memberships m WHERE m.upload_id = p.id)`);
        else if (collection !== 'all') conditions.push(`EXISTS (SELECT 1 FROM staff_upload_collection_memberships m WHERE m.upload_id = p.id AND m.collection_id = ${bind(collection)})`);
        if (query.search) {
          const search = bind(`%${String(query.search).slice(0, 300)}%`);
          conditions.push(`concat_ws(' ', p.caption, p.staff_location, array_to_string(p.staff_tags, ' '), p.category, p.staff_category, p.linked_entity_name, p.uploader_name, p.uploader_email, p.ai_description, p.manual_label, p.original_file_name, p.academy_track, p.academy_cohort, p.verification_status, p.public_gallery_status) ILIKE ${search}`);
        }
        for (const [key, operator] of [['date_from', '>='], ['date_to', '<=']]) {
          if (query[key]) { validateDate(query[key]); conditions.push(`p.created_at_utc::date ${operator} ${bind(query[key])}::date`); }
        }
        const collections = await pool.query('SELECT id, name FROM staff_upload_collections ORDER BY sort_order, name');
        const result = await pool.query(`SELECT ${fields} FROM photo_uploads_review p WHERE ${conditions.join(' AND ')} ORDER BY p.created_at_utc DESC, p.id DESC`, values);
        return res.json({ ok: true, uploads: result.rows, collections: collections.rows });
      }
      const id = String(req.params?.review_id || '');
      const body = req.body || {};
      if (!/^[1-9]\d*$/.test(id)) throw new TypeError('Invalid upload ID');
      const allowed = ['caption', 'location', 'date_taken', 'tags', 'status', 'collections'];
      if (Object.keys(body).some(key => !allowed.includes(key))) throw new TypeError('Forbidden metadata field');
      const caption = validateText(body.caption, 2000);
      const location = validateText(body.location, 500);
      const date = body.date_taken || null;
      if (date) validateDate(date);
      if (!['active', 'archived'].includes(body.status)) throw new TypeError('Invalid status');
      if (!Array.isArray(body.tags) || body.tags.length > 50 || body.tags.some(tag => typeof tag !== 'string' || tag.length > 100)) throw new TypeError('Invalid tags');
      if (!Array.isArray(body.collections) || body.collections.length > 100 || body.collections.some(item => typeof item !== 'string')) throw new TypeError('Invalid collections');
      const collections = [...new Set(body.collections)];
      client = await pool.connect();
      await client.query('BEGIN');
      const found = await client.query(`SELECT p.id FROM photo_uploads_review p WHERE p.id = $1 AND ${STAFF_SCOPE} FOR UPDATE`, [id]);
      if (!found.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ ok: false, error: 'Upload not found' }); }
      const valid = await client.query('SELECT id FROM staff_upload_collections WHERE id = ANY($1::text[])', [collections]);
      if (valid.rows.length !== collections.length) throw new TypeError('Unknown collection');
      await client.query(`UPDATE photo_uploads_review SET caption=$2, staff_location=$3, date_taken=$4,
        staff_tags=$5, staff_archive_status=$6, updated_at_utc=now() WHERE id=$1`, [id, caption, location, date, body.tags, body.status]);
      await client.query('DELETE FROM staff_upload_collection_memberships WHERE upload_id=$1', [id]);
      await client.query('INSERT INTO staff_upload_collection_memberships (upload_id, collection_id) SELECT $1, unnest($2::text[])', [id, collections]);
      await client.query('COMMIT');
      return res.json({ ok: true, review_id: id });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      return res.status(error instanceof TypeError ? 400 : 500).json({ ok: false, error: error instanceof TypeError ? error.message : 'Could not load or save staff uploads' });
    } finally { client?.release(); }
  };
}
function validateText(value, max) {
  if (value == null) return null;
  if (typeof value !== 'string' || value.length > max) throw new TypeError('Invalid text');
  return value.trim() || null;
}
function validateDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw new TypeError('Invalid date');
}
