# Shopify manual follow-up rules

| subject_pattern | body_pattern | extracted_fields | expected_followup | green_condition | orange_condition | red_condition | related_product_workflow |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [planteenboom.nu] Bestellen | SKU: 5 plus recurring text such as Deliver every month or Elke maand bezorgen | order_id, customer_name, product_name, sku, amount, currency, recurring text | Verify thank-you email and whether donor/subscription was recorded. | purchase email matched with required outbox/registry evidence | purchase email exists but follow-up evidence missing | follow-up failed or remains open past SLA | Shopify monthly donation SKU 5; needs_verification; unmapped_product |
