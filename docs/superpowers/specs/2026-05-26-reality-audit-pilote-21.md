# Reality Audit Report — site-wide (run réel 2026-05-20)

**Capturé le** : 2026-05-20 (via Supabase MCP, projet `cxpojprgwgubzjyqzmoq`)
**Confiance audit (data_availability_pct)** : 50.00%
**Verdict** : `conversion_funnel`
**Row id** : `2da28f28-8d4f-4de9-aea1-b982595e0808`

> ⚠️ Ce snapshot est généré par `scripts/audit/render-reality-audit-report.ts` (rendu manuel ici, run réel via MCP). Reproduction :
> `npx ts-node scripts/audit/render-reality-audit-report.ts > docs/superpowers/specs/2026-05-26-reality-audit-pilote-21.md`

## A. Indexation
| Métrique | Valeur |
|---|---|
| pages_submitted | 1897 |
| pages_discovered | 1897 (GSC, impressions > 0, 28j) |
| pages_indexed | 1897 (proxy) |
| pages_noindex_involuntary | — (MISSING, nécessite crawl scan) |
| canonical_correct_pct | — (MISSING) |

## B. Intent match
| Métrique | Valeur |
|---|---|
| intent_sample_size | — (non capturé, review SERP manuel requis) |
| intent_match_count | — |

## C. Conversion funnel (28j) — **BOTTLENECK DOMINANT**
| Métrique | Valeur |
|---|---|
| organic_sessions_28d | **2308** |
| organic_orders_28d | **4** |
| organic_revenue_28d | 790.02 € |
| **taux de conversion** | **0.17%** (4 / 2308) |
| baseline_orders_seo_attributable_28d | 4 (ga4_last_touch) |

> 🚨 **0.17% de conversion organic** vs e-commerce auto-parts sain ≈ 1-3%. C'est un facteur **~10-15x** sous la norme. Le trafic organic EXISTE (2308 sessions, 1897 pages indexées) mais ne se transforme presque pas en commande.

## D. Business viability
| Métrique | Valeur |
|---|---|
| margin_estimate (none) | — (cost_of_goods absent) |
| stock_coverage_pct | — (site-wide, pas calculé) |
| business_viability_tier | — (gamme-level seulement) |

## E. UX & confiance achat
| Métrique | Valeur |
|---|---|
| mobile_ux_friction_score | — (CWV daily vide sur 28j) |
| Selector telemetry (E.bis-E.sexies) | — (NON instrumenté, NULL honnête) |

## Notes audit
Run réel site-wide 2026-05-20 via MCP. SIGNAL MAJEUR : 2308 sessions organic → 4 commandes = 0.17%.
2 bugs corrigés au run : (1) channel=`organic search` pas `organic` (eq retournait 0 sessions) ;
(2) verdict logic : ajout `CONVERSION_RATE_FLOOR` 0.5% (sinon orders>0 → content_quality à tort).
data_availability_pct=50% : décisives sessions+orders+pages OK ; noindex/canonical/intent/viability MISSING.

## Verdict + Recommandation orientation (post-STOP 4 semaines)

**Verdict : `conversion_funnel`**

🔀 **PIVOT Commerce-Loop V1** (déjà TOP PRIORITY). Le tunnel est cassé, pas le contenu. Investir dans le pipeline SEO contenu (R2 / Evidence Guard / freshness / SERP) serait du gaspillage tant que 2308 visiteurs organic ne produisent que 4 commandes.

**Hypothèses à investiguer en priorité (Commerce-Loop V1)** :
- Compatibilité véhicule : le sélecteur convertit-il ? (selector telemetry à instrumenter)
- Mobile UX : dropoff mobile ? (device split GA4 à activer)
- Confiance achat : prix visible, stock affiché, frais de port ?
- Funnel panier → checkout → paiement : où est le dropoff ?

## Limites de cet audit (honnêteté méthodologique)

- `data_availability_pct = 50%` → verdict avec confiance modérée mais le signal conversion (0.17%) est robuste car basé sur sessions+orders réels.
- Indexation noindex/canonical non mesurés → un problème indexation secondaire ne serait pas détecté ici.
- Intent match non échantillonné → mismatch SERP non exclu.
- **Mais** : même si indexation/intent avaient des problèmes, le signal conversion 0.17% reste le bottleneck #1 actionnable.

---
_⚠️ STOP ABSOLU 4 semaines avant toute décision SEO platform — observer GSC/GA4/commandes réelles, comparer baseline. Le verdict pointe vers Commerce-Loop V1, déjà priorité 1._
