# Monitoring database test plan

Datum: 2026-06-02

Doel: veilig bepalen hoe `docs/sql/001_monitoring_datamodel.sql` getest kan worden voordat deze migration ooit op productie wordt uitgevoerd.

Belangrijk: dit plan voert geen SQL uit. Het beschrijft alleen hoe de migration veilig getest moet worden.

## 1. Voorwaarden voordat de SQL wordt uitgevoerd

Controleer vooraf:

- Je werkt niet op `main`.
- Je werkt niet direct op `staging`.
- Je gebruikt niet de productie-PostgreSQL connection string.
- De migration is ongewijzigd en komt uit `docs/sql/001_monitoring_datamodel.sql`.
- De migration bevat alleen nieuwe monitoringtabellen:
  - `monitoring.automation_events`
  - `monitoring.outbound_messages`
  - `monitoring.automation_registry`
- De migration maakt alleen een nieuw schema aan met `CREATE SCHEMA IF NOT EXISTS monitoring`.
- Er staan geen actieve `DROP`, `ALTER` of `DELETE` statements in het uit te voeren deel.
- De rollbacksectie blijft volledig uitgecommentarieerd.
- Er is een recente backup of snapshot als er op een gedeelde testdatabase wordt gewerkt.
- De testdatabase of het testschema bevat geen productiegegevens die niet nodig zijn voor deze test.
- De uitvoerder heeft alleen de minimale rechten die nodig zijn om nieuwe tabellen en indexen te maken.

## 2. Controleren dat we niet op productie werken

Voer deze checks uit voordat `psql` of een database client wordt gebruikt:

1. Controleer de databasehost en database naam in de connection string.
2. Controleer dat de host niet de productiehost is.
3. Controleer dat de database naam expliciet test, staging, sandbox of local bevat.
4. Controleer dat `NODE_ENV`, Netlify context of lokale shell niet naar productie verwijst.
5. Controleer in PostgreSQL:

```sql
select current_database(), current_user, inet_server_addr(), inet_server_port();
```

6. Controleer eventueel of productie-only tabellen of grote aantallen ontbreken:

```sql
select table_schema, table_name
from information_schema.tables
where table_name in ('automation_events', 'outbound_messages', 'automation_registry')
order by table_schema, table_name;
```

Als er twijfel is: niet uitvoeren.

## 3. Aanbevolen testomgeving

Voorkeursvolgorde:

1. Aparte Aiven testdatabase zonder productiegegevens.
2. Aparte lokale PostgreSQL database.
3. Apart `monitoring` schema in een gedeelde testdatabase.

Voer de migration niet direct uit op Aiven `defaultdb` zonder backup, hostcontrole en expliciet akkoord. Als `defaultdb` productie of productie-achtig is, moet eerst een aparte testdatabase worden gebruikt.

### Optie A: aparte Aiven testdatabase

Aanbevolen voor de eerste cloudtest.

Voordelen:

- Zelfde provider als de vermoedelijke productieomgeving.
- Geen risico voor productie- of stagingdata.
- Geschikt om Aiven-specifieke rechten, SSL en connection strings te valideren.

Voorbeeldnaam:

- `ptb_tree_map_monitoring_test`

### Optie B: lokale PostgreSQL database

Geschikt voor een eerste syntax- en idempotentietest.

Voordelen:

- Geen risico voor gedeelde data.
- Snel opnieuw te maken.
- Geschikt om syntax, tabellen, indexen, testdata en foreign keys te controleren.

Voorbeeldnaam:

- `ptb_monitoring_test`

### Optie C: apart schema in een gedeelde testdatabase

Alleen gebruiken als een aparte Aiven testdatabase of lokale database niet beschikbaar is.

Voorbeeldschema:

- `monitoring`

De migration gebruikt expliciete schema-prefixes en maakt `monitoring` zelf aan met `CREATE SCHEMA IF NOT EXISTS monitoring;`. Er is dus geen `search_path` nodig.

## 4. SQL veilig uitvoeren

Aanbevolen stappen:

1. Open een nieuwe terminal of database client.
2. Zet expliciet de testdatabase connection string.
3. Controleer met `select current_database()` dat je in de juiste omgeving zit.
4. Start met een dry read van het bestand:

```bash
type docs\sql\001_monitoring_datamodel.sql
```

5. Voer de migration uit via een testdatabase:

```bash
psql "%TEST_DATABASE_URL%" -f docs/sql/001_monitoring_datamodel.sql
```

6. Sla de output op voor review:

```bash
psql "%TEST_DATABASE_URL%" -f docs/sql/001_monitoring_datamodel.sql > monitoring_migration_test_output.txt 2>&1
```

7. Voer de migration een tweede keer uit op dezelfde testdatabase om idempotentie te controleren. Door `CREATE TABLE IF NOT EXISTS` en `CREATE INDEX IF NOT EXISTS` mag dit niet falen.

8. Controleer dat de testdata niet onbedoeld dupliceert. Let op: de huidige sample inserts gebruiken `ON CONFLICT DO NOTHING`, maar zonder unieke constraints kan herhaald uitvoeren alsnog extra testevents toevoegen. Dit is acceptabel voor een smoke-test, maar moet in de testoutput worden genoteerd.

## 5. Controles na uitvoering

### Tabellen bestaan

```sql
select table_name
from information_schema.tables
where table_schema = 'monitoring'
  and table_name in ('automation_events', 'outbound_messages', 'automation_registry')
order by table_name;
```

Verwacht:

- `monitoring.automation_events`
- `monitoring.automation_registry`
- `monitoring.outbound_messages`

### Kolommen bestaan

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'monitoring'
  and table_name in ('automation_events', 'outbound_messages', 'automation_registry')
order by table_name, ordinal_position;
```

Controleer dat alle gevraagde velden aanwezig zijn, waaronder:

- `changed_fields jsonb`
- `fields_touched jsonb`
- `systems_used ARRAY`
- `tables_touched ARRAY`
- `github_files ARRAY`
- `related_event_id bigint`

### Indexes bestaan

```sql
select tablename, indexname
from pg_indexes
where schemaname = 'monitoring'
  and tablename in ('automation_events', 'outbound_messages', 'automation_registry')
order by tablename, indexname;
```

Verwachte indexen:

- `idx_automation_events_event_time`
- `idx_automation_events_category`
- `idx_automation_events_severity`
- `idx_automation_events_action_required`
- `idx_automation_events_customer_email`
- `idx_outbound_messages_message_time`
- `idx_outbound_messages_recipient_email`
- `idx_outbound_messages_status`
- `idx_automation_registry_flow_name`
- `idx_automation_registry_category`
- `idx_automation_registry_status`

### Testdata-inserts aanwezig

```sql
select id, flow_name, category, status
from monitoring.automation_registry
where flow_name like 'TEST -%';

select id, category, severity, status, entity_id, action_required
from monitoring.automation_events
where summary like 'TEST DATA -%'
order by id;

select id, message_type, provider, recipient_email, subject, related_event_id
from monitoring.outbound_messages
where subject like 'TEST DATA -%';
```

Verwacht:

- minimaal 1 registry testrow;
- minimaal 2 automation event testrows;
- minimaal 1 outbound message testrow.

### Foreign keys werken

Controleer de bestaande relatie:

```sql
select outbound.id as outbound_message_id,
       outbound.related_event_id,
       event.id as automation_event_id,
       event.entity_id
from monitoring.outbound_messages outbound
left join monitoring.automation_events event
  on event.id = outbound.related_event_id
where outbound.subject like 'TEST DATA -%';
```

Verwacht:

- `related_event_id` verwijst naar een bestaande `monitoring.automation_events.id`.

Controleer dat een ongeldige foreign key faalt in een transaction die wordt teruggedraaid:

```sql
begin;

insert into monitoring.outbound_messages (
  message_type,
  related_event_id,
  status
) values (
  'fk_test_should_fail',
  -999999,
  'sent'
);

rollback;
```

Verwacht:

- PostgreSQL weigert de insert vanwege de foreign key.
- De transaction wordt teruggedraaid.

## 6. Rollback-procedure

Gebruik rollback alleen in een gecontroleerde testomgeving.

Voorkeursrollback voor smoke-testdata:

```sql
begin;

delete from monitoring.outbound_messages
where related_entity_id in ('test-upload-001', 'test-workflow-001')
   or subject like 'TEST DATA -%';

delete from monitoring.automation_events
where entity_id in ('test-upload-001', 'test-workflow-001')
   or summary like 'TEST DATA -%';

delete from monitoring.automation_registry
where flow_name like 'TEST -%';

commit;
```

Volledige rollback van de nieuwe monitoringtabellen alleen in een testomgeving:

```sql
begin;

drop table if exists monitoring.outbound_messages;
drop table if exists monitoring.automation_events;
drop table if exists monitoring.automation_registry;
drop schema if exists monitoring;

commit;
```

Niet gebruiken op productie zonder expliciet akkoord en backup/snapshot.

## 7. Wat absoluut niet gedaan mag worden

- De migration uitvoeren op productie.
- De migration direct op Aiven `defaultdb` uitvoeren zonder backup, hostcontrole en expliciet akkoord.
- De production `DATABASE_URL` gebruiken.
- `DROP`, `ALTER` of `DELETE` uitvoeren op bestaande business tables.
- Existing tables zoals `users1`, `trees1`, `photo_uploads_review`, `academy_students` of `academy_point_events` aanpassen.
- Testdata met echte klant- of studentgegevens invoegen.
- Secrets, API keys, webhook secrets of admin keys in de monitoringtabellen opslaan.
- De rollbacksectie uit de migration ongecontroleerd activeren.
- De SQL uitvoeren vanuit een omgeving waarvan databasehost of database naam onbekend is.
- De dashboardfrontend of bestaande tree map aanpassen in deze fase.

## 8. Latere loggingbronnen

Na goedkeuring van het testplan kunnen deze gegevens later worden gelogd:

### Zapier

- Workflowrun gestart/geslaagd/gefaald.
- `flow_name`, Zapier task/run id, trigger event, foutmelding.
- Eindstatus van workflows uit `master_workflow_registry.md`.
- Manual follow-up signalen wanneer bewijs ontbreekt.
- Webhook delivery naar approval/outbound flows.

### Shopify

- Nieuwe betaalde order.
- SKU/product-id.
- Klant-email.
- Of tree allocation verwacht is.
- Of gift claim token of certificate verwacht is.
- Follow-up nodig bij missende allocation/outbound evidence.

### Zoho Mail

- Outbound mails die als bewijs dienen.
- Manual follow-up folders/tags.
- Message id, subject, recipient, send status.
- Mails die niet aan bron-events gekoppeld kunnen worden.

### Zoho Creator

- Certificaat- of evidence records.
- Creator record id.
- Status van certificate/tree allocation records.
- Fouten of ontbrekende jobstatussen.

### PostgreSQL

- Nieuwe of gewijzigde rows in `photo_uploads_review`.
- Academy upload statuswijzigingen.
- Nieuwe `academy_point_events`.
- Tree allocation signalen uit `trees1` en `v_user_trees`.
- Users met subscription status maar ontbrekende tree allocation.
- AI description failures en pending review SLA-breaches.

## 9. Logische volgende branch/commit

Aanbevolen volgende branch:

- `feature/monitoring-database-smoke-test`

Aanbevolen commit na goedkeuring van dit testplan:

- `Add monitoring database test plan`

Daarna pas:

1. Testdatabase aanmaken.
2. `001_monitoring_datamodel.sql` uitvoeren op testdatabase.
3. Testoutput documenteren.
4. Eventuele migration-aanpassingen op een aparte vervolgbranch doen.

