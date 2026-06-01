# Zoho Mail manual follow-up rules

| subject_pattern | body_pattern | extracted_fields | expected_followup | green_condition | orange_condition | red_condition | related_product_workflow | remain_open_until_outbox_evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [planteenboom.nu] Bestellen | SKU: 5; recurring delivery text | order_id, customer_name, product_name, sku, amount, currency, recurring=yes | verify thank-you email and registry/subscription handling | matched to outbox evidence or verified registry action | purchase email exists without evidence | open past SLA or failed follow-up | Shopify monthly donation SKU 5; needs_verification; unmapped_product | yes |
| New Revenue Alert | First invoice generated; Plan/Add-on; Invoice number | invoice_id, customer_name, customer_email, plan_id, amount, currency | verify Chargebee plan workflow, tree allocation, welcome/thank-you email | invoice matched to known workflow and evidence | invoice alert exists but workflow evidence missing | processing failed or payment/manual action overdue | Chargebee first invoice generated | yes |
