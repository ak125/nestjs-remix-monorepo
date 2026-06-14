# Reality Audit — Data Availability Precheck (PR-0.5)

**Date** : 2026-05-19 (capturé via Supabase MCP, projet `cxpojprgwgubzjyqzmoq`)
**Source** : `scripts/audit/data-availability-precheck.ts` + queries MCP `information_schema`
**But** : éviter d'exécuter Task 1 collector si > 30% colonnes décisives sont MISSING (audit fantôme)

## Verdict Go/No-Go

> ✅ **GO** : 100% des colonnes DÉCISIVES indexation+funnel+baseline sont AVAILABLE ou PARTIAL. Task 1 collector peut s'exécuter avec audit significatif. Les colonnes contextuelles (selector telemetry E.bis-E.sexies) restent MISSING et seront NULL honnêtes — documentées comme tel dans `notes`.

**Résumé décisives** :
- ✅ A. Indexation : `__seo_gsc_daily` + `__seo_index_history` présents (8/8 colonnes core OK)
- ✋ B. Intent : manuel (review SERP, 21 reviews top-1 par gamme)
- ✅ C. Funnel : `__seo_ga4_daily` + `___xtr_order.ga_client_id` présents
- ✅ C.bis Baseline : `__seo_gamme_gsc_baseline` déjà capturé
- 🟡 D. Viability : `gamme_aggregates` (price/products/vlevel/seo_score) + `___xtr_order.ord_date_deliv` + `support_tickets` — margin réelle indisponible (proxy nécessaire)
- 🟡 E. UX : `__seo_cwv_daily` (LCP/INP/CLS) — pas de device split direct
- ❌ E.bis-E.sexies : vehicle_selector_events table absente — NULL honnête

## Tables existantes pertinentes (confirmées via MCP)

| Table | Usage Reality Audit | Status |
|---|---|---|
| `__seo_gsc_daily` (+ partitions 2026_*) | A. Indexation : impressions/clicks/CTR/position | ✅ |
| `__seo_ga4_daily` (+ partitions 2026_*) | C. Funnel : sessions/conversions/bounce | ✅ |
| `__seo_cwv_daily` (+ partitions 2026_*) | E. UX : LCP/INP/CLS/TTFB par page | ✅ |
| `__seo_gamme_gsc_baseline` | C.bis Baseline : clicks/impressions/CTR/position pré-pilote | ✅ |
| `__seo_index_history` | A. Indexation : historique état index par page | ✅ (à confirmer columns) |
| `__seo_crawl_log` / `__seo_crawl_hub` | A. Indexation : crawl events | ✅ (partial) |
| `gamme_aggregates` | D. Viability : price_min/max_rag, products_total, vlevel_counts, seo_score | ✅ |
| `___xtr_order` | C. Funnel + D. Viability : ord_date, ord_total_ttc, ga_client_id, ord_date_deliv | ✅ |
| `___xtr_order_line` | C. Funnel : produits achetés par order | ✅ |
| `support_tickets` | D. Viability : category/status pour SAV proxy | ✅ |

## Tables/instrumentation MISSING (impact = colonnes NULL honnêtes)

| Manquant | Impact | Action recommandée |
|---|---|---|
| `vehicle_selector_events` table | E.bis-E.sexies : selector retry/time/abandon/backtrack | Instrumentation custom OU GA4 events custom (différé hors-scope Task 1) |
| `__seo_url_audit` (canonical/noindex dérivés) | A.canonical_correct_pct + pages_noindex_involuntary | Crawler dédié OU scan ponctuel (peut être manuel pour pilote 21 gammes) |
| Cost of goods (marge réelle) | D.margin_estimate_pct exact | Utiliser price_min_rag comme proxy + flag `margin_estimate_method: 'price_proxy'` |
| GA4 `device` dimension dans `__seo_ga4_daily` | E.bis mobile_vs_desktop_dropoff_pct | Query GA4 MCP directe avec breakdown device (workspace seo-analytics) |
| Stock par SKU temps réel | D.stock_coverage_pct | products_total proxy ; à raffiner si stock_disponible existe ailleurs |

## Plan adaptation Task 1 collector

Le collector écrit dans `__seo_reality_audit` avec :
- Colonnes décisives REMPLIES (verdict pertinent) : indexation, intent (manual sample), funnel, viability tier, baseline
- Colonnes contextuelles NULL pour celles non-instrumentées : `notes` documente quelles sont absentes
- Verdict `dominant_problem` calculable malgré gaps contextuels

**Décision** : GO Task 1, NULL honnête pour selector telemetry, manual sample 21 SERP intent reviews (1 par gamme, top-1 SERP), proxy `price_min_rag` pour margin.

---

**Suite** : exécuter Task 1 (migration `__seo_reality_audit` + collector) puis Task 2 (render report).
