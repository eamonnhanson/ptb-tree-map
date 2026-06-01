# Chargebee source inventory

| path | rows | contains | does_not_contain | reliability |
| --- | --- | --- | --- | --- |
| docs/sources/chargebee/chargebee-items-2026-05-31.csv | 25 | Chargebee item catalog: plans/addons/charges/status/family | item price export or workflow execution evidence | high for catalog |
| docs/sources/chargebee/chargebee-subscriptions-2026-05-31.csv | 35 | subscriptions, customer fields, plan_id, next billing | tree allocation or outbound email proof | high for subscription state |
| docs/sources/chargebee/chargebee-invoices-2026-05-31.csv | 104 | invoice status, amounts, first invoice flag, customer data | workflow completion/audit trail | high for invoice state |

Invoice status counts: Payment Due: 9, Paid: 95.
