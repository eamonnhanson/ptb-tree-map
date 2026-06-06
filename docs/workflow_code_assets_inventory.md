# Workflow code assets inventory

Inventory date: 2026-06-06

| file_path | purpose | related_workflows | environment_variables | status | notes |
| --- | --- | --- | --- | --- | --- |
| `netlify/functions/monitoring-summary.js` | Live dashboard summary API reading monitoring counts | netlify_monitoring_summary | `MONITORING_DATABASE_URL` | implemented | Read-only dashboard function with test database guard in code. |
| `netlify/functions/monitoring-events.js` | Live dashboard events API reading `monitoring.automation_events` | netlify_monitoring_events | `MONITORING_DATABASE_URL` | implemented | Used by automation dashboard for event data. |
| `netlify/functions/monitoring-outbound-messages.js` | Live dashboard outbound messages API reading `monitoring.outbound_messages` | netlify_monitoring_outbound | `MONITORING_DATABASE_URL` | implemented | Used for outbound email evidence display. |
| `netlify/functions/monitoring-registry.js` | Live dashboard registry API reading `monitoring.automation_registry` | netlify_monitoring_registry | `MONITORING_DATABASE_URL` | implemented | Current registry source for dashboard; maintenance registry remains documentation. |
| `netlify/edge-functions/protect-automation-dashboard.js` | Basic Auth protection for automation dashboard | dashboard access control | `DASHBOARD_BASIC_AUTH_USER`; `DASHBOARD_BASIC_AUTH_PASSWORD` | implemented | Protects `/automation-dashboard/` per dashboard security docs. |
| `frontend/automation-dashboard/index.html` | Automation dashboard page shell | dashboard; future Workflow maintenance button | none directly | implemented | No frontend change made for this inventory. |
| `frontend/automation-dashboard/app.js` | Dashboard client logic fetching Netlify monitoring endpoints | dashboard; monitoring summary/events/outbound/registry | none directly | implemented | Candidate future place for Workflow maintenance tab/button, but not changed. |
| `frontend/automation-dashboard/styles.css` | Dashboard styling | dashboard | none | implemented | No frontend change made. |
| `frontend/automation-dashboard/student-uploads.json` | Static sample/dashboard data | academy upload dashboard examples | none | sample_or_legacy | Mentioned in SQL test data as dashboard validation file. |
| `api/db.js` | PostgreSQL pool helper with `DATABASE_URL` and `DB_SCHEMA` | Render API / dashboard endpoints | `DATABASE_URL`; `NODE_ENV`; `DB_SCHEMA` | implemented | Main backend DB helper. |
| `api/trees.js` | Tree lookup endpoint using separate PostgreSQL client | Render tree lookup | `PG_URL` | implemented | Uses separate connection from `api/db.js`; role separation should be reviewed. |
| `api/forestHeroes.js` | Forest hero feed endpoint | forest hero map/gallery | database env via `api/db.js` | implemented | Reads `public.trees1` and `public.users1`. |
| `api/forestHeroSearch.js` | Forest hero search endpoint for staff linking | staff upload / forest hero lookup | database env via `api/db.js` | implemented | Reads users and trees. |
| `api/savePhotoReview.js` | Saves upload metadata and AI description into review table | KETSO uploads; staff uploads; academy onboarding | database env via `api/db.js`; `OPENAI_API_KEY` through helper | implemented | Write path for `photo_uploads_review`. |
| `api/getPhotoReviewGallery.js` | Reads photo review/gallery records | gallery; staff/public/admin views | database env via `api/db.js` | implemented | Inventory notes say `upload_context` query filtering may be missing. |
| `api/getStudentGallery.js` | Reads student gallery records and rewards | student gallery | database env via `api/db.js` | implemented | Reads `photo_uploads_review` and `academy_student_rewards`. |
| `api/generateImageDescription.js` | OpenAI image description helper | upload review metadata | `OPENAI_API_KEY` | implemented | AI failures are downgraded to fallback status. |
| `api/treeByAd.js` | Placeholder tree-by-id endpoint | tree map API | none | stub | Returns placeholder data according to existing inventory. |
| `api/treesByCodes.js` | Placeholder trees-by-codes endpoint | tree map API | none | stub | Returns placeholder rows according to existing inventory. |
| `server.js` | Express server route registration and moderation/webhook logic | Render API / dashboard endpoints; approval webhook to Zapier | `PORT`; `DATABASE_URL`; `DB_SCHEMA`; `ADMIN_GALLERY_KEY`; `ZAPIER_APPROVAL_WEBHOOK_URL`; `OPENAI_API_KEY` | implemented | Not listed by `rg --files api/frontend/netlify` scan but referenced in existing inventory. |
| `frontend/app.js` | Public tree map / Forest Heroes frontend logic | tree map; forest hero display | none directly | implemented | Reads Render API endpoints from browser. |
| `frontend/index.html` | Public map page | tree map | none | implemented | Static frontend asset. |
| `frontend/styles.css` | Public map styling | tree map | none | implemented | Static frontend asset. |
| `docs/sql/001_monitoring_datamodel.sql` | Defines `monitoring.automation_events`, `monitoring.outbound_messages`, and `monitoring.automation_registry` | monitoring datamodel | none | plan_or_migration_file | Not executed as part of this inventory. |
| `docs/sql/002_monitoring_registry_seed.sql` | Concept seed plan for `monitoring.automation_registry` | monitoring registry seed | none | plan_only | Contains no active INSERT statements. |
| `docs/sql/003_monitoring_real_events_seed.sql` | Real events seed/reference SQL | monitoring events | none | existing_sql_asset | Not executed as part of this inventory. |
| `docs/sql/004_monitoring_zap172_heartbeat_template.sql` | Zap 172 heartbeat insert template | zap_172 heartbeat | Zapier-mapped placeholders; database connection selected in Zapier | template_only | Intended only for guarded `ptb_monitoring_test` use. |
| `docs/master_workflow_registry.csv` | Broad workflow/source registry | all workflow maintenance seed candidates | none | source_doc | 32 records across Zapier, Shopify, Chargebee, Zoho Mail signals. |
| `docs/master_workflow_registry.md` | Human-readable version of master registry | all workflow maintenance seed candidates | none | source_doc | Mirrors CSV in review-friendly format. |
| `docs/zapier_workflow_registry.csv` | Detailed Zapier workflow registry | 12 Zapier workflows | none | source_doc | Includes actions, tables, fields, history counts, risks. |
| `docs/zapier_workflow_inventory.md` | Human-readable Zapier inventory | 12 Zapier workflows | none | source_doc | Useful for dependency review and runbooks. |
| `docs/workflow_source_inventory.md` | Source export inventory | inventory governance | none | source_doc | Tracks reliability and open questions for source files. |
| `docs/automation_inventory.md` | Internal monitoring dashboard automation inventory | Render/API/KETSO/upload monitoring | none | source_doc | Notes missing Shopify/Chargebee/certificate/email writer code in inspected repo. |
| `docs/monitoring_registry_seed_plan.md` | Plan for loading registry data safely | monitoring registry | none | source_doc | Explicitly says no production DB change. |
| `docs/monitoring_zap172_heartbeat_plan.md` | Plan for Zap 172 heartbeat event | zap_172 heartbeat | none | source_doc | Documents separate `ptb_monitoring_test` connection. |
| `docs/shopify_product_workflow_map.md` | Shopify catalog to workflow expectations | Shopify product signals | none | source_doc | Order export still needed for full audit. |
| `docs/chargebee_subscription_map.md` | Chargebee subscription records | Chargebee subscription signals | none | source_doc | Contains subscription-level evidence but not downstream allocation proof. |
| `docs/zoho_mail_source_inventory.md` | Zoho Mail evidence source inventory | Zoho Mail evidence signals | none | source_doc | Live folder/API state still needs verification. |
| `docs/workflow_maintenance_inventory.md` | Maintenance-layer overview and governance rule | workflow maintenance | none | new_doc | Created in this task. |
| `docs/workflow_maintenance_registry.csv` | First maintenance registry | workflow maintenance | none | new_doc | Created in this task; no database load performed. |
| `docs/workflow_dependency_map.md` | Trigger/action/output dependency map | workflow maintenance | none | new_doc | Created in this task. |
| `docs/workflow_connections_inventory.md` | Connections and DB users inventory without secrets | workflow maintenance | none | new_doc | Created in this task. |
| `docs/workflow_code_assets_inventory.md` | Code/document asset inventory | workflow maintenance | none | new_doc | Created in this task. |

## Assets Not Found In This Repo

- Shopify webhook/app configuration.
- Chargebee webhook/app configuration.
- Zoho Flow export.
- Zoho Creator app automation export.
- Zoho Writer merge templates.
- Live Zoho Mail folder/API export.
- Aiven privilege export for `avnadmin`, `web_ro`, `web_rw`, and `zapier_user`.
