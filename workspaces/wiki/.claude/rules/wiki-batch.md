# Règles Wiki Batch

S'applique aux runs depuis `workspaces/wiki/`. Complète (sans les remplacer) les règles génériques monorepo (`/opt/automecanik/app/CLAUDE.md`) + le canon ADR-033 (`automecanik-wiki/_meta/schema/frontmatter.schema.json`) + le contrat AEC (`agent-exit-contract.md`).

## Sources de vérité

- **Canon frontmatter wiki** : `automecanik-wiki/_meta/schema/frontmatter.schema.json` v2.0.0 (Draft 2020-12). Source unique pour la structure des fiches `proposals/<slug>.md` et `wiki/<entity_type>/<slug>.md`.
- **Canon contract data downstream** : `automecanik-rag/docs/GAMME_PAGE_CONTRACT.md` v2.0 (PR-A.rag mergée 2026-04-30 commit `224e4c63`). Décrit le shape `GammeContentContract.v2.0` produit par le pipeline RAG.
- **ADR-031** : 4-layer raw/wiki/exports/consumers (`governance-vault/ledger/decisions/adr/ADR-031-four-layer-content-architecture.md`)
- **ADR-032** : diagnostic & maintenance unification (cohabitation `entity_data.maintenance{}` avec `diagnostic_relations[]`)
- **ADR-033** : wiki gamme `diagnostic_relations[]` contract — `governance-vault/ledger/decisions/adr/ADR-033-wiki-gamme-diagnostic-relations-contract.md` (status `accepted` 2026-04-29, PR vault #108 commit `77085ef`)
- **Templates canoniques** : `automecanik-wiki/_meta/templates/{gamme,vehicle,constructeur,support}.md` v2.0.0
- **Source catalog** : `automecanik-wiki/_meta/source-catalog.yaml` (registre slugs sources stables, PR wiki #9)
- **DB convention** : mémoire `diag-symptom-db-convention.md` — slugs `__diag_symptom.slug` en anglais snake_case `brake_*`, JOIN via `system_id`

## Sas markdown wiki ≠ sas DB RAG (NE PAS CONFONDRE)

**Verrou conceptuel critique** (mémoire `feedback_wiki_scope_discipline.md`) :

| Sas | Localisation | Schema | Promotion |
|---|---|---|---|
| **Wiki proposals** (markdown) | `automecanik-wiki/proposals/<slug>.md` | frontmatter v2.0.0 ADR-033 | manuelle reviewer humain → `wiki/<entity_type>/<slug>.md` (commit message `promotion-from-proposals: <slug>`) |
| **RAG proposals** (DB) | table Supabase `__rag_proposals` | colonnes typées | gérée par `RagProposalService` (ADR-022 L1) côté backend NestJS, **distinct du sas markdown** |

Le skill `wiki-proposal-writer` écrit **uniquement** dans le sas markdown wiki. **Jamais** d'écriture DB depuis ce workspace. Si une fiche markdown doit être promue en DB RAG, c'est via le pipeline `sync-from-wiki` côté Partie 3 (différée).

## Schema frontmatter v2.0.0 strict (canon ADR-033)

Tout fichier `automecanik-wiki/proposals/<slug>.md` produit par ce workspace doit avoir :

- `schema_version: 2.0.0`
- `entity_type` ∈ `{gamme, vehicle, constructeur, support}` (cf. ADR-031 §D15)
- `slug`, `title`, `aliases[]`, `lang: fr`, `created_at`, `updated_at`, `truth_level` ∈ `{L1, L2, L3, L4}`
- `source_refs[]` (≥ 1) : `{kind: recycled|external|wiki, origin_repo, origin_path, captured_at}`
- `provenance: {ingested_by: human:<email> | skill:wiki-proposal-writer, promoted_from: null}`
- `review_status: proposed` (par défaut), `reviewed_by: null`, `reviewed_at: null`, `review_notes: <string>`
- `no_disputed_claims: true`, `exportable: {rag: false, seo: false, support: false}` (canon défaut Partie 3 différée)
- `confidence_score: <number 0-1>` (calculé par formule §4 `_meta/quality-gates.md`)

**Pour `entity_type: gamme` uniquement** :
- `diagnostic_relations[]` (canon ADR-033 §D1) : optionnel mais recommandé. Chaque entrée = `{symptom_slug, system_slug, relation_to_part, part_role, evidence{confidence, source_policy, reviewed, diagnostic_safe}, sources[]}`. Defaults conservateurs ADR-033 §D4 : `reviewed: false`, `diagnostic_safe: false`.
- `entity_data.maintenance{}` (canon ADR-032 §D1) : obligatoire si la gamme matche un slug `kg_nodes.MaintenanceInterval`. Champs : `educational_advice` (1-2 lignes), `related_pages[]`.
- `entity_data.{pg_id, family, intents, vlevel, related_parts}` : champs business spécifiques.

## 9 quality gates Python (canon `automecanik-wiki/_scripts/quality-gates.py`)

Le validateur Python côté wiki repo implémente 9 `blocked_reasons` enum :

1. `relation_to_part_missing` — entrée `diagnostic_relations[]` sans `relation_to_part`
2. `symptom_unstructured` — symptôme implicite dans le body (lexique FR `bruit|grincement|vibration|voyant|fumée|surchauffe|fuite|usure|claquement|sifflement`) non miroité dans `diagnostic_relations[].part_role` — solution : enrichir le `part_role` avec le label FR du symptôme cible
3. `confidence_overclaimed` — `evidence.confidence: high` mais aucun `source_type` éligible (cf. `source-policy.md` §9 : `oem_*`, `tecdoc_official`, `normative_standard` requis pour `high`)
4. `source_policy_violated` — `source_policy: 1_high` mais aucune source `confidence: high` ; ou `source_policy: 2_medium_concordant` mais < 2 sources medium concordantes
5. `legacy_symptoms_block` — présence de `entity_data.symptoms[]` ou `diagnostic.symptoms[]` (anti-pattern ADR-033 §D2)
6. `forbidden_systemes_dir` — fichier sous `wiki/systemes/` (anti-pattern §D3)
7. `forbidden_per_symptom_file` — fichier `wiki/diagnostic/<symptom>-*.md` matchant pattern `(bruit|grincement|vibration|voyant|fumee|surchauffe|fuite|usure|symptome|claquement|sifflement)-*.md` (anti-pattern §D3)
8. `source_slug_unknown` — slug cité dans `diagnostic_relations[].sources[]` absent de `_meta/source-catalog.yaml`
9. `maintenance_advice_missing` — fiche gamme dont le slug matche un `kg_nodes.MaintenanceInterval` mais sans `entity_data.maintenance.educational_advice`

Le skill `wiki-proposal-writer` doit invoquer `python3 _scripts/quality-gates.py <fichier>` après génération et reporter le verdict + `blocked_reasons` dans son output AEC. **Pas d'auto-correction** — propose-only.

## 3 anti-patterns figés ADR-033 §D3

1. ❌ **NE PAS créer** `wiki/systemes/<slug>.md` ni aucun `entity_type: system` — DB `__diag_system` est SoT
2. ❌ **NE PAS créer** fichier-par-symptôme `wiki/diagnostic/<symptom>-*.md` (frontend Remix sert `/diagnostic-auto/symptome/$slug`). **Note** : le dossier `wiki/diagnostic/` lui-même reste autorisé pour fiches macro-pédagogiques (vocab, FAQ, wizard-steps — ADR-032 §D1)
3. ❌ **NE PAS réécrire** le moteur diagnostic (DB `__diag_*` / RPCs / backend / frontend) — hors scope ADR-033

## Convention slug DB `__diag_symptom.slug` (mémoire `diag-symptom-db-convention.md`)

- **Anglais snake_case** avec préfixe par système : `brake_noise_metallic`, `brake_vibration_pedal`, `brake_pulling_side`, `brake_soft_pedal`, `brake_noise_grinding` (5 actifs freinage en DB, 2026-04-30)
- JOIN via `system_id` (pas de colonne `system_slug` directe sur `__diag_symptom`)
- Si un symptom_slug souhaité n'existe pas en DB → **retirer** de `diagnostic_relations[]` + tracer dans `review_notes` du frontmatter, ne pas l'inventer. Ouvrir PR `__diag_symptom` extension séparée pour ajouter.

Query SQL canon (référence pour PR-D cron export) :
```sql
SELECT s.slug AS symptom_slug, sys.slug AS system_slug, s.label, s.urgency, s.active
FROM public.__diag_symptom s
JOIN public.__diag_system sys ON sys.id = s.system_id
WHERE s.active = true
ORDER BY s.slug;
```

## Workflow `wiki-protected-paths.yml` (4 markers commit message)

Tout commit qui touche `wiki/<entity_type>/*.md` doit inclure dans son message un de ces markers (déployé PR wiki #8) :

- `promotion-from-proposals: <slug>` — promotion d'un proposal validé vers canon
- `rollback: <slug>` — rétrogradation §10 quality-gates
- `template-migration: <type>@<old>→<new>` — semver bump §3.7 (utilisé par migration progressive PR-E)
- `metadata-backfill: <field> (<reason>)` — update frontmatter-only par tooling déterministe (ex: `compute-confidence-score.py --fix`)

Sans marker → CI fail. Le sas `proposals/` n'est **pas** couvert par ce workflow (proposals = WIP par construction).

## Output AEC v1.0.0 obligatoire

Tout run depuis ce workspace produit un coverage manifest (cf. `agent-exit-contract.md`) :

```yaml
final_status: PARTIAL_COVERAGE | SCOPE_SCANNED | REVIEW_REQUIRED
scope_requested: <description>
scope_actually_scanned: <chemins ou slugs>
files_read_count: <int>
excluded_paths: [<paths>]
unscanned_zones: [<paths>]    # OBLIGATOIRE même si vide
corrections_proposed: <int>    # nombre de fiches proposals générées
corrections_applied: 0         # toujours 0 — propose-only
remaining_unknowns: [<liste>]  # OBLIGATOIRE
```

Statuts interdits : `COMPLETE`, `DONE`, `ALL_FIXED`, `NO_ISSUES`, `PATCH_APPLIED`, `AUTO_FIXED`, `100% covered`.

## Anti-patterns wiki (en plus des Q1-Q4 monorepo)

- **Pas de skill qui écrit DB** — ce workspace écrit **uniquement** des fichiers `automecanik-wiki/proposals/<slug>.md`. Toute écriture Supabase / `__rag_proposals` / `__seo_*` / `kg_*` est interdite (Partie 3 différée).
- **Pas de scrape OEM** — sources provenance via `automecanik-raw/{sources,recycled,normalized}/` uniquement. Si gap, ouvrir issue raw repo, ne pas scraper depuis le skill.
- **Pas de prédiction LLM des `evidence.confidence`** — formule déterministe `_scripts/compute-symptom-confidence.py` (canon).
- **Pas d'invention de slug DB** — si un `symptom_slug` souhaité n'existe pas en `__diag_symptom`, retirer + tracer review_notes (cf. P0(b) session 2026-04-30 : `distance_freinage_allongee`, `voyant_freinage_allume` retirés de `plaquette-de-frein.md` faute de slug DB existant).
- **Pas de bricolage hybride transitoire** — Partie 3 = consommateurs (DB / RAG / SEO / blog / diagnostic / chatbot) attend `wiki-readiness-check.py = READY` (PR-F). Pas de pipeline custom en attendant. Big-bang quand la chaîne est prête (garde-fou utilisateur #12).
- **Pas de duplication backend** — les modules NestJS `backend/src/modules/admin/services/rag-proposal.service.ts` (ADR-022 L1) et `backend/src/modules/wiki/` (Partie 3) ne sont **pas** modifiés depuis ce workspace.

## Contrat de sortie agents

`./agent-exit-contract.md` — règle non-négociable applicable à tout skill ou agent du workspace wiki.

## Référence

- ADR-031 — 4-layer architecture (vault)
- ADR-032 — diagnostic & maintenance unification (vault)
- ADR-033 — wiki gamme `diagnostic_relations[]` (vault)
- Plan rev 3 — `/home/deploy/.claude/plans/mvp-et-raw-et-wobbly-brooks.md`
- Mémoire `mvp-g6-adr033-handoff.md` — état Phase 1 closed 2026-04-30
- Mémoire `diag-symptom-db-convention.md` — convention slug DB
- Mémoire `feedback_wiki_scope_discipline.md` — sas markdown ≠ sas DB
