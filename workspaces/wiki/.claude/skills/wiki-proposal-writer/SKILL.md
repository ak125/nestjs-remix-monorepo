---
name: wiki-proposal-writer
description: Génère une fiche `automecanik-wiki/proposals/<slug>.md` au format frontmatter ADR-033 v2.0.0 strict. Mode propose-only (jamais d'écriture canon `wiki/<entity_type>/`, jamais de DB). Lit `automecanik-raw/{sources,recycled,normalized}/` comme source de vérité. Produit coverage manifest AEC v1.0.0 obligatoire. Use when user asks to "create a proposal", "draft a wiki gamme", "ajouter une proposal", etc. Pour migration legacy `entity_data.symptoms[]` → `diagnostic_relations[]`, utiliser plutôt le script `scripts/wiki/migrate-symptoms-to-relations.ts` (PR-E ADR-033) — pas ce skill.
---

# Wiki Proposal Writer

## Mission

Produire **un seul** fichier `automecanik-wiki/proposals/<slug>.md` par invocation, conforme au schema frontmatter v2.0.0 ADR-033, prêt pour revue humaine et promotion vers `wiki/<entity_type>/`.

Le skill est **propose-only** : il n'écrit jamais dans `wiki/<entity_type>/` (canon), ni dans la DB Supabase, ni dans les `exports/`. Toute fiche produite reste sous review humain avant promotion.

## Scope autorisé / interdit

| Lecture | Écriture |
|---|---|
| ✅ `automecanik-raw/{sources,recycled,normalized}/` (matière brute) | ✅ `automecanik-wiki/proposals/<slug>.md` (1 fiche par invocation) |
| ✅ `automecanik-wiki/_meta/` (canon templates, schemas, source-catalog) | ❌ `automecanik-wiki/wiki/<entity_type>/` (canon) |
| ✅ `automecanik-wiki/exports/diag-canon-slugs.json` (FK `__diag_symptom`) | ❌ DB Supabase (toute table `__*`, `kg_*`) |
| ✅ `automecanik-wiki/wiki/<entity_type>/` (lecture seule, anti-duplication slug) | ❌ `automecanik-rag/knowledge/` (RAG repo, géré par sync-from-wiki Partie 3) |
| ✅ governance-vault canon ADR-031/032/033 (référence) | ❌ `automecanik-wiki/exports/` (auto-généré par PR-D cron) |
| ✅ source-policy.md (règles `source_type → max_confidence`) | ❌ `_meta/source-catalog.yaml` (modification = PR séparée monorepo) |

## Anti-patterns figés (canon ADR-033 §D3)

Le skill **refuse** systématiquement de :

1. ❌ Créer `wiki/systemes/<slug>.md` (DB `__diag_system` est SoT)
2. ❌ Créer `wiki/diagnostic/<symptom>-*.md` matchant le pattern `(bruit|grincement|vibration|voyant|fumee|surchauffe|fuite|usure|symptome|claquement|sifflement)-*.md`
3. ❌ Toucher au moteur diagnostic (DB `__diag_*`, RPCs, backend, frontend)

Si l'utilisateur demande explicitement l'un de ces 3, le skill répond avec verdict `REVIEW_REQUIRED` + note explicite renvoyant vers ADR-033 §D3.

## Architecture skills-first (mémoire `skills-first-architecture.md`)

| Étape | Mode | Outil |
|---|---|---|
| 1. Lecture matière brute (`automecanik-raw/`) | 0-LLM | `Read`, `Glob`, `Grep` |
| 2. Détection `entity_type` (gamme/vehicle/constructeur/support) | 0-LLM | heuristique sur path source + naming |
| 3. Anti-duplication slug | 0-LLM | `Glob automecanik-wiki/wiki/<entity_type>/*.md` |
| 4. Lecture template canon (`_meta/templates/<entity_type>.md` v2.0.0) | 0-LLM | `Read` |
| 5. Lecture source-catalog (slugs sources stables) | 0-LLM | `Read _meta/source-catalog.yaml` |
| 6. Pour entity_type=gamme : lecture `exports/diag-canon-slugs.json` (si présent) | 0-LLM | `Read` (fallback liste hardcoded `brake_*` si absent — cf. PR-D) |
| 7. Génération frontmatter (champs structurés) | 0-LLM | template fill avec valeurs détectées |
| 8. Calcul `confidence_score` (formule `_meta/quality-gates.md` §4) | 0-LLM | invoque `python3 _scripts/compute-confidence-score.py --check` |
| 9. Rédaction body markdown (sections obligatoires `entity_type`) | **Anthropic** | rédactionnel uniquement (Définition / Fonctionnement / Symptômes / FAQ / etc.) |
| 10. Validation post-génération via 9 quality gates | 0-LLM | invoque `python3 _scripts/quality-gates.py <fichier>` |
| 11. Output AEC coverage manifest | 0-LLM | YAML structuré |

**Aucune chaîne LLM custom**, aucun wrapper maison. Anthropic Claude est invoqué **uniquement** pour le rédactionnel (étape 9), pas pour la structure ni pour la validation.

## Flow d'invocation

### Inputs requis

L'utilisateur fournit au minimum :
- **Slug cible** (ex: `amortisseur`, `volkswagen-golf-7`, `dacia`, `livraison-gratuite`)
- **Entity type** (si le slug est ambigu)
- **Sources brutes** : path(s) vers `automecanik-raw/sources/<...>` ou `recycled/<...>` ou indication implicite (« la doc Bosch sur les amortisseurs »)

### Flow étape par étape

```
1. Vérifier scope (refuser anti-patterns §D3 immédiatement)
2. Vérifier slug uniqueness (Glob automecanik-wiki/wiki/<entity_type>/<slug>.md)
   → si existant, abort avec REVIEW_REQUIRED
3. Lire automecanik-wiki/_meta/templates/<entity_type>.md
   → squelette frontmatter v2.0.0
4. Lire automecanik-wiki/_meta/source-catalog.yaml
   → registre slugs sources stables
5. Pour entity_type=gamme :
   - Lire automecanik-wiki/exports/diag-canon-slugs.json (si présent)
     → liste FK __diag_symptom.slug + __diag_system.slug pour validation
   - Sinon fallback hardcoded courte (cf. PR-D ADR-033 — 5 slugs `brake_*`)
6. Lire les sources brutes fournies (automecanik-raw/<...>)
7. Générer le frontmatter :
   - schema_version: 2.0.0
   - entity_type: <détecté>
   - slug, title, aliases, lang, created_at, updated_at, truth_level
   - source_refs[] (1 par source brute)
   - provenance: ingested_by: skill:wiki-proposal-writer
   - review_status: proposed
   - exportable: { rag: false, seo: false, support: false }
   - Pour gamme : entity_data.{pg_id, family, intents, vlevel, related_parts}
   - Pour gamme avec MaintenanceInterval matche : entity_data.maintenance.{educational_advice, related_pages}
   - Pour gamme avec diagnostic_relations[] souhaités : entrées avec defaults conservateurs ADR-033 §D4
     (reviewed: false, diagnostic_safe: false, confidence: medium par défaut)
8. Rédiger le body markdown (Anthropic, sections obligatoires) :
   - Pour gamme : Définition / Fonctionnement / Symptômes système (mirror diagnostic_relations[]) /
                  Conseil pédagogique d'entretien (mirror entity_data.maintenance.educational_advice) /
                  Choix selon véhicule / FAQ
   - Pour vehicle : Identité / Spécificités / Pièces fréquentes / FAQ
   - Pour constructeur : Identité / Modèles principaux / Spécificités techniques / FAQ
   - Pour support : Question / Réponse / Cas particuliers / Liens internes
9. Calculer confidence_score (Python compute-confidence-score.py)
10. Écrire automecanik-wiki/proposals/<slug>.md
11. Invoquer python3 _scripts/quality-gates.py proposals/<slug>.md
    → reporter verdict (PASS / FAIL + blocked_reasons[])
12. Output AEC coverage manifest (cf. ci-dessous)
```

## Defaults conservateurs (ADR-033 §D4)

Toutes les entrées `diagnostic_relations[].evidence` produites par le skill ont :

```yaml
evidence:
  confidence: medium                    # jamais high par défaut (overclaim)
  source_policy: 2_medium_concordant    # ou manual_review si < 2 sources medium
  reviewed: false                       # canon défaut, flip true uniquement après revue humaine
  diagnostic_safe: false                # canon défaut, flip true uniquement reviewer ≠ auteur
```

Le skill **ne flip jamais** `evidence.diagnostic_safe: true`. Cette autorité est réservée à un commit signé reviewer ≠ auteur (audit ad hoc).

## Output Coverage Manifest AEC v1.0.0 (obligatoire)

Tout output du skill inclut :

```yaml
final_status: PARTIAL_COVERAGE | SCOPE_SCANNED | REVIEW_REQUIRED | INSUFFICIENT_EVIDENCE
scope_requested: "<description user>"
scope_actually_scanned: "<slug + sources lues>"
files_read_count: <int>                # automecanik-raw + _meta lus
excluded_paths: ["wiki/<entity_type>/", "exports/", "DB Supabase"]
unscanned_zones: [<liste si applicable>]
corrections_proposed: 1                 # 1 fiche proposals générée
corrections_applied: 0                  # toujours 0 — propose-only
remaining_unknowns: [<liste>]
quality_gates_verdict: PASS | FAIL
blocked_reasons: [<liste si FAIL>]
```

Statuts interdits : `COMPLETE`, `DONE`, `ALL_FIXED`, `NO_ISSUES`, `PATCH_APPLIED`, `AUTO_FIXED`. Verdict par défaut = `PARTIAL_COVERAGE`.

## Garde-fous absolus

1. **1 fiche par invocation.** Si l'utilisateur demande N proposals, refuser et expliquer que le batch passe par PR-E `migrate-symptoms-to-relations.ts` (mode `--per-system`) ou par invocations séparées.
2. **Pas d'auto-correction.** Si `quality-gates.py` retourne FAIL avec `blocked_reasons[]`, le skill **propose** la correction dans son output mais n'écrit pas une version "corrigée auto" du fichier. La correction passe par un nouveau commit reviewer.
3. **Pas d'invention de slug DB.** Si un `symptom_slug` souhaité n'existe pas dans `__diag_symptom.slug` (vérifié via `exports/diag-canon-slugs.json` ou fallback hardcoded), le skill **retire** l'entrée de `diagnostic_relations[]` et trace dans `review_notes` du frontmatter (cf. P0(b) précédent : `distance_freinage_allongee`, `voyant_freinage_allume` retirés faute de slug DB existant).
4. **Pas de scrape OEM externe.** Les sources viennent de `automecanik-raw/{sources,recycled,normalized}/` exclusivement. Si gap, le skill output `INSUFFICIENT_EVIDENCE` et propose à l'utilisateur d'enrichir le raw repo.
5. **Pas de prédiction LLM des `evidence.confidence`.** Formule déterministe via `compute-symptom-confidence.py` (canon).

## Cas d'usage typique

```
User: « Crée une proposal pour la gamme amortisseur, sources : automecanik-raw/recycled/rag-knowledge/amortisseur-overview-fr.md + automecanik-raw/sources/web-clips/oem-renault-clio-amortisseur.md »

Skill:
1. ✅ Scope vérifié (gamme, pas d'anti-pattern §D3)
2. ✅ Slug 'amortisseur' uniquement présent en proposals/ (pas dans wiki/gammes/)
3. ✅ Template _meta/templates/gamme.md lu (v2.0.0)
4. ✅ source-catalog.yaml lu, sources mappées : 'oem_renault_clio_amortisseur' (status: to_capture par défaut nouvelle entrée — note review_notes)
5. ✅ exports/diag-canon-slugs.json lu (8 slugs disponibles)
6. ✅ Sources brutes lues (2 fichiers, 12kB total)
7. ✅ Frontmatter généré : schema_version: 2.0.0, entity_type: gamme, slug: amortisseur, family: suspension, intents: [diagnostic, achat, entretien, remplacement], vlevel: V2, diagnostic_relations[] (3 entrées avec defaults conservateurs), entity_data.maintenance.educational_advice (1 ligne sur intervalle de remplacement)
8. ✅ Body rédigé via Anthropic : Définition, Fonctionnement, Symptômes système, Conseil pédagogique, Choix selon véhicule, FAQ
9. ✅ confidence_score calculé : 0.42 (formule §4)
10. ✅ proposals/amortisseur.md écrit
11. ✅ quality-gates.py PASS (0 FAIL, 0 WARN)

Output AEC :
final_status: SCOPE_SCANNED
scope_requested: "Proposal gamme amortisseur from 2 raw sources"
scope_actually_scanned: "amortisseur (gamme)"
files_read_count: 6  # 2 sources + 4 _meta canon
excluded_paths: ["wiki/gammes/", "exports/", "DB Supabase"]
unscanned_zones: []
corrections_proposed: 1
corrections_applied: 0
remaining_unknowns: ["evidence.diagnostic_safe à valider par reviewer ≠ auteur avant promotion"]
quality_gates_verdict: PASS
blocked_reasons: []
```

## Promotion vers canon (hors scope du skill)

Pour promouvoir une fiche `proposals/<slug>.md` validée vers `wiki/<entity_type>/<slug>.md` :

1. Reviewer humain valide la diff frontmatter + body
2. Bumpe `review_status: proposed` → `reviewed` ou `approved`
3. Renseigne `reviewed_by: <email>`, `reviewed_at: <ISO>`
4. `git mv proposals/<slug>.md wiki/<entity_type>/<slug>.md`
5. Commit avec marker `promotion-from-proposals: <slug>` (workflow `wiki-protected-paths.yml`)

Le skill **ne fait jamais** ce mv. C'est une décision humaine.

## Références

- ADR-031 vault — 4-layer architecture (raw / wiki / exports / consumers)
- ADR-032 vault — `entity_data.maintenance{}` cohabite avec `diagnostic_relations[]`
- ADR-033 vault PR #108 commit `77085ef` — `diagnostic_relations[]` canon
- canon frontmatter : `automecanik-wiki/_meta/schema/frontmatter.schema.json` v2.0.0
- canon templates : `automecanik-wiki/_meta/templates/{gamme,vehicle,constructeur,support}.md`
- canon source-catalog : `automecanik-wiki/_meta/source-catalog.yaml`
- canon contract data : `automecanik-rag/docs/GAMME_PAGE_CONTRACT.md` v2.0 (PR-A.rag mergée 2026-04-30 commit `224e4c63`)
- 9 quality gates Python : `automecanik-wiki/_scripts/quality-gates.py`
- formule `confidence_score` : `_meta/quality-gates.md` §4
- workflow `wiki-protected-paths.yml` (4 markers commit message)
- mémoire `skills-first-architecture.md` (0-LLM structure, Anthropic seul rédactionnel)
- mémoire `feedback_wiki_scope_discipline.md` (sas markdown ≠ sas DB)
- mémoire `diag-symptom-db-convention.md` (slugs anglais snake_case `brake_*`)
- mémoire `mvp-g6-adr033-handoff.md` (Phase 1 closed 2026-04-30)
- contrat AEC : `./agent-exit-contract.md` (canon distribué)
- workspace rules : `../wiki-batch.md`
