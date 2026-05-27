# B3 multi-gammes — Evidence Summary (compatibility-url-json ingest sur 6 gammes) — 2026-05-27

> **Scope strict B3 multi-gammes** : appliquer `--compatibility-url-json <path>` à chaque JSON B2 individuel et mesurer l'upgrade `variant_readiness`. 6 gammes testées (vanne-egr témoin + 5 nouvelles). **0 write wiki, 0 schema modif, 0 runtime mutation, 0 DB write, 0 scraping nouveau, 0 body inference.**

## Verdict global — **6/6 gammes PASS_VARIANT_READY**

| Gamme | Avant (sans compat) | Après (avec --compat) | Delta | compat_factors |
|---|---|---|---|---|
| **vanne-egr** | `PASS_PARTIAL_R2_BLOCKED` | **`PASS_VARIANT_READY`** | ↑ | NEW |
| **filtre-a-huile** | `RAG_CANDIDATE_REQUIRES_REVIEW` | **`PASS_VARIANT_READY`** | ↑↑ (2 niveaux) | NEW |
| **plaquette-de-frein** | `RAG_CANDIDATE_REQUIRES_REVIEW` | **`PASS_VARIANT_READY`** | ↑↑ (2 niveaux) | NEW |
| **support-moteur** | `PASS_PARTIAL_R2_BLOCKED` | **`PASS_VARIANT_READY`** | ↑ | NEW |
| **courroie-d-accessoire** | `PASS_PARTIAL_R2_BLOCKED` | **`PASS_VARIANT_READY`** | ↑ | NEW |
| **thermostat** | `PASS_PARTIAL_R2_BLOCKED` | **`PASS_VARIANT_READY`** | ↑ | NEW |
| **Taux PASS_VARIANT_READY** | **0/6** | **6/6 (100 %)** | | |

## Détails clés par gamme (after B3 with --compatibility-url-json)

| Gamme | compatibility_proven_by_url | source_kind | dimensions_count | confirmed | OEM web | RAG cand |
|---|---:|---|---:|---:|---:|---:|
| vanne-egr | **25** | compatibility_proven_by_runtime_url | 7 | 6 | 2 | 1 |
| filtre-a-huile | **10** | compatibility_proven_by_runtime_url | ≥5 | ≥4 | ≥1 | 1 |
| plaquette-de-frein | **13** | compatibility_proven_by_runtime_url | ≥5 | ≥4 | ≥1 | 1 |
| support-moteur | **62** | compatibility_proven_by_runtime_url | ≥5 | ≥4 | ≥1 | 1 |
| courroie-d-accessoire | **50** | compatibility_proven_by_runtime_url | ≥5 | ≥4 | ≥1 | 1 |
| thermostat | **62** | compatibility_proven_by_runtime_url | 7 | 6 | 7 (3 tier1 + 3 tier2) | 1 |

## Anti-patterns canon respectés (vérifiés via run log per gamme)

- ✅ `anti_filler_pass: true` (6/6)
- ✅ `anti_filler_paraphrase_used: false` (6/6) — **0 body inference**
- ✅ `schema_valid: true` (6/6) — Option C maintenue
- ✅ `compatibility_factors_source_kind: compatibility_proven_by_runtime_url` (6/6)
- ✅ 0 write wiki (dry-run only)
- ✅ 0 schema modif
- ✅ 0 runtime mutation
- ✅ 0 DB write
- ✅ 0 scraping nouveau

## Insights B3 multi-gammes

1. **100 % succès upgrade** : la méthode `compatibility_proven_by_runtime_url` fonctionne uniformément sur 6 gammes (vanne-egr témoin + 5 nouvelles), 0 régression, 0 exception.

2. **2 gammes ont fait double upgrade** : `filtre-a-huile` et `plaquette-de-frein` partent de `RAG_CANDIDATE_REQUIRES_REVIEW` (RAG_ONLY pour fonctions/symptoms/criteria sans OEM web confirmation) et passent directement à `PASS_VARIANT_READY` grâce au compatibility_factors PROUVÉ par URL runtime, qui ajoute l'OEM Web tier1/tier2 nécessaire.

3. **Toutes les 6 gammes sont rag_recycled_candidate** (raw_is_rag_candidate=True) → confirme `feedback_rag_to_raw_candidate_requalification` canon : RAG legacy reste candidate, jamais auto-promu, **mais utilisable comme matière première** lorsque combiné avec preuve runtime.

4. **Volume URLs ingestible massif** : 222 tuples total (vanne-egr 25 + 5 nouvelles 172) prêts à enrichir compatibility_factors pour Task 8 future.

5. **Body inference = false partout** : aucune dimension n'a été inférée du body web (canon strict respecté).

## Pipeline empiriquement validé

```
B2 GSC query top R2 URLs FR per gamme
        ↓
B2 HEAD HTTP check status 200
        ↓
B2 JSON compatibility_proven_by_url[]   ← 222 tuples × 22 brands × 74 motos
        ↓
B3 promote-raw-gammes-to-wiki.py --compatibility-url-json
        ↓
B3 extract_dimensions enriches compatibility_factors with proven brands/motos
        ↓
variant_readiness PASS_VARIANT_READY  ← 6/6 gammes
```

## Limite empirique surfacée (limite NON bloquante)

Pour `filtre-a-huile` + `plaquette-de-frein`, le verdict initial `RAG_CANDIDATE_REQUIRES_REVIEW` (avant B3) signifie que l'OEM web Hella/NGK n'a pas corroboré les dimensions RAG candidate (function, symptoms, selection_criteria sont en `RAG_ONLY`). Le compatibility_factors B3 résout le R2-block mais ne valide pas humainement les dimensions textuelles candidate.

→ **Task 8 write réel reste bloqué** non seulement par schema Option C, mais aussi par **review humaine candidate** pour ces 2 gammes. La proposal frontmatter portera `review_status: proposed` + `requires_review: true`.

## Outputs livrés

| Fichier | Description |
|---|---|
| `audit/wiki-bootstrap-b3-multigammes-evidence-2026-05-27.json` | Evidence structuré complet before/after × 6 gammes |
| `audit/wiki-bootstrap-b3-multigammes-evidence-2026-05-27.md` | Ce rapport markdown |

## STOP B3 multi-gammes — owner review pending

Conformément au canon strict :
- ❌ Pas de write wiki (Task 8 reste bloqué)
- ❌ Pas de schema modif (Option C maintenue)
- ❌ Pas de runtime mutation
- ❌ Pas de B4 yet (à décider owner)
- ❌ Pas de scaling au-delà des 5+1 gammes pilotées

## Décisions possibles owner suivantes

**(B4) DB cross-check `auto_type` / `pg_aliases`** — étendre la matrice avec niveau autorité DB (URL 200 + DB tuple aligné = double-confirmation).

**(Task 8 write réel vanne-egr)** — nécessite résolution schema Option A (PR wiki schema `entity_data.dimensions`) OU Option B (PR vault canon). Aussi : owner validation manuelle du preview vanne-egr (RAG candidate dimensions textuelles requièrent review humaine).

**(B2/B3 sur d'autres gammes R2 FR)** — étendre la matrice aux gammes suivantes du top R2 FR (injecteur, kit-de-distribution, pompe-a-eau, sonde-lambda, alternateur, etc.).

**(STOP & OBSERVE jusqu'au 2026-06-08)** — tenir position avant scale, re-évaluer empirique trafic FR post-fenêtre.

## Phrase canonique gravée (étend B3 vanne-egr)

> Quand la compatibilité est prouvée par URL runtime, le pipeline WIKI bootstrap la transforme uniformément en `compatibility_factors_present=true` + `PASS_VARIANT_READY` sur toutes les gammes testées. **6/6 gammes PASS_VARIANT_READY, 0 body inference, 0 régression, 222 tuples × 22 brands × 74 motorisations.**
