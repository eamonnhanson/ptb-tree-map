# Zoho Mail outbox evidence rules

| subject_pattern | body_pattern | extracted_fields | proves | does_not_prove | may_close_event | resolution_rule |
| --- | --- | --- | --- | --- | --- | --- |
| Tree allocated -> * | Tree code; Type; Location; Tree ID; User ID; Transaction/Invoice | tree_code, tree_type, lat, long, tree_id, user_id, transaction_id, invoice_id, recipient_email | tree_allocated_email_seen | customer thank-you or certificate sent | purchase/subscription requiring tree allocation | close only when matched to related purchase/invoice/customer |
| Complete your KETSO Academy onboarding | personal onboarding link/token | customer/student name, onboarding_url, token | onboarding_email_sent | onboarding completed or approved | academy onboarding invitation required | close invite-sent requirement, keep upload/approval open |
| Bedankt voor jouw boomabonnement | Boomcode and Certificate.pdf attachment | recipient_name, tree_code, attachment filename | subscription_thank_you_sent; certificate_email_seen | PostgreSQL allocation unless matched | subscription thank-you/certificate follow-up | close outbound email requirement only when customer/tree match is found |
