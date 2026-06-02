# Dashboard MVP gap analysis

Datum: 2026-06-02

Scope:

- Huidig statisch dashboard: `frontend/automation-dashboard/`
- Brondocumenten:
  - `docs/automation_inventory.md`
  - `docs/master_workflow_registry.md`
  - `docs/workflow_audit_gap_report.md`
- Monitoringdashboardplan zoals bedoeld in de prompt: van statisch MVP naar live monitoring voor workflows, student uploads, onboarding, auditstatus, opvolging, en later photo viewer/outbound/diagnostics.

Deze analyse documenteert alleen. Er zijn geen applicatielogica-, frontend- of databasewijzigingen nodig voor dit document.

## 1. Wat het huidige dashboard al doet

Het huidige dashboard is een bruikbaar statisch MVP voor dagelijkse oriëntatie. Het draait als statische pagina onder `frontend/automation-dashboard/` en gebruikt `app.js`, `styles.css`, `index.html` en `student-uploads.json`.

Aanwezige functies:

- Toont een operationele samenvatting met aantallen dashboardsignalen, workflow/productstromen, oranje kaarten, rode aandachtspunten en bronsystemen.
- Toont dashboardkaarten voor hoofdgebieden zoals tree allocation, Shopify aankopen, abonnementen, manual follow-up, outbound e-mail, certificaten, Academy onboarding en rapportage.
- Toont een workflow registry met workflow-id, naam, systeem, categorie, status en bewijs.
- Toont audittaken op basis van statische workflowactie-data.
- Toont een read-only studentmodule met:
  - samenvatting van open opvolging, ontbrekende screenshots, goedgekeurde uploads en blokkades;
  - student upload inbox;
  - onboarding inbox;
  - statische JSON-data uit `student-uploads.json`.
- Toont een sectie Openstaande acties met drie groepen:
  - Student uploads;
  - Onboarding;
  - Workflow/audit.
- Toont een compacte sectie Vandaag opvolgen.
- Ondersteunt filters:
  - algemene dashboardfilters: zoekterm, status, systeem;
  - actiefilters: actietype, urgentie;
  - studentfilters: zoekterm, studentstatus, les.
- Normaliseert voor openstaande acties urgentie naar dashboardstatus:
  - hoog = rood;
  - middel/normaal = oranje;
  - laag = groen.
- Combineert filters zodat zoekterm, status, systeem, actietype, urgentie en les elkaar verder beperken.
- Toont lege staten met actieve filters.
- Heeft een resetknop voor alle filters.

## 2. Wat nog statisch of mockdata is

Vrijwel alle inhoud is nu statisch of afgeleid uit statische arrays/JSON:

- `signalCards` in `app.js` zijn handmatig samengestelde dashboardkaarten.
- `workflows` in `app.js` is een handmatig geselecteerde subset van de master workflow registry.
- `workflowActions` in `app.js` is statische actie/mockdata voor auditopvolging.
- `student-uploads.json` bevat voorbeeldregistraties en voorbeelduploads, inclusief eigenaar, urgentie, laatste update, vervolgstap en bewijs.
- Samenvattingen en tellers zijn lokaal berekend uit deze statische data.
- Er is geen live API-call naar PostgreSQL, Zapier, Shopify, Chargebee, Zoho Mail, R2 of backend diagnostics.
- Er is geen autorisatie- of sessiecontext voor verschillende rollen.
- Er is geen persistentie van filterkeuzes, opvolgstatus, eigenaar, SLA of resolved-status.
- Er is geen live reconciliation tussen R2-objecten en `photo_uploads_review`.
- Er is geen live auditlog van Zapier-runstatussen, outbound mails, certificaten of webhookpogingen.

Het MVP is daarom bruikbaar als prototype voor informatiearchitectuur en dagelijkse workflow, maar nog niet als operationele bron van waarheid.

## 3. Ontbrekende onderdelen voor fase 2 en fase 3

### Fase 2: live read-only monitoring

Fase 2 moet het statische dashboard vervangen door live, read-only data zonder acties te muteren.

Ontbrekend voor fase 2:

- Backend API-routes die dashboarddata ophalen uit PostgreSQL.
- Een gestandaardiseerde `automation_registry` of vergelijkbare bron voor workflowmetadata.
- Een gestandaardiseerde `automation_events` of `workflow_audit_events` tabel voor status, eindresultaat, bewijs en fouten per workflowrun.
- Query's voor openstaande student uploads en onboarding op basis van `photo_uploads_review` en `academy_students`.
- Query's voor SLA/urgentie, bijvoorbeeld pending review ouder dan X dagen.
- Query's voor workflow/audit acties uit registry en gap report.
- Live dashboard statusregels per categorie: rood/oranje/groen.
- Bron/bewijsvelden die niet alleen tekstueel zijn, maar naar records, workflowruns, uploads of exports verwijzen.
- Duidelijke mapping tussen student upload statussen en dashboardstatussen.
- Read-only backend-authenticatie voor dashboardgebruikers.
- Een afgesproken datacontract tussen frontend en API.
- Basic caching/rate limiting, zodat dashboardqueries de productie-DB niet onnodig belasten.

### Fase 3: operational monitoring en remediation

Fase 3 gaat verder dan live read-only: het dashboard wordt dan een operationele cockpit met audit, prioritering, historische trends en mogelijk gecontroleerde acties.

Ontbrekend voor fase 3:

- Durable event logging voor externe systemen zoals Zapier, Shopify, Chargebee en Zoho Mail.
- Persistent outbound email/certificate status en retry-informatie.
- R2-vs-DB reconciliation voor uploads.
- Staff upload identity-persistentie, omdat staff fields nu mogelijk niet worden opgeslagen in `photo_uploads_review`.
- Admin/action auditlog voor dashboardacties.
- Resolved/owner/assignment workflow voor openstaande acties.
- SLA-definities per actietype.
- Trendgrafieken per dag/week voor pending uploads, workflow failures, missing evidence, outbound failures.
- Alerting of notifications voor rode/high urgency items.
- Rolgebaseerde views voor admin, staff, academy/support en superuser.
- Eventuele write-acties zoals markeren als resolved, opnieuw proberen, owner toewijzen of notitie toevoegen.

## 4. Benodigde PostgreSQL-tabellen

### Bestaande tabellen/views die direct bruikbaar zijn

Deze tabellen staan in `automation_inventory.md` en zijn relevant voor fase 2:

- `public.trees1`
  - Voor boomallocatie, ontbrekende coordinaten, ontbrekende tree codes, en koppeling aan users.
- `public.users1`
  - Voor klant/subscription signalen, forest hero eligibility en users zonder boom.
- `public.v_user_trees`
  - Voor read-only tree lookup per gebruiker.
- `photo_uploads_review`
  - Centrale tabel voor uploads, reviewstatus, academy/student/staff/onboarding metadata, AI-status, gallery visibility en punten.
- `public.academy_students` / `academy_students`
  - Voor studentidentiteit, onboarding, track/cohort/status en upload token.
- `academy_point_events`
  - Voor punten-sync per goedgekeurde upload.
- `academy_student_rewards`
  - Voor samengevatte student rewards en badges.

### Tabellen die nodig of aanbevolen zijn voor dashboardmonitoring

Deze tabellen lijken nog te ontbreken of zijn niet in de code aangetroffen:

- `automation_registry`
  - Source of truth voor workflow_id, naam, categorie, bronsysteem, verwacht resultaat, eigenaar, statusregel, bewijsverwachting en fase.
- `automation_events` of `workflow_audit_events`
  - Per workflowrun/event: workflow_id, source_event_id, started_at, completed_at, status, error, result_summary, evidence_ref.
- `automation_action_items`
  - Openstaande acties met type, eigenaar, urgentie, status, next_action, due_at, resolved_at, source_table, source_id.
- `outbound_email_log`
  - Mailtype, ontvanger, workflow_id/source_id, provider, status, sent_at, retry_count, message_id, error.
- `certificate_jobs`
  - Certificaatstatus per klant/student/tree, generated_at, sent_at, file_ref, error.
- `webhook_delivery_log`
  - Voor Zapier/approval webhookpogingen, statuscode, payload hash, attempt count, last_error.
- `r2_reconciliation_events`
  - R2-object zonder DB-record, DB-record zonder R2-object, checked_at, result.
- `dashboard_audit_log`
  - Alleen nodig zodra dashboard write-acties krijgt: actor, action, target, old/new values.

### Mogelijk bestaande maar niet bevestigde tabellen

Uit `master_workflow_registry.md` blijken integraties met deze bronnen, maar de repo-inventaris bevestigt geen live tabellen:

- `gift_claims`
- `email_log`
- `photos`
- `email_templates_01_gifttrees`
- subscription/customer/order tabellen voor Shopify en Chargebee

Deze moeten eerst met live schema of integratie-eigenaren worden bevestigd voordat ze in API's worden gebruikt.

## 5. Benodigde API-routes

Fase 2 kan beginnen met read-only routes. Een compact API-contract:

| Method | Route | Doel | Bron |
| --- | --- | --- | --- |
| GET | `/api/dashboard/summary` | Topmetrics voor dashboard | registry, events, uploads |
| GET | `/api/dashboard/workflows` | Workflow registry met status/filtering | `automation_registry`, master registry |
| GET | `/api/dashboard/workflow-actions` | Workflow/audit open acties | `automation_action_items`, `workflow_audit_events` |
| GET | `/api/dashboard/student-uploads` | Upload inbox en uploadacties | `photo_uploads_review`, `academy_students` |
| GET | `/api/dashboard/onboarding` | Onboarding inbox en acties | `academy_students`, `photo_uploads_review` |
| GET | `/api/dashboard/open-actions` | Gecombineerde actielijst | action view/materialized query |
| GET | `/api/dashboard/today` | Compacte Vandaag opvolgen lijst | action view |
| GET | `/api/dashboard/filters` | Beschikbare systemen, statussen, lessen, actietypes | registry/uploads |
| GET | `/api/dashboard/evidence/:type/:id` | Read-only bron/bewijsdetails | source tables |

Aanbevolen queryparameters:

- `q`
- `status`
- `system`
- `action_type`
- `urgency`
- `lesson`
- `owner`
- `limit`
- `offset`

Fase 3 routes kunnen later worden toegevoegd:

- `POST /api/dashboard/actions/:id/resolve`
- `POST /api/dashboard/actions/:id/assign`
- `POST /api/dashboard/actions/:id/comment`
- `POST /api/dashboard/retry/:event_id`

Die horen pas na auth, auditlog en duidelijke bevoegdheden.

## 6. Benodigde beveiliging

Voor fase 2:

- Dashboard alleen achter authenticatie, niet publiek op internet.
- Read-only API-scope voor gewone dashboardgebruikers.
- Geen admin key in querystring; bestaande patronen met query-param keys zijn risicovol.
- Server-side autorisatie per route.
- Rollen:
  - viewer: lezen;
  - operations: lezen plus later acties toewijzen/resolven;
  - admin/superuser: diagnostics en gevoelige data.
- Geen ruwe persoonsgegevens tonen tenzij nodig voor opvolging.
- PII-minimalisatie voor studentdata en klantdata.
- API responses beperken tot benodigde velden.
- Rate limiting en server-side pagination.
- Audit logging voor alle toekomstige write-acties.
- DB access via parameterized queries.
- `DB_SCHEMA` strak gecontroleerd houden.
- Secrets via environment variables, niet in frontend of statische JS.

Voor fase 3:

- Row-level of route-level access per rol.
- Auditlog verplicht voor resolve/assign/retry.
- Bescherming tegen mass export van student/customer data.
- CSRF-bescherming of same-site sessiebeleid als er write-acties komen.
- Separate access policy voor diagnostics, omdat die infrastructuurdetails en schema-informatie kan lekken.

## 7. Onderdelen die later horen

Deze onderdelen zijn belangrijk, maar horen niet in het eerste live-dashboard-MVP.

### Photo viewer

Later toevoegen omdat:

- Er bestaan al gallery/admin/student views.
- Photo viewer vraagt om file access, privacykeuzes, moderation states, R2 URL-validatie en rolrechten.
- Het huidige dashboard moet eerst actie- en statusgericht blijven.

Fase 2 kan wel tellers tonen, zoals pending uploads, approved-but-hidden, missing file URL.

### Outbound email monitoring

Later toevoegen omdat:

- Er is geen persistent outbound email log gevonden.
- `notifyApproval()` logt webhookpogingen niet duurzaam.
- Zoho Mail/Zapier bewijs is nu vooral export/sample-based.

Eerst nodig: `outbound_email_log` of `webhook_delivery_log`.

### Diagnostics

Later uitbreiden omdat:

- Er bestaan al basisdiagnostics: `/api/diag/info`, `/api/diag/db`, `/api/diag/heroes`.
- Diagnostics kunnen gevoelige DB/schema/env-informatie tonen.
- Dit hoort achter strengere admin/superuser-beveiliging.

Fase 2 kan alleen een eenvoudige health/status indicator tonen.

### Shopify, Chargebee en certificates

Later live maken omdat:

- De geinspecteerde code bevat geen Shopify/Chargebee write-flows.
- Er is geen certificate generation table of code gevonden.
- De registry bevat wel verwachte stromen, maar live brondata moet eerst worden bevestigd.

Eerst nodig: integratie-eigenaar, bronrepo, exports of tabellen.

## 8. Aanbevolen volgorde voor de volgende 5 commits

1. `Add dashboard API contract document`
   - Documenteer het JSON-contract voor summary, workflows, open actions, student uploads, onboarding en filters.
   - Geen codewijziging behalve docs.

2. `Add automation registry schema draft`
   - Voeg SQL/schema-doc toe voor `automation_registry`, `workflow_audit_events` en `automation_action_items`.
   - Beschrijf indexes en status/urgency mapping.

3. `Add read-only dashboard query helpers`
   - Backend-only read helpers voor uploads/onboarding/workflow registry.
   - Nog geen frontend-koppeling.

4. `Add read-only dashboard API routes`
   - Implementeer GET-routes met dezelfde filtersemantiek als het statische dashboard.
   - Voeg eenvoudige tests of sample responses toe.

5. `Switch dashboard from static data to API with fallback`
   - Frontend haalt live data op via API.
   - Houd tijdelijke statische fallback alleen voor lokale/dev modus.
   - Geen write-acties toevoegen.

Na deze 5 commits kan fase 2 worden gevalideerd op staging zonder `main` of de bestaande tree map te wijzigen.

