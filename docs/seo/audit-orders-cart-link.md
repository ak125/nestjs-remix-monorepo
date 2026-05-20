# Audit liaison SEO ↔ orders/cart (PR-SBD-1 Task 0)

> **Date** : 2026-05-18
> **Auditeur** : Claude (Agent SDK)
> **Mode** : READ-ONLY (aucune écriture DB/code applicatif, uniquement ce document)
> **Scope** : déterminer GO/NO-GO pour le Bloc 4 (Conversion Gap) de PR-SBD-1, et la V2 readiness (revenue/stock/recoverability scoring).

---

## 1. Module orders/cart — inventaire

### Chemins
- [backend/src/modules/orders/](backend/src/modules/orders/) — module commandes complet
- [backend/src/modules/cart/](backend/src/modules/cart/) — module panier complet

### Endpoints HTTP existants (extrait)
- [orders.controller.ts](backend/src/modules/orders/controllers/orders.controller.ts) : `@Get`, `@Get :id`, `@Post`, `@Post 'guest'`, `@Patch :id`, `@Delete :id`, `@Get 'customer/stats'`
- [order-actions.controller.ts](backend/src/modules/orders/controllers/order-actions.controller.ts) : `@Patch :orderId/lines/:lineId/status/:newStatus`, `@Post :orderId/validate`, `@Post :orderId/ship`, `@Post :orderId/deliver`, `@Post :orderId/cancel`, `@Post :orderId/confirm-payment`, etc.
- [order-archive.controller.ts](backend/src/modules/orders/controllers/order-archive.controller.ts) : `@Get :orderId`, `@Get 'customer/:customerId/list'`
- [order-status.controller.ts](backend/src/modules/orders/controllers/order-status.controller.ts) : status workflow
- [tickets.controller.ts](backend/src/modules/orders/controllers/tickets.controller.ts) : tickets équivalence
- [cart-analytics.controller.ts](backend/src/modules/cart/controllers/cart-analytics.controller.ts) : `@Get 'analytics/report'`, `@Get 'analytics/abandonment'`, `@Get 'analytics/average-value'`, `@Get 'analytics/abandoned-products'`

### Tables Supabase

Confirmé via [backend/src/database/types/database.types.ts](backend/src/database/types/database.types.ts) :

- `___xtr_order` — commande globale (header)
- `___xtr_order_line` — ligne de commande (1 row par produit acheté)
- `___xtr_customer` — client
- `___xtr_invoice` / `___xtr_invoice_line` — facturation
- `__abandoned_cart_emails` ([migration 20260325](backend/supabase/migrations/20260325_abandoned_cart_emails.sql)) — panier abandonné avec snapshot JSONB + email recovery

---

## 2. Liaison URL ↔ commande — VERDICT GO

### Champ canonique : `___xtr_order_line.orl_website_url`

- **Type** : `string | null` ([database.types.ts:872](backend/src/database/types/database.types.ts#L872))
- **Sémantique** : URL produit acheté (rendu dans l'admin orders : [admin.orders.$orderId.tsx:416-426](frontend/app/routes/admin.orders.$orderId.tsx#L416))
- **Granularité** : par ligne de commande (1 row = 1 produit = 1 URL)
- **Set** par : le service order creation + `order-actions.service.ts` (placeholder `'System'` pour les lignes équivalence créées admin)

### Champs revenue & margin disponibles (utiles V2)

- `orl_art_price_sell_ttc` — revenue TTC par ligne
- `orl_art_price_sell_ht` — revenue HT par ligne
- `orl_art_price_sell_margin` — marge par ligne (V2 revenue-weighted scoring possible)
- `orl_art_quantity` — quantité
- `___xtr_order.ord_total_ttc` / `ord_total_ht` — totaux commande
- `___xtr_order.ord_is_pay` — flag payé

### Champs orders non utiles pour landing

- `ord_link` / `ord_link_type` ([orders 774-775](backend/src/database/types/database.types.ts#L774)) : pas une URL canonique (sémantique inconnue, probablement lien interne/parent commande)
- Pas de `ord_landing_url`, `ord_referrer`, `ord_utm_*` au niveau commande globale

### Limites identifiées

1. **Granularité order_line, pas order** : une commande de 5 produits = 5 URLs distinctes. Le JOIN sessions ↔ orders se fait au niveau ligne, pas commande.
2. **`orl_website_url` nullable** : peut être vide. Filtrer `WHERE orl_website_url IS NOT NULL AND orl_website_url <> 'System'` dans la RPC.
3. **Pas de funnel multi-step** : la table ne capture que `purchase` final. Pas de séparation visite → cart → checkout → purchase.
4. **Pas d'attribution multi-touch** : `orl_website_url` est l'URL de la page d'achat finale (last-click). Pas d'historique des pages visitées avant.

---

## 3. event_log business — VERDICT ABSENT

### Cherché

- `event_log` / `user_event` / `tracking_event` / `page_view` / `add_to_cart_event` : aucune table de ce nom dans `backend/supabase/migrations/`.
- `__seo_event_log` ([migration 20260425](backend/supabase/migrations/20260425_seo_event_log.sql)) existe MAIS c'est l'audit trail SEO (ingestion runs / anomalies / alerts), **pas** un event_log business utilisateur.
- `__abandoned_cart_emails` capture les paniers abandonnés (snapshot JSONB) mais n'est pas un event_log granulaire.

### Conclusion

Le funnel utilisateur (page_view → add_to_cart → checkout_start → purchase) n'est pas tracé en base. Le seul signal disponible est :
- **Sessions / pageviews** : via `__seo_ga4_daily.sessions` (par page, daily aggregate, latence ~72h)
- **Purchases** : via `___xtr_order_line` (par URL, temps réel)

Le Bloc 4 V1 livrera donc une vue **sessions vs orders** par URL — pas un funnel détaillé.

---

## 4. V2 readiness (revenue/stock/recoverability scoring)

| V2 feature | Exposable maintenant ? | Note |
|---|---|---|
| **Revenue-weighted scoring** | ✅ OUI | `orl_art_price_sell_ttc` + `orl_art_price_sell_margin` disponibles par ligne |
| **Stock awareness** | ⚠️ à vérifier | Table `pieces`/`piece_price` à inspecter en V2 (hors-scope Task 0) |
| **Recoverability score** | ✅ Heuristique calculable | Basé sur `position_band` × `ctr_gap` × `competitor_density` — pure SQL/TS, aucune nouvelle source de données |
| **Decision outcome feedback** | ❌ pas V1 | Demande nouvelle table `__seo_decision_outcomes` (V1.5+ gated empirique) |

---

## 5. Verdict GO/NO-GO Bloc 4 (Conversion Gap)

### ✅ **GO** — Bloc 4 livrable en data Phase A (RPC `rpc_seo_conversion_v1`)

**Implémentation RPC** :

```sql
CREATE OR REPLACE FUNCTION rpc_seo_conversion_v1(
  p_window_days INT, p_now TIMESTAMPTZ DEFAULT NOW(), p_limit INT DEFAULT 20
) RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH bounds AS (SELECT (p_now::DATE - p_window_days) AS from_d, p_now::DATE AS to_d),
  traffic AS (
    SELECT page, SUM(sessions)::BIGINT sessions FROM __seo_ga4_daily, bounds
    WHERE date >= bounds.from_d AND date < bounds.to_d
    GROUP BY page HAVING SUM(sessions) > 50
  ),
  conv AS (
    -- JOIN au niveau order_line, agrégé par URL
    SELECT
      ol.orl_website_url AS page,
      COUNT(DISTINCT ol.orl_ord_id)::BIGINT AS orders_count,
      COALESCE(SUM(ol.orl_art_price_sell_ttc::NUMERIC), 0)::FLOAT8 AS revenue
    FROM ___xtr_order_line ol
    INNER JOIN ___xtr_order o ON o.ord_id = ol.orl_ord_id
    WHERE o.ord_date::DATE >= (p_now::DATE - p_window_days)
      AND o.ord_date::DATE < p_now::DATE
      AND o.ord_is_pay = '1' -- uniquement commandes payées
      AND ol.orl_website_url IS NOT NULL
      AND ol.orl_website_url <> 'System'
    GROUP BY ol.orl_website_url
  ),
  joined AS (
    SELECT
      t.page,
      _seo_resolve_surface_key(t.page) AS surface_key,
      t.sessions,
      COALESCE(c.orders_count, 0) AS orders_count,
      CASE WHEN t.sessions > 0
           THEN ROUND(COALESCE(c.orders_count,0)::NUMERIC / t.sessions * 100, 2)::FLOAT8
           ELSE 0::FLOAT8 END AS conversion_rate,
      COALESCE(c.revenue, 0)::FLOAT8 AS revenue,
      ROUND(t.sessions::NUMERIC * GREATEST(0, 0.01 - (COALESCE(c.orders_count,0)::NUMERIC / NULLIF(t.sessions,0))), 2)::FLOAT8 AS business_impact_score,
      CASE WHEN COALESCE(c.orders_count,0) = 0 AND t.sessions > 200 THEN 'critical'
           WHEN COALESCE(c.orders_count,0) = 0 AND t.sessions > 100 THEN 'high'
           ELSE 'medium' END AS severity
    FROM traffic t LEFT JOIN conv c USING (page)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'page', page, 'surface_key', surface_key, 'sessions', sessions, 'orders_count', orders_count,
    'conversion_rate', conversion_rate, 'revenue', revenue,
    'business_impact_score', business_impact_score, 'impact_score_version', 'v1', 'severity', severity
  ) ORDER BY business_impact_score DESC), '[]'::jsonb)
  FROM (SELECT * FROM joined ORDER BY business_impact_score DESC LIMIT p_limit) j;
$$;
```

### Index supplémentaire requis (Task 1 Step 11)

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xtr_order_line_website_url_paid
  ON ___xtr_order_line (orl_website_url)
  WHERE orl_website_url IS NOT NULL AND orl_website_url <> 'System';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xtr_order_date_paid
  ON ___xtr_order (ord_date)
  WHERE ord_is_pay = '1';
```

### Rappel — Bloc 4 reste MASQUÉ en UI Phase A

Même avec verdict GO :
- La RPC `rpc_seo_conversion_v1` est livrée et exposée dans le snapshot (data complète)
- La route Remix Phase A ne rend PAS le bloc Conversion (Phase A.6 conditionnel à Phase B)
- Activation Phase A.6 demande : gates Phase B + ≥ 2 décisions Phase B référençant un besoin conversion

---

## 6. Recommandations transverses

### Type casting strict (corrige correction critique #2 du plan)

Toutes les valeurs scorées doivent être castées `::FLOAT8` SQL avant `jsonb_build_object`. Sinon supabase-js renvoie en string et Zod `z.number()` fail-loud → 500.

Concerne `conversion_rate`, `revenue`, `business_impact_score`. La RPC ci-dessus respecte déjà cette règle.

### Granularité order_line vs unique customer

Le JOIN par `orl_website_url` compte un produit identique acheté 2 fois (par 2 clients distincts) comme 2 commandes. C'est intentionnel pour V1 (signal de conversion fort). En V2 avec attribution multi-touch, segmenter par `orl_ord_id` distinct.

---

## 7. Conclusion

| Question | Réponse |
|---|---|
| Liaison URL ↔ commande existe ? | **OUI** via `___xtr_order_line.orl_website_url` |
| event_log business granulaire ? | **NON** — seulement final purchase + abandoned cart snapshot |
| Bloc 4 Conversion Gap livrable Phase A ? | **GO** (data exposable en data, UI Phase A.6) |
| Revenue scoring V2 ready ? | **OUI** via `orl_art_price_sell_ttc` + `orl_art_price_sell_margin` |
| Stock awareness V2 ready ? | **À vérifier** (table produits hors-scope Task 0) |
| Decision outcome feedback V1 ? | **NON** — V1.5+ gated empirique |

**Décision** : continuer Task 1 avec la RPC `rpc_seo_conversion_v1` version GO. Bloc 4 reste **masqué en UI Phase A** ; activation conditionnelle Phase B (cf. plan).
