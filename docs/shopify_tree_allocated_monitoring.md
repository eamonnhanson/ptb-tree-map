# Shopify workflowbewijs voor Tree allocated

Tree allocated leest geen Shopify API. Zap `374491281` (versie `374491282`) schrijft drie compacte events via **Webhooks by Zapier → Custom Request** naar `POST https://map.planteenboom.nu/.netlify/functions/monitoring-ingest` en daarmee naar de bestaande tabel `monitoring.automation_events`. Stel bij Custom Request `Method` in op `POST`, kies een JSON-body en stel de headers in op `Content-Type: application/json` en `Authorization: Basic <base64 van AUTOMATION_DASHBOARD_USER:AUTOMATION_DASHBOARD_PASSWORD>`. Gebruik daarvoor de bestaande beveiligde waarden uit Netlify/Zapier; zet het wachtwoord nooit in een payload of logveld.

Vaste velden in elke request: `workflow_key=shopify_gift_tree_sku01_374491281`, `zap_id=374491281` en `zap_version=374491282`. De server maakt de idempotency key uit workflow, eventtype en het genormaliseerde order-ID.

## Betekenis van het bewijs

| Controle | Bewijsbron | Wat hiermee is bewezen |
|---|---|---|
| Shopify-order | `shopify_order_received` | Geldige Shopify-ordergegevens zijn ontvangen. |
| Klantkoppeling | `public.users1` | Een PostgreSQL-gebruiker is aan de toegewezen bomen gekoppeld. |
| Boomtoewijzing | `public.trees1` | Het werkelijke aantal bomen en hun Shopify order-ID; dit komt niet uit een monitoringevent. |
| GiftClaims-record | `gift_claim_created` | Eén Zoho Creator GiftClaims-record is aangemaakt. |
| Gift-claim e-mail | `gift_claim_email_submitted` | De gift-claim e-mail is geaccepteerd voor aanbieding aan de verzendactie. |
| Certificaatgeneratie | Niet gemonitord | Het huidige contract bevat hiervoor geen bewijs. |
| Certificaatmail | Niet gemonitord | Het huidige contract bevat hiervoor geen bewijs. |

De interne status `completed` betekent uitsluitend dat de gemonitorde gift-claimworkflow compleet is: Shopify-bewijs, klantkoppeling, een exact passende PostgreSQL-boomtoewijzing, precies één GiftClaims-record en een aangeboden gift-claim e-mail zijn bevestigd, zonder geregistreerde technische fout. Deze status bewijst geen certificaatgeneratie en geen certificaatmail. Certificatevidence vereist later een afzonderlijke registrydefinitie met een eigen betrouwbare bron en contract; bestaande gift-claimevents mogen daarvoor niet worden hergebruikt.

## Na Shopify-trigger/filter

Voeg **Webhooks by Zapier → Custom Request** toe, stel `Method` in op `POST` en map de JSON-body:

| JSON-veld | Zapier-waarde |
|---|---|
| `event_type` | vaste waarde `shopify_order_received` |
| `order_id` | Shopify **Order ID** |
| `occurred_at` | Shopify **Created At** (dit event bewijst ontvangst van die order) |
| `created_at` | Shopify **Created At** |
| `customer_email` | Shopify **Customer Email** |
| `customer_locale` | Shopify **Customer Locale** |
| `sku` | Shopify **Line Item SKU** |
| `ordered_quantity` | Shopify **Line Item Quantity** |
| `product_title` | Shopify **Line Item Title** |

## Na geslaagde Creator-stap 8

Dezelfde Custom Request-configuratie, met `event_type=gift_claim_created`, `order_id` uit de Shopify-trigger, `occurred_at={{zap_meta_human_now}}`, `creator_record_id` als het record-ID uit stap 8, `creator_record_count=1` en `status=success`. Plaats deze webhook uitsluitend op het succespad na de Creator-actie. `{{zap_meta_human_now}}` is Zapier's runtime-timestamp; gebruik niet de numerieke Unix-variant, omdat de endpoint een parseerbare datum/tijd verwacht.

## Na geslaagde e-mailstap 13

Dezelfde Custom Request-configuratie, met `event_type=gift_claim_email_submitted`, `order_id` uit de trigger, `occurred_at={{zap_meta_human_now}}`, `recipient_email` als **Customer Email**, `language` als de bestaande genormaliseerde taaluitkomst (`nl`, `en` of `fr`), `submission_status=submitted` en `provider_or_action` als vaste actie-/providernaam, bijvoorbeeld `Zoho Mail - Send claim email`. Plaats deze webhook uitsluitend na een succesvolle response van stap 13.

Bij `shopify_order_received` wordt `language` server-side afgeleid van `customer_locale`: alleen `nl`, `en` en `fr` zijn geldig en een regionale suffix wordt verwijderd (`fr-BM` wordt `fr`). Stuur voor dit event daarom geen apart `language`-veld; onbekende velden worden bewust geweigerd.

Stuur geen e-mailbody, claimtoken of volledige claim-URL mee. Historische orders zonder deze events blijven bewust `Niet volledig controleerbaar`.

## Productievereisten

De huidige productieconfiguratie gebruikt de bestaande database `ptb_monitoring_test`; deze taak introduceert geen tweede registry of database. De rol achter `MONITORING_DATABASE_URL` heeft voor ingestion minimaal `INSERT` op `monitoring.automation_events` en `USAGE` op `monitoring.automation_events_id_seq` nodig. Tree allocated heeft daarnaast `SELECT` op `monitoring.automation_events` nodig. Beheer deze rechten buiten de applicatiecode en leg geen database-URL of credentials vast in repositorybestanden of Zap-payloads.
