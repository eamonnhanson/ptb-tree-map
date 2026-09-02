# Shopify subscription tree allocation

## Status en veiligheidsgrens

Dit document beschrijft de reviewklare PostgreSQL-implementatie in `docs/sql/011_shopify_subscription_tree_allocation.sql`. De SQL is niet uitgevoerd. Voer de migratie niet tegen productie uit voordat het live schema, een backup, een testdatabase-run en de historische backfill zijn beoordeeld.

De echte PostgreSQL-harness staat in `test/shopifySubscriptionAllocationIntegration.test.js`. Hij accepteert uitsluitend `PTB_POSTGRES_INTEGRATION_URL` met host `localhost`, `127.0.0.1` of `::1` en een databasenaam die begint met `ptb_shopify_subscription_test`. Hij weigert iedere andere host of databasenaam voordat een query wordt uitgevoerd.

```powershell
$env:PTB_POSTGRES_INTEGRATION_URL = 'postgres://test_user:test_password@127.0.0.1:5432/ptb_shopify_subscription_test'
npm run test:postgres-integration
```

Gebruik uitsluitend tijdelijke lokale testcredentials. De harness verwijdert aan het einde het tijdelijke `public`-schema en maakt een leeg schema terug. Zonder expliciete lokale URL wordt de suite veilig overgeslagen.

## Source of truth

```text
Shopify    -> subscription contract + successful paid order
PostgreSQL -> processing state + payment counter + tree allocations
Zoho CRM   -> mirror / afgeleide klantinformatie
Zoho Writer/Creator -> first-payment certificate
Zapier     -> transport/orchestratie, geen boomaantallogica
```

Shopify Flow levert `ptb_subscription` en `ptb_contract_<id>` als transporttags. Tags zijn geen database-identiteit: Zapier geeft de uitgepakte numerieke contract-ID expliciet aan de functie door.

## Identifiers en regels

| variant-ID | bedrag | databasepolicy |
|---|---:|---|
| `53296965386570` | €5 | `odd_payment`: één boom bij payment 1, 3, 5, ... |
| `53296965419338` | €10 | `every_payment`: één boom per succesvolle payment |
| `53296965452106` | €20 | `every_payment`: twee bomen per succesvolle payment |

De subscriptionkey is `shopify_subscription_contract_id`. De idempotencykey is `shopify_order_id`. E-mail is alleen klant-/contactmatching. SKU is leeg en speelt geen rol.

## Bestaande componenten die worden hergebruikt

- `users1`: gebruiker zoeken met genormaliseerde e-mail en zo nodig aanmaken volgens het bestaande `ON CONFLICT(email)`-patroon.
- `trees1`: productievoorraad met vooraf bestaande boomcode en locatie. Allocatie schrijft alleen identificatie-/auditvelden; boominhoud wordt behouden.
- SKU01-patroon: exact-aantalselectie met `FOR UPDATE SKIP LOCKED`.
- `Assigned_Trees`: JSON-array met `tree_id`, `tree_code`, `tree_type`, `latitude`, `longitude`, geschikt voor één Creator `CertificateJobs`-record.
- `monitoring.workflow_registry` en `workflow_dependencies`: governance/traceerbaarheid; niet gebruikt als operationele payment-ledger.

## Nieuwe databaseobjecten

- `shopify_tree_subscription_variants`: declaratieve variantpolicy.
- `shopify_tree_subscriptions`: één rij per contract en eigen paymentcounter.
- `shopify_subscription_payments`: één rij per succesvolle Shopify order.
- `shopify_subscription_payment_trees`: één payment naar nul, één of twee bomen.
- `process_shopify_subscription_payment(...)`: centrale transactionele allocatie.
- `mark_shopify_subscription_payment_side_effect(...)`: onafhankelijke statusupdate voor Writer, welkomstmail of CRM.

`UNIQUE(shopify_order_id)` voorkomt dubbele verwerking. `UNIQUE(contract_id,payment_number)` beschermt numbering. `UNIQUE(tree_id)` in de koppeltabel en locks op `trees1` beschermen boomidentiteit.

## Centrale functie en Zapier-aanroep

Zapier roept precies één databasefunctie aan nadat Get Order by ID de tags en paid order heeft bevestigd:

```sql
SELECT *
FROM public.process_shopify_subscription_payment(
  p_shopify_order_id := '90000000000001',
  p_shopify_subscription_contract_id := '80000000001',
  p_shopify_variant_id := '53296965386570',
  p_customer_email := 'subscription-test@example.invalid',
  p_paid_at := '2026-08-20T08:07:34Z',
  p_amount := 5.00,
  p_shopify_order_name := '#TEST-1001',
  p_shopify_customer_id := '70000000001',
  p_currency := 'EUR',
  p_raw_tags := 'ptb_subscription,ptb_contract_80000000001'
);
```

Dit voorbeeld is fictief en mag niet tegen productie worden uitgevoerd.

De resultset bevat `processed`, `duplicate`, order/contract/variant, `payment_number`, `is_first_payment`, `trees_due`, `trees_allocated`, totaal, welcome/certificateflags, user/e-mail, allocatiedatum, side-effectstatussen en `assigned_trees`.

Zapier kan `assigned_trees` als `Assigned_Trees` aan Creator/Writer doorgeven. Voor €20 staan twee objecten in dezelfde array en wordt één welkomstcertificaat gemaakt.

## Transactionele werking

1. Valideer ID’s, e-mail, betaaldata en actieve variant.
2. Neem een transactionele advisory lock per order.
3. Geef bij duplicate het opgeslagen paymentresultaat en dezelfde `Assigned_Trees` terug.
4. Neem een advisory lock per contract en lock de subscriptionrij.
5. Zoek/maak `users1`, bepaal het volgende paymentnummer en registreer de payment.
6. Bepaal `trees_due` uitsluitend vanuit de variantregistry.
7. Lock exact het benodigde aantal volledig vrije en niet-gereserveerde `trees1`-rijen.
8. Bij onvoldoende voorraad: exception en rollback van de volledige functiecall.
9. Claim alle bomen, leg payment-tree-links vast en update counters.
10. Commit gebeurt door PostgreSQL na de statement/transactie; de functie voert geen externe calls uit.

## Definitieve vrije boom

De read-only productie-inspectie bevestigde 377 bomen en nul uitzonderingen op deze volledige predicate:

```sql
user_id IS NULL
AND is_claimed IS NOT TRUE
AND purchase_date IS NULL
AND order_id IS NULL
AND reserved_token IS NULL
AND claimed_at IS NULL
AND unclaimed_user_id IS NULL
AND tree_code IS NOT NULL
AND lat IS NOT NULL
AND "long" IS NOT NULL
```

De kandidatenselectie voegt `ORDER BY id`, `FOR UPDATE SKIP LOCKED` en `LIMIT trees_due` toe. Bij een tekort volgt een exception vóór de update, zodat twee verschuldigde bomen nooit als één gedeeltelijke allocatie worden opgeslagen.

## Behouden en gewijzigde boomvelden

De bestaande waarden van `tree_code`, `tree_type`, `lat`, `long`, `planted_date`, `tree_name`, `reserved_token` en `unclaimed_user_id` worden niet gegenereerd of overschreven.

Tijdens een subscription allocation worden uitsluitend deze `trees1`-velden gewijzigd:

- `user_id`: interne `users1.id`;
- `is_claimed`: `true`, voor compatibiliteit met bestaande SKU01/SKU02/Chargebee-allocatiestromen die dit veld als claimstatus gebruiken;
- `claimed_at`: transactioneel allocatiemoment als `timestamptz`;
- `order_id`: numerieke Shopify order-ID als tekst, nooit de GraphQL GID;
- `purchase_date`: Shopify `paid_at` geconverteerd naar UTC `timestamp without time zone`;
- `updated_at`: huidig transactiemoment als UTC `timestamp without time zone`.

De exacte tijdzoneconversies zijn:

```sql
purchase_date = p_paid_at AT TIME ZONE 'UTC',
updated_at = now() AT TIME ZONE 'UTC'
```

`trees1.order_id` is `varchar(50)`. De functie accepteert uitsluitend 1–30 cijfers en bewaart die invoer rechtstreeks als tekst. Een waarde zoals `gid://shopify/Order/...` wordt geweigerd.

## Retrybeleid

- Zapier opnieuw: dezelfde order-ID retourneert `duplicate=true`, hetzelfde paymentnummer en dezelfde bomen; geen counter- of allocatiewijziging.
- Writer faalt: markeer `certificate=failed`; roep bij retry eerst de paymentfunctie opnieuw aan om dezelfde bomen op te halen en probeer Writer opnieuw.
- E-mail faalt: markeer `welcome_email=failed` en retry alleen de e-mail.
- CRM faalt: markeer `crm=failed` en retry alleen de CRM-update.
- Refund/chargeback: wijzig later alleen `financial_status`; bomen en payment-tree-links blijven historisch staan.

Voorbeeld side effect:

```sql
SELECT * FROM public.mark_shopify_subscription_payment_side_effect(
  p_shopify_order_id := '90000000000001',
  p_effect := 'certificate',
  p_status := 'completed',
  p_external_id := 'creator-test-id',
  p_external_url := 'https://example.invalid/test-certificate.pdf'
);
```

Na de gecombineerde Zoho Writer-actie “Merge a Template and Send Email” moeten
zowel `certificate` als `welcome_email` met het bestaande markermechanisme op
`completed` worden gezet. De exacte ene PostgreSQL custom-query en Zapierpositie
staan in `docs/zapier_postgresql_completion_steps.md`. Zonder die stap blijven
de twee velden `pending` en kan PostgreSQL de afgeronde welkomstketen niet
aantonen.

## Backfill bestaande subscriptions

`docs/sql/012_shopify_subscription_existing_backfill_template.sql` bevat expres een exception en `ROLLBACK`. Bevestig per contract handmatig:

1. contract-ID en Shopify customer-ID;
2. genormaliseerde e-mail en juiste `users1.id`;
3. variant-ID en startdatum;
4. iedere succesvolle historische order-ID, bedrag en `paid_at`;
5. het daardoor bewezen `successful_payment_count`;
6. reeds toegewezen boom-ID’s en `trees_allocated_total`;
7. welcome/certificaatstatus;
8. laatste order-ID en last-payment/allocation timestamps.

Voer historische orders niet via de centrale functie in als dat onbedoeld nieuwe bomen zou alloceren. Backfill ledger/counters en bestaande tree-links expliciet na reconciliatie.

## Registry en dashboard

Voeg bij productievoorbereiding een `monitoring.workflow_registry`-record en dependencies toe voor:

```text
Shopify successful subscription payment
-> Shopify Flow tags
-> Zapier Get Order
-> process_shopify_subscription_payment
-> optional Creator/Writer
-> welcome email
-> Zoho CRM
```

Deze registryrecords horen pas bij de werkelijke Zap-ID/naam nadat de Zap is gebouwd. De huidige frontend toont “Abonnementen” hardcoded als `Chargebee / Zapier`; wijzig dat in een afzonderlijke, testbare dashboardtaak nadat de nieuwe workflow live-identiteit bekend is. Chargebee blijft mogelijk relevant voor andere plannen.

## Productieprocedure

1. Controleer in de geïsoleerde testdatabase dat het schema overeenkomt met de bevestigde productietypen voor `users1` en `trees1`.
2. Maak en verifieer een backup/restoreplan.
3. Voer migratie 011 eerst uit op een geïsoleerde database met representatief schema en fixtures.
4. Draai SQL-integratietests voor alle variant-, duplicate-, concurrency- en voorraadscenario’s.
5. Reconcileer bestaande Shopify-contracten en orders; vul een gereviewde kopie van template 012.
6. Voer migratie 011 in een goedgekeurd onderhoudsvenster handmatig uit via Beekeeper/Aiven.
7. Controleer tabellen, constraints, variantseed en function signatures read-only.
8. Voer de goedgekeurde backfill uit en controleer payment-/tree-counts; gebruik eerst een transactie met rollback.
9. Configureer de Zap in testmodus en test fictieve/testorders end-to-end.
10. Activeer de nieuwe route zonder overlap met de oude Chargebee/handmatige allocatieroute.
11. Reconcileer Shopify paid orders dagelijks tegen `shopify_subscription_payments` en monitor pending/failed side effects.

## Open verificatiepunten

- Valideer de migratie en echte concurrency op een geïsoleerde PostgreSQL-testdatabase met een productie-equivalent schema; de repositorytests zijn contracttests en voeren geen SQL-engine uit.
- Bevestig Writer/Creator multi-tree mapping en callback/statusvelden.
- Bepaal de echte Zap-ID/naam voordat registry/dependencyrecords worden geseed.
