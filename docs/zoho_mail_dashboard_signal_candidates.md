# Zoho Mail dashboard signal candidates

| event_name | source | green_condition | orange_condition | red_condition | suggested_card |
| --- | --- | --- | --- | --- | --- |
| manual_followup_required | Manual Follow-up folder/email export | matched evidence and marked resolved | new/unmatched email | overdue or failed automation | Manual follow-up |
| outbound_email_sent | Outbox Monitor | matched to expected workflow | outbox evidence exists without matching source event | expected outbox evidence missing | Outbound email |
| unknown_email_signal | Any in-scope Zoho Mail folder | classified and mapped | unclassified but no failure indicator | indicates failure or missing action | Email review |
