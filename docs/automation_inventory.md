# Automation inventory for internal monitoring dashboard

Inventory date: 2026-05-31

Scope inspected:

- `ptb-tree-map-current`: Express/PostgreSQL backend, tree map frontend, photo review APIs.
- `ketso-uploader-current`: Cloudflare Pages frontend/functions for KETSO uploads, onboarding, staff uploads, admin review, galleries.

The current implementation is event-oriented around tree lookup, academy/student uploads, staff uploads, photo review/moderation, gallery display, and approval notifications. I did not find implemented Shopify, Chargebee, certificate generation, outbound email log, customer table, or subscription write flows in the inspected code.

## Repository overview

### `ptb-tree-map-current`

- Runtime: Node.js ES modules.
- Main server: `server.js`.
- Database: PostgreSQL via `pg`.
- Main DB helper: `api/db.js`, using `DATABASE_URL` and optional `DB_SCHEMA`.
- Frontend: `frontend/` and static `docs/` pages for the public tree map.
- Core operational responsibility: expose read APIs for trees/forest heroes, write/read APIs for `photo_uploads_review`, academy moderation actions, student gallery/profile APIs, and diagnostics.

### `ketso-uploader-current`

- Runtime: static frontend plus Cloudflare Pages Functions.
- Storage: Cloudflare R2 binding `KETSO_BUCKET`.
- Core operational responsibility: upload files to R2, collect student/staff/onboarding metadata, call the `ptb-tree-map-current` backend to save review records, and provide gallery/admin/user-facing review pages.
- No direct PostgreSQL connection was found here. Database writes happen indirectly by calling `https://ptb-tree-map.onrender.com/api/save-photo-review`.

## Relevant files and purpose

### Backend and database files

- `ptb-tree-map-current/server.js`
  - Express server and route registration.
  - Mounts tree APIs, gallery APIs, academy upload review/submission/moderation APIs, diagnostics, and static frontend.
  - Contains admin key guard for moderation endpoints.
  - Contains `notifyApproval()` Zapier webhook for approved public academy uploads.
  - Contains `syncApprovedUploadPoint()` logic that inserts/updates/deletes `academy_point_events`.

- `ptb-tree-map-current/api/db.js`
  - PostgreSQL pool creation.
  - Uses `DATABASE_URL`, `NODE_ENV`, and `DB_SCHEMA`.
  - Sets PostgreSQL `search_path` on connect.
  - Exports `pool`, `q()`, and `SCHEMA_NAME`.

- `ptb-tree-map-current/api/trees.js`
  - Separate PostgreSQL `Client` using `PG_URL` plus `certs/ca.pem`.
  - Reads `public.v_user_trees` by email or `user_id`.

- `ptb-tree-map-current/api/forestHeroes.js`
  - Express router for `/api/forest-heroes`.
  - Reads `public.trees1` joined to `public.users1`.

- `ptb-tree-map-current/api/forestHeroSearch.js`
  - Search endpoint for staff linking uploads to forest hero/tree records.
  - Reads `public.users1` joined to `public.trees1`.

- `ptb-tree-map-current/api/savePhotoReview.js`
  - Primary write path into `photo_uploads_review`.
  - Resolves academy student by email from `academy_students`.
  - Calls OpenAI image description helper before inserting review metadata.

- `ptb-tree-map-current/api/getPhotoReviewGallery.js`
  - Reads approved public non-student photos or anonymous onboarding uploads from `photo_uploads_review`.

- `ptb-tree-map-current/api/getStudentGallery.js`
  - Reads approved public student uploads from `photo_uploads_review`.
  - Joins `academy_student_rewards`.

- `ptb-tree-map-current/api/generateImageDescription.js`
  - Calls OpenAI Responses API with `OPENAI_API_KEY`.

- `ptb-tree-map-current/api/treeByAd.js`
  - Stub endpoint for `/api/trees/:id`; currently returns placeholder data.

- `ptb-tree-map-current/api/treesByCodes.js`
  - Stub endpoint for `/api/trees/by-codes`; currently maps codes into placeholder rows.

### Upload handlers and frontend pages

- `ketso-uploader-current/functions/upload.js`
  - Cloudflare Function `POST /upload`.
  - Validates file type, extension, name, and size.
  - Writes uploaded file streams into R2 via `env.KETSO_BUCKET.put()`.
  - Returns R2 object key and file metadata.

- `ketso-uploader-current/functions/list.js`
  - Cloudflare Function `GET /list`.
  - Lists R2 objects via `env.KETSO_BUCKET.list()`.

- `ketso-uploader-current/functions/api/staff-uploads.js`
  - Cloudflare Function `GET /api/staff-uploads` and `POST /api/staff-uploads`.
  - GET proxies to `/api/photo-review-gallery` and filters staff uploads client-side.
  - POST validates staff upload payload and calls `/api/save-photo-review`.
  - PATCH is reserved and returns `501`.

- `ketso-uploader-current/functions/api/staff-uploads/[id].js`
  - Placeholder PATCH endpoint returning `501`.

- `ketso-uploader-current/functions/api/academy-student-search.js`
  - Cloudflare Function `GET /api/academy-student-search`.
  - Proxies to backend academy student search.
  - Uses optional `ACADEMY_STUDENT_SEARCH_API_URL` and `ACADEMY_STUDENT_SEARCH_TOKEN`.

- `ketso-uploader-current/app.js`
  - Main uploader frontend logic.
  - Handles student/staff upload modes, image cropping/compression, file upload to R2, forest hero lookup, academy student lookup/search, and saving review metadata.

- `ketso-uploader-current/index.html`
  - Main upload UI using `app.js`.

- `ketso-uploader-current/academy-onboarding/index.html`
  - Dedicated academy onboarding flow.
  - Uploads to `/upload`, then calls `/api/save-photo-review`.
  - Can load student data by token via `/api/academy-student`.

- `ketso-uploader-current/academy-my-upload/index.html`
  - Student review confirmation page.
  - Reads `/api/academy-upload-review`.
  - Writes `/api/academy-submit-upload`.

- `ketso-uploader-current/admin-review/index.html`
  - Admin moderation UI.
  - Reads `/api/academy-moderation-queue`.
  - Writes approve/reject/hide actions.
  - Uses `admin_key` query parameter.

- `ketso-uploader-current/admin-gallery/index.html`
  - Admin gallery/moderation UI.
  - Reads moderation queue and writes approve/reject actions.
  - Uses `x-admin-key` header.

- `ketso-uploader-current/student-gallery/index.html`
  - Student gallery UI.
  - Reads `/api/student-gallery` and `/api/photo-review-gallery`.

- `ketso-uploader-current/staff-gallery/index.html`
  - Staff/public gallery UI.
  - Reads `/api/photo-review-gallery`.

- `ketso-uploader-current/staff-upload-dashboard/index.html`
  - Staff upload dashboard.
  - Uploads to `/upload`, saves metadata via `/api/staff-uploads`, reads `/api/staff-uploads`, and searches forest heroes.

- `ketso-uploader-current/student-profile/index.html`
  - Student profile UI.
  - Reads `/api/student-profile/:id`.

- `ketso-uploader-current/anonymous-upload-claims/index.html`
  - Reads anonymous onboarding uploads through `/api/photo-review-gallery?anonymous_onboarding=1`.
  - Builds WhatsApp claim messages; no backend claim write path found.

- `ketso-uploader-current/gallery.html`
  - Generic gallery view reading `/api/photo-review-gallery`.

- `ketso-uploader-current/shared/staff-categories.js` and `functions/_shared/staff-categories.js`
  - Shared allowed staff category list.

## Relevant API routes

### `ptb-tree-map-current` Express routes

| Method | Route | Purpose | Primary tables |
| --- | --- | --- | --- |
| GET | `/` | Health/info JSON | none |
| GET | `/health` | Health JSON | none |
| GET | `/api/trees` | Lookup user trees by email or `user_id` | `public.v_user_trees` |
| GET | `/api/trees/by-codes` | Stub lookup by tree codes | none currently |
| GET | `/api/trees/:id` | Stub lookup by tree id | none currently |
| GET | `/api/forest-hero-search` | Search subscription users/trees for staff linking | `public.users1`, `public.trees1` |
| GET | `/api/forest-heroes` | Paginated forest hero tree feed | `public.users1`, `public.trees1` |
| GET | `/api/photo-review-gallery` | Public/admin photo gallery feed | `photo_uploads_review` |
| GET | `/api/student-gallery` | Student public gallery feed | `photo_uploads_review`, `academy_student_rewards` |
| POST | `/api/save-photo-review` | Save upload metadata for review | `photo_uploads_review`, `academy_students` |
| GET | `/api/academy-upload-review` | Fetch one review upload for student confirmation | `photo_uploads_review` |
| POST | `/api/academy-submit-upload` | Mark upload submitted by student | `photo_uploads_review` |
| GET | `/api/academy-student` | Lookup academy student by upload token | `public.academy_students` |
| GET | `/api/academy-student-search` | Search academy students | `public.academy_students` |
| GET | `/api/diag/info` | Parse DB env and SSL status | env only |
| GET | `/api/diag/db` | DB ping and `users1`/`trees1` column list | `information_schema.columns` |
| GET | `/api/diag/heroes` | Count/preview forest heroes with coordinates | `public.users1`, `public.trees1` |
| POST | `/api/academy-approve-upload` | Admin approves upload and syncs points | `photo_uploads_review`, `academy_point_events` |
| GET | `/api/academy-moderation-queue` | Admin review queue | `photo_uploads_review` |
| POST | `/api/academy-reject-upload` | Admin rejects upload and removes points event | `photo_uploads_review`, `academy_point_events` |
| POST | `/api/academy-hide-upload` | Admin hides upload and removes points event | `photo_uploads_review`, `academy_point_events` |
| GET | `/api/student-profile/:id` | Student profile plus approved uploads | `academy_students`, `photo_uploads_review` |
| GET | `/map` | Static map page | none |

### `ketso-uploader-current` Cloudflare Pages Functions

| Method | Route | Purpose | External effects |
| --- | --- | --- | --- |
| POST | `/upload` | Validate and store uploaded file | Writes R2 object to `KETSO_BUCKET` |
| GET | `/list` | List uploaded R2 objects | Reads `KETSO_BUCKET` |
| GET | `/api/academy-student-search` | Proxy academy student search | Calls backend search API |
| GET | `/api/staff-uploads` | Load staff upload metadata | Calls backend gallery API |
| POST | `/api/staff-uploads` | Save staff upload metadata | Calls backend save review API |
| PATCH | `/api/staff-uploads` | Reserved, returns `501` | none |
| PATCH | `/api/staff-uploads/:id` | Reserved, returns `501` | none |

## Environment variables and bindings

### `ptb-tree-map-current`

- `PORT`
  - Used by `server.js` for Express port, default `10000`.

- `DATABASE_URL`
  - Used by `api/db.js` and diagnostic route.
  - Primary PostgreSQL connection string for pooled backend access.

- `PG_URL`
  - Used by `api/trees.js`.
  - Separate PostgreSQL connection string for the `/api/trees` route.
  - Uses local `certs/ca.pem`.

- `NODE_ENV`
  - Used by `api/db.js` and diagnostics to decide production SSL behavior.

- `DB_SCHEMA`
  - Used by `api/db.js` to set PostgreSQL `search_path`, default `public`.

- `ADMIN_GALLERY_KEY`
  - Used by moderation/admin endpoints in `server.js`.

- `ZAPIER_APPROVAL_WEBHOOK_URL`
  - Used by `notifyApproval()` after public approval of academy uploads.
  - Sends event `academy_upload_approved`.

- `OPENAI_API_KEY`
  - Used by `api/generateImageDescription.js`.

### `ketso-uploader-current`

- `KETSO_BUCKET`
  - Cloudflare R2 binding used by `/upload` and `/list`.

- `ACADEMY_STUDENT_SEARCH_API_URL`
  - Optional override for Cloudflare proxy target.

- `ACADEMY_STUDENT_SEARCH_TOKEN`
  - Optional token sent as `x-api-key` by the academy student search proxy.

## PostgreSQL tables, views, and referenced fields

### `public.trees1`

Referenced by forest hero routes and diagnostics.

- `id`
- `lat`
- `long`
- `tree_code`
- `tree_type`
- `tree_name`
- `planted_date`
- `area`
- `user_id`

### `public.users1`

Referenced by forest hero routes and diagnostics.

- `id`
- `email`
- `first_name`
- `last_name`
- `subscription_type`

### `public.v_user_trees`

Referenced by `/api/trees`.

- `tree_code`
- `tree_type`
- `lat`
- `long`
- `area`
- `planted_date`
- `email`
- `user_id`

### `photo_uploads_review`

Central operational table for uploads, review, moderation, and galleries.

Read/write fields referenced:

- `id`
- `category`
- `linked_entity_type`
- `linked_entity_name`
- `user_id`
- `tree_id`
- `cropped_file_url`
- `original_file_url`
- `original_file_size_bytes`
- `cropped_file_size_bytes`
- `review_status`
- `verification_status`
- `public_gallery_status`
- `upload_context`
- `academy_student_id`
- `academy_track`
- `academy_cohort`
- `academy_whatsapp`
- `lesson_key`
- `interest_area`
- `upload_type`
- `file_type`
- `file_extension`
- `uploader_name`
- `uploader_email`
- `caption`
- `ai_description`
- `ai_status`
- `ai_confidence`
- `ai_feedback`
- `consent_given`
- `points_awarded`
- `is_visible_in_gallery`
- `reviewed_by_admin`
- `reviewed_at_utc`
- `reviewed_by`
- `approved_at`
- `rejected_reason`
- `created_at_utc`
- `student_confirmed_at`

Code also sends fields such as `staff_category`, `selected_category`, `uploaded_by`, `staff_id`, `staff_name`, and `staff_created_at` from `ketso-uploader-current/functions/api/staff-uploads.js`, but `api/savePhotoReview.js` currently does not insert those fields. This is important for staff upload monitoring because staff identity appears to be lost unless it is encoded into already-inserted fields such as `uploader_name`, `category`, or `linked_entity_name`.

### `academy_students` / `public.academy_students`

Referenced by academy student lookup/search and upload student resolution.

- `id`
- `zoho_contact_id`
- `ketso_student_id`
- `full_name`
- `first_name`
- `last_name`
- `email`
- `whatsapp`
- `track`
- `primary_stream`
- `cohort`
- `status`
- `upload_token`

### `academy_point_events`

Written by approval/rejection/hide sync logic.

- `academy_student_id`
- `event_key`
- `event_label`
- `points`
- `source_table`
- `source_id`
- `metadata`

### `academy_student_rewards`

Read by student gallery.

- `academy_student_id`
- `total_points`
- `badge_count`
- `public_badge_count`
- `badges`

### `information_schema.columns`

Read by diagnostics.

- `table_schema`
- `table_name`
- `column_name`
- `ordinal_position`

## Code paths that write to monitored entities

### Trees

- No writes to `trees`, `trees1`, or `v_user_trees` were found.
- Tree logic is read-only:
  - `/api/trees`
  - `/api/forest-heroes`
  - `/api/forest-hero-search`
  - `/api/diag/heroes`
- `treeByAd.js` and `treesByCodes.js` are stubs and do not query or write.

### Users

- No writes to `users`, `users1`, or academy user/customer identity tables were found.
- `public.users1` is read for subscription users and forest hero display.
- `academy_students` is read for token lookup, search, profile, and upload-to-student matching.

### Photo upload/review tables

Writes found:

- `api/savePhotoReview.js`
  - `INSERT INTO photo_uploads_review (...)`.
  - Creates pending upload review rows for student, academy onboarding/upload, staff upload, forest hero, and general photo contexts.

- `server.js` `/api/academy-submit-upload`
  - `UPDATE photo_uploads_review`
  - Sets `verification_status = 'submitted_for_review'` and `student_confirmed_at = NOW()`.

- `server.js` `/api/academy-approve-upload`
  - `UPDATE photo_uploads_review`
  - Sets approved statuses, public/private gallery visibility, review metadata, approval timestamp, and points.

- `server.js` `/api/academy-reject-upload`
  - `UPDATE photo_uploads_review`
  - Sets rejected statuses, hidden gallery state, rejected reason, and zero points.

- `server.js` `/api/academy-hide-upload`
  - `UPDATE photo_uploads_review`
  - Hides upload from gallery, zeroes points, records reviewer and optional reason.

### Subscriptions

- No writes to subscriptions were found.
- `public.users1.subscription_type` is used as a read-only signal for forest hero eligibility.
- No `subscriptions` table reference was found.

### Customers

- No writes to customers were found.
- No `customers` table reference was found.

### Outbound email logs

- No outbound email log table or email send code was found.
- No `nodemailer`, SMTP provider, or mail API implementation was found.
- The only outbound follow-up implementation found is `notifyApproval()`, which posts to `ZAPIER_APPROVAL_WEBHOOK_URL`.

### Certificates

- No certificate generation write path was found.
- `distance_certificate_course` appears only as an academy interest area label/value, not as certificate issuance logic.
- No certificate table reference was found.

### Academy points/rewards

Writes found:

- `server.js` `syncApprovedUploadPoint(upload)`
  - `UPDATE academy_point_events`
  - `INSERT INTO academy_point_events ... WHERE NOT EXISTS`
  - `DELETE FROM academy_point_events`

This sync is triggered after approve/reject/hide actions and is tied to `photo_uploads_review` source rows.

### R2 object storage

Writes found:

- `ketso-uploader-current/functions/upload.js`
  - `env.KETSO_BUCKET.put(key, file.stream(), ...)`

This is not PostgreSQL, but it is operationally important because database review records point to R2 public URLs.

## Suspected operational flows

### 1. Tree allocated

Observed code:

- Tree map and forest hero APIs read `public.v_user_trees`, `public.trees1`, and `public.users1`.
- Eligibility for forest hero display appears to require `users1.subscription_type IS NOT NULL`.
- No allocation writer exists in the inspected code.

Likely event signal:

- A new row in `trees1` with `user_id` populated.
- Or a new row appearing in `v_user_trees`.
- A useful dashboard event would be "tree allocated to user/customer" when a tree row is linked to a user and has a `tree_code`.

Needed for monitoring:

- Source-of-truth write process for allocating trees.
- Definitive table/field for allocation timestamp.
- Whether `planted_date` or another field should represent allocation time.

Suggested first dashboard signals:

- Newly allocated trees by day.
- Allocated trees missing `lat`/`long`.
- Allocated trees missing `tree_code`.
- Users with `subscription_type` but no visible tree.

### 2. Onboarding or upload awaiting approval

Observed code:

- Uploads are stored in R2 through `/upload`.
- Metadata is inserted into `photo_uploads_review` through `/api/save-photo-review`.
- Student confirmation can mark an upload as `submitted_for_review`.
- Admin queue reads `verification_status`, defaulting to `pending`.

Likely event signal:

- `photo_uploads_review` rows where `verification_status IN ('pending', 'submitted_for_review')`.
- Include `category`, `upload_context`, `academy_student_id`, `uploader_name`, `uploader_email`, `created_at_utc`, and `student_confirmed_at`.

Suggested first dashboard signals:

- Awaiting review count by category/upload context.
- Oldest pending upload age.
- Pending uploads missing `academy_student_id` but with student-looking category.
- Uploads whose R2 URL exists in DB but may not be reachable.

### 3. New purchase via Shopify or Chargebee requiring follow-up

Observed code:

- No Shopify API, Chargebee API, webhook, customer, purchase, checkout, invoice, subscription write, or follow-up code found.
- A static Shopify CDN image URL appears in frontend map icon configuration only.
- `users1.subscription_type` is read as an existing subscription/customer status signal.

Likely event signal:

- Not derivable from inspected code.

Needed for monitoring:

- Repository or integration that receives Shopify/Chargebee events.
- Tables used for purchases, customers, invoices, subscriptions, follow-up status.
- Rules for "requires follow-up".

Suggested placeholder registry entries:

- `purchase.shopify.created.awaiting_followup`
- `purchase.chargebee.created.awaiting_followup`
- `subscription.created_without_tree_allocation`

### 4. Photo viewer with student, staff and superuser views

Observed code:

- Student gallery reads `/api/student-gallery` and `/api/photo-review-gallery`.
- Staff gallery reads `/api/photo-review-gallery`.
- Admin/superuser review pages read `/api/academy-moderation-queue` and write approve/reject/hide endpoints.
- Student profile reads `/api/student-profile/:id`.

Likely event signal:

- Gallery visibility is driven by:
  - `verification_status = 'approved'`
  - `review_status = 'approved'`
  - `public_gallery_status = 'public'`
  - `is_visible_in_gallery = true`
  - `academy_student_id IS [NOT] NULL`
  - `upload_context` and `category`

Suggested first dashboard signals:

- Approved but not visible uploads.
- Visible uploads missing `cropped_file_url`.
- Student uploads with points awarded but hidden.
- Staff uploads saved with `upload_context = 'staff_upload'` but not recoverable by staff id.

### 5. Outbound emails and certificates to customers

Observed code:

- No email provider implementation found.
- No outbound email log table found.
- No certificate generation implementation found.
- `ZAPIER_APPROVAL_WEBHOOK_URL` sends approval data to Zapier for public academy upload approval.

Likely event signal:

- For current code, the only outbound signal is "approval webhook attempted".
- Attempts are logged only to application logs, not persisted in PostgreSQL.

Needed for monitoring:

- Where customer emails and certificates are generated today.
- Whether Zapier creates email/certificate artifacts outside this repo.
- Tables/logs for outbound send attempts, retries, failures, and certificate status.

Suggested first dashboard signals:

- Approved public academy upload with no recorded outbound follow-up.
- Zapier webhook missing environment variable.
- Zapier webhook returned non-2xx, once persistent logs exist.

### 6. Errors, retries and missing follow-up actions

Observed code:

- Errors are mostly logged with `console.error()` or returned as JSON.
- No persistent retry queue or error table found.
- Cloudflare upload function returns errors directly.
- R2 write and DB metadata write are separate operations; R2 can succeed while DB save fails.
- OpenAI description failures are downgraded to fallback description or `ai_status = 'failed'`.

Likely event signals:

- `photo_uploads_review.ai_status = 'failed'`.
- Review rows with missing `cropped_file_url` or missing student identity.
- R2 objects without matching DB rows are possible but not queryable from PostgreSQL alone.
- DB rows with public URLs that no longer resolve are possible but not checked.

Suggested first dashboard signals:

- Upload metadata save failures, once captured.
- R2 upload success without DB record, if frontend/function emits durable event.
- Pending review older than SLA.
- `ai_status = 'failed'`.
- Approved public upload where `academy_point_events` is missing.

### 7. Diagnostics for old flows, unused tables, unused fields and deprecated endpoints

Observed code:

- Diagnostics already exist:
  - `/api/diag/info`
  - `/api/diag/db`
  - `/api/diag/heroes`
- Stub/deprecated-looking endpoints:
  - `/api/trees/:id` currently returns placeholder data.
  - `/api/trees/by-codes` currently returns placeholder data.
  - `PATCH /api/staff-uploads` and `PATCH /api/staff-uploads/:id` return `501`.
- Potential field mismatch:
  - Staff upload function sends staff-specific fields that `savePhotoReview.js` does not insert.
  - `getPhotoReviewGallery.js` reads filters from query only for category/date/search/anonymous onboarding; Cloudflare staff uploads GET passes `upload_context=staff_upload`, but backend gallery code does not currently consume an `upload_context` query parameter.

Suggested first dashboard signals:

- Deprecated/stub endpoint hit count, once request logs are available.
- Fields sent by clients but not persisted.
- Tables known in DB but not referenced in code.
- DB columns referenced by diagnostics only.

## Missing information

- The actual repository for Shopify, Chargebee, purchase, customer, subscription write flows was not present in the inspected checkouts.
- The actual source of tree allocation writes was not present.
- No schema migration files or SQL DDL were found, so table definitions, indexes, constraints, defaults, and triggers are unknown.
- No persistent outbound email/certificate tables or send code were found.
- No durable error/retry table was found.
- No request logging or audit log table was found for admin actions.
- No clear persisted field for staff id in `photo_uploads_review` was found, despite client code sending `staff_id`.
- No persistent Zapier webhook attempt log was found.
- No R2-to-DB reconciliation code was found.
- Git status could not be read without marking these older checkouts as safe Git directories because ownership differs between sandbox users. I did not change Git configuration.

## Suggested `automation_registry` entries

These entries are intentionally operational-event oriented rather than system-oriented.

| Event key | Trigger/source | Signal | Attention criteria |
| --- | --- | --- | --- |
| `tree.allocated` | `trees1` / `v_user_trees` | Tree linked to user/customer | Missing `tree_code`, coordinates, planted date, or customer link |
| `tree.allocated_missing_coordinates` | `trees1` | `user_id` present, `lat`/`long` missing | Needs map/location follow-up |
| `subscription.user_without_tree` | `users1` + `trees1` | `subscription_type IS NOT NULL` but no tree row | Needs allocation follow-up |
| `upload.created.awaiting_review` | `photo_uploads_review` | New row with `verification_status = 'pending'` | Review queue SLA |
| `upload.submitted_for_review` | `photo_uploads_review` | `verification_status = 'submitted_for_review'` | Ready for admin review |
| `upload.approved.public` | `photo_uploads_review` | Approved and public | Verify gallery visibility, points event, outbound follow-up |
| `upload.approved.private` | `photo_uploads_review` | Approved but private | Verify intended non-public status |
| `upload.rejected` | `photo_uploads_review` | Rejected status | Verify reason present |
| `upload.hidden` | `photo_uploads_review` | `public_gallery_status = 'hidden'` | Verify points removed |
| `upload.ai_failed` | `photo_uploads_review` | `ai_status = 'failed'` | Optional manual description/follow-up |
| `upload.anonymous_onboarding.awaiting_claim` | `photo_uploads_review` | Approved public onboarding with no student/name/email | Needs identity claim |
| `academy.points.synced` | `academy_point_events` | Source table/id exists for approved public student upload | Missing or duplicate points event |
| `academy.points.removed` | `academy_point_events` | Source event removed after reject/hide | Verify no stale reward state |
| `gallery.student.visible` | `photo_uploads_review` | Approved public student upload | Missing image/file URL |
| `gallery.staff.visible_or_private` | `photo_uploads_review` | Staff upload context/category | Staff id not persisted or cannot be filtered |
| `outbound.approval_webhook.sent` | Zapier webhook | Approval webhook attempted | Needs durable logging |
| `outbound.approval_webhook.failed` | Zapier webhook | Non-2xx or exception | Retry/follow-up needed |
| `purchase.shopify.created.awaiting_followup` | Missing source | New Shopify purchase | Placeholder until purchase integration located |
| `purchase.chargebee.created.awaiting_followup` | Missing source | New Chargebee purchase/subscription | Placeholder until integration located |
| `certificate.awaiting_generation` | Missing source | Customer/student eligible for certificate | Placeholder until certificate logic located |
| `diagnostic.stub_endpoint_used` | Request logs | Hit to placeholder route | Route deprecation or implementation decision |
| `diagnostic.r2_without_db_record` | R2 + DB reconciliation | R2 object with no review row | Requires reconciliation job |
| `diagnostic.db_record_without_r2_object` | DB + R2 reconciliation | Review URL missing object | Requires reconciliation job |

## Risk notes

- The uploader and backend are split across two checkouts and public URLs are hard-coded in many frontend files. This makes environment switching and internal dashboard correlation harder.
- `api/trees.js` uses `PG_URL` and a separate PostgreSQL client while the rest of the backend uses `DATABASE_URL` through `api/db.js`. This may hide environment drift.
- `api/db.js` sets `search_path` using `DB_SCHEMA` string interpolation. Keep `DB_SCHEMA` tightly controlled.
- Admin authentication is a shared key passed by header or query parameter. Query-param admin keys can leak via browser history, logs, and referrers.
- `notifyApproval()` has no persistent delivery log or retry queue. Approval follow-up may silently depend on application logs.
- R2 upload and DB metadata save are not atomic. A user can upload a file successfully but fail to create the review row.
- Staff upload metadata appears partly dropped because `savePhotoReview.js` ignores staff-specific fields sent by `functions/api/staff-uploads.js`.
- `functions/api/staff-uploads.js` tries to filter staff uploads by `staff_id`/`uploaded_by`, but those fields are not returned by `photo-review-gallery` and may not be stored.
- `getPhotoReviewGallery.js` does not consume `upload_context` from query parameters, although a caller passes it. Staff upload listing may therefore over-fetch and filter poorly.
- The photo review table is doing many jobs: public gallery, student submissions, staff uploads, forest hero linking, academy onboarding, moderation, AI status, points, and outbound trigger source. The dashboard should expose event views without encouraging direct table editing in version 1.
- No schema/migration files were found, so referenced fields may differ from live DB reality.
- No destructive SQL or application logic changes were made while preparing this inventory.
