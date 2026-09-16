-- Fill every placeholder. The reference must be unique for this customer.
-- Invoice numbers alone are unsuitable because April and September 2026 reused one.
BEGIN;
insert into public.ops_console_tree_credit_topups (credit_code, reference, trees, ordered_at, received_at, notes)
values ('imcd_benelux', 'REPLACE_WITH_UNIQUE_BATCH_REFERENCE', 0, null, null, 'Replace every placeholder before execution');
COMMIT;
