# KETSO Academy tutor questions

## Deployment order

1. Apply `docs/sql/008_academy_tutor_questions.sql` to the production PostgreSQL database.
2. Create and test both Zapier Catch Hook Zaps.
3. Add the Render environment variables below.
4. Deploy `ptb-tree-map`.
5. Deploy `ketso-uploader`.
6. Test with dedicated test students before using a real student account.
7. Preview review 353, verify the displayed record and question text, and only then run the backfill.

Do not send a real test email until the recipient and test moment have been confirmed.

## Render environment variables

Required:

- `ADMIN_GALLERY_KEY`: existing tutor/admin key. The frontend sends it in `X-Admin-Key`, never in the URL.
- `TUTOR_QUESTION_WEBHOOK_URL`: Zapier Catch Hook URL for new questions.
- `TUTOR_ANSWER_WEBHOOK_URL`: Zapier Catch Hook URL for tutor answers.
- `TUTOR_NOTIFICATION_EMAIL`: `eamonn@planteenboom.nu`.
- `KETSO_UPLOADER_BASE_URL`: `https://ketso-uploader.pages.dev`.
- `STAFF_UPLOAD_KEY`: existing KETSO staff password, now checked server-side instead of exposed in `app.js`.

Optional:

- `TUTOR_WEBHOOK_TIMEOUT_MS`: webhook timeout in milliseconds. Default `5000`; accepted range `1000` through `15000`.

After saving the variables, redeploy the Render service. Never place a webhook URL or admin key in frontend code.

## Zap 1: new question to tutor

1. Trigger: **Webhooks by Zapier → Catch Hook**.
2. Copy its URL into Render as `TUTOR_QUESTION_WEBHOOK_URL`.
3. In a controlled test, submit a question with a test student token.
4. Confirm that Zapier receives these fields:

| Field | Meaning |
|---|---|
| `event` | `academy_tutor_question_created` |
| `tutor_email` | Address from `TUTOR_NOTIFICATION_EMAIL` |
| `question_id` | Private question ID |
| `student_name` | Student name |
| `student_id` | Academy student ID |
| `course_key` | Course key |
| `course_name` | Readable course name |
| `module_key` | Lesson or module key |
| `module_name` | Readable lesson or module name |
| `question` | Full question |
| `created_at` | Submission time |
| `tutor_queue_url` | Safe link without an admin key |

5. Action: **Email by Zapier**, Zoho Mail, Gmail or the approved mail action.
6. To: use the `tutor_email` field.
7. Suggested subject: `New KETSO student question #{{question_id}}`.
8. Include student, student ID, course, module, date, full question and `tutor_queue_url`.
9. Turn the Zap on only after the controlled test has produced one email to the intended tutor.

## Zap 2: answer to student

1. Trigger: **Webhooks by Zapier → Catch Hook**.
2. Copy its URL into Render as `TUTOR_ANSWER_WEBHOOK_URL`.
3. Answer a question belonging to a test student with a non-deliverable or controlled test address.
4. Confirm that Zapier receives:

| Field | Meaning |
|---|---|
| `event` | `academy_tutor_question_answered` |
| `question_id` | Private question ID |
| `student_name` | Student name |
| `student_email` | Student recipient |
| `course_key` | Course key |
| `course_name` | Readable course name |
| `module_key` | Lesson or module key |
| `module_name` | Readable lesson or module name |
| `question` | Original question |
| `answer` | Tutor-checked answer |
| `answered_at` | Answer time |
| `student_questions_url` | Personal `My questions` link |

5. Action: approved email action.
6. To: use `student_email`. Do not enter a fixed address.
7. Suggested subject: `Your KETSO tutor has answered your question`.
8. Include the student name, original question, tutor answer and `student_questions_url`.
9. Turn the Zap on only after verifying that it cannot send to an unintended address.

Zapier accepting a webhook means that the notification request was accepted. It does not prove final email delivery. The tutor page reports `accepted`, `failed`, `not configured` or `pending`.

## Database migration

From a shell with `DATABASE_URL` and `psql`:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/sql/008_academy_tutor_questions.sql
```

If `psql` is unavailable in Render, open the database SQL console and execute the complete file. The migration is repeatable and adds missing columns when an earlier local table version already exists.

## Review and backfill question 353

Run preview only:

```sh
node scripts/backfillTutorQuestion353.js
```

The preview:

- selects only `photo_uploads_review.id = 353`;
- stops if the row is not explicitly marked as a tutor question;
- stops if it has no academy student;
- shows the identifying metadata and exact question text;
- shows whether a backfill already exists;
- changes nothing.

After visually confirming the exact record and question text:

```sh
APPLY_BACKFILL=true CONFIRM_REVIEW_ID=353 node scripts/backfillTutorQuestion353.js
```

The apply run is idempotent through the unique `source_review_id`. It also makes only record 353 private, removes its points and deletes only the point event whose `source_table` is `photo_uploads_review` and whose `source_id` is `353`.

## Post-deployment test

1. Open a test student’s personal course link.
2. Select **A question to the tutor** and choose a module.
3. Submit a harmless test question once, then simulate a duplicate retry.
4. Confirm that the page says the question was saved privately and never says `Waiting for approval`.
5. Confirm that only one database question exists and it has zero points.
6. Confirm it is absent from student, general and moderation galleries.
7. Open `/tutor-questions/`; verify that no data loads with a wrong admin key.
8. Load with the correct key and filter New, Answered, Closed and All.
9. Verify student name, student ID, course, module, date, full question and tutor notification status.
10. Send a checked answer and confirm that the answer is stored even if the answer webhook is deliberately disabled.
11. Confirm the student page shows the answer only with the correct personal token.
12. Confirm a wrong token is rejected and student A cannot see student B’s question.
13. Close the question and confirm it appears under Closed.
14. Confirm Zap 1 sends only to `eamonn@planteenboom.nu`.
15. Confirm Zap 2 sends only to the test student and its personal link opens `My questions`.
