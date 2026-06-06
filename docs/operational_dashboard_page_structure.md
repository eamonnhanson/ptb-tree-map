# Operational dashboard page structure

Datum: 2026-06-06

## Uitgangspunt

Het automation dashboard wordt niet georganiseerd per systeem, maar per operationeel werkgebied en operationele gebeurtenis.

Systemen zoals Shopify, Chargebee, Zapier, Zoho, PostgreSQL, Netlify, Render en GitHub zijn belangrijk, maar ze zijn niet de hoofdindeling van het dashboard. Ze zijn actors, sources, processors, storage systems, output systems of evidence systems binnen een operationele keten.

De hoofdvraag van het dashboard is dus niet: "Wat gebeurt er in Zapier?" De hoofdvraag is: "Welke operationele gebeurtenis heeft aandacht nodig, wat is de status, welk bewijs is er, en welke actie moet iemand nemen?"

## Hoofdstructuur

De hoofdstructuur bestaat uit aparte pagina's:

| Pad | Doel |
| --- | --- |
| `/automation-dashboard/` | Hoofdmenu |
| `/automation-dashboard/tree-sales/` | Plant N Boom tree sales |
| `/automation-dashboard/ketso/` | KETSO |
| `/automation-dashboard/follow-up/` | Follow-up |
| `/automation-dashboard/workflow-maintenance/` | Workflow maintenance and development |

Elke hoofdknop op het hoofdmenu moet naar een aparte pagina leiden. Hoofdknoppen mogen niet naar een hash-sectie op dezelfde pagina leiden.

Elke subpagina krijgt een duidelijke Dashboard-knop of Dashboard-icoon dat terugleidt naar:

`/automation-dashboard/`

## Pagina's En Subsecties

### `/automation-dashboard/`

Het hoofdmenu toont vier hoofdingangen:

- Plant N Boom tree sales
- KETSO
- Follow-up
- Workflow maintenance and development

Deze pagina is bedoeld als navigatiehub, niet als volledige operationele werklijst.

### `/automation-dashboard/tree-sales/`

Plant N Boom tree sales bevat de operationele signalen rond aankopen, boomtoewijzing, klantcommunicatie en certificaten.

Subsecties:

- Tree allocated
- Purchases requiring follow-up
- Outbound emails and certificates

### `/automation-dashboard/ketso/`

KETSO bevat de operationele signalen rond Academy uploads, goedkeuringen en fotobeheer.

Subsecties:

- Approval queue
- Photo viewer

### `/automation-dashboard/follow-up/`

Follow-up is de dagelijkse actielijst voor fouten, ontbrekende stappen en handmatige opvolging.

Subsecties:

- Errors and missing actions

### `/automation-dashboard/workflow-maintenance/`

Workflow maintenance and development bevat onderhoud, diagnose, technische inventaris en verouderde of ongebruikte onderdelen.

Subsecties:

- Diagnostics
- Workflow maintenance
- Old flows
- Unused tables
- Unused fields
- Deprecated endpoints

## Systemen Als Rollen In De Keten

Systemen worden behandeld als rollen binnen een operationele keten:

- `source_system`: waar de gebeurtenis vandaan komt.
- `processor_system`: welk systeem de gebeurtenis verwerkt of doorstuurt.
- `storage_system`: waar de status of output wordt opgeslagen.
- `output_system`: welk systeem klantcommunicatie, documenten of zichtbare output maakt.
- `evidence_system`: waar bewijs of auditdata gevonden wordt.

Een systeem kan meerdere operationele signalen veroorzaken. Een operationeel signaal kan meerdere systemen raken.

Voorbeeld:

Een Shopify-aankoop kan Zapier triggeren. Zapier kan PostgreSQL bijwerken voor boomtoewijzing. Daarna kan Zoho Creator of Zoho Writer een certificaat genereren en Zoho Mail een e-mail versturen.

Dezelfde keten kan signalen opleveren onder:

- Purchases requiring follow-up
- Tree allocated
- Outbound emails and certificates
- Errors and missing actions
- Workflow maintenance

Daarom hoort Shopify niet als losse hoofdpagina in het dashboard. Shopify is in dit voorbeeld de bron van een operationele keten. Zapier is processor, PostgreSQL is storage, Zoho Creator/Writer is document-output, Zoho Mail is communicatie-output, en het dashboard toont de operationele status per gebeurtenis.

## Eventmodel Op Hoofdlijnen

Het gewenste eventmodel moet operationele gebeurtenissen beschrijven zonder de dashboardstructuur vast te zetten op specifieke systemen.

Voorgestelde velden:

| Veld | Betekenis |
| --- | --- |
| `event_id` | Stabiele unieke id voor het event. |
| `operational_area` | Hoofdgebied, bijvoorbeeld `tree_sales`, `ketso`, `follow_up`, of `workflow_maintenance`. |
| `operational_event_type` | Type gebeurtenis, bijvoorbeeld `tree_allocated`, `purchase_requires_follow_up`, `approval_needed`, of `deprecated_endpoint_used`. |
| `primary_entity_type` | Hoofdobject, bijvoorbeeld `order`, `tree`, `student_upload`, `workflow`, of `endpoint`. |
| `primary_entity_id` | Id van het hoofdobject. |
| `source_system` | Systeem waar de gebeurtenis ontstaat. |
| `processor_system` | Systeem dat de gebeurtenis verwerkt. |
| `storage_system` | Systeem of database waar status of output wordt opgeslagen. |
| `output_system` | Systeem dat e-mail, document, certificaat of andere output maakt. |
| `status` | Operationele status, bijvoorbeeld `ok`, `needs_review`, `missing_evidence`, `failed`, of `resolved`. |
| `needs_follow_up` | Boolean die bepaalt of het event op de Follow-up pagina verschijnt. |
| `related_workflow_id` | Link naar workflow maintenance of registry id. |
| `last_seen_at` | Laatste moment waarop dit signaal gezien of bijgewerkt is. |
| `evidence_url` | Link naar bewijs, bronexport, dashboarddetail of extern systeem. |
| `notes` | Korte audit- of opvolgnotities. |

## Migratiestrategie

### Fase 1: documentatie vastleggen

Leg deze pagina- en informatiestructuur vast in documentatie. Er worden nog geen frontend-, backend-, SQL- of Netlify Function-wijzigingen gedaan.

### Fase 2: hoofdmenu maken met vier tegels

Maak `/automation-dashboard/` een hoofdmenu met vier duidelijke tegels:

- Plant N Boom tree sales
- KETSO
- Follow-up
- Workflow maintenance and development

### Fase 3: workflow maintenance verplaatsen naar eigen pagina

Verplaats workflow maintenance van een sectie binnen het dashboard naar:

`/automation-dashboard/workflow-maintenance/`

### Fase 4: KETSO onderdelen naar eigen pagina verplaatsen

Verplaats Approval queue en Photo viewer naar:

`/automation-dashboard/ketso/`

### Fase 5: plant N Boom tree sales pagina opbouwen

Bouw de tree sales pagina met:

- Tree allocated
- Purchases requiring follow-up
- Outbound emails and certificates

### Fase 6: follow-up pagina opbouwen als dagelijkse actielijst

Bouw `/automation-dashboard/follow-up/` als operationele actielijst voor:

- fouten;
- ontbrekende acties;
- events met `needs_follow_up = true`;
- open reviews of ontbrekend bewijs.

### Fase 7: eventmodel en endpoints verbeteren

Verbeter het eventmodel en de read-only endpoints zodat de pagina's gevoed worden vanuit operationele gebeurtenissen in plaats van systeemgerichte lijsten.

Doel: systemen blijven zichtbaar als bron, processor, opslag, output of bewijs, maar de gebruiker navigeert primair op operationeel werkgebied en operationele gebeurtenis.
