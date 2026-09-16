-- Review-only, not executed by the app or build.
-- First verify the intended database has these business tables. The existing
-- monitoring connection is ptb_monitoring_test; do not assume it is the live
-- allocation/Academy database. Do not grant access on an unverified target.
-- Existing role: ops_console_reader. Execute only after explicit approval.
BEGIN;
GRANT USAGE ON SCHEMA public TO ops_console_reader;
GRANT SELECT (id, user_id, tree_name, lat, "long", claimed_at)
  ON public.trees1 TO ops_console_reader;
GRANT SELECT ON public.ops_console_tree_credits, public.ops_console_tree_credit_accounts,
  public.ops_console_tree_credit_topups TO ops_console_reader;
GRANT SELECT (review_status) ON public.photo_uploads_review TO ops_console_reader;
GRANT SELECT (status) ON public.academy_tutor_questions TO ops_console_reader;
COMMIT;
