# Email monitoring integration options

No email integration is implemented in this phase.

| option | pros | cons | security_concerns | reliability | effort | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| Zoho Mail API | native metadata, folder access, stable IDs | OAuth/app setup and API limits | least-privilege OAuth scopes; token storage | high | medium | best long-term choice |
| IMAP read-only access | standard protocol, easy MVP polling | weaker folder/filter metadata and provider quirks | read-only mailbox credential handling | medium | low/medium | good technical MVP if API setup is slow |
| manual export/import for MVP | fastest, no live credentials | manual, stale data, no real-time dashboard | export files may contain personal data | low/medium | low | recommended MVP choice for first dashboard prototype |
| forward selected emails to a webhook | near real time and simple event ingestion | depends on forwarding filters; can miss historical data | webhook authentication and PII in transit | medium/high after setup | medium | good after logging schema exists |
| Zapier Email Parser or mailbox trigger | fits current Zapier stack | adds more Zapier dependency and parser maintenance | third-party mailbox copy and parser access | medium | medium | use selectively, not as canonical audit store |

Recommended MVP: manual export/import first, using the logging standard and classifier rules above. Move to Zoho Mail API once the dashboard data model is stable.
