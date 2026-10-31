# November 2026 demo site

## Doel

Van 1 t/m 30 november 2026 kan Plant N Boom de volledige klantreis demonstreren zonder een echte nieuwe verkoop te registreren.

Shopify testproduct:

- product: `16155240005962`
- variant: `64172819480906`
- SKU: `test`
- prijs: €0
- status tijdens voorbereiding: DRAFT
- gewenste status na go-live: UNLISTED of ACTIVE, afhankelijk van distributie
- template: `product.november-demo`

Een demo-order reserveert 1, 5 of 10 echte bomen uit een vaste pool van 100 bomen. De koppeling duurt 24 uur. Daarna kunnen dezelfde bomen opnieuw voor een andere demo worden gebruikt.

## 600 bomen vrijmaken

De productie-migratie `docs/sql/027_november_demo_pool.sql` bevat een gecontroleerde eenmalige functie.

Deze functie:

1. zoekt productie-bomen die direct gekoppeld zijn aan het opgegeven War Child e-mailadres;
2. stopt volledig als er minder dan 600 direct gekoppelde bomen zijn;
3. maakt een audit-snapshot van alle 600 originele boomrecords;
4. maakt exact 600 bomen vrij;
5. markeert de eerste 100 als `demo_pool = true`;
6. laat de overige 500 als normale vrije verkoopvoorraad achter;
7. kan niet per ongeluk nogmaals 600 bomen vrijmaken, omdat batch `november-2026-demo` uniek is.

Uitvoeren na database-backup:

```sql
SELECT public.prepare_november_2026_demo_pool(
  'mark.kirkels@warchild.nl',
  'RELEASE 600 WAR CHILD TREES FOR NOVEMBER DEMO'
);
```

Verwachte uitkomst:

```json
{
  "status": "prepared",
  "released_count": 600,
  "demo_count": 100,
  "sale_count": 500
}
```

Bij een tweede uitvoering moet `status = already_prepared` terugkomen en mogen geen extra bomen worden vrijgemaakt.

## Donorhistorie

De release verwijdert de historische informatie niet.

Voor iedere boom wordt vóór het vrijmaken het volledige originele `trees1` record opgeslagen in:

`public.tree_allocation_release_audit`

met:

- oorspronkelijke boom-ID;
- oorspronkelijke bron-e-mail;
- volledig origineel boomrecord als JSON;
- bestemming `demo_pool` of `sale_pool`;
- releasedatum;
- batch-ID.

Als de 600 bomen eerder in formele War Child-certificaten, contractuele outputs of donatierapportages zijn opgenomen, moet de organisatie vóór productie-uitvoering vaststellen dat herallocatie is toegestaan. De audit maakt de technische historie controleerbaar, maar verandert de donorafspraak niet.

## Nieuwe Zap: Demo – Shopify → 24h tree reservation

Gebruik een aparte Zap. Voeg deze logica niet toe aan SKU01/SKU02 of subscription Zaps.

### Stap 1: Shopify

Trigger:

`New Order`

Waarom: de demo kost €0. `New Order` triggert zodra Shopify de order aanmaakt en is daarom niet afhankelijk van een payment-statusovergang.

### Stap 2: Filter by Zapier

Ga alleen verder als:

- Line Item SKU = `test`
- Line Item Variant ID = `64172819480906`
- Line Item Price = `0`
- quantity is 1, 5 of 10

Als de Shopify trigger meerdere line items als arrays teruggeeft, gebruik de line-item velden van de testvariant en voorkom dat een andere variant als `test` wordt geïnterpreteerd.

### Stap 3: PostgreSQL

Gebruik een Custom Query:

```sql
SELECT public.allocate_demo_order(
  '{{SHOPIFY_ORDER_ID}}',
  '{{LINE_ITEM_SKU}}',
  '{{LINE_ITEM_VARIANT_ID}}',
  '{{CUSTOMER_EMAIL}}',
  {{LINE_ITEM_QUANTITY}}
) AS result;
```

Map exact de Shopify velden. Typ geen voorbeeld-ID's over in de live Zap.

De database controleert opnieuw:

- order ID-formaat;
- SKU exact `test`;
- variant exact `64172819480906`;
- e-mailadres aanwezig;
- quantity tussen 1 en 10;
- alleen `demo_pool = true` bomen.

De functie verandert niet:

- `trees1.user_id`
- `trees1.is_claimed`
- `trees1.order_id`
- `trees1.purchase_date`

De echte boom blijft dus vrije demo-voorraad en krijgt alleen een tijdelijke reservering in de demo-tabellen.

### Stap 4: klantbericht

Gebruik de returned `assigned_trees` om de klant de boomcode(s) en bomenkaart te tonen.

Zet zichtbaar in de mail/pagina:

**Demo – tijdelijke koppeling. Deze boom is niet verkocht. De koppeling vervalt automatisch na 24 uur.**

## Vrijgeven na 24 uur

De kaart toont alleen demo-reserveringen waarvoor:

`reserved_until > now()`

Dus na 24 uur verdwijnt de demo-boom automatisch uit de zoekresultaten, ook als de cleanup nog niet heeft gedraaid.

Maak daarnaast een eenvoudige Scheduled Zap:

1. Schedule by Zapier: ieder uur
2. PostgreSQL Custom Query:

```sql
SELECT public.release_expired_demo_reservations() AS released;
```

Hiermee worden verlopen links administratief als vrijgegeven gemarkeerd.

De volgende demo-order kan verlopen bomen ook automatisch vrijgeven omdat `allocate_demo_order()` deze cleanup zelf eerst uitvoert.

## Productieverkoop beschermen

De 100 demo-bomen mogen nooit door een echte verkoop worden toegewezen.

De repository-versies van:

- `011_shopify_subscription_tree_allocation.sql`
- `014_chargebee_subscription_payment_allocation.sql`

sluiten daarom `demo_pool = true` uit.

De live Zapier SQL voor SKU01 en SKU02 moet vóór het vrijmaken van de 600 bomen eveneens krijgen:

```sql
AND COALESCE((to_jsonb(t)->>'demo_pool')::boolean, false) = false
```

of, zodra migration 027 is toegepast:

```sql
AND t.demo_pool = false
```

Gebruik dit in iedere query die een vrije productieboom selecteert of reserveert.

## Kaart

Bij zoeken op het e-mailadres van een demo-order voegt `/api/trees` actieve tijdelijke demo-reserveringen toe aan de normale bomen.

Demo-bomen tonen:

- echte boomcode;
- echte GPS-locatie;
- boomsoort;
- DEMO-marker;
- duidelijke melding dat de boom niet verkocht is;
- exacte vervaldatum/tijd.

Na 24 uur verdwijnt de demo-koppeling automatisch.

## Go-live volgorde

1. Controleer/backup productie-PostgreSQL.
2. Controleer dat de brongebruiker minimaal 600 direct gekoppelde bomen heeft.
3. Voeg `demo_pool = false` toe aan SKU01/SKU02 live allocators.
4. Deploy database/API/map changes.
5. Run migration 027.
6. Run `prepare_november_2026_demo_pool(...)`.
7. Controleer 100 demo + 500 verkoop.
8. Maak de nieuwe Zap met SKU `test`.
9. Plaats één €0 testorder.
10. Controleer boom op de kaart.
11. Zet testorder 24 uur oud in een gecontroleerde test en controleer vrijgave.
12. Pas daarna Shopify productstatus aan van DRAFT naar UNLISTED/ACTIVE en publiceer de November-demo template.
13. Op 1 december: product terug naar DRAFT en demo-Zap uit.

## Acceptatiecriteria

- [ ] exact 600 bomen vrijgemaakt
- [ ] 100 bomen `demo_pool = true`
- [ ] 500 bomen `demo_pool = false` en vrij verkoopbaar
- [ ] volledige oude War Child-koppeling in auditlog
- [ ] SKU test kost €0
- [ ] demo-order wijzigt geen ownershipvelden op trees1
- [ ] demo-boom zichtbaar op kaart
- [ ] demo-boom duidelijk als DEMO gemarkeerd
- [ ] koppeling niet meer zichtbaar na 24 uur
- [ ] dezelfde demo-boom daarna opnieuw reserveerbaar
- [ ] SKU01 kan nooit demo_pool kiezen
- [ ] SKU02 kan nooit demo_pool kiezen
- [ ] Shopify subscriptions kunnen nooit demo_pool kiezen
- [ ] Chargebee subscriptions kunnen nooit demo_pool kiezen
- [ ] demo-orders tellen niet als nieuwe verkoop of impact
