# Shopify dashboard signal candidates

| event_name | source | green_condition | orange_condition | red_condition | required_evidence |
| --- | --- | --- | --- | --- | --- |
| shopify_gift_tree_purchase | Shopify SKU 01 Zapier trigger | claim link sent and gift_claims record exists | order exists but claim/outbox evidence missing | Zap error or no available trees | Zapier success, gift_claims row, Zoho Mail claim link |
| shopify_owned_tree_purchase | Shopify SKU 02 Zapier trigger | tree allocated and certificate/outbox evidence exists | allocation or outbound proof missing | Zap error or allocation failed | Zapier success, trees1 update, Zoho Creator/certificate evidence |
| shopify_recurring_donation | Zoho Manual Follow-up sample emails SKU 5 | thank-you/subscription evidence matched | email exists with no verified workflow | overdue follow-up | outbox thank-you or registry record |
