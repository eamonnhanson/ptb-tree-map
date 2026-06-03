# Monitoring API testplan

Datum: 2026-06-03

Doel: testplan maken voor toekomstige read-only monitoring API-routes waarmee het interne automatiseringen-dashboard later data kan lezen uit het PostgreSQL schema `monitoring`.

Belangrijk: dit document is alleen een testplan. In deze stap worden geen API-routes gebouwd, geen SQL statements uitgevoerd, geen frontendbestanden aangepast en geen databasewijzigingen gedaan.

## 1. Doel van de API-testfase

De API-testfase moet aantonen dat toekomstige monitoringroutes veilig, voorspelbaar en alleen-lezen werken voordat ze aan het dashboard in `frontend/automation-dashboard/` worden gekoppeld.

De testfase controleert:

- Of alle geplande `GET /api/monitoring/*` routes responsevormen leveren die het dashboard kan gebruiken.
- Of filters correct worden gevalideerd en vertaald naar parameterized SQL `SELECT` queries.
- Of de API alleen leest uit schema `monitoring`.
- Of de API niet schrijft naar de database.
- Of Basic Auth en API-beveiliging voorkomen dat monitoringdata publiek toegankelijk is.
- Of foutscenario's veilig falen zonder secrets, stacktraces of databasegegevens te lekken.
- Of de API uitsluitend getest wordt tegen Aiven database `ptb_monitoring_test`, niet tegen `defaultdb` en niet tegen productie.

## 2. Routes die later getest moeten worden

De eerste read-only API-fase moet deze routes testen:

| Route | Doel | Databasebron |
| --- | --- | --- |
| `GET /api/monitoring/summary` | Dashboardtellingen en topmetrics. | `monitoring.automation_events`, `monitoring.outbound_messages`, `monitoring.automation_registry` |
| `GET /api/monitoring/events` | Gefilterde eventlog. | `monitoring.automation_events` |
| `GET /api/monitoring/actions` | Openstaande acties. | `monitoring.automation_events` |
| `GET /api/monitoring/registry` | Workflow registry. | `monitoring.automation_registry` |
| `GET /api/monitoring/outbound-messages` | Outbound berichtenlog. | `monitoring.outbound_messages`, optioneel `monitoring.automation_events` |

Alle routes moeten alleen `GET` ondersteunen. `POST`, `PUT`, `PATCH` en `DELETE` moeten niet bestaan of `405 Method Not Allowed` teruggeven.

## 3. Testdetails per route

Alle SQL in dit document is indicatief voor latere tests. Voer deze queries niet uit in deze documentatiefase. De latere implementatie moet parameterized queries gebruiken.

### `GET /api/monitoring/summary`

Verwachte queryparameters:

| Parameter | Type | Betekenis |
| --- | --- | --- |
| `from` | ISO datum/timestamp | Inclusieve start van de meetperiode. |
| `to` | ISO datum/timestamp | Exclusieve eindgrens van de meetperiode. |
| `category` | tekst | Optionele eventcategorie. |
| `source_system` | tekst | Optioneel bronsysteem. |
| `severity` | tekst | Optionele eventseverity. |
| `action_required` | boolean | Optioneel alleen events met of zonder open actie. |

Verwachte responsevorm:

```json
{
  "data": {
    "events": {
      "total": 2,
      "last24h": 2,
      "red": 1,
      "orange": 1,
      "openActions": 2,
      "failed": 1
    },
    "outboundMessages": {
      "total": 1,
      "failed": 0,
      "queued": 0,
      "last24h": 1
    },
    "registry": {
      "total": 1,
      "active": 0,
      "paused": 0,
      "test": 1
    }
  },
  "meta": {
    "database": "ptb_monitoring_test",
    "schema": "monitoring",
    "readOnly": true
  }
}
```

Relevante SQL `SELECT`:

```sql
select
  count(*) as total,
  count(*) filter (where event_time >= now() - interval '24 hours') as last_24h,
  count(*) filter (where severity = 'red') as red,
  count(*) filter (where severity = 'orange') as orange,
  count(*) filter (where action_required = true) as open_actions,
  count(*) filter (where status = 'failed') as failed
from monitoring.automation_events
where ($1::timestamptz is null or event_time >= $1)
  and ($2::timestamptz is null or event_time < $2)
  and ($3::text is null or category = $3)
  and ($4::text is null or source_system = $4)
  and ($5::text is null or severity = $5)
  and ($6::boolean is null or action_required = $6);
```

```sql
select
  count(*) as total,
  count(*) filter (where status = 'failed') as failed,
  count(*) filter (where status = 'queued') as queued,
  count(*) filter (where message_time >= now() - interval '24 hours') as last_24h
from monitoring.outbound_messages
where ($1::timestamptz is null or message_time >= $1)
  and ($2::timestamptz is null or message_time < $2);
```

```sql
select
  count(*) as total,
  count(*) filter (where status = 'active') as active,
  count(*) filter (where status = 'paused') as paused,
  count(*) filter (where status = 'test') as test
from monitoring.automation_registry;
```

Foutscenario's:

- Ongeldige `from` of `to` geeft `400 Bad Request`.
- `from` later dan `to` geeft `400 Bad Request`.
- Ontbrekende databaseconfiguratie geeft veilige `500` of `503`, zonder connection string.
- Lege dataset geeft geldige response met nullen.

### `GET /api/monitoring/events`

Verwachte queryparameters:

| Parameter | Type | Betekenis |
| --- | --- | --- |
| `severity` | tekst | Filter op `green`, `orange`, `red` of later afgesproken waarden. |
| `status` | tekst | Filter op operationele status zoals `ok`, `needs_review`, `failed`. |
| `category` | tekst | Filter op dashboardcategorie. |
| `source_system` | tekst | Filter op bronsysteem. |
| `action_required` | boolean | Filter op open actie. |
| `from` | ISO datum/timestamp | Inclusieve start op `event_time`. |
| `to` | ISO datum/timestamp | Exclusieve eindgrens op `event_time`. |
| `q` | tekst | Zoekterm voor flow, entity, e-mail, summary of foutmelding. |
| `limit` | integer | Standaard 100, maximaal 500. |
| `offset` | integer | Standaard 0. |

Verwachte responsevorm:

```json
{
  "data": [
    {
      "id": 1,
      "eventTime": "2026-06-02T10:00:00.000Z",
      "category": "academy/upload",
      "severity": "orange",
      "status": "needs_review",
      "sourceSystem": "KETSO uploader",
      "flowName": "TEST - Academy upload review monitor",
      "entityType": "photo_uploads_review",
      "entityId": "test-upload-001",
      "customerEmail": "student@example.invalid",
      "summary": "TEST DATA - student upload submitted for review.",
      "actionRequired": true,
      "externalLink": null,
      "errorMessage": null,
      "changedFields": {}
    }
  ],
  "meta": {
    "limit": 100,
    "offset": 0,
    "readOnly": true
  }
}
```

Relevante SQL `SELECT`:

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
where ($1::text is null or severity = $1)
  and ($2::text is null or status = $2)
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

Foutscenario's:

- Ongeldige boolean voor `action_required` geeft `400 Bad Request`.
- Negatieve `limit` of `offset` geeft `400 Bad Request`.
- `limit` boven maximum wordt geweigerd of begrensd op 500.
- Zoekterm die niets vindt geeft `200 OK` met lege `data`.
- Databasefout geeft geen SQL, host, user of stacktrace terug.

### `GET /api/monitoring/actions`

Verwachte queryparameters:

| Parameter | Type | Betekenis |
| --- | --- | --- |
| `severity` | tekst | Urgentie/statuskleur van de open actie. |
| `status` | tekst | Operationele status. |
| `category` | tekst | Dashboardcategorie. |
| `source_system` | tekst | Bronsysteem. |
| `from` | ISO datum/timestamp | Inclusieve start op `event_time`. |
| `to` | ISO datum/timestamp | Exclusieve eindgrens op `event_time`. |
| `q` | tekst | Zoekterm. |
| `limit` | integer | Standaard 100, maximaal 500. |
| `offset` | integer | Standaard 0. |

Verwachte responsevorm:

```json
{
  "data": [
    {
      "id": 2,
      "eventTime": "2026-06-02T10:05:00.000Z",
      "category": "workflow/audit",
      "severity": "red",
      "status": "failed",
      "sourceSystem": "Zapier",
      "flowName": "TEST - Manual follow-up evidence",
      "entityType": "workflow",
      "entityId": "test-workflow-001",
      "summary": "TEST DATA - missing manual follow-up evidence.",
      "actionRequired": true,
      "errorMessage": "Missing live Zoho Mail folder evidence."
    }
  ],
  "meta": {
    "limit": 100,
    "offset": 0,
    "readOnly": true
  }
}
```

Relevante SQL `SELECT`:

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
  and ($1::text is null or severity = $1)
  and ($2::text is null or status = $2)
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

Foutscenario's:

- Queryparameter `action_required=false` wordt genegeerd of geweigerd, omdat deze route per definitie open acties toont.
- Geen open acties geeft `200 OK` met lege `data`.
- Niet-GET methodes geven `405 Method Not Allowed`.
- API zonder Basic Auth geeft geen data.

### `GET /api/monitoring/registry`

Verwachte queryparameters:

| Parameter | Type | Betekenis |
| --- | --- | --- |
| `status` | tekst | Registry-status, bijvoorbeeld `active`, `paused`, `test`. |
| `category` | tekst | Workflowcategorie. |
| `source_system` | tekst | Systeem dat voorkomt in `systems_used`. |
| `q` | tekst | Zoekterm voor naam, trigger, technische samenvatting of notities. |
| `limit` | integer | Standaard 100, maximaal 500. |
| `offset` | integer | Standaard 0. |

Verwachte responsevorm:

```json
{
  "data": [
    {
      "id": 1,
      "flowName": "TEST - Academy upload review monitor",
      "category": "academy/upload",
      "status": "test",
      "triggerDescription": "Example event emitted when a student upload needs review.",
      "systemsUsed": ["PostgreSQL", "KETSO uploader"],
      "tablesTouched": ["photo_uploads_review", "academy_students"],
      "fieldsTouched": {},
      "githubRepo": "ptb-tree-map",
      "githubFiles": ["frontend/automation-dashboard/student-uploads.json"],
      "technicalSummary": "Test registry row for monitoring dashboard validation.",
      "notes": "TEST DATA - safe to delete after validation."
    }
  ],
  "meta": {
    "limit": 100,
    "offset": 0,
    "readOnly": true
  }
}
```

Relevante SQL `SELECT`:

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
  and ($3::text is null or $3 = any(systems_used))
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

Foutscenario's:

- Onbekende status geeft lege `data`, tenzij de implementatie expliciet alleen toegestane waarden accepteert.
- Ongeldige `limit` of `offset` geeft `400 Bad Request`.
- Lege registry geeft `200 OK` met lege `data`.
- Response bevat geen databaseconnectiongegevens.

### `GET /api/monitoring/outbound-messages`

Verwachte queryparameters:

| Parameter | Type | Betekenis |
| --- | --- | --- |
| `status` | tekst | Berichtstatus, bijvoorbeeld `sent`, `failed`, `queued`. |
| `message_type` | tekst | Type outbound bericht. |
| `provider` | tekst | Provider, bijvoorbeeld Zapier, Zoho Mail of SMTP. |
| `from` | ISO datum/timestamp | Inclusieve start op `message_time`. |
| `to` | ISO datum/timestamp | Exclusieve eindgrens op `message_time`. |
| `q` | tekst | Zoekterm voor ontvanger, subject, entity, foutmelding of flow. |
| `limit` | integer | Standaard 100, maximaal 500. |
| `offset` | integer | Standaard 0. |

Verwachte responsevorm:

```json
{
  "data": [
    {
      "id": 1,
      "messageTime": "2026-06-02T10:10:00.000Z",
      "messageType": "test_notification",
      "provider": "Zapier",
      "recipientEmail": "student@example.invalid",
      "subject": "TEST DATA - upload approved",
      "status": "sent",
      "relatedEventId": 1,
      "relatedEntityType": "photo_uploads_review",
      "relatedEntityId": "test-upload-001",
      "externalLink": null,
      "errorMessage": null,
      "event": {
        "category": "academy/upload",
        "severity": "orange",
        "status": "needs_review",
        "flowName": "TEST - Academy upload review monitor",
        "actionRequired": true
      }
    }
  ],
  "meta": {
    "limit": 100,
    "offset": 0,
    "readOnly": true
  }
}
```

Relevante SQL `SELECT`:

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

Foutscenario's:

- Onbekende provider geeft lege `data`.
- Ongeldige datumrange geeft `400 Bad Request`.
- Outbound message zonder gekoppeld event blijft zichtbaar met `event: null`.
- Geen secrets, providercredentials of databasegegevens in response.

## 4. Testdatabase

De API-testfase gebruikt uitsluitend:

- Provider: Aiven PostgreSQL
- Database: `ptb_monitoring_test`
- Schema: `monitoring`
- Tabellen:
  - `monitoring.automation_events`
  - `monitoring.outbound_messages`
  - `monitoring.automation_registry`

Niet toegestaan:

- Testen tegen Aiven `defaultdb`.
- Testen tegen productie.
- Productieconnection strings gebruiken.
- Productiedata kopieren naar responses of testlogs.
- SQL uitvoeren vanuit dit documentatie-only werk.

De environment variable voor toekomstige API-tests is:

```text
MONITORING_DATABASE_URL
```

Deze variabele moet later naar `ptb_monitoring_test` wijzen. De volledige waarde mag nooit in logs, responses, screenshots of documentatie terechtkomen.

## 5. Beveiliging

Te testen beveiligingsregels:

- API is read-only.
- Alleen SQL `SELECT` is toegestaan.
- Geen `INSERT`, `UPDATE`, `DELETE`, `DROP` of `ALTER`.
- Gebruik later bij voorkeur een read-only database user met alleen `SELECT` op `monitoring.*`.
- API mag niet publiek openstaan.
- Basic Auth via Netlify Edge Function beschermt zowel `frontend/automation-dashboard/` als `/api/monitoring/*`.
- API geeft geen data terug zonder geldige Basic Auth.
- `MONITORING_DATABASE_URL` wordt alleen server-side gebruikt.
- Geen secrets, connection strings, databasehost, databaseuser, stacktraces of ruwe SQL in responses.
- Monitoringresponses krijgen geen publieke cacheheaders; bij voorkeur `Cache-Control: no-store`.
- CORS blijft same-origin of gesloten.
- Requestlimieten beschermen zoekroutes tegen onnodig zware queries.

## 6. Te testen filters

Deze filters moeten minimaal getest worden:

| Filter | Queryparameter | Verwachte routes |
| --- | --- | --- |
| Severity | `severity` | `summary`, `events`, `actions` |
| Status | `status` | `events`, `actions`, `registry`, `outbound-messages` |
| Category | `category` | `summary`, `events`, `actions`, `registry` |
| Source system | `source_system` | `summary`, `events`, `actions`, `registry` |
| Action required | `action_required` | `summary`, `events`; `actions` impliceert altijd `true` |
| Date range | `from`, `to` | `summary`, `events`, `actions`, `outbound-messages` |
| Search term | `q` | `events`, `actions`, `registry`, `outbound-messages` |

Filtertestcases:

- Zonder filters: route retourneert standaardresultaat.
- Exacte match op `severity=red`.
- Exacte match op `severity=orange`.
- Exacte match op `status=failed`.
- Exacte match op `category=academy/upload`.
- Exacte match op `source_system=Zapier`.
- Boolean parsing voor `action_required=true`.
- Ongeldige boolean voor `action_required=maybe`.
- Datumrange met alleen `from`.
- Datumrange met alleen `to`.
- Datumrange met `from` en `to`.
- Ongeldige datum.
- Zoekterm op `entity_id`.
- Zoekterm op `customer_email`.
- Zoekterm op `summary`.
- Zoekterm zonder resultaten.

## 7. Verwachte smoke-testdata

De migration is succesvol getest op `ptb_monitoring_test`. Verwachte rijenaantallen uit de smoke-test:

| Tabel | Verwacht aantal rijen |
| --- | ---: |
| `monitoring.automation_registry` | 1 |
| `monitoring.automation_events` | 2 |
| `monitoring.outbound_messages` | 1 |

Verwachte signalen:

- Minimaal 1 registry row met `flow_name` die begint met `TEST -`.
- Minimaal 1 oranje academy upload event met `action_required = true`.
- Minimaal 1 rood workflow/audit event met `status = 'failed'`.
- Minimaal 1 outbound message gekoppeld aan het academy upload event.

De API-tests mogen deze data alleen lezen. Tests mogen de smoke-testdata niet opschonen, aanvullen of corrigeren.

## 8. Handmatige curl-tests voor later

Deze voorbeelden zijn bedoeld voor later, nadat de API-routes bestaan. Gebruik een lokale of test-URL en geldige Basic Auth. Zet geen echte credentials in documentatie of terminalgeschiedenis die gedeeld wordt.

```bash
curl -i -u "$BASIC_AUTH_USER:$BASIC_AUTH_PASSWORD" \
  "http://localhost:8888/api/monitoring/summary"
```

```bash
curl -i -u "$BASIC_AUTH_USER:$BASIC_AUTH_PASSWORD" \
  "http://localhost:8888/api/monitoring/events?severity=red&action_required=true"
```

```bash
curl -i -u "$BASIC_AUTH_USER:$BASIC_AUTH_PASSWORD" \
  "http://localhost:8888/api/monitoring/events?category=academy%2Fupload&q=test-upload-001"
```

```bash
curl -i -u "$BASIC_AUTH_USER:$BASIC_AUTH_PASSWORD" \
  "http://localhost:8888/api/monitoring/actions?status=failed"
```

```bash
curl -i -u "$BASIC_AUTH_USER:$BASIC_AUTH_PASSWORD" \
  "http://localhost:8888/api/monitoring/registry?status=test"
```

```bash
curl -i -u "$BASIC_AUTH_USER:$BASIC_AUTH_PASSWORD" \
  "http://localhost:8888/api/monitoring/outbound-messages?status=sent"
```

```bash
curl -i -u "$BASIC_AUTH_USER:$BASIC_AUTH_PASSWORD" \
  "http://localhost:8888/api/monitoring/outbound-messages?q=student%40example.invalid"
```

Negatieve handmatige tests:

```bash
curl -i "http://localhost:8888/api/monitoring/summary"
```

Verwacht: geen monitoringdata zonder Basic Auth.

```bash
curl -i -u "$BASIC_AUTH_USER:$BASIC_AUTH_PASSWORD" \
  -X POST "http://localhost:8888/api/monitoring/events"
```

Verwacht: `405 Method Not Allowed` of route niet gevonden, geen databasewrite.

```bash
curl -i -u "$BASIC_AUTH_USER:$BASIC_AUTH_PASSWORD" \
  "http://localhost:8888/api/monitoring/events?action_required=maybe"
```

Verwacht: `400 Bad Request`.

## 9. Fouttests

### Ontbrekende database env var

Setup later:

- Start API zonder `MONITORING_DATABASE_URL`.

Verwachting:

- Route faalt gesloten.
- Response is `500` of `503`.
- Geen connection string of stacktrace in response.
- Logmelding is bruikbaar maar bevat geen secret.

### Verkeerde database env var

Setup later:

- Zet `MONITORING_DATABASE_URL` naar een niet-bestaande testdatabase of naar een expliciet geblokkeerde waarde.
- Gebruik nooit productie of `defaultdb` om deze test te bewijzen.

Verwachting:

- API weigert verbinding of faalt veilig.
- Response bevat geen host, user, wachtwoord of ruwe driverfout.
- Als implementatie database-naamvalidatie bevat, moet een niet-testdatabase direct worden geweigerd.

### Database niet bereikbaar

Setup later:

- Simuleer netwerkfout, verkeerde poort of tijdelijk onbereikbare testdatabase.

Verwachting:

- Response is `503 Service Unavailable`.
- Timeout is begrensd.
- Geen langdurig hangende request.
- Geen secretlekkage.

### Lege resultaten

Setup later:

- Gebruik filters die geen rows matchen, bijvoorbeeld een niet-bestaande categorie.

Verwachting:

- Response is `200 OK`.
- `data` is een lege array of tellingen zijn `0`.
- Dit is geen serverfout.

### Ongeldige query parameter

Voorbeelden:

- `action_required=maybe`
- `from=geen-datum`
- `to=geen-datum`
- `limit=-1`
- `limit=999999`
- `offset=-5`

Verwachting:

- Response is `400 Bad Request`.
- Error heeft een veilige, korte melding.
- Ongeldige input komt niet in SQL terecht.

## 10. Acceptatiecriteria voordat koppeling aan dashboard mag

De API mag pas aan `frontend/automation-dashboard/` gekoppeld worden als:

- Alle vijf geplande `GET` routes bestaan en handmatig getest zijn tegen `ptb_monitoring_test`.
- Alle routes alleen `SELECT` queries gebruiken.
- `POST`, `PUT`, `PATCH` en `DELETE` geen data kunnen wijzigen.
- De API beschermd is met Basic Auth of dezelfde effectieve toegangspoort als het dashboard.
- Routes zonder geldige Basic Auth geen monitoringdata teruggeven.
- `MONITORING_DATABASE_URL` server-side blijft en niet in browsercode of responses verschijnt.
- De databaseverbinding naar `ptb_monitoring_test` wijst, niet naar `defaultdb` of productie.
- Fouttests voor ontbrekende env var, verkeerde env var en onbereikbare database veilig falen.
- Filters voor severity, status, category, source_system, action_required, date range en search term werken.
- Lege resultaten geldige lege responses opleveren.
- Responses een stabiele JSON-vorm hebben die het dashboard kan consumeren.
- PII-velden zoals `customer_email` bewust en alleen achter interne auth worden teruggegeven.
- Er een review is geweest op querylimieten, cacheheaders en error responses.

## 11. Wat absoluut niet gedaan mag worden

Tijdens deze testplanfase en de latere read-only API-testfase mag het volgende niet gebeuren:

- Geen SQL uitvoeren vanuit deze documentatietaak.
- Geen echte API-routes bouwen in deze stap.
- Geen frontendbestanden wijzigen in deze stap.
- `server.js` niet wijzigen in deze stap.
- Geen database wijzigen.
- Niet testen tegen Aiven `defaultdb`.
- Niet testen tegen productie.
- Geen productieconnection string gebruiken.
- Geen `INSERT`, `UPDATE`, `DELETE`, `DROP` of `ALTER`.
- Geen testdata toevoegen, wijzigen of verwijderen.
- Geen Basic Auth omzeilen.
- Geen database secrets loggen of in responses tonen.
- Geen API publiek openzetten.
- Niet pushen naar `main`.
- Niet direct pushen naar `staging`.
- Niet automatisch committen.

## 12. Aanbevolen volgende branch

Aanbevolen volgende branch na dit testplan:

```text
feature/monitoring-readonly-api-contract
```

Doel van die branch:

- JSON responsecontracten per route definitief documenteren.
- PII-velden expliciet markeren.
- Error responsevormen vastleggen.
- Nog steeds geen frontend koppelen en geen databasewrites toevoegen.

Daarna kan een aparte implementatiebranch volgen, bijvoorbeeld:

```text
feature/monitoring-readonly-api-routes
```

Die branch mag pas starten nadat dit testplan en het responsecontract gereviewd zijn.
