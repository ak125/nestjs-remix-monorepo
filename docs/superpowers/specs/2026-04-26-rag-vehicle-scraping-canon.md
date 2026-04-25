# RAG Vehicle Scraping — Canon Path (propose-before-write)

**Date** : 2026-04-26
**Branche** : `feat/rag-vehicle-scraping-canon`
**CEO directive** : "plus il y a enrichissement plus on peut varier les contenus" — la priorité est l'acquisition de **faits factuels distinguants par motorisation** (couple, vmax, masse, code moteur, norme Euro, période détaillée), à câbler ensuite sur le rendu R8.

## Diagnostic factuel (mesuré 2026-04-26)

Jaccard mesuré sur HTML rendu prod entre 2 motorisations sœurs Clio III 1.5 dCi (64 ch vs 68 ch) : **83.2 %**. 292 tokens communs, 14 + 45 uniques (presque tous des codes pièces, peu de tokens sémantiques distinctifs).

PR #185 (frontend distinct render) seul = baisse estimée à 70-75 %. Toujours au-dessus du seuil 40 %.

**Cause racine** : la DB `auto_type` n'a que ~6 champs distinctifs (puissance, body, fuel, period, type_name, cylindrée). Les **vrais faits différenciants par motorisation** (couple, vmax, masse, code moteur K9K vs D4F) ne sont pas en DB.

## Stratégie

Acquisition de ces faits **via web scraping**, écrits dans le RAG `vehicles/<slug>.md` mais **uniquement via `__rag_proposals`** (ADR-022 L1 — propose-before-write, jamais d'écriture disque directe).

## Stack récupérée (commit tip 78324b28 de la PR #172 fermée)

- `scripts/rag/download-vehicle-motor-corpus.py` (724 LOC) — scraper : download HTML web → scratch dir `web-vehicles/`. **Zéro write RAG.** Safe.
- `data/vehicles_known_urls.csv` — URLs Clio III curated par l'utilisateur (Wikipedia FR/EN, lacentrale, autotitre, fiches-auto).
- (à venir) `scripts/rag/rag-propose-vehicle-from-web.py` — enricher mode propose. Réécrit depuis l'ancien `rag-enrich-vehicle-from-web.py` (closed PR #172) qui faisait du direct-write `vehicles/*.md` → maintenant écrit dans `__rag_proposals` avec status `pending`.

## Mécanique propose-before-write

Pour chaque modèle (e.g. Clio III, modele_id=140004) :

1. **Read** : charge le contenu actuel de `rag/knowledge/vehicles/clio-iii.md` (peut être vide / inexistant)
2. **Compute** : génère le nouveau contenu enrichi avec les motorisations[] scrapées
3. **Hash** : calcule `base_content_hash`, `proposed_content_hash`, `input_fingerprint` (déterministe sur les inputs scraping)
4. **Diff** : `diff_unified` pour reviewing
5. **Validate** : forbidden_terms_found + schema_valid + risk_level (low/medium/high selon nb lignes ajoutées)
6. **INSERT** dans `__rag_proposals` avec :
   - `target_path` = `vehicles/clio-iii.md`
   - `target_kind` = `vehicle`
   - `status` = `pending`
   - `expires_at` = J+14
   - `created_by` = `rag-vehicle-scraper-canon-v1`
7. **Aucune écriture disque.** Le merge dans `vehicles/clio-iii.md` se fait par un autre processus après approbation manuelle.

## Champs cibles par motorisation

Extraits par motorisation type_id (validés cross-source ≥2 confirmations) :

| Champ | Source primaire | Confirmation |
|---|---|---|
| `code_moteur` (K9K, D4F) | Wikipedia FR | fiches-auto |
| `couple_nm` | fiches-auto | autotitre |
| `couple_rpm` | fiches-auto | — |
| `power_rpm` | fiches-auto | Wikipedia |
| `vitesse_max_kmh` | fiches-auto | Wikipedia |
| `zero_a_cent_s` | fiches-auto | Wikipedia |
| `masse_kg` | fiches-auto | — |
| `boite` (5/6 vitesses, manuelle/auto) | fiches-auto | — |
| `norme_euro` | dérivé `derive_euro(year_from)` | — |
| `période_mensuelle` | DB `type_month_*` | — |

## Gouvernance — directive CEO 2026-04-26

ADR-022 ligne 73 dit "Stage 2 canary 10 modèles low-profile (PAS Clio/208/Golf)". Le CEO @fafa a explicitement dirigé que **l'enrichissement scraping est la priorité depuis le début** et que le pilote se fait sur **Clio III**.

Décision documentée :
- Pilote = Clio III (modele_id 140004) en directive CEO override de la ligne 73 ADR-022
- Vault PR séparée à ouvrir pour amender ADR-022 ligne 73 : ajouter "Stage 2 canary peut inclure des modèles top-trafic sur directive board"
- Les écritures restent en propose-before-write (L1 respecté)
- 2-3 motorisations Clio III en proposal pilot, review board avant merge

## Articulation avec PR #185 (frontend)

PR #185 et cette PR sont **indépendantes** et **complémentaires** :

- PR #185 : utilise data DB existante (auto_type, diag_*, switches) → gain Jaccard 83 → 70 %
- Cette PR : ajoute des champs scraping au RAG → après merge de proposals, le frontend (TechSpecsSection ou nouvelle MotorFactsSection) lit ces nouveaux champs → gain Jaccard 70 → 30-40 %

Les 2 PRs peuvent merger dans n'importe quel ordre. La mesure post-merge des deux ensemble = vraie validation.

## Hors scope explicite

- ❌ Direct-write `vehicles/*.md` (interdit par ADR-022 L1)
- ❌ Scraping de modèles autres que Clio III dans cette PR (1 pilote, mesure, puis Stage 2 canary low-profile en PR séparée)
- ❌ Frontend modifications (couvert par PR #185)
- ❌ LLM-based extraction (parsers déterministes uniquement)

## Réversibilité

- Si proposals rejected → status='rejected', aucune modification RAG
- Si proposals approved + merged → écriture RAG via processus séparé
- Le scraper n'écrit que dans `web-vehicles/` (scratch dir, gitignored)
- Le proposeur écrit uniquement dans `__rag_proposals` table (aucune table de prod touchée)

## Refs

- ADR-022 R8 RAG Control Plane (vault, accepted 2026-04-25)
- PR fermée #172 (monorepo, scraping direct-write — bricolage rejeté)
- PR fermée #3 (rag, vehicles/*.md direct-write — bricolage rejeté)
- Honest debrief : `governance-vault/ledger/knowledge/r8-vehicle-enrichment-stage1-honest-debrief-20260425.md`
- PR #185 frontend distinct render (parallèle, complémentaire)
