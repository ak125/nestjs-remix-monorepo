# B5 — DB-rich dimensions ingest (compatibility_proven_by_runtime_url_and_db) — 2026-05-27

> **Scope strict B5** : consommer le JSON B4 cross-check comme input enrichi, transformer 219 PASS_DB_ALIGNED tuples en dimensions DB-rich (fuels, power_ps_range, year_range, motorisation_profiles[]). Filter STALE_URL_DB_MISSING. **0 DB query, 0 write wiki, 0 schema modif, 0 runtime mutation, 0 body inference.**

## Verdict global — **6/6 PASS_VARIANT_READY** avec source `compatibility_proven_by_runtime_url_and_db`

| Gamme | Status | source_kind | Tuples proven (PASS_DB_ALIGNED) | Stale exclus |
|---|---|---|---:|---:|
| **vanne-egr** | `PASS_VARIANT_READY` | `compatibility_proven_by_runtime_url_and_db` | **25** | 0 |
| **filtre-a-huile** | `PASS_VARIANT_READY` | idem | **9** (1 stale exclu) | 1 |
| **plaquette-de-frein** | `PASS_VARIANT_READY` | idem | **12** (1 stale exclu) | 1 |
| **support-moteur** | `PASS_VARIANT_READY` | idem | **61** (1 stale exclu) | 1 |
| **courroie-d-accessoire** | `PASS_VARIANT_READY` | idem | **50** | 0 |
| **thermostat** | `PASS_VARIANT_READY` | idem | **62** | 0 |
| **TOTAL** | **6/6 PASS** | uniformly upgraded | **219** | **3** (correctly excluded) |

## Compatibility_factors enrichi (sample vanne-egr)

```yaml
compatibility_factors:
  source_kind: compatibility_proven_by_runtime_url_and_db
  marques: [citroen, nissan, opel, peugeot, renault, volkswagen]      # 6 brands
  motorisations: [1-3-cdti, 1-4-hdi, 1-5-dci, 1-6-hdi, 1-6-tdi,
                  1-9-dci, 1-9-tdi, 2-0-dti-16v, 2-0-hdi]              # 9 URL slugs
  fuels: ['Diesel', 'Essence']                                         # NEW B5 (depuis db_type_fuel)
  power_ps_range:                                                      # NEW B5
    min: 90
    max: 200
    count: 23
  year_range:                                                          # NEW B5
    min: 1998
    max: 2018
  type_ids: [8686, 11074, 12246, ...]                                  # NEW B5 (canon DB)
  db_aligned_count: 25                                                 # NEW B5
  stale_count: 0                                                       # NEW B5
  proven_url_count: 25
  brand_motorisation_pairs: [25 tuples]
  model_count_distinct: 17

motorisation_profiles:                                                  # NEW B5 — rich profile per vehicle-moto
  - brand: peugeot
    brand_name: PEUGEOT
    model: 207
    model_name: 207
    type_id: 33260
    type_name: 1.6 HDi
    fuel: Diesel
    power_ps: 90
    year_from: 2009
    year_to: 2014
    source_url: https://www.automecanik.com/pieces/vanne-egr-1145/peugeot-128/207-128018/1-6-hdi-33260.html
    db_status: PASS_DB_ALIGNED
  - ... 24 more
```

→ **Différenciation R2 véhicule × motorisation maintenant exploitable** : Peugeot 207 1.6 HDi 90ch 2009-2014 ≠ Peugeot 208 1.6 HDi 8686 (autres années/refs). Le proposal WIKI peut désormais produire des H1/title véhicule-aware avec faits techniques distincts par variante.

## Conformité canon B5 respectée

- ✅ 0 body inference (anti_filler_paraphrase_used: false × 6/6)
- ✅ 0 DB query (B5 consomme le JSON B4, jamais Supabase direct)
- ✅ schema_valid: true × 6/6 (Option C maintenue)
- ✅ STALE_URL_DB_MISSING (3 entries) exclues des confirmed dimensions
- ✅ source_kind upgraded uniformly to `compatibility_proven_by_runtime_url_and_db`
- ✅ 0 write wiki / 0 schema modif / 0 runtime mutation
- ✅ Task 8 reste bloqué

## Pipeline empiriquement validé end-to-end

```
B2 GSC URL pattern + HEAD 200            → 222 URLs proven (100 %)
            ↓ (read-only)
B4 DB cross-check pieces_gamme/auto_*    → 219 PASS_DB_ALIGNED (98.6 %) + 3 STALE excluded
            ↓ (read-only JSON consumption)
B5 extract_dimensions enriched           → compatibility_factors + fuels + power_ps_range + year_range
   + motorisation_profiles[] (DB-rich)     + 219 motorisation_profiles total across 6 gammes
            ↓
variant_readiness                         → 6/6 PASS_VARIANT_READY
            ↓
(Task 8 write réel — bloqué par schema Option A + owner validation)
```

## Insights B5

1. **6/6 PASS_VARIANT_READY uniformly** : la combinaison runtime URL + DB catalog améliore la qualité de la matrice sans casser aucune gamme.

2. **`motorisation_profiles[]` est la vraie nouveauté** : pour la première fois, le pipeline produit des tuples véhicule × motorisation × type_name × fuel × power_ps × years **prouvés par 2 niveaux d'autorité**. C'est la donnée canonique nécessaire pour générer des H1/title R2 réellement différenciés (par exemple `Vanne EGR PEUGEOT 207 1.6 HDi 90ch 2009-2014` vs `Vanne EGR PEUGEOT 208 1.6 HDi 90ch 2012-2019`).

3. **STALE_URL_DB_MISSING correctement filtrées** : 3 tuples (Peugeot Boxer III 2.0 BlueHDi, Peugeot 208 1.2 PureTech récent, BMW X1 F48) gardés en `warnings` mais exclus de `compatibility_proven_by_url`. Pas d'invention ni promotion automatique.

4. **fuels canonisés depuis DB** : `Diesel`, `Essence`, parfois `Hybride` selon gamme — issus de `auto_type.type_fuel` (DB authoritative), pas regex body inference.

5. **power_ps_range + year_range** : extensions immédiatement exploitables pour blocs H2 R2/R8 "Fiche technique compatible".

## Documents livrés

- `audit/wiki-bootstrap-b5-db-rich-dimensions-2026-05-27.json` — per_gamme_results × 6 gammes
- `audit/wiki-bootstrap-b5-db-rich-dimensions-2026-05-27.md` — ce rapport
- 7 nouveaux tests B5 TDD PASS (total 53/53 tests pytest)

## STOP B5 — owner review pending

Conformément au canon strict :
- ❌ Pas de write wiki (Task 8 reste bloqué par schema Option A + owner validation)
- ❌ Pas de schema modif (Option C maintenue)
- ❌ Pas de runtime mutation
- ❌ Pas de fix automatique des 3 STALE_URL (= ops infrastructure data ingest, hors-scope agent)
- ❌ Pas d'extension multi-gammes supplémentaire (B2/B3 sur autres top R2 FR)

## Décisions possibles owner suivantes

**(Task 8 write réel vanne-egr)** — schema Option A maintenant clairement justifié : compatibility_factors prouvée 2 niveaux × motorisation_profiles[] rich → entity_data.dimensions vaut la modif schema. Path de référence ADR-033 (vault status: proposed, sas wiki workflow).

**(B6 extension multi-gammes)** — appliquer B2→B3→B4→B5 sur top R2 FR suivantes (injecteur, kit-de-distribution, pompe-a-eau, alternateur, sonde-lambda). Matrice étendue.

**(Ops B-stale)** — investiguer ingest pipeline `auto_type` pour les 3 STALE détectées. Hors-scope agent.

**(STOP & OBSERVE jusqu'au 2026-06-08)** — tenir position. Re-mesurer trafic FR post-fenêtre.

## Phrase canonique gravée (étend B2→B4)

> Le triple-niveau d'autorité (URL runtime 200 + DB catalog canon + DB-rich labels) transforme 219 tuples bruts en **219 motorisation_profiles** exploitables pour différenciation R2/R8. fuels canonisés, power_ps_range, year_range et type_name fournissent les faits techniques nécessaires pour générer des H1/title véhicule-aware sans paraphrase, sans body inference. **6/6 gammes PASS_VARIANT_READY avec source_kind `compatibility_proven_by_runtime_url_and_db`.**
