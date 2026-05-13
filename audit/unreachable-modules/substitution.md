# Triage substitution

> Produit par **PR-3b-1 canari Step B** per plan `/home/deploy/.claude/plans/pr-3-backend-nestjs-aware-deadcode.md` §4.
> Snapshot post-#459 (`scripts/cleanup/validate-before-delete.sh` désormais unreachable-aware) sur main `8e10b5d3`.
> Méthode : protocole data-driven plan §4 — commandes `rg` + lecture `audit/*.json`, pas de nouveau script.

## Pourquoi `substitution` et pas `blog-metadata` ?

Le plan §4 ordonnait `blog-metadata` en canari #1 sur la seule base du nombre de candidats (2). Cross-check `.claude/knowledge/ops/cleanup-targets.md` (SoT curé humain, refresh #450 du 2026-05-11) :
- `blog-metadata` y est étiqueté **« refactor, pas delete — fusion → blog/metadata/ »** (item #5 backlog, hors Step B).
- `substitution` y est listé comme **« likely dead — vérifier le lien parts-feed avant delete »** dans les 4 modules approuvés pour PR-3 Step B (item #3 : `upload` / `agentic-engine` / `mcp-validation` / `substitution`).

→ Pivot canari conforme au SoT : `substitution` (5 candidats `low`, le plus petit des 4 approuvés, 0 enjeu DB).

## Faits (verdict matrice §4 plan)

- **`nestjs_reachable_from_app_module`** : `false` (présent dans `runtime-entrypoints.json#entrypoints.nestjs_unreachable_modules`).
- **`static_importers`** (`rg --type=ts 'SubstitutionModule|SubstitutionService|SubstitutionController' backend/src frontend/app` hors sous-arbre) : `[]`.
- **`dynamic_importers`** (`audit/dynamic-import-edges.json`) : `[]`.
- **`string_refs`** (`rg "['\"]substitution" backend/src .github scripts backend/supabase/migrations`) : `[]`.
- **`bullmq_processors_referencing`** (`rg "substitution|Substitution" backend/src/workers`) : `[]`.
- **`db_callsites`** (filtre `audit/db-usage-map.json` par les 6 fichiers du sous-arbre) : `0` (le service interne n'apparaît pas dans db-usage car le sous-arbre entier est unreachable).
- **`supabase_migrations_referencing`** : `[]`.

## Faits complémentaires (hors matrice — observabilité)

- **Routes HTTP exposées** : `@Controller(...)` dans `controllers/substitution.controller.ts` — non routables (module pas dans `AppModule.imports[]`, 0 controller registered au boot NestJS).
- **Knowledge cross-refs (purement documentaires, hors scope drop)** :
  - `.claude/knowledge/modules/substitution.md` — fiche dédiée stub. **Conservée** : convention `scripts/knowledge/refresh-knowledge.py` docstring "No deletion of .md files even if the underlying module disappears" — la fiche persiste comme pointer d'intention historique/future.
  - `.claude/knowledge/integrations/parts-feed.md` — ligne `backend/src/modules/substitution/` dans Fichiers applicatifs. **Conservée** : documente l'intention applicative (équivalences pièces) ; cible de re-création potentielle au même path.
  - `.claude/knowledge/README.md` — entrée d'index. **Conservée** pour la même raison.
  - `.claude/knowledge/ops/cleanup-targets.md` — 4 mentions backlog (item #3, etc.). **Non touchées ici** (le suivi backlog se met à jour au prochain cycle audit, plan §10 "no opportunistic cleanup").

## Verdict matrice plan §4

| Constat | Verdict |
|---------|---------|
| Tous les bullets matrice vides | `dead_subtree` |

→ **verdict : `dead_subtree`** (au sens code applicatif). L'intention documentaire reste préservée dans `.claude/knowledge/` per convention.

## Reason

Module **non-wired DI** (donc routes inactives), **aucun importeur statique/dynamique/CI/worker/DB/migration**. Les références knowledge sont purement documentaires : elles documentent une capacité applicative intentionnelle (équivalences pièces) jamais branchée empiriquement. Per convention `refresh-knowledge.py`, les `.md` knowledge persistent à la disparition du module — l'intention reste tracée, le code mort part.

## Action mécanique PR-3b-1

**Drop des 6 fichiers backend** (scope strict plan §10, knowledge intacte) :

- `backend/src/modules/substitution/substitution.module.ts`
- `backend/src/modules/substitution/controllers/substitution.controller.ts`
- `backend/src/modules/substitution/services/intent-extractor.service.ts`
- `backend/src/modules/substitution/services/substitution.service.ts`
- `backend/src/modules/substitution/services/substitution-logger.service.ts`
- `backend/src/modules/substitution/types/substitution.types.ts`

**Knowledge inchangée** : aucune édition de `.claude/knowledge/{README.md,modules/substitution.md,integrations/parts-feed.md,ops/cleanup-targets.md}`. Les `[KNOWLEDGE]` blockers de `validate-before-delete.sh` sont **explicitement résolus par la voie "keep + document"** offerte par le script ("Otherwise, keep this file and document the retention reason in .claude/knowledge/ops/cleanup-targets.md"). La doc d'intention reste, le code mort part.

**Validation** : `bash scripts/cleanup/validate-before-delete.sh <path>` post-#459 confirme 0 `[RUNTIME-ENTRYPOINT]` blocker sur les 6 fichiers. Les `[NESTJS-DI]` / `[IMPORT]` intra-sous-arbre s'annulent au drop simultané. Les `[KNOWLEDGE]` sont attendus et adressés par cet artefact.

**Build + tests post-drop** : `npm run build` + `npm test` verts. `npm run audit:inventory && npm run audit:baseline:refresh` committés dans la même PR.

## Suivis (hors scope cette PR)

- **cleanup-targets.md** : mise à jour du backlog (substitution → done, retirer de item #3) — soit prochain audit cycle, soit petite PR docs séparée.
- **Plan §4** : pivot canari acté dans cette PR ; édition du plan local (`/home/deploy/.claude/plans/...`) hors repo.
- **Autres modules Step B** (`upload`, `agentic-engine`, `mcp-validation`) : suivront en PR-3b-2/3/4 séparées, chacune avec son artefact triage. ⚠️ **`agentic-engine` apparaît partiellement vivant** via `workers/processors/agentic.processor.ts` (imports directs des services) — cleanup-targets « clearly dead » verdict à re-vérifier avant Step B drop. Le canari substitution établit le protocole ; les suivants pourraient pivoter en allowlist plutôt qu'en drop.
- **DB cleanup** : aucune table ou RPC touchée — strict plan §10.
