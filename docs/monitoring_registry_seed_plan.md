# Monitoring registry seed plan

Datum: 2026-06-04

Doel: een veilige eerste aanpak om echte workflow registry data in `monitoring.automation_registry` te krijgen, zonder productie te breken.

Belangrijk: dit plan wijzigt geen productie database, voert geen SQL uit en bevat geen secrets. De eerste laadstap hoort alleen gericht op `ptb_monitoring_test`.

## Gevonden bronbestanden

| Bestand | Type | Omvang | Bruikbaarheid |
| --- | --- | ---: | --- |
| `docs/master_workflow_registry.csv` | CSV registry | 32 records | Beste voorkeursbron: breedste dekking over Zapier, Shopify productcatalogus, Chargebee plannen en Zoho Mail signalen. |
| `docs/master_workflow_registry.md` | Markdown registry | 32 records | Leesbare versie van dezelfde master registry; handig voor review, minder geschikt voor automatisch laden. |
| `docs/zapier_workflow_registry.csv` | CSV registry | 12 records | Beste verrijkingsbron voor de Zapier workflows; bevat detail over acties, tabellen, velden, history en risico. |
| `docs/zapier_workflow_inventory.md` | Markdown inventory | 12 workflows | Leesbare Zapier-inventaris met detailnotities per Zap. |
| `docs/workflow_source_inventory.md` | Markdown inventory | 11 bronregels | Legt betrouwbaarheid en scope van bronexports vast; bruikbaar voor risico-inschatting. |
| `docs/automation_inventory.md` | Markdown inventory | n.v.t. | Geeft bredere monitoringcontext en voorgestelde eventgerichte registry entries. |
| `docs/monitoring_datamodel.md` | Markdown schema-uitleg | n.v.t. | Beschrijft het doel en de velden van `monitoring.automation_registry`. |
| `docs/sql/001_monitoring_datamodel.sql` | SQL datamodel | n.v.t. | Exacte tabelkolommen voor de mapping. |

Aanvullende relevante contextbestanden onder `docs/`:

- `docs/workflow_audit_gap_report.md`
- `docs/dashboard_mvp_gap_analysis.md`
- `docs/dashboard_signal_candidates.md`
- `docs/zapier_audit_gap_report.md`
- `docs/zapier_dashboard_signal_candidates.md`
- `docs/shopify_product_workflow_map.md`
- `docs/chargebee_source_inventory.md`
- `docs/zoho_mail_source_inventory.md`

## Voorkeursbron

Voorkeursbron voor de eerste seed: `docs/master_workflow_registry.csv`.

Redenen:

- Het bestand bevat 32 records en dekt meer dan alleen Zapier.
- De kolommen sluiten goed aan op het huidige dashboard en de tabel `monitoring.automation_registry`.
- Het bestand bevat al functionele categorieen, systemen, verwacht resultaat, bewijsbron, status en open vragen.
- De records zijn geschikt om als registry-metadata te dienen, terwijl runtime events in `monitoring.automation_events` en `monitoring.outbound_messages` blijven.

Verrijkingsbron: `docs/zapier_workflow_registry.csv`.

Gebruik deze voor de eerste 12 `zap_*` records om `tables_touched`, `fields_touched` en detailnotities scherper te maken. Niet gebruiken als enige bron, omdat Shopify/Chargebee/Zoho Mail registry-kandidaten dan ontbreken.

## Bruikbare kolommen

### `docs/master_workflow_registry.csv`

Bruikbare kolommen:

- `workflow_id`
- `workflow_name`
- `business_category`
- `trigger_system`
- `trigger_event`
- `flow_tool`
- `flow_name`
- `systems_used`
- `expected_result`
- `audit_location`
- `evidence_source`
- `failure_risk`
- `dashboard_status_rule`
- `status`
- `open_questions`
- `notes`

Ook bruikbaar voor notities, maar niet rechtstreeks nodig voor het minimale schema:

- `source_product_system`
- `source_product_id`
- `source_product_name`
- `source_sku`
- `source_plan_id`
- `source_price_or_plan`
- `customer_email_source`
- `tree_allocation_expected`
- `certificate_expected`
- `outbound_email_expected`
- `manual_followup_required`
- `audit_available`
- `dashboard_card`

### `docs/zapier_workflow_registry.csv`

Bruikbare verrijkingskolommen:

- `workflow_id`
- `zap_id`
- `trigger_app`
- `trigger_event`
- `actions`
- `action_apps`
- `postgresql_tables`
- `postgresql_fields_updated`
- `expected_business_result`
- `likely_dashboard_category`
- `audit_evidence_found`
- `missing_audit_evidence`
- `history_success`
- `history_filtered`
- `history_halted`
- `history_error`
- `manual_followup_required`
- `risk_level`
- `open_questions`
- `status`

## Mapping naar `monitoring.automation_registry`

Doeltabel volgens `docs/sql/001_monitoring_datamodel.sql`:

- `flow_name text not null`
- `category text not null`
- `status text not null default 'active'`
- `trigger_description text`
- `systems_used text[]`
- `tables_touched text[]`
- `fields_touched jsonb default '{}'::jsonb`
- `github_repo text`
- `github_files text[]`
- `technical_summary text`
- `notes text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Voorgestelde mapping:

| Doelkolom | Bron | Mapping |
| --- | --- | --- |
| `flow_name` | `master.flow_name`, fallback `master.workflow_name` | Naam van workflow of registry-signaal. |
| `category` | `master.business_category` | Dashboardcategorie. |
| `status` | `master.status` | Voor seed voorlopig bronstatus behouden, zoals `partially_audited`, `not_audited`, `unknown`, `manual_followup_required`. |
| `trigger_description` | `master.trigger_system`, `master.trigger_event` | Bijvoorbeeld `Shopify: new_paid_order_v3`. |
| `systems_used` | `master.systems_used` | Split op `;`, trim waarden, opslaan als `text[]`. |
| `tables_touched` | `zapier.postgresql_tables` waar `workflow_id` matcht | Split op `;`, trim waarden. Voor niet-Zapier records leeg laten of vullen uit notities alleen na review. |
| `fields_touched` | `zapier.postgresql_fields_updated` en history counters | JSONB, bijvoorbeeld `{ "postgresql_fields_updated": [...], "history": { ... } }`. Voor niet-Zapier records `{}`. |
| `github_repo` | vaste repo-context | `ptb-tree-map` als herkomst van deze documentatie, niet als live code-eigenaar. |
| `github_files` | bronbestanden | Array met bijvoorbeeld `docs/master_workflow_registry.csv` en optioneel `docs/zapier_workflow_registry.csv`. |
| `technical_summary` | `master.expected_result` plus `master.evidence_source` | Korte samenvatting van verwacht resultaat en bewijsbron. |
| `notes` | `master.open_questions`, `master.notes`, `master.failure_risk`, `master.dashboard_status_rule` | Auditnotities en resterende verificatiepunten. |

Er is geen `owner`-kolom in `monitoring.automation_registry`; daarom niet mappen of verzinnen.

## Kandidaatrecords voor eerste seed

Eerste veilige seed-kandidaten: de 12 Zapier workflows die in zowel master als Zapier registry voorkomen.

| workflow_id | flow_name | category | systemen |
| --- | --- | --- | --- |
| `zap_1` | `IMCD_NL_TreeCert_Postgres` | `certificate/tree allocation` | ZohoForms; PostgreSQL; BranchingAPI; ZohoCreator |
| `zap_15` | `IMCD_BEL_TreeCert_Postgres` | `certificate/tree allocation` | ZohoForms; PostgreSQL; BranchingAPI; ZohoCreator |
| `zap_29` | `zap a multipleEigenbomenShopifyToPostgreSQL (SKU 02)` | `shopify/tree purchase` | Shopify; FilterAPI; PostgreSQL; Code; ZapierLooping; BranchingAPI; ZohoCreator |
| `zap_47` | `zap a- Shopify -> Tokenized Gift Tree Link (SKU 01)` | `shopify/tree purchase` | Shopify; FilterAPI; Code; PostgreSQL; ZapierFormatter; ZohoCreator; ZohoMail |
| `zap_61` | `ZAP B` | `other` | ZohoForms; PostgreSQL; FilterAPI; Code; ZapierLooping; ZapierFormatter; BranchingAPI; ZohoCreator |
| `zap_95` | `Nieuw abonnes chargebee REVERTED` | `subscription` | Chargebee; ZapierFormatter; BranchingAPI; Code; ZohoMail; PostgreSQL; FilterAPI |
| `zap_124` | `Monthly Tree Report` | `reporting` | Schedule; PostgreSQL; Code; ZohoMail |
| `zap_129` | `Send Forest Hero Photo Email (once per user/ p/h) - Forest Photo 2025Q4 - Eenmalige e-mail` | `outbound photo email` | Schedule; PostgreSQL; ZapierFormatter; ZapierLooping; ZohoMail |
| `zap_135` | `(Copy) zap b multiple Eigenbomen SKU02` | `shopify/tree purchase` | Shopify; FilterAPI; Delay; PostgreSQL; Code; ZohoCreator |
| `zap_141` | `Nieuw abonnes shopify handmatig - zoho form` | `shopify/tree purchase` | ZohoForms; ZapierFormatter; BranchingAPI; Code; ZohoMail; PostgreSQL; FilterAPI |
| `zap_172` | `Webhooks by Zapier` | `other` | WebHook; FilterAPI; ZohoMail |
| `zap_175` | `Trigger: New or Updated Contact in Zoho CRM` | `academy/onboarding` | ZohoCRM; FilterAPI; PostgreSQL; ZohoMail |

Daarna kan een tweede seedbatch de overige master records toevoegen:

- Shopify product catalog: 8 records.
- Chargebee subscription records: 8 records.
- Zoho Mail email evidence records: 5 records.

Deze tweede batch is nuttig voor dashboarddekking, maar minder geschikt als eerste seed omdat sommige records expliciet `unknown` of `none verified` bevatten.

## Risico's

- Productiestatus is niet gegarandeerd. De Zapier export beschrijft structuur en history, maar niet noodzakelijk de actuele active/paused staat in Zapier op laaddatum.
- `workflow_id` bestaat niet als kolom in `monitoring.automation_registry`. Zonder schemawijziging moet die in `notes`, `technical_summary` of `fields_touched` worden opgenomen.
- `status` in de master registry gebruikt auditstatussen zoals `partially_audited`, niet dezelfde waarden als live operational status. Het dashboard kan die als oranje tonen, maar semantisch is dit registrykwaliteit, geen runtime failure.
- Sommige master records zijn productcatalogus- of evidence-signalen, geen echte workflowautomations. Die kunnen nuttig zijn, maar moeten duidelijk als registry/signaal worden gelabeld.
- `systems_used` en `tables_touched` zijn semicolon-gescheiden tekst in docs; bij laden moeten lege waarden en whitespace zorgvuldig worden opgeschoond.
- De huidige tabel heeft geen unieke constraint op `flow_name`; opnieuw laden kan duplicaten maken als er geen veilige deduplicatie wordt toegepast.
- Er zijn encoding-artefacten in enkele namen in de docs. Review namen voor definitieve seed.
- Geen productie database wijzigen. Alleen `ptb_monitoring_test` mag later als eerste doel worden gebruikt.

## Veilige latere laadstappen voor `ptb_monitoring_test`

1. Review dit plan en kies de seed scope: aanbevolen eerste batch is alleen de 12 Zapier workflows.
2. Maak een gegenereerd SQL-bestand of laadscript dat alleen `monitoring.automation_registry` raakt.
3. Zorg dat alle `INSERT` statements schema-qualified zijn: `monitoring.automation_registry`.
4. Gebruik alleen `MONITORING_DATABASE_URL` voor de testdatabase en controleer vooraf dat de database exact `ptb_monitoring_test` is.
5. Voeg een preflight toe die de huidige registry telt en duplicaten op `flow_name` rapporteert.
6. Draai eerst een read-only preview: welke records zouden worden toegevoegd, welke zouden al bestaan.
7. Laad pas daarna in een expliciete test-run met transactie naar `ptb_monitoring_test`.
8. Controleer met SELECT-only queries:
   - aantal registry records;
   - records per category;
   - records per status;
   - eerste 12 flow names.
9. Open het dashboard en controleer dat `/.netlify/functions/monitoring-registry` live data toont.
10. Pas na review en akkoord een aparte productie-aanpak ontwerpen. Dit plan voert geen productiewijziging uit.

## Geen productie database wijzigen

Deze fase is alleen planning en documentatie. Er is geen SQL uitgevoerd, geen database gewijzigd, geen secret toegevoegd en geen frontend of Netlify Function aangepast.
