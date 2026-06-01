# Zapier workflow inventory

Source: docs/sources/zapier/exported-zap-2026-05-31T10_27_41.118Z.json
History: docs/sources/zapier/history/zapier-history-combined-2026-03-01-to-2026-05-31.csv

| workflow_id | workflow_name | trigger_app | trigger_event | action_apps | postgresql_tables | expected_business_result | history | status | risk_level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| zap_1 | IMCD_NL_TreeCert_Postgres | ZohoForms | new_form_entry | ZohoForms; PostgreSQL; BranchingAPI; ZohoCreator | users1; trees1 | Allocate tree/certificate record from Zoho Form submission. | success 10, filtered 0, halted 0, error 0 | partially_audited | low |
| zap_15 | IMCD_BEL_TreeCert_Postgres | ZohoForms | new_form_entry | ZohoForms; PostgreSQL; BranchingAPI; ZohoCreator | users1; trees1 | Allocate tree/certificate record from Zoho Form submission. | success 2, filtered 0, halted 0, error 0 | partially_audited | low |
| zap_29 | zap a multipleEigenbomenShopifyToPostgreSQL (SKU 02) | Shopify | new_paid_order_v3 | Shopify; FilterAPI; PostgreSQL; Code; ZapierLooping; BranchingAPI; ZohoCreator | trees1; users1 | Allocate owned tree purchase to PostgreSQL and create Zoho Creator evidence. | success 0, filtered 12, halted 0, error 0 | partially_audited | medium |
| zap_47 | zap a- Shopify -> Tokenized Gift Tree Link (SKU 01) | Shopify | new_paid_order_v3 | Shopify; FilterAPI; Code; PostgreSQL; ZapierFormatter; ZohoCreator; ZohoMail | trees1; gift_claims; SET; email_templates_01_gifttrees | Create claim token, reserve/record gift claim, send claim-link email. | success 0, filtered 6, halted 0, error 0 | partially_audited | medium |
| zap_61 | ZAP B | ZohoForms | new_form_entry | ZohoForms; PostgreSQL; FilterAPI; Code; ZapierLooping; ZapierFormatter; BranchingAPI; ZohoCreator | gift_claims; users1; SET; trees1 | Process gift tree claim form, allocate claimed trees, create certificate jobs. | success 0, filtered 0, halted 0, error 0 | not_audited | low |
| zap_95 | Nieuw abonnes chargebee REVERTED | Chargebee | payment_succeeded | Chargebee; ZapierFormatter; BranchingAPI; Code; ZohoMail; PostgreSQL; FilterAPI | users1; trees1 | Handle subscription/customer record, allocate subscription tree, send allocation mail. | success 62, filtered 0, halted 8, error 0 | partially_audited | medium |
| zap_124 | Monthly Tree Report | Schedule | everyMonth | Schedule; PostgreSQL; Code; ZohoMail | trees1 | Email monthly tree report. | success 1, filtered 0, halted 0, error 0 | partially_audited | low |
| zap_129 | Send Forest Hero Photo Email (once per user/ p/h) - Forest Photo 2025Q4 - Eénmalige e-mail | Schedule | everyHour | Schedule; PostgreSQL; ZapierFormatter; ZapierLooping; ZohoMail | photos; trees1; base; users1; params; email_log; unsent | Send forest photo email once and log to email_log. | success 7, filtered 0, halted 1420, error 0 | partially_audited | low |
| zap_135 | (Copy) zap b multiple Eigenbomen SKU02 | Shopify | new_paid_order_v3 | Shopify; FilterAPI; Delay; PostgreSQL; Code; ZohoCreator | trees1; users1 | Allocate owned tree purchase to PostgreSQL and create Zoho Creator evidence. | success 0, filtered 6, halted 0, error 0 | partially_audited | medium |
| zap_141 | Nieuw abonnes shopify handmatig - zoho form | ZohoForms | new_form_entry | ZohoForms; ZapierFormatter; BranchingAPI; Code; ZohoMail; PostgreSQL; FilterAPI | users1; trees1 | Handle subscription/customer record, allocate subscription tree, send allocation mail. | success 0, filtered 0, halted 0, error 0 | partially_audited | medium |
| zap_172 | Webhooks by Zapier | WebHook | hook_v2 | WebHook; FilterAPI; ZohoMail |  | Workflow needs verification. | success 45, filtered 21, halted 0, error 0 | partially_audited | low |
| zap_175 | Trigger: New or Updated Contact in Zoho CRM | ZohoCRM | new_or_updated_module_entry | ZohoCRM; FilterAPI; PostgreSQL; ZohoMail | process_academy_student_from_crm | Create/update Academy onboarding data and send onboarding email. | success 74, filtered 912, halted 0, error 13 | partially_audited | high |

## Detailed extraction notes

### zap_1: IMCD_NL_TreeCert_Postgres

- Trigger filters: 2 filter/path steps
- PostgreSQL queries: 5 SQL/query steps
- PostgreSQL tables touched: users1; trees1
- PostgreSQL fields updated/mapped: query; update__tree_code; row_id; update__tree_type; update__user_id; update__claimed_at; VoornaamOntvanger; oomtype; Boom_code; EmailGever; Boomnaaam; Email_ontvanger_cadeauboom; PD_Boom1; email; updated_at; created_at; update__tree_name
- Zoho Creator apps/forms touched: Zoho Creator records/forms touched; exact app/form needs verification from Zap step mappings
- Zoho Mail actions: none found
- Shopify references: no
- Chargebee references: no
- Webhook references: no
- Code by Zapier snippets summary: 0 Code by Zapier steps
- Formatter steps summary: 0 Formatter steps
- Looping steps summary: 0 Looping steps
- Branch/path logic: 3 branch/path steps
- Audit evidence found: Zapier history CSV; PostgreSQL users1/trees1
- Missing audit evidence: standardized final workflow/audit log row
- Manual follow-up required: unknown
- Open questions: Verify production active/paused state and whether final customer-visible evidence is complete.

### zap_15: IMCD_BEL_TreeCert_Postgres

- Trigger filters: 2 filter/path steps
- PostgreSQL queries: 5 SQL/query steps
- PostgreSQL tables touched: users1; trees1
- PostgreSQL fields updated/mapped: query; update__tree_code; row_id; update__tree_type; update__user_id; update__claimed_at; VoornaamOntvanger; oomtype; Boom_code; EmailGever; Boomnaaam; Email_ontvanger_cadeauboom; PD_Boom1; email; updated_at; created_at; update__tree_name
- Zoho Creator apps/forms touched: Zoho Creator records/forms touched; exact app/form needs verification from Zap step mappings
- Zoho Mail actions: none found
- Shopify references: no
- Chargebee references: no
- Webhook references: no
- Code by Zapier snippets summary: 0 Code by Zapier steps
- Formatter steps summary: 0 Formatter steps
- Looping steps summary: 0 Looping steps
- Branch/path logic: 3 branch/path steps
- Audit evidence found: Zapier history CSV; PostgreSQL users1/trees1
- Missing audit evidence: standardized final workflow/audit log row
- Manual follow-up required: unknown
- Open questions: Verify production active/paused state and whether final customer-visible evidence is complete.

### zap_29: zap a multipleEigenbomenShopifyToPostgreSQL (SKU 02)

- Trigger filters: 3 filter/path steps
- PostgreSQL queries: 3 SQL/query steps
- PostgreSQL tables touched: trees1; users1
- PostgreSQL fields updated/mapped: query; iteration_limit; update__lat; update__long; update__tree_code; row_id; update__tree_type; update__user_id; update__tree_id; update__order_id; update__claimed_at; sku; voornaam_ontvanger; achternaam_ontvanger; email_ontvanger; tree_code; lat; long; tree_type; aantal_bomen; language; user_id; Assigned_Trees; order_id; email; updated_at; created_at; dump
- Zoho Creator apps/forms touched: Zoho Creator records/forms touched; exact app/form needs verification from Zap step mappings
- Zoho Mail actions: none found
- Shopify references: yes
- Chargebee references: no
- Webhook references: no
- Code by Zapier snippets summary: 4 Code by Zapier steps
- Formatter steps summary: 0 Formatter steps
- Looping steps summary: 1 Looping steps
- Branch/path logic: 3 branch/path steps
- Audit evidence found: Zapier history CSV; PostgreSQL trees1/users1
- Missing audit evidence: standardized final workflow/audit log row
- Manual follow-up required: yes/unknown
- Open questions: Verify production active/paused state and whether final customer-visible evidence is complete.

### zap_47: zap a- Shopify -> Tokenized Gift Tree Link (SKU 01)

- Trigger filters: 1 filter/path steps
- PostgreSQL queries: 3 SQL/query steps
- PostgreSQL tables touched: trees1; gift_claims; SET; email_templates_01_gifttrees
- PostgreSQL fields updated/mapped: query; inputs; gifter_email; token; tree_ids; number_of_trees; expires_at; sku; language; order_ID; subject; content
- Zoho Creator apps/forms touched: Zoho Creator records/forms touched; exact app/form needs verification from Zap step mappings
- Zoho Mail actions: {{59__subject}}

- Shopify references: yes
- Chargebee references: no
- Webhook references: no
- Code by Zapier snippets summary: 5 Code by Zapier steps
- Formatter steps summary: 2 Formatter steps
- Looping steps summary: 0 Looping steps
- Branch/path logic: 0 branch/path steps
- Audit evidence found: Zapier history CSV; PostgreSQL trees1/gift_claims/SET/email_templates_01_gifttrees; Zoho Mail outbound action
- Missing audit evidence: standardized final workflow/audit log row
- Manual follow-up required: yes/unknown
- Open questions: Verify production active/paused state and whether final customer-visible evidence is complete.

### zap_61: ZAP B

- Trigger filters: 6 filter/path steps
- PostgreSQL queries: 10 SQL/query steps
- PostgreSQL tables touched: gift_claims; users1; SET; trees1
- PostgreSQL fields updated/mapped: query; inputs; token; recipient_name; recipient_email; deliver_on; sku; gift_claim_token; personal_message; certificate_type; nickname_sender; number_of_trees; pin_code; language; Assigned_Trees; bcc_address; display_name; tree_ids_csv
- Zoho Creator apps/forms touched: Zoho Creator records/forms touched; exact app/form needs verification from Zap step mappings
- Zoho Mail actions: none found
- Shopify references: no
- Chargebee references: no
- Webhook references: no
- Code by Zapier snippets summary: 8 Code by Zapier steps
- Formatter steps summary: 5 Formatter steps
- Looping steps summary: 1 Looping steps
- Branch/path logic: 3 branch/path steps
- Audit evidence found: PostgreSQL gift_claims/users1/SET/trees1
- Missing audit evidence: standardized final workflow/audit log row
- Manual follow-up required: unknown
- Open questions: Verify production active/paused state and whether final customer-visible evidence is complete.

### zap_95: Nieuw abonnes chargebee REVERTED

- Trigger filters: 7 filter/path steps
- PostgreSQL queries: 4 SQL/query steps
- PostgreSQL tables touched: users1; trees1
- PostgreSQL fields updated/mapped: inputs; subject; content; query; row_id; update__first_name; update__last_name; update__chargebee_id; update__subscription_type; update__subscription_info; lookup_value; update__user_id; update__claimed_at; update__claim_email_sent_at; email; first_name; last_name; chargebee_id; subscription_type; subscription_info; updated_at; created_at
- Zoho Creator apps/forms touched: none found
- Zoho Mail actions: {{100__alert_subject}}; Tree allocated -> {{111__tree_code}} to {{103__email}}; Tree allocated -> {{119__tree_code}} to {{103__email}}
- Shopify references: no
- Chargebee references: yes
- Webhook references: no
- Code by Zapier snippets summary: 4 Code by Zapier steps
- Formatter steps summary: 2 Formatter steps
- Looping steps summary: 0 Looping steps
- Branch/path logic: 6 branch/path steps
- Audit evidence found: Zapier history CSV; PostgreSQL users1/trees1; Zoho Mail outbound action
- Missing audit evidence: standardized final workflow/audit log row
- Manual follow-up required: yes/unknown
- Open questions: Verify production active/paused state and whether final customer-visible evidence is complete.

### zap_124: Monthly Tree Report

- Trigger filters: 0 filter/path steps
- PostgreSQL queries: 1 SQL/query steps
- PostgreSQL tables touched: trees1
- PostgreSQL fields updated/mapped: subject; content
- Zoho Creator apps/forms touched: none found
- Zoho Mail actions: Monthly trees report - {{124__date_month}} {{124__date_year}} ({{126__count}} items)
- Shopify references: no
- Chargebee references: no
- Webhook references: no
- Code by Zapier snippets summary: 2 Code by Zapier steps
- Formatter steps summary: 0 Formatter steps
- Looping steps summary: 0 Looping steps
- Branch/path logic: 0 branch/path steps
- Audit evidence found: Zapier history CSV; PostgreSQL trees1; Zoho Mail outbound action
- Missing audit evidence: standardized final workflow/audit log row
- Manual follow-up required: unknown
- Open questions: Verify production active/paused state and whether final customer-visible evidence is complete.

### zap_129: Send Forest Hero Photo Email (once per user/ p/h) - Forest Photo 2025Q4 - Eénmalige e-mail

- Trigger filters: 0 filter/path steps
- PostgreSQL queries: 2 SQL/query steps
- PostgreSQL tables touched: photos; trees1; base; users1; params; email_log; unsent
- PostgreSQL fields updated/mapped: query; subject; content
- Zoho Creator apps/forms touched: none found
- Zoho Mail actions: {{=gives['330591777']['first_name']}}, we hebben een van jouw bomen gefotografeerd 🌳💚
- Shopify references: no
- Chargebee references: no
- Webhook references: no
- Code by Zapier snippets summary: 0 Code by Zapier steps
- Formatter steps summary: 1 Formatter steps
- Looping steps summary: 1 Looping steps
- Branch/path logic: 0 branch/path steps
- Audit evidence found: Zapier history CSV; PostgreSQL email_log; PostgreSQL photos/trees1/base/users1/params/email_log/unsent; Zoho Mail outbound action
- Missing audit evidence: standardized final event status fields
- Manual follow-up required: unknown
- Open questions: Verify production active/paused state and whether final customer-visible evidence is complete.

### zap_135: (Copy) zap b multiple Eigenbomen SKU02

- Trigger filters: 1 filter/path steps
- PostgreSQL queries: 1 SQL/query steps
- PostgreSQL tables touched: trees1; users1
- PostgreSQL fields updated/mapped: query; Assigned_Trees; order_id; sku; voornaam_ontvanger; achternaam_ontvanger; email_ontvanger; aantal_bomen; language; user_id
- Zoho Creator apps/forms touched: Zoho Creator records/forms touched; exact app/form needs verification from Zap step mappings
- Zoho Mail actions: none found
- Shopify references: yes
- Chargebee references: no
- Webhook references: no
- Code by Zapier snippets summary: 1 Code by Zapier steps
- Formatter steps summary: 0 Formatter steps
- Looping steps summary: 0 Looping steps
- Branch/path logic: 0 branch/path steps
- Audit evidence found: Zapier history CSV; PostgreSQL trees1/users1
- Missing audit evidence: standardized final workflow/audit log row
- Manual follow-up required: unknown
- Open questions: Verify production active/paused state and whether final customer-visible evidence is complete.

### zap_141: Nieuw abonnes shopify handmatig - zoho form

- Trigger filters: 7 filter/path steps
- PostgreSQL queries: 4 SQL/query steps
- PostgreSQL tables touched: users1; trees1
- PostgreSQL fields updated/mapped: inputs; subject; content; query; row_id; update__first_name; update__last_name; update__subscription_type; update__subscription_info; lookup_value; update__user_id; update__claimed_at; update__claim_email_sent_at; email; first_name; last_name; subscription_type; subscription_info; updated_at; created_at
- Zoho Creator apps/forms touched: none found
- Zoho Mail actions: {{147__alert_subject}}; Tree allocated -> {{158__tree_code}} to {{150__email}}; Tree allocated -> {{167__tree_code}} to {{150__email}}
- Shopify references: yes
- Chargebee references: no
- Webhook references: no
- Code by Zapier snippets summary: 4 Code by Zapier steps
- Formatter steps summary: 3 Formatter steps
- Looping steps summary: 0 Looping steps
- Branch/path logic: 6 branch/path steps
- Audit evidence found: PostgreSQL users1/trees1; Zoho Mail outbound action
- Missing audit evidence: standardized final workflow/audit log row
- Manual follow-up required: yes/unknown
- Open questions: Verify production active/paused state and whether final customer-visible evidence is complete.

### zap_172: Webhooks by Zapier

- Trigger filters: 1 filter/path steps
- PostgreSQL queries: 0 SQL/query steps
- PostgreSQL tables touched: none found
- PostgreSQL fields updated/mapped: content
- Zoho Creator apps/forms touched: none found
- Zoho Mail actions: Your KETSO Academy upload has been approved
- Shopify references: no
- Chargebee references: no
- Webhook references: yes
- Code by Zapier snippets summary: 0 Code by Zapier steps
- Formatter steps summary: 0 Formatter steps
- Looping steps summary: 0 Looping steps
- Branch/path logic: 0 branch/path steps
- Audit evidence found: Zapier history CSV; Zoho Mail outbound action
- Missing audit evidence: standardized final workflow/audit log row
- Manual follow-up required: unknown
- Open questions: Verify production active/paused state and whether final customer-visible evidence is complete.

### zap_175: Trigger: New or Updated Contact in Zoho CRM

- Trigger filters: 1 filter/path steps
- PostgreSQL queries: 1 SQL/query steps
- PostgreSQL tables touched: process_academy_student_from_crm
- PostgreSQL fields updated/mapped: query; KETSO_student_ID; Onboarding_URL; Academy_automation_status; Academy_onboarding_status; content; Academy_onboarding_invite_status; Academy_onboarding_invite_date
- Zoho Creator apps/forms touched: none found
- Zoho Mail actions: Complete your KETSO Academy onboarding
- Shopify references: no
- Chargebee references: no
- Webhook references: no
- Code by Zapier snippets summary: 0 Code by Zapier steps
- Formatter steps summary: 0 Formatter steps
- Looping steps summary: 0 Looping steps
- Branch/path logic: 0 branch/path steps
- Audit evidence found: Zapier history CSV; PostgreSQL process_academy_student_from_crm; Zoho Mail outbound action
- Missing audit evidence: standardized final workflow/audit log row
- Manual follow-up required: unknown
- Open questions: Verify production active/paused state and whether final customer-visible evidence is complete.
