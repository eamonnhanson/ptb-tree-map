# Monitoring database smoke test result

## Doel

Dit document legt het resultaat vast van de eerste smoke test van de migration
`docs/sql/001_monitoring_datamodel.sql`.

## Testomgeving

- Provider: Aiven PostgreSQL
- Database: `ptb_monitoring_test`
- User: `avnadmin`
- Port: `14296`
- Niet uitgevoerd op `defaultdb`
- Niet uitgevoerd op productie

## Uitgevoerde migration

- Migration: `docs/sql/001_monitoring_datamodel.sql`
- Schema aangemaakt: `monitoring`
- Tabellen aangemaakt:
  - `monitoring.automation_events`
  - `monitoring.automation_registry`
  - `monitoring.outbound_messages`

## Rijenaantallen na test

| Tabel | Aantal rijen |
| --- | ---: |
| `automation_registry` | 1 |
| `automation_events` | 2 |
| `outbound_messages` | 1 |

## Indexcontrole

- 14 indexen gevonden in schema `monitoring`
- Indexen aanwezig op:
  - `automation_events`
  - `automation_registry`
  - `outbound_messages`

## Foreign key controle

`monitoring.outbound_messages.related_event_id` verwijst correct naar
`monitoring.automation_events.id`.

Testresultaat:

| Veld | Waarde |
| --- | --- |
| `outbound_message_id` | 1 |
| `related_event_id` | 1 |
| `automation_event_id` | 1 |
| `entity_id` | `test-upload-001` |

## Conclusie

- Smoke test geslaagd.
- Migration is bruikbaar voor een volgende gecontroleerde teststap.
- Nog niet uitvoeren op Aiven `defaultdb` of productie zonder backup,
  hostcontrole en expliciet akkoord.
