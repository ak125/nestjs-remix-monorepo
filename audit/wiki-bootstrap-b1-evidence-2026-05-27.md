# Phase B1 — Evidence Summary (avant/après) — 2026-05-27

> **Scope strict B1** : gap détecté Phase A (418 fichiers web frontmatter indenté, parser inopérant) → correction ciblée parser tolérant + nested relation extractor + rerun même pilote vanne-egr. Doctrine correction-loop sans switch-pilot, sans nouveau scraping, sans write wiki. Branch `feat/wiki-bootstrap-promote-raw-gammes-2026-05-27`.

## Verdict empirique — vanne-egr `--dry-run`

| Métrique | Phase A (avant B1) | Phase B1 (après) | Δ |
|---|---:|---:|---|
| web_corpus_files matched | **0** | **2** (Hella + NGK) | +2 |
| oem_sources_count | 0 | 2 | +2 |
| tier1_sources_count | 0 | 0 | 0 (Hella/NGK non listés Tier1) |
| tier2_sources_count | 0 | 0 | 0 (pas Wikipedia ici) |
| rag_candidate_sources_count | 1 | 1 | 0 |
| dimensions_count | 5 | **6** | +1 |
| dimensions_confirmed_count | 2 | **5** | **+3** ✅ |
| **variant_readiness** | `RAG_CANDIDATE_REQUIRES_REVIEW` | **`PASS_PARTIAL_R2_BLOCKED`** | **upgrade** ✅ |
| schema_valid | True | True | = |
| anti_filler.pass | True | True | = |
| web_with_vehicle_evidence | n/a | **0** | (parsed correctly, 0 fontmatter vehicles) |
| web_no_vehicle_evidence | n/a | **2** | (NO_VEHICLE_EVIDENCE explicit) |

## Causes du status `PASS_PARTIAL_R2_BLOCKED`

`compatibility_factors` reste absent → R2-sensitive blocked. Cause :
- 2 fichiers web matchés (Hella + NGK) sont du contenu **gamme-générique OEM** (pas véhicule-aware).
- `extract_dimensions` ne trouve aucune `motorisation` / `norme_euro` dans le body (les pages Hella expliquent les types pneumatique/électrique sans cibler motorisation spécifique).
- **NO_VEHICLE_EVIDENCE** correct : aucun champ `vehicles:` dans frontmatter source → jamais inventé.

## Découverte structurelle : 2 conventions web corpus

| Convention | Volume | Frontmatter | Champ gamme | truth_level |
|---|---:|---|---|---|
| **A** (indenté) | 418 fichiers | indenté 8 espaces (`        ---`) | `slug_gamme:` scalar | L2 |
| **B** (Hella/NGK + OEM) | (~20) | non-indenté `---` | `mapped_gammes:` array | L3 |

**Avant B1.1** : regex `^---\n` ne matchait que Convention B → 0 fichier pour la plupart des gammes.
**Après B1.1** : `FRONTMATTER_RE = r'^([ \t]*)---\n(.*?)\n\1---\n(.*)$'` supporte les 2.
**Après B1.2** : `_web_file_matches_slug()` accepte `slug_gamme` scalar OR `mapped_gammes` array.

## Commits Phase B1

| Commit | Description |
|---|---|
| 4385979f2 | B1.1 — tolerant frontmatter parser (5 tests fixture) |
| de9a3057c | B1.2 — web relation extractor + NO_VEHICLE_EVIDENCE (4 tests) |
| (à venir) | B1.3 — rerun evidence + cluster audit Clio III 1.5 dCi |

## Anti-patterns respectés

- ❌ Pas de nouveau scraping (B2 si nécessaire après owner review)
- ❌ Pas de modification H1/title runtime
- ❌ Pas de write wiki (Task 8 reste bloqué)
- ❌ Pas de `--scope canon-237` (vanne-egr only, single-gamme rerun)
- ❌ Pas de DB write
- ❌ Pas de schema Option A forcée (Option C maintenue)
- ❌ Pas de compatibilité véhicule inventée — `NO_VEHICLE_EVIDENCE` explicite

## Tests pytest

- Phase A : 30 tests PASS
- Phase B1.1 : +5 tests parser (incl. real indented file)
- Phase B1.2 : +4 tests web_relations (incl. **NEVER_invents_vehicle**)
- **Total : 39 tests pytest PASS**

## Verdict B1 par critère success

| Critère | Cible | Atteint |
|---|---|---:|
| ≥ 1 web source matched | ✅ | **2** (Hella + NGK) |
| ≥ 1 relation gamme détectée | ✅ | **2** (mapped_gammes / slug_gamme) |
| ≥ 1 relation vehicle/motorisation OU NO_VEHICLE_EVIDENCE | ✅ | **2 NO_VEHICLE_EVIDENCE explicites** |
| ≥ 3 dimensions confirmed_by_web | ✅ | **5 dimensions confirmed** |
| candidate/confirmed bien séparés | ✅ | source_refs flag `rag_recycled_candidate` + `oem_web` séparés |

**Status final B1 : SUCCESS — status acceptable `PASS_PARTIAL_R2_BLOCKED` (cause claire = compatibility_factors absent).**

## Limite empirique surfacée

Les pages OEM matchées (Hella + NGK) sont du contenu **gamme-générique**, pas véhicule-spécifique. Pour R2 différenciation véhicule (Clio 4 1.5 dCi vs Peugeot 308 2.0 HDi), il faudra :
- soit ajouter des fichiers web véhicule-aware au corpus (Phase B2 — scraping ciblé vehicle pages)
- soit faire B1c **audit cluster réel** sur pages live R8/R2 Clio III 1.5 dCi pour mesurer le near-duplicate structurel actuel.
