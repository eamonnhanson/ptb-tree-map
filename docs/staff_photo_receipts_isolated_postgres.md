# Staff photo receipts — isolated PostgreSQL acceptance test

This procedure is for PR #55 only. It must run against a newly created local
PostgreSQL database on a loopback host. Do not use an Aiven, Render, Netlify,
or other remote connection string.

## Production schema evidence

`test/sql/001_photo_uploads_review_baseline.sql` is a test-only reconstruction
of `public.photo_uploads_review`, obtained on 14 September 2026 through
catalog-only queries using the read-only `ptb_schema_inspector` role. The
inspection read `pg_class`, `pg_attribute`, `pg_attrdef`, `pg_constraint`,
`pg_index`, `pg_sequence`, and related catalog views only; it did not read any
application-table rows. The source table has no foreign-key dependencies.

The inspector role was verified to have no SELECT, INSERT, UPDATE, DELETE,
database CREATE, public-schema CREATE, or table ownership privilege.

## Provision a disposable local database

Use a local PostgreSQL owner/admin credential. It is intentionally not stored
in this repository. Choose a unique name matching
`ptb_staff_photo_receipts_test[_suffix]`.

```powershell
$testDatabase = "ptb_staff_photo_receipts_test_20260914"
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" --host 127.0.0.1 --username <local-owner> $testDatabase
$env:PTB_STAFF_PHOTO_POSTGRES_INTEGRATION_URL = "postgresql://<local-owner>@127.0.0.1:5432/$testDatabase"
node --test test/staffPhotoReceiptPostgresIntegration.test.js
```

The test rejects non-loopback hosts and database names outside that dedicated
pattern. It drops and recreates the database's `public` schema, so never point
the variable at a shared or persistent database.

## Exact schema sequence

The SQL-backed test applies this exact order:

1. `test/sql/001_photo_uploads_review_baseline.sql`
2. `docs/sql/022_staff_photo_receipts.sql`

The first file is test-only and is never a production migration. The second
file remains a reviewed deployment migration and must not be applied to Aiven
from this test procedure.

## Acceptance coverage

`test/staffPhotoReceiptPostgresIntegration.test.js` verifies against the
actual isolated PostgreSQL database that identical staff payloads reuse one
review ID and row; all receipt columns and the partial unique index exist; the
gallery returns the exact R2 URL and staff identity; missing staff identity
returns HTTP 400 without an insert; and lost-response recovery reads the
existing receipt without creating a second row.

After testing, remove the disposable database with the local PostgreSQL owner
tooling. Do not use a production connection for cleanup.
