# Kritieke workflows in workflow maintenance

## Doel en scope

De workflow-maintenancepagina toont drie kritieke workflows vanuit dezelfde
`monitoring.workflow_registry` en `monitoring.workflow_dependencies` die de rest
van workflow maintenance gebruiken:

- `zap_95`: Chargebee payment naar PostgreSQL MVP;
- `shopify_monthly_donation_subscription_payment`: Shopify subscriptions naar
  tree allocation;
- `zap_175`: Zoho CRM Academy onboarding → PostgreSQL.

Dit is geen tweede monitoringarchitectuur en geen live-statuspagina. De kaarten
lezen de bestaande read-only `workflow-maintenance` API. Runtime-uitvoeringen
blijven thuishoren in `monitoring.automation_events` en
`monitoring.outbound_messages`.

## Statusregels

| Status | Regel |
|---|---|
| `GREEN` | De registry heeft status `implemented`, een `last_tested_at` en een PostgreSQL dependency met de verwachte source-controlled SQL-evidence. Dit bewijst nog niet dat een Zap nu actief is. |
| `ORANGE` | De verwachte directe PostgreSQL SQL-evidence bestaat, maar de registry bewijst geen geïmplementeerde én geteste toestand. Review-only migraties vallen hieronder. |
| `RED` | De maintenance registry markeert de workflow expliciet als `failed` of `blocked`. |
| `UNKNOWN` | De registryrij of directe PostgreSQL-definitie ontbreekt. Zapier-export, veldnamen of een queryreferentie alleen gelden niet als PostgreSQL-implementatiebewijs. |

Voor Academy geldt bovendien een runtime-gate: de workflow mag pas `GREEN`
worden nadat een nieuwe succesvolle post-change completion in
`public.academy_onboarding_completions` is aangetoond. Het bestaan van de
productie-completionlaag alleen is daarvoor onvoldoende.

De huidige repository-evidence resulteert na toepassing van registry-migratie
019 in:

- Chargebee: `ORANGE`, vanwege review-only SQL 014;
- Shopify subscriptions: `ORANGE`, vanwege review-only SQL 011;
- Academy onboarding: `ORANGE`. De Zap, de source-controlled processor en de
  productie-completionlaag bestaan, maar een nieuwe succesvolle post-change
  runtime completion is nog niet aangetoond.

Zonder een bereikbare registry-API toont de pagina geen gefingeerde fallbackstatus.
De ORANGE Academy-regel in `frontend/automation-dashboard/app.js` is uitsluitend
statische fallback-inventory. De gezaghebbende kritieke workflowstatus wordt
registry-first afgeleid in de workflow-maintenanceview.

## Chargebee business dependencies

Migratie 019 registreert de aangeleverde businessketen: New Payment, Find
Existing Subscription, invoice-linevalidatie, de PostgreSQL-processor, de twee
businesspaden, allocation notification, Pythontransformatie, Writer merge/send
en het vastleggen van voltooide side effects.

De technische Code by Zapier-actie na de laatste PostgreSQL-stap is uitsluitend
een publicatievereiste van Zapier. Zij heeft geen businessinput of -output en is
daarom bewust niet opgenomen in `monitoring.workflow_dependencies`.

## PostgreSQL-evidencegrens

- SQL 011 en SQL 014 zijn source-controlled ontwerp- en test-evidence. De
  dashboardstatus noemt ze review-only totdat deployment en een gecontroleerde
  testdatum afzonderlijk in de registry zijn vastgelegd.
- Voor `zap_175` documenteert migratie 020 de bestaande productie-completionlaag.
  Migratie 021 bewaart de bestaande productieprocessor als source-controlsnapshot
  en behoudt diens `SET search_path TO 'public'` ongewijzigd.
  Stap 8 ontvangt Zoho CRM Record Id als `p_zoho_contact_id`, stap 4 Ketso
  Student Id als `p_ketso_student_id` en momenteel `NULL` voor alle drie externe
  IDs. Een completionrecord bewijst dat alle voorgaande Zap-actions succesvol
  zijn doorlopen, maar bewijst geen inbox delivery.
- Stap 9, **Code by Zapier - Technical no-op for Zapier publishing**, is geen
  business dependency en valt buiten de completion-evidence.
- De pagina raadpleegt geen Zapier UI, Shopify, Chargebee, Zoho of productie-DB.

## Open evidence

- Chargebee: deployment van SQL 014, testdatum, live Zap-identiteit/versie,
  definitieve path predicates, validator- en Pythonsource, Writer-template en
  provider/status-ID's.
- Shopify: deployment van SQL 011, echte Zap-ID/versie, Shopify Flow-configuratie,
  contract/orderbackfill, Writer/Creator- en CRM-mapping en side-effectbewijs.
- Academy: een nieuwe succesvolle post-change runtime completion,
  CRM-veldownership en afzonderlijk bewijs van inbox delivery wanneer dat
  vereist is.

## Bestanden

- `docs/sql/019_critical_workflows_registry.sql`: idempotente registry- en
  dependencyrecords, alleen bedoeld voor de monitoring-testdatabase.
- `netlify/functions/workflow-maintenance.js`: exposeert reeds geregistreerde
  reads/writes en evidence sources via de bestaande API.
- `frontend/automation-dashboard/workflow-maintenance/`: rendert de kaarten en
  past de conservatieve statusregels toe.
- `test/workflowMaintenanceFrontend.test.js`: controleert rendering,
  statusafleiding en uitsluiting van de technische no-op.
