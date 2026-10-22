# Staff metadata backend correction

## Concurrency compatibility follow-up — 22 October 2026

Reviewed and applied `docs/backend-pr65-concurrency.patch` from uploader
commit `13fa8f3bb3c28482e36e856052c39a3d216de37b`, alongside its verification
report `docs/staff-metadata-review-blockers.md`. This section supersedes the
earlier contract and verification status below.

PATCH now requires an `expected` object containing exactly the supplied editable
fields (`staff_name`, `category`, `caption`), with each original raw value a string
or null. Missing/invalid preconditions and edits with no fields return 400.
Names are validated without normalization: accents, repeated and surrounding
spaces are retained; blank-only, non-string and over-80-character names fail.
Caption trimming and the 2,000-character limit remain unchanged.

Null-safe comparisons run inside the same parameterized UPDATE that writes the
edit. A changed supplied field rejects the entire edit with HTTP 409 and
`STAFF_METADATA_CONFLICT` / `METADATA_CONFLICT`. Unrelated fields are neither
compared nor overwritten. A scoped read after an unsuccessful UPDATE returns 404
for inaccessible/missing records; it never retries a write. The existing staff
session route gate, immutable receipt ownership, public/non-student scope and
forbidden-field checks remain intact. Empty and null captions deliberately clear
descriptions only when their original value still matches.

Validation of the final backend changes:

- Every root backend `test/*.test.js`: 237 passed, zero failures, five guarded
  PostgreSQL tests skipped. Database integration URLs were removed from the test
  process; localhost permission was used for HTTP fixtures.
- Repository-wide `npm test`: 298 passed, two failures, five skipped. Both failures
  are existing ops-console isolation assertions requiring all branch/working-tree
  files to be inside `apps/ops-console`; this backend PR necessarily violates
  that app-specific assumption. No tests were weakened or removed.
- Uploader at the exact commit above: `npm test` passed all 12 test files.
- Direct uploader proxy-to-backend-handler fixture passed exact names, partial
  edits, combined stale-edit rejection/409, auth forwarding, required expected
  values and empty/null clearing. Fetch was intercepted and the SQL pool mocked;
  no deployed service or database was contacted by this fixture.
- Regression tests include simultaneous same-field edits (one success/one 409),
  simultaneous different-field edits (both retained), exact names and deliberate
  clearing. The simultaneous connection cases are guarded PostgreSQL tests and
  remain unexecuted without an explicitly approved disposable database.
- `git diff --check` passed.

Remaining release blockers: approved disposable PostgreSQL acceptance, read-only
confirmation of the deployed error/schema/configuration, and separately authorized
post-release persistence/device acceptance with uploader #36. Keep this PR draft.
No merge, deployment, migration or production database write was performed.

## Earlier correction and verification (historical)

Companion to eamonnhanson/ketso-uploader#36, based on
`docs/backend-staff-metadata.patch` and `docs/staff-metadata-persistence.md`
at uploader commit 5050a3e8322392b79741a6f11ef0b42d2492af85.

The PATCH endpoint retains the existing requireStaff session gate, receipt
staff_id ownership comparison, staff context and public/non-student scope.
The shared staff session is not a personal identity; this change preserves
the existing ownership model rather than introducing a new one.

One parameterized UPDATE preserves omitted name, category and caption values.
Explicit empty or null captions clear the description. Captions accept up to
2,000 characters; longer and non-string values fail before SQL. Invalid supplied
names/categories still fail. Identity, media and moderation fields cannot be
edited. RETURNING no longer requires mime_type or duration_seconds.
Database errors remain HTTP 500 with a fixed diagnostic class; the handler
does not log SQL, parameters, metadata or raw exception details.

## Verification on 22 October 2026

- Focused staff metadata, management, photo and video unit tests: 23 passed.
- All root test/*.test.js through npm test with explicit file arguments:
  233 passed, zero failures, five PostgreSQL integration tests skipped.
  Explicit paths exclude unrelated existing worktrees and the independently
  scoped ops-console application. PostgreSQL test connection settings were
  removed from the test process; no database was approved or contacted.
- The initial sandbox broad run was interrupted after localhost fixture fetches
  failed and unrelated ops-console isolation checks failed. The backend suite
  passed using host access for fixture HTTP servers.
- git diff --check passed.

New unit coverage includes independent edits, explicit clearing, exact length
boundary, rejected input, SQL ownership/scope, authentication route wiring,
removed column dependencies and bounded diagnostics (including unexpected codes).

## Disposable PostgreSQL verification still required

The new test has NOT executed SQL in this session. It checks independent reads,
long-caption retention on a name-only edit, unchanged unrelated/unauthorized
rows, missing optional columns, explicit clearing and rollback on a real CHECK
constraint failure.

Run only after explicit approval identifying the disposable database.
The fixture resets public with DROP SCHEMA CASCADE and recreates fixture tables.
Its URL guard requires localhost/127.0.0.1/::1, role ketso_test, and database
ptb_staff_management_test (or that name followed by an underscore suffix).
Set PTB_STAFF_MANAGEMENT_POSTGRES_TEST_URL through a secure local mechanism,
and PTB_STAFF_METADATA_TEST_RESET_APPROVED=yes for that approved run.
Do not place credentials in commands, output or commits.

Run this file alone, never concurrently with staff management integration tests:

    node --test test/staffMetadataPostgresIntegration.test.js

Both files reset the same fixture database. Remove the approval flag after the
run. The new approval flag is test-only; no production configuration is added.

## Production release checks and risks

- The original deployed 500 root cause remains unconfirmed. Use authorized,
  read-only deployed logs to distinguish SCHEMA_MISMATCH,
  DATABASE_PERMISSION_DENIED, METADATA_CONFLICT, DATABASE_TIMEOUT and
  DATABASE_ERROR. Do not infer missing columns from a failed save alone.
- Verify the intended backend revision, database, DB_SCHEMA/search_path and
  runtime SELECT/UPDATE privileges. Receipt columns from migration 022 remain
  required; caption must support 2,000 characters (the checked-in baseline is
  text). Inspect actual constraints and triggers before deciding on migrations.
- Metadata PATCH no longer requires video duration or MIME columns. Other
  gallery/video queries still have their existing schema requirements,
  including migrations 024/025; management collections use 026. This correction
  adds no migration and does not authorize running existing migrations.
- Preserve STAFF_UPLOAD_KEY session configuration and existing database
  connection settings. Render configuration is external to this repository;
  the checked-in GitHub workflow runs tests only. No production deployment
  configuration was inspected or changed.
- api/db.js still has existing connection/pool logging and TLS verification
  behavior outside this correction. Handler diagnostic sanitization does not
  claim to sanitize the entire application's existing logging. Review those
  separately, with explicit TLS review before any TLS change.
- After a separately authorized release, confirm PATCH and fresh GET retain
  name/category/description through refresh and logout/login using an approved
  test record, paired with uploader #36. Production persistence and Android
  device acceptance remain unverified.

No merge, deployment, migration or production data change was performed.
