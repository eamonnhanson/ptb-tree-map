# Arboriculture I rollout

## Deployment order

1. Back up `academy_students`, `photo_uploads_review`, `academy_point_events` and `academy_student_rewards`.
2. Run `docs/sql/007_academy_courses.sql` against the production PostgreSQL database.
3. Deploy `ptb-tree-map` to Render.
4. Confirm `/health` and `/api/academy-courses` return HTTP 200.
5. Test one existing legacy upload token. It must return `online_tree_planting` with `legacy: true`.
6. Deploy `ketso-uploader` to Cloudflare Pages.
7. Create one Arboriculture I enrollment and test image, text and document uploads before changing Zapier.
8. Update the Zoho/Zapier registration workflow to create an enrollment and use its token in the onboarding URL.

## Create or update an Arboriculture I enrollment

After the existing `process_academy_student_from_crm` step has returned the student ID, call:

```sql
SELECT *
FROM public.enroll_academy_student(
  {{academy_student_id}},
  'arboriculture_1',
  {{cohort}},
  NULL,
  'active'
);
```

The function creates an `enrollment_token` when none is supplied. Build the personal upload URL from the returned token:

```text
https://ketso-uploader.pages.dev/academy-onboarding/?token=<enrollment_token>
```

The existing onboarding URL based on `academy_students.upload_token` remains valid and resolves to the online tree planting course.

## Rollback boundary

The migration only adds a table, a nullable column, indexes, backfilled course labels and a helper function. Existing student and upload identifiers are unchanged. If the frontend or API deployment must be rolled back, leave the added database objects in place so uploads written with `course_key` remain readable.
