# Staff upload management

Implementation spans the `ptb-tree-map` Express backend and the sibling
`ketso-uploader` Cloudflare Pages repository. Both are required.

## Git scope

Both repositories use `codex/staff-upload-collections-archive`, starting from
their fetched `origin/main` on 18 October 2026. Backend base:
`9fb3cbc2086ad26a43034aaf31669fca08752c13`; uploader base:
`2f27d4dc21e65e8220bd0d2677af02481faf5701`.
The metadata endpoint/editor from merged backend PR 61 and uploader PRs 31/32
are already in those bases. This feature adds collections, reversible archive,
staff sessions, and a management gallery; it does not reintroduce those PRs.

## Workflow

Start at https://ketso-uploader.pages.dev/ and choose **KETSO staff**.
Enter the existing staff password. The staff home offers **Upload new** and
**Manage existing uploads**. Upload new retains the current upload dashboard.
Manage opens `/manage-uploads/` with Current projects and Active selected.
Choose Unassigned to find legacy uploads; choose All collections to search
across projects. Status is independent: select Archived or All to find and
restore archived uploads. Date filters are optional and use upload dates.
Open a card, edit metadata, select multiple collections, and Save or Cancel.
Date taken stays empty unless entered. Restore by changing status to Active.

## Authorization and storage

The existing `/api/academy-staff-auth` password check now issues an HMAC-signed
eight-hour staff session using the existing `STAFF_UPLOAD_KEY`. The token is
stored in the current browser tab's sessionStorage; the password is not stored.
Every management API request checks the signature and expiry. No admin key is
sent to the browser. Rotation of the existing password invalidates sessions.

The shared password establishes a staff role, not a verified individual.
Management therefore follows the existing public staff-gallery visibility
boundary: public, non-student staff uploads with approved/not-required review
or verification. Private, pending and student uploads stay outside this view.
The legacy metadata PATCH is also protected by staff authentication and this
visibility boundary, while retaining its staff-ID ownership predicate.

Registry row IDs remain authoritative. Metadata lives on photo_uploads_review;
collection definitions and memberships use relational tables. Current projects
means assigned records, with Active as the default independent status. No age
cutoff or legacy assignment is inferred. Archiving changes management status
only; it does not moderate or remove an image from the public gallery.
`/gallery` and `/admin-gallery/` are unchanged. Empty collection selections
move a record into Unassigned. Save replaces only that row's memberships in a
transaction, preserving its media URLs, identity and upload timestamp.

## Deployment sequence (not executed)

1. Confirm the actual Render service and PostgreSQL target. After approval,
   apply `docs/sql/026_staff_upload_collections.sql` once, following existing
   staff receipt migration 022. It adds columns/tables and four collection
   definitions; it neither deletes uploads nor guesses assignments or dates.
2. Coordinate the two application releases: the backend now requires a staff
   session for the existing metadata PATCH, so the older uploader cannot edit
   until its matching frontend release is available. Deploy this backend
   revision to the verified Render service. Keep the existing STAFF_UPLOAD_KEY.
   No new environment variables are required.
3. Deploy the sibling uploader revision to the existing ketso-uploader
   Cloudflare Pages project. Actual deployment settings are external to these
   repositories and have not been inferred or changed.
4. Verify login, upload and management with authorized test records. Existing
   tabs must log in again to obtain a session. Do not test submissions against
   production without approval.

Collection options are maintained once in staff_upload_collections. Add or
rename options through a reviewed migration; the gallery/editor load them
from the API. Public feeds are not changed by management archiving.

## Verification and local reproduction

Verified on 18 October 2026 using Node 24.19.0 and a disposable PostgreSQL 18
cluster bound to `127.0.0.1:55439`. No production database, R2 storage,
notifications, deployment, or merge was used.

- Uploader `npm test`: 71 passed, zero failed/skipped.
- Backend current-checkout suite: 242 passed, zero failed, two skipped.
  PowerShell: `$testFiles = (Get-ChildItem test -Filter *.test.js).FullName; npm test -- @testFiles`.
  Explicit files avoid discovering unrelated nested `.worktrees/` checkouts.
- `test/staffUploadManagementPostgresIntegration.test.js`: eight passing tests
  including its parent. It runs baseline + migrations 022, 024, 025, then 026
  twice. It checks legacy field preservation, actual row filtering, multiple
  memberships, caption/location/tag search of archived uploads, restore,
  rejection/rollback, and the read-only public gallery.
- Existing staff photo receipt integration suite: six passing tests including
  its parent. Its fixture now includes prerequisite migration 024 so the current
  public gallery can query submission_section. No assertions were removed.
- Only unrelated Shopify and Chargebee PostgreSQL suites were skipped because
  their dedicated test database variables were not set.

The new database suite requires `PTB_STAFF_MANAGEMENT_POSTGRES_TEST_URL` pointing
to a disposable loopback database named `ptb_staff_management_test[_suffix]`
with role `ketso_test`. It refuses other hosts/database names/roles and resets
that database's public schema. Never point it at a shared database. The receipt
suite uses its separate existing `PTB_STAFF_PHOTO_POSTGRES_INTEGRATION_URL` and
`ptb_staff_photo_receipts_test[_suffix]` database.

Run `node --test test/staffUploadManagementPostgresIntegration.test.js` after
setting the dedicated local variable. To reproduce browser acceptance, stop
that test first, keep the same variable set, and run:
`node scripts/previewStaffUploadManagement.js ../ketso-uploader`.
This resets the disposable fixture database, serves both local checkouts at
http://127.0.0.1:8768/, and accepts the fixture-only password
`local-fixture-password`. Production URLs are rewritten only in local HTTP
responses; the fixture never imports the production database connection.
Photo bytes use local fixture storage; registry saves use the real handler.

Browser acceptance covered wrong/correct password, the two staff choices,
Current/Active defaults, legacy Unassigned records dated 2001, Cancel,
caption/location/date/tags editing with two collections, persistence on reopen,
archiving, Archived/All tag search, restoring at 390x844, visible save errors,
synthetic Upload new with a durable receipt, new uploads in Unassigned,
sign-out protection, and the public gallery's viewing-only controls.
A discovered rapid-filter race was fixed and regression-tested; superseded
responses cannot overwrite the newest selected filters.

Neither repository defines a build script. Changed JavaScript syntax and Git
whitespace checks passed. Production migration 026 and deployment remain
separate approval steps after both feature PRs are reviewed.
