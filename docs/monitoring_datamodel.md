# Monitoring datamodel

Datum: 2026-06-02

Doel: een veilige PostgreSQL basis leggen voor het interne Plant N Boom / KETSO monitoringdashboard.

Deze fase gaat alleen over database-migratie en documentatie. Het dashboardprototype in `frontend/automation-dashboard/` blijft statisch. Er zijn geen frontend-, applicatielogica- of bestaande business-table wijzigingen nodig.

## Migration

Bestand:

- `docs/sql/001_monitoring_datamodel.sql`

De migration gebruikt:

- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- geen `ALTER` op bestaande business tables
- geen destructieve SQL in het actieve deel
- een rollbacksectie die volledig is uitgecommentarieerd

## Tabellen

### `automation_events`

Doel: centrale eventlog voor workflowstatus, monitoringstatus en actie-signalen.

Voorbeelden:

- Zapier workflowrun is geslaagd of gefaald.
- Academy upload is ingediend voor review.
- Manual follow-up bewijs ontbreekt.
- Tree allocation mist een verwachte eindstatus.

Belangrijke velden:

- `event_time`: wanneer het monitoringevent plaatsvond.
- `category`: functionele groep, bijvoorbeeld `academy/upload`, `workflow/audit`, `tree/allocation`.
- `severity`: dashboardkleur, zoals `green`, `orange`, `red`.
- `status`: operationele status, zoals `ok`, `needs_review`, `failed`.
- `source_system`: bronsysteem, zoals Zapier, PostgreSQL, KETSO uploader, Zoho Mail.
- `flow_name`: workflow- of procesnaam.
- `entity_type` en `entity_id`: verwijzing naar bronobject.
- `customer_email`: optioneel voor klantgerichte opvolging.
- `changed_fields`: JSONB payload met relevante veldwijzigingen.
- `action_required`: of het dashboard dit als open actie moet tonen.
- `external_link`: link naar bronsysteem of bewijs.
- `error_message`: fouttekst bij rood/failure.

### `outbound_messages`

Doel: persistent loggen van uitgaande berichten en webhookachtige follow-up.

Voorbeelden:

- Goedkeuringsnotificatie naar Zapier.
- Klantmail via Zoho Mail.
- Certificaatmail zodra certificate flows later worden aangesloten.

Belangrijke velden:

- `message_time`: verzend- of pogingstijd.
- `message_type`: type bericht, bijvoorbeeld `approval_notification`, `certificate_email`, `tree_report`.
- `provider`: bijvoorbeeld Zapier, Zoho Mail, SMTP provider.
- `recipient_email`: ontvanger.
- `status`: `sent`, `failed`, `queued`, of andere afgesproken status.
- `related_event_id`: optionele foreign key naar `automation_events`.
- `related_entity_type` en `related_entity_id`: bronobject als er geen event-id is.
- `external_link`: providerlog of bewijslink.
- `error_message`: foutmelding bij failure.

### `automation_registry`

Doel: source of truth voor workflows en monitoringdekking.

Voorbeelden:

- Zapier workflow voor Shopify SKU 02.
- Chargebee abonnementenflow.
- Academy onboarding via Zoho CRM.
- Manual follow-up signalen vanuit Zoho Mail.

Belangrijke velden:

- `flow_name`: workflownaam.
- `category`: dashboardcategorie.
- `status`: registry-status, bijvoorbeeld `active`, `paused`, `test`.
- `trigger_description`: beschrijving van de trigger.
- `systems_used`: betrokken systemen.
- `tables_touched`: PostgreSQL-tabellen die de flow raakt.
- `fields_touched`: JSONB beschrijving van relevante velden.
- `github_repo` en `github_files`: traceerbaarheid naar code.
- `technical_summary`: korte technische uitleg.
- `notes`: open vragen of auditnotities.

## Indexen

De migration maakt indexen voor dashboardfilters:

- `automation_events(event_time)`
- `automation_events(category)`
- `automation_events(severity)`
- `automation_events(action_required)`
- `automation_events(customer_email)`
- `outbound_messages(message_time)`
- `outbound_messages(recipient_email)`
- `outbound_messages(status)`
- `automation_registry(flow_name)`
- `automation_registry(category)`
- `automation_registry(status)`

Deze indexen ondersteunen de eerste dashboardvragen:

- Wat is vandaag gebeurd?
- Welke rode/oranje events hebben opvolging nodig?
- Welke klant of student is geraakt?
- Welke outbound berichten zijn mislukt?
- Welke flows zijn actief of nog test?

## Testdata

De SQL bevat een duidelijk gemarkeerde `TEST DATA` sectie.

Deze testdata is bedoeld voor lokale of staging smoke-tests:

- een test registry row;
- een oranje academy upload event;
- een rood workflow/audit event;
- een outbound message gekoppeld aan het testevent.

Voor productie kan de testdata-sectie worden overgeslagen of na validatie worden verwijderd met de uitgecommentarieerde rollbackqueries.

## Dashboardgebruik

Fase 2 kan deze tabellen gebruiken voor read-only API's:

- openstaande acties uit `automation_events where action_required = true`;
- workflow registry uit `automation_registry`;
- outbound monitoring uit `outbound_messages`;
- dashboardkaarten op basis van categorie, severity en status.

Het huidige statische dashboard hoeft in deze fase nog niet te worden aangepast.

## Veiligheid

Belangrijke randvoorwaarden:

- Geen secrets in databasevelden opslaan.
- Geen bestaande business tables droppen of muteren.
- Dashboard API's read-only houden tot er expliciete autorisatie en audit logging is.
- PII zoals `customer_email` alleen tonen aan geautoriseerde interne gebruikers.
- `external_link` alleen vullen met links die intern veilig toegankelijk zijn.
- Write-acties zoals resolved/assign/retry pas later toevoegen met `dashboard_audit_log` of vergelijkbare audittrail.

## Open punten voor latere fases

- Exacte mapping van bestaande Zapier/Shopify/Chargebee flows naar `automation_registry`.
- Of `severity` beperkt moet worden met een check constraint zodra de statuswoorden definitief zijn.
- Of `status` per categorie een enum/check constraint moet krijgen.
- Of `automation_events` later partitionering nodig heeft op `event_time`.
- Of `outbound_messages.related_event_id` verplicht moet worden voor bepaalde message types.
- Of er aparte tabellen nodig zijn voor dashboard action ownership en resolved-status.

