# Monitoring read-only API plan

Datum: 2026-06-03

Doel: plan maken voor read-only API-routes waarmee het interne automatiseringen-dashboard later live data kan lezen uit het PostgreSQL schema `monitoring`.

Belangrijk: dit document is alleen een plan. Er worden nog geen API-routes gebouwd, geen SQL statements uitgevoerd, geen frontendbestanden aangepast en geen databasewijzigingen gedaan.

## Scope en randvoorwaarden

De API moet straks alleen lezen uit:

- `monitoring.automation_events`
- `monitoring.outbound_messages`
- `monitoring.automation_registry`

De migration `docs/sql/001_monitoring_datamodel.sql` is getest op Aiven database `ptb_monitoring_test`. Er mag nog niets naar productie of Aiven `defaultdb`. De bestaande tree map en bestaande business tables blijven buiten scope.

Alle routes in dit plan zijn read-only. Toegestaan zijn alleen `GET` routes met SQL `SELECT` queries. Niet toegestaan zijn `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, resolved-acties, retry-acties, comments, assigns of andere databasewrites.

## 1. Dashboardonderdelen die live data nodig hebben

Het dashboard in `frontend/automation-dashboard/` is nu statisch. Deze onderdelen hebben later live monitoringdata nodig:

| Dashboardonderdeel | Live databron | Doel |
| --- | --- | --- |
| Samenvattingskaarten | `monitoring.automation_events`, `monitoring.outbound_messages`, `monitoring.automation_registry` | Aantallen rood/oranje/groen, open acties, recente events, failed outbound messages en actieve registry flows tonen. |
| Algemene filters | Alle drie monitoringtabellen | Status, severity, category, source system, actie vereist, datumrange en zoekterm toepassen. |
| Auditoverzicht / signaalkaarten | `monitoring.automation_events` | Recentste events en status per categorie tonen. |
| Openstaande acties | `monitoring.automation_events` | Events met `action_required = true` tonen, gesorteerd op urgentie en tijd. |
| Vandaag opvolgen | `monitoring.automation_events`, eventueel `monitoring.outbound_messages` | Acties en failures van vandaag of binnen gekozen datumrange tonen. |
| Workflow registry | `monitoring.automation_registry` | Workflows, categorieen, status, systemen, geraakte tabellen en documentatie-links tonen. |
| Workflow/audit-acties | `monitoring.automation_events` | Rode/oranje workflowevents met opvolging tonen. |
| Outbound e-mail / berichtenmonitor | `monitoring.outbound_messages` | Verzonden, queued en failed outbound berichten tonen met provider, ontvanger en foutmelding. |
| Student upload en onboarding signalen | Eerst `monitoring.automation_events` | Alleen live maken voor zover deze signalen als monitoringevents beschikbaar zijn. De bestaande statische studentdata blijft buiten deze API-fase. |

## 2. Benodigde read-only API-routes

Aanbevolen routeprefix:

- `/api/monitoring`

Eerste routes:

| Route | Doel | Primaire tabel(len) |
| --- | --- | --- |
| `GET /api/monitoring/summary` | Compacte dashboardmetrics en tellingen. | `automation_events`, `outbound_messages`, `automation_registry` |
| `GET /api/monitoring/events` | Eventlog voor auditoverzicht en signaalkaarten. | `automation_events` |
| `GET /api/monitoring/actions` | Openstaande acties uit events. | `automation_events` |
| `GET /api/monitoring/registry` | Workflow registry. | `automation_registry` |
| `GET /api/monitoring/outbound-messages` | Outbound berichtenlog. | `outbound_messages`, optioneel join naar `automation_events` |

Optioneel later:

- `GET /api/monitoring/filters` voor beschikbare filterwaarden.
- `GET /api/monitoring/events/:id` voor detailweergave van een specifiek event.
- `GET /api/monitoring/outbound-messages/:id` voor detailweergave van een specifiek outbound bericht.

## 3. Indicatieve SQL SELECT queries per route

Alle voorbeelden hieronder zijn indicatief. De uiteindelijke implementatie moet parameterized queries gebruiken en nooit querystrings direct in SQL plakken.

### `GET /api/monitoring/summary`

Doel: topmetrics voor het dashboard.

```sql
select
  count(*) filter (where event_time >= now() - interval '24 hours') as events_last_24h,
  count(*) filter (where severity = 'red') as red_events,
  count(*) filter (where severity = 'orange') as orange_events,
  count(*) filter (where action_required = true) as open_actions,
  count(*) filter (where status = 'failed') as failed_events
from monitoring.automation_events
where event_time >= coalesce($1::timestamptz, now() - interval '30 days')
  and event_time < coalesce($2::timestamptz, now() + interval '1 day');
```

```sql
select
  count(*) as outbound_total,
  count(*) filter (where status = 'failed') as outbound_failed,
  count(*) filter (where status = 'queued') as outbound_queued,
  count(*) filter (where message_time >= now() - interval '24 hours') as outbound_last_24h
from monitoring.outbound_messages
where message_time >= coalesce($1::timestamptz, now() - interval '30 days')
  and message_time < coalesce($2::timestamptz, now() + interval '1 day');
```

```sql
select
  count(*) as registry_total,
  count(*) filter (where status = 'active') as registry_active,
  count(*) filter (where status = 'paused') as registry_paused,
  count(*) filter (where status = 'test') as registry_test
from monitoring.automation_registry;
```

### `GET /api/monitoring/events`

Doel: gefilterde eventlijst voor auditoverzicht en signaalkaarten.

```sql
select
  id,
  event_time,
  category,
  severity,
  status,
  source_system,
  flow_name,
  entity_type,
  entity_id,
  customer_email,
  summary,
  action_required,
  external_link,
  error_message,
  changed_fields,
  created_at
from monitoring.automation_events
where ($1::text is null or status = $1)
  and ($2::text is null or severity = $2)
  and ($3::text is null or category = $3)
  and ($4::text is null or source_system = $4)
  and ($5::boolean is null or action_required = $5)
  and ($6::timestamptz is null or event_time >= $6)
  and ($7::timestamptz is null or event_time < $7)
  and (
    $8::text is null
    or flow_name ilike '%' || $8 || '%'
    or entity_id ilike '%' || $8 || '%'
    or customer_email ilike '%' || $8 || '%'
    or summary ilike '%' || $8 || '%'
    or error_message ilike '%' || $8 || '%'
  )
order by event_time desc, id desc
limit least(coalesce($9::int, 100), 500)
offset coalesce($10::int, 0);
```

### `GET /api/monitoring/actions`

Doel: openstaande acties tonen. In deze fase betekent dat: events waar `action_required = true`.

```sql
select
  id,
  event_time,
  category,
  severity,
  status,
  source_system,
  flow_name,
  entity_type,
  entity_id,
  customer_email,
  summary,
  external_link,
  error_message
from monitoring.automation_events
where action_required = true
  and ($1::text is null or status = $1)
  and ($2::text is null or severity = $2)
  and ($3::text is null or category = $3)
  and ($4::text is null or source_system = $4)
  and ($5::timestamptz is null or event_time >= $5)
  and ($6::timestamptz is null or event_time < $6)
  and (
    $7::text is null
    or flow_name ilike '%' || $7 || '%'
    or entity_id ilike '%' || $7 || '%'
    or customer_email ilike '%' || $7 || '%'
    or summary ilike '%' || $7 || '%'
    or error_message ilike '%' || $7 || '%'
  )
order by
  case severity
    when 'red' then 1
    when 'orange' then 2
    when 'green' then 3
    else 4
  end,
  event_time desc,
  id desc
limit least(coalesce($8::int, 100), 500)
offset coalesce($9::int, 0);
```

### `GET /api/monitoring/registry`

Doel: workflow registry live uitlezen.

```sql
select
  id,
  flow_name,
  category,
  status,
  trigger_description,
  systems_used,
  tables_touched,
  fields_touched,
  github_repo,
  github_files,
  technical_summary,
  notes,
  created_at,
  updated_at
from monitoring.automation_registry
where ($1::text is null or status = $1)
  and ($2::text is null or category = $2)
  and (
    $3::text is null
    or $3 = any(systems_used)
  )
  and (
    $4::text is null
    or flow_name ilike '%' || $4 || '%'
    or trigger_description ilike '%' || $4 || '%'
    or technical_summary ilike '%' || $4 || '%'
    or notes ilike '%' || $4 || '%'
  )
order by category asc, flow_name asc
limit least(coalesce($5::int, 100), 500)
offset coalesce($6::int, 0);
```

### `GET /api/monitoring/outbound-messages`

Doel: outbound berichtenlog tonen, inclusief relatie met monitoringevent als die bestaat.

```sql
select
  message.id,
  message.message_time,
  message.message_type,
  message.provider,
  message.recipient_email,
  message.subject,
  message.status,
  message.related_event_id,
  message.related_entity_type,
  message.related_entity_id,
  message.external_link,
  message.error_message,
  message.created_at,
  event.category as event_category,
  event.severity as event_severity,
  event.status as event_status,
  event.flow_name as event_flow_name,
  event.action_required as event_action_required
from monitoring.outbound_messages message
left join monitoring.automation_events event
  on event.id = message.related_event_id
where ($1::text is null or message.status = $1)
  and ($2::text is null or message.message_type = $2)
  and ($3::text is null or message.provider = $3)
  and ($4::timestamptz is null or message.message_time >= $4)
  and ($5::timestamptz is null or message.message_time < $5)
  and (
    $6::text is null
    or message.recipient_email ilike '%' || $6 || '%'
    or message.subject ilike '%' || $6 || '%'
    or message.related_entity_id ilike '%' || $6 || '%'
    or message.error_message ilike '%' || $6 || '%'
    or event.flow_name ilike '%' || $6 || '%'
  )
order by message.message_time desc, message.id desc
limit least(coalesce($7::int, 100), 500)
offset coalesce($8::int, 0);
```

## 4. Ondersteunde filters

Alle routes hoeven niet exact dezelfde filters te ondersteunen, maar de API moet wel dezelfde queryparameter-namen gebruiken.

| Filter | Queryparameter | Routes | Mapping |
| --- | --- | --- | --- |
| Status | `status` | `events`, `actions`, `registry`, `outbound-messages` | `automation_events.status`, `automation_registry.status`, `outbound_messages.status` |
| Severity | `severity` | `summary`, `events`, `actions` | `automation_events.severity` |
| Category | `category` | `summary`, `events`, `actions`, `registry` | `automation_events.category`, `automation_registry.category` |
| Source system | `source_system` | `summary`, `events`, `actions`, `registry` | `automation_events.source_system`; bij registry zoeken in `systems_used` |
| Action required | `action_required` | `summary`, `events`, `actions` | `automation_events.action_required` |
| Date range | `from`, `to` | `summary`, `events`, `actions`, `outbound-messages` | `event_time` of `message_time` |
| Search term | `q` | `events`, `actions`, `registry`, `outbound-messages` | `ILIKE` op veilige tekstvelden |

Aanbevolen afspraken:

- `from` en `to` zijn ISO-8601 timestamps of datums.
- `to` is exclusief, zodat dagranges netjes werken.
- `limit` is standaard `100` en maximaal `500`.
- `offset` mag voor de eerste fase; cursor-based pagination kan later als tabellen groot worden.
- Lege strings worden behandeld als geen filter.
- Onbekende filterwaarden leveren een lege lijst op, geen fout.

## 5. Environment variable

Gebruik voor de testdatabase:

```text
MONITORING_DATABASE_URL
```

Deze environment variable moet verwijzen naar Aiven database `ptb_monitoring_test` of naar een lokale testdatabase. Hij mag niet verwijzen naar productie of Aiven `defaultdb`.

Aanbevolen checks bij startup of request:

- Faal gesloten als `MONITORING_DATABASE_URL` ontbreekt.
- Log nooit de volledige connection string.
- Controleer in lokale testdocumentatie dat de database naam `ptb_monitoring_test` is.
- Gebruik een databasegebruiker met alleen `SELECT` rechten op `monitoring.*` zodra deze rol beschikbaar is.
- Gebruik niet de bestaande productie- of tree-map databasevariabele voor deze API.

## 6. Waarom deze API read-only moet blijven

De eerste API-fase is bedoeld om monitoringinformatie zichtbaar te maken, niet om werkprocessen vanuit het dashboard te veranderen.

Read-only blijven is belangrijk omdat:

- Het dashboard intern is, maar nog geen volledige autorisatie per actie heeft.
- Er nog geen auditlog bestaat voor dashboard-acties zoals resolve, assign, retry of comment.
- Monitoringdata PII kan bevatten, zoals `customer_email`.
- Een fout in een schrijfroute direct operationele status of opvolging kan vervuilen.
- De migration is alleen ontworpen als datamodel voor observatie en rooktests.
- Productie/defaultdb expliciet buiten scope is.
- De bestaande tree map niet geraakt mag worden.

Write-acties kunnen pas later worden overwogen met een apart ontwerp voor rollen, CSRF-bescherming, audit logging, idempotentie, validatie en rollbackgedrag.

## 7. Basic Auth en API-beveiliging

Het dashboard is nu beschermd met Basic Auth via een Netlify Edge Function. Die bescherming moet straks ook gelden voor API-verzoeken.

Aanbevolen model:

- Dezelfde Basic Auth gate beschermt zowel `frontend/automation-dashboard/` als `/api/monitoring/*`.
- API-routes mogen geen data teruggeven als Basic Auth faalt.
- De API gebruikt server-side secrets; `MONITORING_DATABASE_URL` komt nooit in browser-JavaScript terecht.
- De frontend haalt data alleen op via same-origin routes, bijvoorbeeld `/api/monitoring/summary`.
- Responses krijgen geen publieke cacheheaders. Gebruik bijvoorbeeld `Cache-Control: no-store` voor monitoringdata met PII of operationele status.
- CORS blijft gesloten of same-origin. Geen brede `Access-Control-Allow-Origin: *`.
- Foutmeldingen naar de browser blijven generiek. Databasehost, user, SQL en stacktraces worden niet gelekt.
- Rate limiting of eenvoudige request throttling is later wenselijk, vooral voor zoekfilters.

Basic Auth is dus de toegangspoort. De API zelf moet daarnaast defensief blijven: read-only databaseuser, parameterized queries, beperkte velden, limieten op `limit`, veilige error responses en geen secrets in logs.

## 8. Lokaal testen met `ptb_monitoring_test`

Er wordt in deze planfase niets uitgevoerd. Als de API later gebouwd wordt, kan lokaal testen zo:

1. Zet de connection string naar de testdatabase:

```powershell
$env:MONITORING_DATABASE_URL = "<Aiven ptb_monitoring_test connection string>"
```

2. Controleer handmatig dat de connection string naar `ptb_monitoring_test` wijst en niet naar `defaultdb`.

3. Start de lokale server of Netlify dev-omgeving met alleen testdatabaseconfiguratie.

4. Open het dashboard achter Basic Auth.

5. Test per route alleen `GET` requests:

```powershell
Invoke-RestMethod "http://localhost:8888/api/monitoring/summary"
Invoke-RestMethod "http://localhost:8888/api/monitoring/events?severity=red&action_required=true"
Invoke-RestMethod "http://localhost:8888/api/monitoring/actions?category=workflow/audit"
Invoke-RestMethod "http://localhost:8888/api/monitoring/registry?status=test"
Invoke-RestMethod "http://localhost:8888/api/monitoring/outbound-messages?status=failed"
```

6. Controleer dat `POST`, `PUT`, `PATCH` en `DELETE` niet bestaan of `405 Method Not Allowed` geven.

7. Controleer dat API-verzoeken zonder Basic Auth geen monitoringdata teruggeven.

8. Controleer dat zoekfilters, limieten en datumranges werken zonder SQL-fouten.

9. Controleer dat responses geen database secrets, stacktraces of overbodige PII bevatten.

## 9. Bestanden die later aangepast moeten worden

Als deze API echt gebouwd wordt, zijn waarschijnlijk deze bestanden of mappen betrokken:

| Bestand of map | Verwachte aanpassing |
| --- | --- |
| `netlify.toml` | Routing/configuratie voor Netlify Functions of Edge Functions controleren. |
| `netlify/edge-functions/` of bestaande Basic Auth locatie | Basic Auth ook laten gelden voor `/api/monitoring/*` als dat nog niet zo is. |
| `netlify/functions/monitoring-summary.*` of vergelijkbare nieuwe functions | Nieuwe read-only API-handler voor summary. |
| `netlify/functions/monitoring-events.*` of vergelijkbare nieuwe functions | Nieuwe read-only API-handler voor events. |
| `netlify/functions/monitoring-actions.*` of vergelijkbare nieuwe functions | Nieuwe read-only API-handler voor open acties. |
| `netlify/functions/monitoring-registry.*` of vergelijkbare nieuwe functions | Nieuwe read-only API-handler voor registry. |
| `netlify/functions/monitoring-outbound-messages.*` of vergelijkbare nieuwe functions | Nieuwe read-only API-handler voor outbound berichten. |
| Nieuwe gedeelde databasehelper, bijvoorbeeld `netlify/functions/_lib/monitoring-db.*` | PostgreSQL client, parameterized query helper, env-var validatie en read-only guard. |
| Nieuwe gedeelde filterhelper, bijvoorbeeld `netlify/functions/_lib/monitoring-filters.*` | Queryparameter-validatie, limieten, datumrange parsing en zoekterm-normalisatie. |
| `frontend/automation-dashboard/app.js` | Later vervangen van statische arrays door fetches naar `/api/monitoring/*`. Niet in deze plancommit. |
| `frontend/automation-dashboard/index.html` | Alleen later als UI nieuwe states nodig heeft, zoals loading/error/empty. Niet in deze plancommit. |
| `docs/dashboard_security.md` | Later documenteren hoe Basic Auth en API-beveiliging samen werken. |
| `docs/monitoring_database_test_plan.md` | Later aanvullen met API-teststappen zonder databasewrites. |
| Deployment secrets in Netlify | `MONITORING_DATABASE_URL` toevoegen voor test/staging context, niet voor productie zonder expliciet akkoord. |

`server.js` en de bestaande tree map moeten voor deze monitoring-API niet worden aangepast, tenzij een latere architectuurbeslissing expliciet afwijkt. Voor nu is het veiliger om monitoringroutes geisoleerd te houden.

## 10. Aanbevolen volgorde voor volgende commits

1. `Document monitoring read-only API contract`
   - Dit plan toevoegen en reviewen.
   - Geen code, geen databasewijzigingen.

2. `Add monitoring API response contract`
   - JSON responsevormen documenteren voor summary, events, actions, registry en outbound messages.
   - Velden markeren die PII zijn.

3. `Add read-only monitoring database helper`
   - Alleen backend-helper met `MONITORING_DATABASE_URL`, parameterized queries en limieten.
   - Nog geen frontendwijziging.
   - Gebruik bij voorkeur een databaseuser met alleen `SELECT` rechten.

4. `Add monitoring summary and events GET endpoints`
   - Eerste twee read-only routes bouwen.
   - Tests toevoegen voor methodebeperking, ontbrekende env var, filters en veilige errors.

5. `Add monitoring actions, registry and outbound GET endpoints`
   - Overige read-only routes bouwen.
   - Tests toevoegen voor `action_required`, zoekterm, datumrange en max `limit`.

6. `Wire Basic Auth coverage for monitoring API`
   - Controleren dat `/api/monitoring/*` dezelfde bescherming heeft als het dashboard.
   - Handmatig testen zonder en met Basic Auth.

7. `Connect dashboard to monitoring read API`
   - Pas daarna `frontend/automation-dashboard/` aanpassen.
   - Statische fallback of duidelijke empty/error states behouden.

8. `Document staging rollout`
   - Pas na review beslissen of en hoe staging of productieconfiguratie wordt toegevoegd.
   - Nog steeds niets naar productie/defaultdb zonder expliciet akkoord, backup en hostcontrole.

## Open punten

- Exacte JSON responsecontracten per route moeten nog worden vastgelegd.
- Er moet worden gekozen waar de API draait: Netlify Functions, bestaande serverlaag of een aparte backend.
- Er moet worden bevestigd of de bestaande Basic Auth Edge Function automatisch `/api/monitoring/*` beschermt.
- Er is nog geen aparte read-only databaseuser gedocumenteerd voor Aiven.
- Er is nog geen ontwerp voor write-acties, ownership, resolved-status of dashboard audit logging. Die blijven buiten scope.
