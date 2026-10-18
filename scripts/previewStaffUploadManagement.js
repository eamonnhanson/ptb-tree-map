// Local-only acceptance app. Never imports api/db.js, .env, R2, or notifications.
// Requires a disposable database guarded by localManagementPool and a sibling
// uploader checkout. Root uploader resources are rewritten only in responses.
import express from 'express';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createManageStaffUploads } from '../api/manageStaffUploads.js';
import { createStaffLoginHandler, requireStaff } from '../api/staffAccess.js';
import { createUpdateStaffUploadMetadataHandler } from '../api/updateStaffUploadMetadata.js';
import { createSavePhotoReviewHandler } from '../api/savePhotoReview.js';
import { createPhotoReviewGalleryHandler } from '../api/getPhotoReviewGallery.js';
import { localManagementPool, resetManagementDatabase } from '../test/helpers/staffManagementDatabase.js';

const pool = localManagementPool(process.env.PTB_STAFF_MANAGEMENT_POSTGRES_TEST_URL);
const { ids } = await resetManagementDatabase(pool);
const uploaderRoot = path.resolve(process.argv[2] || fileURLToPath(new URL('../../ketso-uploader', import.meta.url)));
const app = express(), port = 8768, origin = `http://127.0.0.1:${port}`;
const env = { STAFF_UPLOAD_KEY: 'local-fixture-password' };
const media = new Map();
app.use((req, res, next) => {
  res.set('Content-Security-Policy', "default-src 'self'; connect-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: blob:; media-src 'self' blob:; form-action 'self'");
  next();
});
app.use(express.json());
app.post('/api/academy-staff-auth', createStaffLoginHandler(env));
const manage = createManageStaffUploads({ pool, env });
app.get('/api/staff-managed-uploads', manage);
app.patch('/api/staff-managed-uploads/:review_id', manage);
const oldEdit = createUpdateStaffUploadMetadataHandler({ dbPool: pool });
app.patch('/api/staff-uploads/:review_id', (req, res) => { if (requireStaff(req, res, env)) return oldEdit(req, res); });
app.get('/api/photo-review-gallery', createPhotoReviewGalleryHandler({ dbPool: pool }));
app.get('/api/staff-uploads', async (req, res) => {
  if (!requireStaff(req, res, env)) return;
  const result = await pool.query("SELECT * FROM photo_uploads_review WHERE staff_id=$1 AND upload_context='staff_upload' AND public_gallery_status='public'", [req.query.staff_id]);
  res.json({ ok: true, uploads: result.rows });
});
const save = createSavePhotoReviewHandler({ dbPool: pool, describeImage: async () => 'Local fixture tree' });
app.post('/api/staff-uploads', (req, res) => {
  if (!requireStaff(req, res, env)) return;
  const body = req.body;
  req.body = { ...body, category: 'staff_upload', staff_category: body.category, selected_category: body.category,
    cropped_file_url: body.file_url, upload_context: 'staff_upload', upload_type: 'staff_photo', uploader_role: 'staff',
    uploaded_by: body.staff_id, uploader_name: body.staff_name, linked_entity_type: 'staff', linked_entity_name: body.staff_name,
    verification_status: 'not_required', review_status: 'not_required', public_gallery_status: 'public' };
  return save(req, res);
});
app.post('/upload', express.raw({ type: () => true, limit: '30mb' }), async (req, res) => {
  const request = new Request(origin + '/upload', { method: 'POST', headers: req.headers, body: req.body });
  const data = await request.formData(), file = data.get('file');
  const key = `${data.get('folder')}/${media.size + 1}.jpg`;
  media.set(key, { bytes: Buffer.from(await file.arrayBuffer()), type: file.type });
  res.json({ ok: true, key });
});
app.get('/media/*', (req, res) => { const file = media.get(req.params[0]); if (!file) return res.sendStatus(404); res.type(file.type).send(file.bytes); });
app.get('/fixture/:image', (_req, res) => res.type('svg').send('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="#e4efdf"/><path d="M240 280V120" stroke="#695238" stroke-width="25"/><circle cx="240" cy="110" r="85" fill="#237341"/></svg>'));
app.get('/__evidence', async (_req, res) => res.json({ ids, uploads: (await pool.query('SELECT id, caption, staff_archive_status, date_taken, created_at_utc FROM photo_uploads_review ORDER BY id')).rows }));
app.use('/api', (_req, res) => res.json([]));
const testPhoto = `<aside style="padding:8px;background:#fff2b5">LOCAL DISPOSABLE TEST ONLY <button type="button" onclick="fixturePhoto()">Use test photo</button></aside><script>
async function fixturePhoto(){const c=document.createElement('canvas');c.width=800;c.height=600;const x=c.getContext('2d');x.fillStyle='#d0e8cb';x.fillRect(0,0,800,600);x.fillStyle='#206f3a';x.fillRect(350,80,100,420);const f=new File([await new Promise(r=>c.toBlob(r,'image/jpeg'))],'test-tree.jpg',{type:'image/jpeg'});const dt=new DataTransfer();dt.items.add(f);const input=document.getElementById('fileInput');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));}</script>`;
app.get('*', async (req, res) => {
  const relative = req.path === '/gallery' ? '/gallery.html' : req.path.endsWith('/') ? req.path + 'index.html' : req.path;
  const target = path.resolve(uploaderRoot, '.' + relative);
  if (!target.startsWith(uploaderRoot + path.sep) || !/\.(html|css|js)$/.test(target)) return res.sendStatus(404);
  try {
    let source = await readFile(target, 'utf8');
    source = source.replaceAll('https://ptb-tree-map.onrender.com', origin).replaceAll('https://ketso-uploader.pages.dev', origin)
      .replaceAll('https://pub-146513161ecf43ebbf81dda0cf702fde.r2.dev/', origin + '/media/');
    if (req.path === '/staff-upload-dashboard/') source = source.replace('<body>', '<body>' + testPhoto);
    res.type(path.extname(target)).send(source);
  } catch { res.sendStatus(404); }
});
const server = app.listen(port, '127.0.0.1', () => console.log(`Local staff management: ${origin}/ (password: local-fixture-password)`));
async function stop() { server.close(); await pool.end(); }
process.on('SIGINT', () => stop().then(() => process.exit()));
process.on('SIGTERM', () => stop().then(() => process.exit()));
