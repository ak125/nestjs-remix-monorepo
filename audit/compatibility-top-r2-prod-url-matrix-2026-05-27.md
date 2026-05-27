# B2 Multi-gammes — Compatibility matrix R2 × véhicule × motorisation (PROD URL, 2026-05-27)

> **Méthode** : Supabase REST query top URLs FR recent_14d par gamme → parse URL pattern → HEAD HTTP check → status 200 = `compatibility_proven_by_runtime_url`. Rate-limit 0.4s. UA `AutoMecanikAudit/1.0`. **0 body inference, 0 HTML body fetch, 0 DB write, 0 wiki write, 0 runtime mutation.**

## Résultats globaux

| Gamme | URLs total | Status 200 (prouvées) | Non-200 | Brands | Motorisations |
|---|---:|---:|---:|---:|---:|
| **filtre-a-huile** | 10 | **10 (100%)** | 0 | **5** | **9** |
| **plaquette-de-frein** | 13 | **13 (100%)** | 0 | **5** | **10** |
| **support-moteur** | 62 | **62 (100%)** | 0 | **11** | **33** |
| **courroie-d-accessoire** | 50 | **50 (100%)** | 0 | **14** | **33** |
| **thermostat** | 62 | **62 (100%)** | 0 | **14** | **33** |
| **vanne-egr (B2 vanne-egr précédent)** | 25 | 25 (100%) | 0 | 6 | 9 |
| **TOTAL B2 multi-gammes (5 gammes)** | **197** | **197 (100%)** | **0** | (22 globaux) | (74 globaux) |

## 22 marques globales prouvées par runtime URL

`audi · bmw · chevrolet · citroen · dacia · fiat · ford · kia · mercedes-benz · mini · mitsubishi · nissan · opel · peugeot · renault · seat · skoda · smart · suzuki · toyota · volkswagen · volvo`

## 74 motorisations globales prouvées (sample)

`0-6 · 1-0 · 1-1 · 1-2 · 1-3-cdti · 1-3-d-multijet · 1-4 · 1-4-16v · 1-4-hdi · 1-4-tdci · 1-4-tdi · 1-5-bluehdi · 1-5-dci · 1-6 · 1-6-cooper-s · 1-6-hdi · 1-6-tdci · 1-6-tdi · 1-8 · 1-9-d · 1-9-dci · 1-9-dti · 1-9-tdi · 1-9-ddis · 2-0-bluehdi · 2-0-cdti · 2-0-d · 2-0-dci · 2-0-hdi · 2-0-tdci · 2-0-tdi · 2-2-d · 2-2-hdi · 2-3-dci-fwd · 2-3-dci-rwd · 2-5-dci · 2-8-hdi · 3-0-330-d · A-180-CDI · …`

## Distribution business par gamme

### filtre-a-huile (10 URLs proven)

- **5 brands** : ford, opel, peugeot, renault, skoda, vw, volvo, citroen
- **9 motorisations** : 1.6 d, 2.0 tdci, 2.0 tdi rs, 1.9 d, 1.6 tdi, 2.0 cdti, 1.5 dci, 1.1 i, 1.9 tdi, 2.0 bluehdi
- Volume très faible (10 URLs) — gamme à fort potentiel mais peu d'URLs indexées top GSC FR. Suggère problème indexation/maillage.

### plaquette-de-frein (13 URLs proven)

- Concentré sur PSA (peugeot 208 1.2 puretech = 57 impr / 75 % du volume)
- Faible diversité véhicule pour une gamme G1 (catalogue #3 site, 107K pièces)
- Cohérent avec carveout `INDEXATION_GAP` (Impact 95 + Reach 5)

### support-moteur (62 URLs proven)

- **Forte diversité** : 11 brands × 33 motorisations
- Top R2 FR : Renault R19 II 1.8 (22 impr), Dacia Duster 1.5 dCi (18), Renault Kangoo BeBop 1.5 dCi (16)
- Renault dominant (≥40%) — cohérent dépendance constructeurs français

### courroie-d-accessoire (50 URLs proven)

- 14 brands × 33 motorisations — **plus diversifié**
- Top R2 : Peugeot Partner I 1.9 d (52 impr), Peugeot 207 1.4 16V (32, 1 click — seule conversion)
- Mix essence + diesel (notamment Renault Symbol 1.4 16V, Peugeot 206 1.1)

### thermostat (62 URLs proven)

- 14 brands × 33 motorisations
- Top R2 : VW Golf VI 1.6 TDi (15 impr), Skoda Yeti 2.0 TDi 4x4 (8), Citroën AX (8)
- **1 click seulement sur 62 URLs** (Skoda Yeti) → CTR très bas, cohérent verdict GSC R2 FR -32%

## Insights B2 multi-gammes

1. **100% status 200** sur 197 URLs : aucune URL stale, catalogue runtime PROD entièrement câblé pour les top R2 FR indexées GSC.

2. **22 brands × 74 motorisations distinctes** : la diversité catalog-truth est très grande, **bien au-delà** du body-content gamme-générique des 418 web files (qui mentionne 10 brands sans relation explicite).

3. **PSA + Renault dominance** : peugeot/citroen + renault représentent 50-65% des URLs proven (cohérent marché FR + verdict R2 FR converti via R2 véhicule-aware).

4. **Distribution clic catastrophique** : seulement 4 URLs sur 197 ont 1 click (1 plaquette + 1 support-moteur + 1 thermostat + 2 courroie-d-accessoire). **Verdict CTR R2 FR effondré confirmé.**

5. **Filtre-a-huile / plaquette-de-frein sous-indexés** : 10-13 URLs alors que ce sont les gammes G1 top catalogue. Suggère **gap indexation Google** (cohérent INDEXATION_GAP carveout RICE).

## Valeur Phase B+ : matrice exploitable

Le JSON matrix global est désormais une **source candidate B3** pour enrichir n'importe quelle gamme du top 5 :

```bash
# Test rerun par gamme (à valider post B3 extension multi-gamme)
python3 scripts/wiki-generators/promote-raw-gammes-to-wiki.py \
  --gamme thermostat --dry-run --verbose \
  --compatibility-url-json audit/compatibility-thermostat-prod-url-2026-05-27.json
```

Chaque gamme aura sa propre matrice `compatibility_proven_by_runtime_url` enrichie de :
- N tuples (brand, model, motorisation, type_id, source_uri, status 200)
- distinct brands
- distinct motorisations
- proof = runtime_url_status_200

## Conformité canon B2

- ✅ 0 body inference
- ✅ HEAD-only HTTP (status code uniquement)
- ✅ 0 HTML body fetch
- ✅ 0 DB write
- ✅ 0 wiki write
- ✅ 0 runtime mutation
- ✅ 0 nouveau scraping
- ✅ Rate-limit conservateur (0.4s)
- ✅ UA identifiable
- ✅ Source autoritative = PROD URL pattern (catalog-truth runtime business)
- ✅ Status 200 = compatibility_proven_by_runtime_url
- ✅ Status non-200 → excluded (jamais inclus)

## Outputs livrés

| Fichier | Description |
|---|---|
| `audit/compatibility-filtre-a-huile-prod-url-2026-05-27.json` | 10 entries |
| `audit/compatibility-plaquette-de-frein-prod-url-2026-05-27.json` | 13 entries |
| `audit/compatibility-support-moteur-prod-url-2026-05-27.json` | 62 entries |
| `audit/compatibility-courroie-d-accessoire-prod-url-2026-05-27.json` | 50 entries |
| `audit/compatibility-thermostat-prod-url-2026-05-27.json` | 62 entries |
| `audit/compatibility-vanne-egr-prod-url-2026-05-27.json` | 25 entries (B2 précédent) |
| `audit/compatibility-top-r2-prod-url-matrix-2026-05-27.json` | matrix globale 197 entries × 22 brands × 74 motos |

## STOP B2 multi-gammes — owner review pending

Conformément au canon owner :
- ❌ Pas de write wiki (Task 8 reste bloqué)
- ❌ Pas de schema modif (Option C maintenue)
- ❌ Pas de runtime H1/title/canonical touché
- ❌ Pas de B3 multi-gammes auto (à décider owner)
- ❌ Pas de B4 DB cross-check yet (à décider owner)
- ❌ Pas de scraping nouveau

## Décisions possibles owner suivantes

**(A) B3 multi-gammes** — appliquer `--compatibility-url-json` à chaque JSON B2 individuel → rerun par gamme et mesurer combien passent en `PASS_VARIANT_READY`. Estimation : 4-5 gammes sur 5 devraient PASS (filtre-a-huile + plaquette-de-frein potentiellement `PASS_PARTIAL` faute de RAW SSOT v5 propre).

**(B) B4 DB cross-check `auto_type`** — étendre B2 pour cross-checker avec tables `auto_type/pg_aliases` runtime DB. Renforce l'autorité du tuple (URL 200 + DB pg_id × type_id alignés).

**(C) Task 8 write réel vanne-egr** — nécessite Option A (PR wiki schema avec entity_data.dimensions). Toujours bloqué tant que schema non-résolu.

**(D) STOP & OBSERVE jusqu'au 2026-06-08** — tenir position avant scale.

## Phrase canonique gravée (étend B2 vanne-egr)

> La compatibilité ne se déduit pas, elle se prouve par l'existence runtime de la page catalogue. B2 multi-gammes confirme : **197 tuples prouvés × 22 brands × 74 motorisations** sur 5 gammes R2 FR critiques, 0 body inference, 0 stale URL.
