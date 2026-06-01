# Chargebee dashboard signal candidates

| event_name | source | green_condition | orange_condition | red_condition | required_evidence | suggested_card |
| --- | --- | --- | --- | --- | --- | --- |
| subscription_created | Chargebee subscriptions + Zapier payment_succeeded | known plan, user recorded, tree allocation and outbound evidence found | subscription/invoice exists but workflow evidence missing | Zapier error or payment due/manual follow-up overdue | Chargebee subscription, Zapier history success, PostgreSQL allocation, Zoho Mail outbound evidence | Subscriptions |
| first_invoice_generated | Chargebee invoices + New Revenue Alert email | first invoice matched to workflow and follow-up evidence | first invoice alert without mapped workflow evidence | payment due or failed workflow remains unresolved | invoice number, customer email, plan_id, allocation/outbox evidence | Chargebee first invoices |
