# SKU 01 Shopify-orderkoppeling

## Scope en bron

De operationele reservering staat niet in applicatiecode maar in Zapier:

- Zap 47, **Shopify → Tokenized Gift Tree Link (SKU 01)**;
- stap 50, **PostgreSQL – Fetch Free Trees for Order - multiple rows**;
- claimen gebeurt in Zap 61 (**ZAP B**), in de PostgreSQL-stappen 75 en 85.

Gebruik uitsluitend Shopify triggerwaarde `{{47__id}}`: het interne Shopify-order-ID, numeriek of als `gid://shopify/Order/...`. Gebruik niet het checkout-ID, het zichtbare ordernummer, e-mailadres of een tijdstip.

## Huidige reserveringsquery (stap 50)

```sql
SELECT id, tree_code, lat, long, tree_type
FROM trees1
WHERE is_claimed = false
ORDER BY id ASC
LIMIT {{47__lineItems[]quantity}};
```

Deze query selecteert alleen bomen. Zij reserveert ze niet atomair en vult `trees1.order_id` niet.

## Nieuwe reserveringsquery voor handmatige Zapier-aanpassing

Vervang stap 50 handmatig door onderstaande query. De query normaliseert uitsluitend `{{47__id}}`, blokkeert een ontbrekend/ongeldig order-ID met een expliciete `error`, wijzigt niets als onvoldoende bomen beschikbaar zijn en geeft alle geselecteerde bomen hetzelfde order-ID.

```sql
WITH input AS (
  SELECT
    CASE
      WHEN BTRIM('{{47__id}}') ~ '^(gid://shopify/Order/)?[0-9]{1,30}$'
      THEN REGEXP_REPLACE(BTRIM('{{47__id}}'), '^gid://shopify/Order/', '', 'i')
      ELSE NULL
    END AS shopify_order_id,
    {{47__lineItems[]quantity}}::int AS requested_count
),
candidates AS MATERIALIZED (
  SELECT t.id
  FROM public.trees1 t, input
  WHERE input.shopify_order_id IS NOT NULL
    AND input.requested_count > 0
    AND COALESCE(t.is_claimed, false) = false
    AND t.order_id IS NULL
  ORDER BY t.id
  FOR UPDATE OF t SKIP LOCKED
  LIMIT (SELECT requested_count FROM input)
),
updated AS (
  UPDATE public.trees1 t
  SET order_id = input.shopify_order_id
  FROM input
  WHERE t.id IN (SELECT id FROM candidates)
    AND (SELECT COUNT(*) FROM candidates) = input.requested_count
  RETURNING t.id, t.tree_code, t.lat, t.long, t.tree_type, t.order_id
)
SELECT id, tree_code, lat, long, tree_type, order_id, NULL::text AS error
FROM updated
UNION ALL
SELECT NULL, NULL, NULL, NULL, NULL, NULL,
  'SKU 01-reservering geblokkeerd: intern Shopify-order-ID ontbreekt of is ongeldig'
FROM input
WHERE shopify_order_id IS NULL
UNION ALL
SELECT NULL, NULL, NULL, NULL, NULL, shopify_order_id,
  'SKU 01-reservering geblokkeerd: onvoldoende vrije bomen'
FROM input
WHERE shopify_order_id IS NOT NULL
  AND (SELECT COUNT(*) FROM candidates) <> requested_count;
```

Voeg direct na stap 50 een Filter/stopcontrole toe: `error` moet leeg zijn en het aantal resultaatrijen moet exact gelijk zijn aan `{{47__lineItems[]quantity}}`. Laat de bestaande stap 52 uitsluitend de niet-lege `id`-waarden samenvoegen tot `tree_ids_csv`.

## Claimstappen 75 en 85

De bestaande `SET`-lijst bevat geen `order_id` en behoudt dat veld daardoor al. Voeg aan beide bestaande `WHERE`-blokken deze voorwaarde toe:

```sql
AND order_id IS NOT NULL
```

Voeg `order_id` toe aan beide `RETURNING`-lijsten. De claimstap mag uitsluitend `user_id`, `is_claimed`, claimtoken/reserveringsvelden en `claimed_at` wijzigen. Voeg nooit `order_id = NULL`, checkout-ID, zichtbaar ordernummer of een e-mailadresmapping toe.

Na beide claimpaden moet Zapier stoppen wanneer het aantal bijgewerkte bomen niet gelijk is aan het verwachte aantal of wanneer meer dan één verschillende `order_id` wordt teruggegeven.

## Gerichte backfill — niet automatisch uitvoeren

Vooraf:

```sql
SELECT id, tree_code, user_id, order_id, claimed_at
FROM public.trees1
WHERE id IN (26392, 26393)
ORDER BY id;
```

Voorbereide wijziging:

```sql
UPDATE public.trees1
SET order_id = '18002517623114'
WHERE id IN (26392, 26393)
  AND order_id IS NULL;
```

Achteraf:

```sql
SELECT id, tree_code, user_id, order_id, claimed_at
FROM public.trees1
WHERE id IN (26392, 26393)
ORDER BY id;
```

Voer deze backfill uitsluitend handmatig uit na beoordeling. Verwacht exact twee gewijzigde rijen en controleer dat beide `user_id = 3339` en `order_id = '18002517623114'` tonen.

## Handmatige acceptatie

Test eerst met een herkenbare testorder voor één boom en daarna met meerdere bomen. Controleer dat alle boomrecords hetzelfde interne Shopify-order-ID hebben, de claim dat ID behoudt en Tree allocated de order op dat ID als één regel samenvoegt. Test tevens dat een lege Shopify Order ID de reservering stopt.
