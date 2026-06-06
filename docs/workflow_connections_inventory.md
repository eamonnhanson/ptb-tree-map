# Workflow connections inventory

Inventory date: 2026-06-06

No passwords, tokens, API keys, or full connection strings belong in this file.

| system | connection_name | username | role | rights | used_by | secret_location | review_status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PostgreSQL / Aiven | Aiven admin connection | avnadmin | database admin | admin; exact rights not listed in repo | manual database administration; initial setup only | Aiven console / local admin secret store | needs_manual_review |
| PostgreSQL / Aiven | Render read-only or dashboard read connection | web_ro | application read-only | expected SELECT on public/monitoring tables; exact grants need confirmation | Render read APIs if configured; Netlify monitoring functions if `MONITORING_DATABASE_URL` uses this user | Render or Netlify environment variables | needs_manual_review |
| PostgreSQL / Aiven | Render read-write application connection | web_rw | application read-write | expected SELECT/INSERT/UPDATE on operational tables; exact grants need confirmation | Render photo review and academy moderation write endpoints | Render environment variable `DATABASE_URL` or equivalent | needs_manual_review |
| PostgreSQL / Aiven | Zapier production database connection | zapier_user | automation read-write | expected SELECT/INSERT/UPDATE for Zapier allocation workflows; exact grants need confirmation | zap_1; zap_15; zap_29; zap_47; zap_61; zap_95; zap_124; zap_129; zap_135; zap_141; zap_175 | Zapier PostgreSQL app connection | needs_manual_review |
| Netlify | MONITORING_DATABASE_URL | unknown, should be web_ro | serverless database connection | should be read-only for dashboard functions; test functions guard against wrong DB name | monitoring-summary; monitoring-events; monitoring-outbound-messages; monitoring-registry | Netlify environment variable `MONITORING_DATABASE_URL` | needs_manual_review |
| Zapier | Zapier defaultdb connection | zapier_user | production automation connection | read/write against production `defaultdb`; exact grants unknown | production Zapier workflows except heartbeat test connection | Zapier connected account for PostgreSQL | needs_manual_review |
| Zapier | Zapier ptb_monitoring_test connection | zapier_user or dedicated monitoring user | test monitoring writer | insert heartbeat into `ptb_monitoring_test.monitoring.automation_events` only when guarded | zap_172 heartbeat pilot | Zapier connected account for PostgreSQL pointing to `ptb_monitoring_test` | partially_reviewed |
| Render | DATABASE_URL | unknown, likely web_rw | application database connection | read/write for backend APIs; exact grants unknown | server.js; api/db.js; savePhotoReview; moderation endpoints | Render environment variables | needs_manual_review |
| Render | PG_URL | unknown, should be web_ro | tree lookup database connection | read-only tree lookup expected | api/trees.js | Render environment variable `PG_URL` | needs_manual_review |
| Render | ZAPIER_APPROVAL_WEBHOOK_URL | n/a | outbound webhook secret URL | POST approval payload to Zapier after public academy upload approval | server.js notifyApproval | Render environment variable | needs_manual_review |
| Render | OPENAI_API_KEY | n/a | AI API key | image description generation only | api/generateImageDescription.js | Render environment variable | needs_manual_review |
| Netlify | DASHBOARD_BASIC_AUTH_USER / DASHBOARD_BASIC_AUTH_PASSWORD | n/a | dashboard access credential | Basic Auth for `/automation-dashboard/` | netlify/edge-functions/protect-automation-dashboard.js | Netlify environment variables | needs_manual_review |
| Shopify | Shopify admin / Zapier Shopify connection | unknown | ecommerce source connection | read paid orders and product data; exact scopes unknown | zap_29; zap_47; zap_135; Shopify catalog signals | Shopify admin / Zapier connected app | needs_manual_review |
| Chargebee | Chargebee Zapier connection | unknown | subscription source connection | read payment/subscription/invoice events; exact scopes unknown | zap_95; Chargebee subscription flow | Zapier connected Chargebee account | needs_manual_review |
| Zoho CRM | Zoho CRM Zapier connection | unknown | CRM automation connection | read/update contacts and Academy onboarding fields | zap_175 | Zapier connected Zoho CRM account | needs_manual_review |
| Zoho Forms | Zoho Forms Zapier connection | unknown | form trigger connection | read submitted forms | zap_1; zap_15; zap_61; zap_141 | Zapier connected Zoho Forms account | needs_manual_review |
| Zoho Creator | Zoho Creator Zapier connection | unknown | app record creation connection | create records; exact app/forms unknown | zap_1; zap_15; zap_29; zap_47; zap_61; zap_135 | Zapier connected Zoho Creator account | needs_manual_review |
| Zoho Writer | Zoho Writer merge connection | unknown | document merge connection | expected merge/generate certificates; exact rights unknown | Zoho Creator to Zoho Writer certificate merge | Zoho Writer / Zoho Creator integration settings | missing_source |
| Zoho Mail | Zoho Mail Zapier/API connection | unknown | outbound email connection | send mail and/or read outbox evidence; exact scopes unknown | zap_47; zap_95; zap_124; zap_129; zap_141; zap_172; zap_175; Zoho Mail evidence workflows | Zapier connected Zoho Mail account / future Zoho Mail API secret | needs_manual_review |
| Zoho Flow | Zoho Flow app connections | unknown | native Zoho automation connections | unknown until export | possible Shopify/Chargebee/Zoho native workflows | Zoho Flow connection settings | missing_source |
| Cloudflare Pages / R2 | KETSO_BUCKET | n/a | object storage binding | read/write uploaded media objects | KETSO uploader upload/list functions | Cloudflare Pages binding | out_of_repo_context |
| Cloudflare Pages | ACADEMY_STUDENT_SEARCH_API_URL / ACADEMY_STUDENT_SEARCH_TOKEN | n/a | backend proxy config | call backend academy student search with optional token | KETSO uploader academy-student-search function | Cloudflare Pages environment variables | out_of_repo_context |

## Review Notes

- `avnadmin` should be reserved for administration, not day-to-day automations.
- `web_ro` should be preferred for dashboard reads.
- `web_rw` should be limited to application write paths that need it.
- `zapier_user` should be reviewed per workflow because many Zaps read and write production tables.
- `MONITORING_DATABASE_URL` should be checked to ensure dashboard functions cannot write unless a specific future write endpoint is deliberately created.
- The Zapier `ptb_monitoring_test` connection is intentionally separate from the `defaultdb` connection for the heartbeat pilot.
