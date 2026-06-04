# Zap 172 heartbeat monitoring plan

Datum: 2026-06-04

Doel: de eerste echte automatische monitoring-event vanuit Zapier naar `monitoring.automation_events` laten schrijven, veilig en alleen in `ptb_monitoring_test`.

Pilot workflow:

- `zap_172`
- `Webhooks by Zapier`

Belangrijk: dit plan voert geen SQL uit, wijzigt geen database en bevat geen secrets.

## Waarom zap_172 de eerste pilot is

`zap_172 · Webhooks by Zapier` is een goede eerste pilot omdat deze workflow in de registry staat als een compacte webhookflow met beperkte systemen: `WebHook`, `FilterAPI` en `ZohoMail`.

De flow is geschikt als heartbeat omdat:

- een webhookflow meestal een duidelijk beginpunt heeft;
- de registry al aangeeft dat endpoint/response monitoring nodig is;
- het event geen klantdata nodig heeft;
- het dashboard kan tonen dat een echte Zapier-run een monitoringregel schrijft;
- de event payload eenvoudig en herbruikbaar is voor andere workflows.

Dit is bewust een groene heartbeat, geen failure-monitoring. Failure-events kunnen later als tweede patroon worden toegevoegd.

## Waar de monitoringstap in de Zap komt

Voeg de monitoringstap aan het einde van de Zap toe, nadat de primaire webhook/filter/mail-logica succesvol is doorlopen.

Aanbevolen plaats:

1. Bestaande trigger: Webhooks by Zapier.
2. Bestaande filter/logica.
3. Bestaande Zoho Mail of vervolgactie.
4. Nieuwe monitoringstap: PostgreSQL heartbeat insert.

Als de Zap meerdere paths heeft, plaats de heartbeat alleen in het success-pad dat echt betekent dat de workflow gezond is doorlopen. Voor error- of fallback-paden komt later een apart rood/oranje eventpatroon.

## Toe te voegen Zapier-stap

Toe te voegen actie:

- App: PostgreSQL by Zapier.
- Action event: Find Row via Custom Query.
- Query: gebruik `docs/sql/004_monitoring_zap172_heartbeat_template.sql`.

Waarom `Find Row via Custom Query`: Eamonn gebruikt deze Zapier-actie al vaak, ook voor writes met `RETURNING`. De template gebruikt daarom een `INSERT ... RETURNING` query die Zapier als resultaat kan tonen.

## Zapier mappingvelden

Minimaal te mappen waarden:

| Placeholder | Waarde in Zapier | Opmerking |
| --- | --- | --- |
| `{{allow_write}}` | `false` tijdens setup/test, alleen `true` bij expliciet akkoord | Extra guard zodat Zapier test-runs standaard niets schrijven. |
| `{{zapier_run_id}}` | Zapier run/task id als beschikbaar | Als niet beschikbaar, gebruik een timestamp of Zap meta value. |
| `{{zapier_fallback_timestamp}}` | Zap meta timestamp, bijvoorbeeld human now of run time | Fallback voor dedupe/debug. |
| `{{trigger_source}}` | webhook, filter, path of bronnaam | Bijvoorbeeld `webhook_success_path`. |
| `{{inserted_by}}` | vaste tekst `zapier:z172` | Geen persoonlijke secret of credential. |

De vaste workflowwaarden blijven in de SQL-template staan:

- `workflow_id`: `zap_172`
- `workflow_name`: `Webhooks by Zapier`
- `category`: `workflow/heartbeat`
- `severity`: `green`
- `status`: `ok`
- `entity_id`: `zap_172`
- `summary`: `Webhooks by Zapier heartbeat received`
- `action_required`: `false`
- `customer_email`: `null`
- `error_message`: `null`

## Waarden in monitoring.automation_events

De eventregel schrijft naar deze kolommen:

- `event_time`: `now()`
- `category`: `workflow/heartbeat`
- `severity`: `green`
- `status`: `ok`
- `source_system`: `Zapier`
- `flow_name`: `Webhooks by Zapier`
- `entity_type`: `workflow`
- `entity_id`: `zap_172`
- `customer_email`: `null`
- `changed_fields`: JSONB met workflow/run metadata
- `summary`: `Webhooks by Zapier heartbeat received`
- `action_required`: `false`
- `external_link`: optioneel `null`
- `error_message`: `null`

`changed_fields` bevat minimaal:

- `workflow_id`
- `workflow_name`
- `zapier_run_id`
- `fallback_timestamp`
- `trigger_source`
- `inserted_by`

## Hoe het dashboard dit toont

Na een echte insert:

- De live summary telt `automation_events` omhoog.
- Het heartbeat-event is groen en heeft `action_required = false`.
- Het event verschijnt niet in de openstaande acties, omdat die endpoint alleen actie-events met `action_required = true` toont.
- Het event kan later zichtbaar worden in een aparte events/timeline-sectie of in summary-trends.

Voor deze pilot is dat gewenst: het doel is bewijs dat Zapier automatisch naar de monitoringtabel kan schrijven, zonder extra open actie te veroorzaken.

## Duplicaten en test-runs voorkomen

De SQL-template heeft drie guards:

1. Databaseguard:
   - schrijft alleen als `current_database() = 'ptb_monitoring_test'`.
2. Zapier write-guard:
   - schrijft alleen als `{{allow_write}} = 'true'`.
   - tijdens Zapier setup/test blijft deze waarde `false`.
3. Dedupe-window:
   - schrijft geen tweede heartbeat met dezelfde `entity_id`, `summary` en `zapier_run_id` binnen 10 minuten.
   - als geen run id beschikbaar is, valt dedupe terug op de fallback timestamp.

Daardoor kan de query veilig in Zapier getest worden zonder dat een write gebeurt.

## Rollback en controle

Voor setup:

1. Zet `allow_write` op `false`.
2. Test de Zapier Custom Query.
3. Verwachte uitkomst: geen insert, geen returned row.

Voor gecontroleerde test in `ptb_monitoring_test`:

1. Controleer dat de PostgreSQL connection naar `ptb_monitoring_test` wijst.
2. Zet `allow_write` tijdelijk op `true`.
3. Run de Zap eenmalig bewust.
4. Controleer via dashboard summary dat `automation_events` met 1 stijgt.
5. Controleer met een SELECT-only query dat `entity_id = 'zap_172'` en `summary = 'Webhooks by Zapier heartbeat received'` aanwezig zijn.
6. Zet `allow_write` terug naar de gewenste productiestand voor de pilot.

Rollback bij fout:

- Verwijder alleen de specifieke heartbeatregel(s) voor `entity_id = 'zap_172'` en summary `Webhooks by Zapier heartbeat received`, na expliciete review.
- Gebruik geen TRUNCATE.
- Raak geen registry of outbound messages aan.

## Herbruikbaar voor andere workflows

Dit patroon kan later worden hergebruikt voor:

- `zap_1` en `zap_15` certificaatflow heartbeat.
- `zap_124` Monthly Tree Report heartbeat.
- `zap_129` Forest Hero outbound heartbeat.
- `zap_175` Zoho CRM onboarding heartbeat.

Per workflow hoeven vooral deze waarden te wijzigen:

- `workflow_id`
- `workflow_name`
- `entity_id`
- `trigger_source`
- eventueel `category`
- eventueel `summary`

De guards blijven hetzelfde: testdatabase, `allow_write`, en dedupe-window.
