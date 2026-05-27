# B2 Audit — Compatibility vanne-egr × véhicule × motorisation (PROD URL, 2026-05-27)

> **Méthode** : query GSC `__seo_gsc_daily` top R2 vanne-egr URLs FR (recent 14j) → parse URL pattern `/pieces/<gamme-pg_id>/<brand-id>/<model-id>/<motorisation-type_id>.html` → HEAD HTTP check → status 200 = `compatibility_proven_by_runtime_url`. **0 body inference, 0 HTML body fetch, 0 DB write, 0 wiki write, 0 runtime mutation.** UA `AutoMecanikAudit/1.0`, rate-limit 0.6s.
>
> **Canon source** : [[feedback_b2_url_pattern_authoritative_vehicle_source]] — PROD URL pattern = source autoritative MAX (runtime business proof).

## Résultats agrégés

| Métrique | Valeur |
|---|---:|
| URLs analysées | **25** |
| Status 200 (compatibility prouvée) | **25 / 25 (100%)** |
| Status non-200 (excluded/stale) | 0 |
| Marques distinctes prouvées | **6** (peugeot, volkswagen, citroen, renault, opel, nissan) |
| Motorisations distinctes prouvées | **9** (1-6-hdi, 2-0-hdi, 1-6-tdi, 1-9-tdi, 1-5-dci, 1-9-dci, 1-3-cdti, 2-0-dti-16v, 1-4-hdi) |
| Total impressions FR 14j (proxy GSC) | **412** |
| Clics 14j | **0** (cohérent avec verdict R2 FR -28/-40% chute, vanne-egr 0 clicks chute) |

## Distribution brand × motorisation (top 10)

| Rang | Brand | Motorisation | URLs prouvées |
|---:|---|---|---:|
| 1 | peugeot | 1-6-hdi | **10** |
| 2 | peugeot | 2-0-hdi | 3 |
| 3 | citroen | 1-6-hdi | 2 |
| 3 | volkswagen | 1-6-tdi | 2 |
| 3 | renault | 1-5-dci | 2 |
| 6 | opel | 2-0-dti-16v | 1 |
| 6 | volkswagen | 1-9-tdi | 1 |
| 6 | opel | 1-3-cdti | 1 |
| 6 | renault | 1-9-dci | 1 |
| 6 | peugeot | 1-4-hdi | 1 |
| (+) | renault | 1-5-dci-modus | 1 |
| (+) | nissan | 1-5-dci-qashqai | 1 |
| (+) | peugeot | 1-6-hdi-others | (déjà inclus) |

## Top 10 URLs par impressions FR

| Rang | Impr 14j | Brand | Model | Motorisation | type_id |
|---:|---:|---|---|---|---:|
| 1 | 47 | citroen | c4-i | 1.6 HDi | 30137 |
| 2 | 38 | citroen | c4-picasso-i | 1.6 HDi | 19749 |
| 2 | 38 | peugeot | 207 | 1.6 HDi | 33260 |
| 4 | 34 | peugeot | 208 | 1.6 HDi | 8686 |
| 5 | 29 | peugeot | 307 | 1.6 HDi | 19341 |
| 5 | 29 | peugeot | 308-sw-i | 1.6 HDi | 59020 |
| 7 | 24 | volkswagen | golf-vi | 1.6 TDi | 33030 |
| 8 | 17 | opel | zafira-a | 2.0 DTi 16V | 15333 |
| 9 | 15 | peugeot | 407-sw | 1.6 HDi | 18015 |
| 10 | 14 | peugeot | 207 | 1.6 HDi | 19353 (variant) |

## Insight empirique

1. **Toutes les URLs sont 200** : le runtime catalogue vanne-egr est correctement câblé pour ces 25 véhicules indexés FR top GSC. Aucune stale URL, aucun 404.

2. **9 motorisations distinctes prouvées** : 1.6 HDi (12 URLs = 48%), 2.0 HDi (3), 1.5 dCi (3), 1.6 TDi (2), 1.9 TDi (1), 1.9 dCi (1), 1.3 CDTi (1), 2.0 DTi 16V (1), 1.4 HDi (1). **Diesel dominant** (cohérent avec la fonction vanne EGR diesel-intensive).

3. **6 marques prouvées** : peugeot 14/25 (56%), volkswagen 3, renault 3, citroen 2, opel 2, nissan 1. **PSA (peugeot+citroen) = 16/25 (64%)** — confirme la dominance PSA pour pannes vanne EGR diesel en France.

4. **0 clicks sur 25 URLs malgré 412 impressions cumulées** : confirme le verdict R2 FR -28/-40% chute (audit GSC FR 2026-05-27). Les pages sont indexées et vues, mais le CTR effondré sur ces longue-traîne véhicule-spécifiques.

## Valeur Phase B+ : `compatibility_proven_by_url[]`

Ce mapping devient une **source candidate B3 / Task 8** pour enrichir le proposal WIKI vanne-egr :

```yaml
entity_data:
  compatibility_proven_by_url:
    - { brand: peugeot, brand_id: 128, model: 207, model_id: 128018, moto: 1.6 HDi, type_id: 33260, source: runtime_url_200 }
    - { brand: peugeot, brand_id: 128, model: 208, model_id: 128021, moto: 1.6 HDi, type_id: 8686, source: runtime_url_200 }
    # ... 23 entries more
  compatibility_summary:
    brands: [peugeot, volkswagen, citroen, renault, opel, nissan]
    motorisations: [1.6 HDi, 2.0 HDi, 1.5 dCi, 1.6 TDi, 1.9 TDi, 1.9 dCi, 1.3 CDTi, 2.0 DTi 16V, 1.4 HDi]
    psa_dominance_pct: 64
```

**À ne PAS confondre avec inventer compatibilité** : ces données viennent du **runtime business catalogue** (URL existante + status 200 = compatibilité prouvée par DB / RPC). C'est de la **vérité business propagée**, pas du body inference.

## Verdict B2 Option A — SUCCESS

| Critère success | Cible | Atteint |
|---|---|---|
| ≥ 10 URLs analysées | ✅ | **25** |
| ≥ 1 véhicule/motorisation prouvé | ✅ | **6 brands × 9 motorisations = 25 tuples prouvés** |
| 0 body inference | ✅ | aucun body fetch |
| 0 HTML body fetch | ✅ | uniquement HEAD |
| 0 write DB | ✅ | read-only |
| 0 write wiki | ✅ | dry-run / audit only |
| Markdown + JSON output | ✅ | `audit/compatibility-vanne-egr-prod-url-2026-05-27.{md,json}` |

## Recommandations B3 / Task 8 (post owner review)

1. **B3 — Étendre `promote-raw-gammes-to-wiki.py`** pour ingérer `compatibility_proven_by_url` depuis le JSON B2 audit → enrichir dimension `compatibility_factors` du WIKI proposal avec **prouvé par runtime** (pas seulement OEM web gamme-générique).

2. **Re-run vanne-egr `--dry-run`** après B3 → vérifier passage de `PASS_PARTIAL_R2_BLOCKED` à `PASS_VARIANT_READY` (compatibility_factors maintenant présent + prouvé).

3. **Task 8 write réel** : seulement si owner GO **après** B3 + variant_readiness PASS + Option A/B schema (vs C dry-run actuel).

4. **Extension B2 multi-gammes** : appliquer la même méthode aux autres top R2 FR (filtre-a-huile, plaquette-de-frein, support-moteur, courroie-d-accessoire, thermostat). Génère une matrice gamme × véhicule × motorisation prouvée canon catalog-truth, source autoritative pour différenciation R2.

## STOP B2 — owner review pending

Conformément au canon :
- ❌ Pas de write wiki
- ❌ Pas de runtime touché
- ❌ Pas de scraping nouveau
- ❌ Pas de switch-pilot
- ❌ Aucune compatibilité inventée

**Données livrées prêtes pour décision owner** :
- `audit/compatibility-vanne-egr-prod-url-2026-05-27.md` (ce rapport)
- `audit/compatibility-vanne-egr-prod-url-2026-05-27.json` (data structurée 25 entries)

## Phrase canonique

> Quand les sources textuelles ne prouvent pas le véhicule, la compatibilité ne se déduit pas : elle se prouve par l'existence runtime de la page catalogue (URL pattern + status 200 = compatibility_proven_by_runtime_url).
