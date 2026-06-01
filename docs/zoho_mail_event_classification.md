# Zoho Mail event classification

| event_type | source_folder | default_status | notes |
| --- | --- | --- | --- |
| purchase_received | Manual Follow-up | orange | needs_verification until matched to source workflow/customer |
| shopify_purchase_received | Manual Follow-up | orange | needs_verification until matched to source workflow/customer |
| shopify_subscription_received | Manual Follow-up | orange | needs_verification until matched to source workflow/customer |
| chargebee_new_revenue_alert | Manual Follow-up | green if matched | needs_verification until matched to source workflow/customer |
| manual_followup_required | Manual Follow-up | orange | needs_verification until matched to source workflow/customer |
| outbound_email_sent | Outbox Monitor | green if matched | needs_verification until matched to source workflow/customer |
| tree_allocated_email_seen | Outbox Monitor | green if matched | needs_verification until matched to source workflow/customer |
| onboarding_email_sent | Outbox Monitor | green if matched | needs_verification until matched to source workflow/customer |
| subscription_thank_you_sent | Outbox Monitor | green if matched | needs_verification until matched to source workflow/customer |
| certificate_email_seen | Outbox Monitor | green if matched | needs_verification until matched to source workflow/customer |
| unknown_email_signal | Manual Follow-up | green if matched | needs_verification until matched to source workflow/customer |
