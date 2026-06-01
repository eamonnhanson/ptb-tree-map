# Workflow source inventory

| path | source_type | system | date_export | contains | does_not_contain | reliability | open_questions | in_scope |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| docs/sources/zapier/exported-zap-2026-05-31T10_27_41.118Z.json | JSON export | Zapier | 2026-05-31T10:27:41.118Z | workflow structure for 12 Zaps | guaranteed current production enabled state | high for exported structure | Confirm active/paused production state in Zapier UI | yes |
| docs/sources/zapier/history/zapier-history-combined-2026-03-01-to-2026-05-31.csv | CSV history | Zapier | 2026-03-01 to 2026-05-31 | 2599 task history rows | full business outcome without downstream logs | high for task status | Map object_title to Zap IDs where titles changed | yes |
| docs/sources/chargebee/chargebee-items-2026-05-31.csv | CSV | Chargebee | 2026-05-31 | 25 items | item prices export | high | Export item prices for exact plan mapping | yes |
| docs/sources/chargebee/chargebee-subscriptions-2026-05-31.csv | CSV | Chargebee | 2026-05-31 | 35 subscriptions | allocation/outbox evidence | high | Confirm canceled/inactive handling | yes |
| docs/sources/chargebee/chargebee-invoices-2026-05-31.csv | CSV | Chargebee | 2026-05-31 | 104 invoices | workflow completion evidence | high | Confirm first invoice alert coverage | yes |
| docs/sources/shopify/products_export.csv | CSV | Shopify | unknown/2026-05-31 upload | 8 product rows | orders or purchase history | high for catalog | Export Shopify orders/subscriptions for full audit | yes |
| docs/sources/zoho-mail/manual-follow-up | folder | Zoho Mail | 2026-05-31 sample/requirements | missing exact requested path | live mailbox state | low | Resolve duplicate/leading-space folder structure; confirm exact live folder names | in scope but unavailable at exact path |
| docs/sources/zoho-mail/outbox-monitor | folder | Zoho Mail | 2026-05-31 sample/requirements | missing exact requested path | live mailbox state | low | Resolve duplicate/leading-space folder structure; confirm exact live folder names | in scope but unavailable at exact path |
| docs/sources/zoho-mail/ sample-emails/manual-follow-up | folder | Zoho Mail | 2026-05-31 sample/requirements | present; leading-space folder name | live mailbox state | medium | Resolve duplicate/leading-space folder structure; confirm exact live folder names | used as manual follow-up evidence |
| docs/sources/zoho-mail/sample-emails/outbox-monitor | folder | Zoho Mail | 2026-05-31 sample/requirements | present | live mailbox state | medium | Resolve duplicate/leading-space folder structure; confirm exact live folder names | used as outbox evidence |
| docs/sources/zoho-mail/zoho-mail-monitoring-requirements.md | requirements | Zoho Mail | 2026-05-31 sample/requirements | present | live mailbox state | medium | Resolve duplicate/leading-space folder structure; confirm exact live folder names | used |
