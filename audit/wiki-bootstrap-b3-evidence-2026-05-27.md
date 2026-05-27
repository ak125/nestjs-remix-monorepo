# Phase B3 — Evidence Summary (compatibility-url-json ingest) — 2026-05-27

> **Scope strict B3** : intégrer le JSON B2 (`audit/compatibility-vanne-egr-prod-url-2026-05-27.json`) comme input prouvé dans `promote-raw-gammes-to-wiki.py`. Rerun vanne-egr `--dry-run` doit upgrader `PASS_PARTIAL_R2_BLOCKED` → `PASS_VARIANT_READY`.

## Upgrade empirique vanne-egr `--dry-run`

| Métrique | Phase A | B1 | B2 (audit) | **B3 (avec --compatibility-url-json)** |
|---|---:|---:|---:|---:|
| web_corpus_files | 0 | 2 | 2 | **2** |
| dimensions_count | 5 | 6 | 6 | **7** (+1 compatibility_factors enrichi) |
| dimensions_confirmed | 2 | 5 | 5 | **6** (+1) |
| compatibility_factors_present | ❌ | ❌ | ❌ | **✅** |
| compatibility_proven_by_url_count | 0 | 0 | 0 | **25** |
| compatibility_factors_source_kind | n/a | n/a | n/a | **`compatibility_proven_by_runtime_url`** |
| **variant_readiness** | `RAG_CANDIDATE_REQUIRES_REVIEW` | `PASS_PARTIAL_R2_BLOCKED` | (audit only) | **`PASS_VARIANT_READY`** ✅ |
| schema_valid | True | True | n/a | **True** |
| anti_filler.pass | True | True | n/a | **True** |
| body inference used | ❌ | ❌ | ❌ | ❌ (canon strict) |

## Source de l'upgrade

`compatibility_factors` enrichi depuis B2 JSON :

```yaml
compatibility_factors:
  marques: [citroen, nissan, opel, peugeot, renault, volkswagen]      # 6 marques prouvées
  motorisations: [1-3-cdti, 1-4-hdi, 1-5-dci, 1-6-hdi, 1-6-tdi,
                  1-9-dci, 1-9-tdi, 2-0-dti-16v, 2-0-hdi]              # 9 motorisations prouvées
  brand_motorisation_pairs: [25 tuples]                                 # détail brand × moto
  model_count_distinct: 17
  proven_url_count: 25
  source_kind: compatibility_proven_by_runtime_url                      # canon B2
```

## Critères de succès B3

| Critère | Cible | Atteint |
|---|---|---:|
| `--compatibility-url-json` CLI flag accepté | ✅ | OK |
| 25 tuples ingestés (status 200 only) | ✅ | OK |
| compatibility_factors_present = true | ✅ | OK |
| Motorisations distinctes ≥ 6 | ✅ | **9** |
| Marques distinctes ≥ 3 | ✅ | **6** |
| `source_kind: compatibility_proven_by_runtime_url` marqué | ✅ | OK |
| variant_readiness != PASS_PARTIAL_R2_BLOCKED | ✅ | **PASS_VARIANT_READY** |
| 0 body inference | ✅ | canon strict respecté |
| 0 wiki write | ✅ | dry-run only |
| 0 schema modif | ✅ | Option C maintenue |
| Tests pytest TDD | 6+ | **7 nouveaux tests B3 PASS** |

## Tests B3 livrés (TDD)

1. `test_read_compatibility_url_json` — charge B2 JSON, filtre status 200
2. `test_reject_non_200_url_compatibility` — exclus 404/non-200
3. `test_extract_motorisations_from_runtime_url_json` — 6 brands × 9 motorisations
4. `test_extract_dimensions_with_compatibility_url_proof` — enrichit compatibility_factors
5. `test_variant_readiness_upgrades_with_runtime_url_proof` — upgrade vérifié
6. `test_no_body_inference_used` — canon strict (body jamais source compat)
7. `test_cli_accepts_compatibility_url_json_flag` — CLI E2E end-to-end

**46/46 tests pytest PASS total** (Phase A 30 + B1 9 + B3 7).

## Anti-patterns canon respectés

- ❌ Pas de write wiki (dry-run only)
- ❌ Pas de schema modif (Option C maintenue)
- ❌ Pas de runtime H1/title/canonical/sitemap touché
- ❌ Pas de DB write
- ❌ Pas de scraping nouveau
- ❌ Pas de multi-gammes (vanne-egr ciblé strict)
- ❌ Task 8 reste bloqué
- ❌ 0 body inference (canon `feedback_b1_correction_loop_canon`)
- ❌ Pas d'invention de compatibilité — source = `compatibility_proven_by_runtime_url` (B2 status 200)

## Commits B3

| Commit | Description |
|---|---|
| 859f505d3 | feat(wiki-bootstrap): b3 compatibility-url-json ingest (pass_variant_ready) |
| (à venir) | docs(audit): b3 evidence summary |

## STOP B3 — owner review pending

Conformément au canon `feedback_b1_correction_loop_canon` et instruction owner :

> **Task 8 reste bloqué jusqu'à :**
> 1. B3 PASS_VARIANT_READY ✅ (atteint)
> 2. schema Option A/B résolue (Phase A maintenue Option C)
> 3. owner validation du preview vanne-egr

## Décisions possibles owner suivantes

**(Task 8 — write réel vanne-egr.md)** : nécessite Option A (PR wiki schema avec entity_data.dimensions) ou Option B (PR vault canon). Phase A maintenue Option C → write reste bloqué tant que schema non résolu.

**(B2 multi-gammes)** : appliquer méthode B2 sur top R2 FR (filtre-a-huile, plaquette-de-frein, support-moteur, courroie-d-accessoire, thermostat) → 5 JSON additionnels.

**(B4 — intégration runtime cross-check)** : étendre B3 pour aussi cross-checker avec `auto_type` table DB (pg_id × type_id × motorisation canonical) — niveau autorité supplémentaire.

**(STOP & OBSERVE)** : tenir position jusqu'au 2026-06-08 (fin OBSERVE), revue empirique post-fenêtre avant toute scale.

## Phrase canonique gravée

> Quand les sources textuelles ne prouvent pas le véhicule, la compatibilité ne se déduit pas : elle se prouve par l'existence runtime de la page catalogue (URL pattern + status 200 = `compatibility_proven_by_runtime_url`). B3 confirme empiriquement : `PASS_VARIANT_READY` atteint pour vanne-egr avec 25 tuples prouvés × 6 brands × 9 motorisations, 0 body inference.
