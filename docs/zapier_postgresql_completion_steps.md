# Zapier PostgreSQL completion steps

## Safety and evidence boundary

These are manual Zapier changes. Nothing in this repository changes Zapier or
proves that a Zap is published, enabled or currently succeeding. Do not add the
steps until the corresponding SQL has been tested in an isolated database and
approved for the intended environment.

A successful Zapier action proves that the provider accepted/executed the
action according to its Zapier contract. It does not by itself prove inbox
delivery of an email.

## Shopify subscriptions to tree allocation

### Finding

Migration 011 already provides the required idempotent mechanism:
`mark_shopify_subscription_payment_side_effect(...)`. The payment row contains
separate `certificate_status` and `welcome_email_status` fields, while the
subscription row becomes `welcome_status = 'completed'` only when both are
completed.

The planned registry chain currently describes Writer and welcome mail but does
not contain the PostgreSQL call after Writer. A successful Writer “Merge a
Template and Send Email” action therefore leaves both database fields pending.

### Manual Zapier change

Immediately after **Zoho Writer — Merge a Template and Send Email**, add one
**PostgreSQL — Find Row via Custom Query** action named:

`Complete Shopify welcome certificate and email in PostgreSQL`

Map only values returned by earlier trusted actions:

- `shopify_order_id`: the normalized numeric order ID originally passed to
  `process_shopify_subscription_payment`;
- `writer_external_id`: Writer's merge/document ID when the action exposes it,
  otherwise SQL `NULL`;
- `writer_external_url`: Writer's document URL when exposed, otherwise `NULL`.

Use one statement so both markers commit or roll back together:

```sql
WITH certificate_marked AS MATERIALIZED (
  SELECT (
    public.mark_shopify_subscription_payment_side_effect(
      '<mapped normalized shopify_order_id>',
      'certificate',
      'completed',
      NULLIF('<mapped writer_external_id or empty>', ''),
      NULLIF('<mapped writer_external_url or empty>', ''),
      NULL
    )
  ).id AS payment_id
)
SELECT (
  public.mark_shopify_subscription_payment_side_effect(
    '<mapped normalized shopify_order_id>',
    'welcome_email',
    'completed',
    NULL,
    NULL,
    NULL
  )
).*
FROM certificate_marked;
```

The dependency on `certificate_marked` forces the certificate marker to execute
before the email marker. A retry with the same order ID and values is
idempotent and does not allocate another tree. Do not call the payment processor
again merely to set completion state.

If Writer fails, this PostgreSQL action must not run. Add a separate failure
path only if Zapier can reliably expose Writer failure; that path may mark the
relevant effects `failed`, but must not mark either one completed.

## Zoho CRM Academy onboarding to PostgreSQL

Published Zap: **Zoho CRM Academy onboarding → PostgreSQL**

### Existing evidence

The definitive production sequence for `zap_175` is:

1. Zoho CRM - New/Updated Module Entry;
2. Filter by Zapier;
3. Code by Zapier - Build safe PostgreSQL query;
4. PostgreSQL - `process_academy_student_from_crm`;
5. Zoho CRM - Update Module Entry;
6. Zoho Mail - Send Email;
7. Zoho CRM - Update Module Entry;
8. PostgreSQL - Complete Academy onboarding in PostgreSQL;
9. Code by Zapier - Technical no-op for Zapier publishing.

Step 9 is a technical publishing requirement and is not a business dependency.
The production call in step 4 passes `FALSE` for `p_test_mode`.

An `academy_students` row matching `zoho_contact_id` and `ketso_student_id`
proves the student-processing result exists. The production completion layer
now provides direct evidence that all actions preceding step 8 returned
successfully.

### Minimal completion model

Migration 020 adds one row per Zoho contact in
`academy_onboarding_completions` and the function
`complete_academy_onboarding(...)`. The function:

- requires exactly one matching existing `academy_students` row;
- does not modify or recreate the student;
- uses the Zoho contact as idempotency/locking key;
- preserves `completed_at` from the first successful call;
- safely enriches optional external IDs on retry;
- rejects a contact that resolves to a different student.

Because the Zap is sequential, a completion row proves that all Zap actions
preceding step 8 completed successfully. It does not prove inbox delivery of
the email.

### Manual Zapier change

Production step 8, immediately after the final **Zoho CRM - Update Module
Entry**, is the PostgreSQL action named:

`Complete Academy onboarding in PostgreSQL`

Its definitive mappings are:

- Zoho CRM Record Id → `p_zoho_contact_id`;
- step 4 Ketso Student Id → `p_ketso_student_id`;
- `p_email_external_id` → SQL `NULL`;
- `p_initial_crm_external_id` → SQL `NULL`;
- `p_final_crm_external_id` → SQL `NULL`.

```sql
SELECT *
FROM public.complete_academy_onboarding(
  '<mapped Zoho CRM Record Id>',
  <mapped step 4 Ketso Student Id>,
  NULL,
  NULL,
  NULL
);
```

The completion action must remain after the final CRM update. Zapier retry may
call it again safely. Step 9 remains outside this evidence boundary because it
is a technical no-op, not a business step.

### What remains unproven

The production definition of `process_academy_student_from_crm` is preserved as
a non-executed source-control snapshot in migration 021. Migration 020 documents
the completion layer already present in production, but Academy must not be
marked `GREEN` until a new successful post-change runtime completion has been
demonstrated.
