# Workflow logging standard

Recommended event fields:

| field | description |
| --- | --- |
| event_time | Required for dashboard correlation and audit filtering |
| workflow_id | Required for dashboard correlation and audit filtering |
| event_type | Required for dashboard correlation and audit filtering |
| source_system | Required for dashboard correlation and audit filtering |
| source_record_id | Required for dashboard correlation and audit filtering |
| customer_email | Required for dashboard correlation and audit filtering |
| product_id | Required for dashboard correlation and audit filtering |
| sku | Required for dashboard correlation and audit filtering |
| plan_id | Required for dashboard correlation and audit filtering |
| invoice_id | Required for dashboard correlation and audit filtering |
| order_id | Required for dashboard correlation and audit filtering |
| expected_result | Required for dashboard correlation and audit filtering |
| actual_result | Required for dashboard correlation and audit filtering |
| status | Required for dashboard correlation and audit filtering |
| severity | Required for dashboard correlation and audit filtering |
| manual_followup_required | Required for dashboard correlation and audit filtering |
| evidence_url | Required for dashboard correlation and audit filtering |
| error_message | Required for dashboard correlation and audit filtering |

Recommended event types:

| event_type |
| --- |
| purchase_received |
| subscription_created |
| first_invoice_generated |
| tree_allocation_started |
| tree_allocated |
| certificate_generation_started |
| certificate_generated |
| outbound_email_sent |
| outbound_email_failed |
| onboarding_email_sent |
| manual_followup_created |
| manual_followup_completed |
| workflow_failed |
| workflow_retried |
