# Triage agentic-engine — retention (no drop)

> Produit par **PR-3b-3 Step B** per plan `/home/deploy/.claude/plans/pr-3-backend-nestjs-aware-deadcode.md` §4 (matrice révisée post-canari `http_route_callers` #469).
> Snapshot post-#469 + #476 (option B upload retention) sur main `761c8f6d`.
> **Option B appliquée 2026-05-13** : pas de drop sur verdict `partial`, retention documentée (cf. substitution PR #469 + upload PR #476).

## Faits (verdict matrice §4 plan)

- **`nestjs_reachable_from_app_module`** : `false` (`runtime-entrypoints.json#nestjs_unreachable_modules`).
- **`static_importers`** : **4 services + constants + types** consommés directement par 2 fichiers `backend/src/workers/` :
  - `workers/worker.module.ts:30-33` — `AgenticDataService`, `EvidenceLedgerService`, `RunManagerService`, `CriticService` (registered as providers locally, sans passer par `AgenticEngineModule`).
  - `workers/processors/agentic.processor.ts:22-35` — mêmes 4 services + `AGENTIC_DEFAULTS`/`GoalType` (de `constants/agentic.constants`) + `AgenticPlanJobData`/`AgenticSolveJobData`/etc. (de `types/job.types`).
- **`dynamic_importers`** : oui — `workers/processors/agentic.processor.ts:313` fait `await import('../../modules/agentic-engine/constants/agentic.constants')` (le double import statique + dynamique est probablement un pattern lazy-eval pour les constants partagées).
- **`string_refs`** : `[]` côté code routé.
- **`bullmq_processors_referencing`** : **oui — `agentic.processor.ts`** est un processor BullMQ (`@Processor(AGENTIC_QUEUE_NAME)`) entièrement bâti sur les services de `agentic-engine/`.
- **`http_route_callers`** (check du prereq-2) : `@Controller('api/admin/agentic')` présent dans `agentic-engine.controller.ts`. **0 caller** trouvé (`rg "['\"]/?api/admin/agentic" frontend/app packages scripts` → ∅, `rg "(fetch|axios)\([^)]*agentic" frontend/app` → ∅). Le controller est fonctionnellement mort, mais les services sont vivants via workers.
- **`db_callsites`** + **`supabase_migrations_referencing`** : services agentic-data + evidence-ledger lisent/écrivent `agentic_*` tables (vu via les imports `SupabaseBaseService`) — hors scope code, traçabilité DB séparée.

## Verdict matrice plan §4

| Constat | Verdict |
|---|---|
| `static_importers ≠ ∅` (4 services + constants + types consommés par workers) **+** `dynamic_importers ≠ ∅` (1 dynamic import des constants) **+** `bullmq_processors_referencing ≠ ∅` (agentic.processor.ts construit dessus) **mais** `*.module.ts` reste unreached | **`partial`** (deeply live via workers) |

→ **verdict : `partial`** — retention requise.

## Décision (option B, cohérente avec upload PR #476)

**Option B retenue** : pas de drop sur `partial`. Le scope Step B (`cleanup-targets.md` item #3) est strictement « delete modules **clearly-dead**, module-entier ». agentic-engine est **deeply partial** : 4 services + constants + types vivent via workers/, juste sans le wrapper `AgenticEngineModule`. Le pattern « registered locally to avoid `AgenticEngineModule` import » est identique à celui d'upload (`rag-proxy.module.ts:80` historique).

→ **Action** : zero drop. agentic-engine reste tel quel. Les checks `[NESTJS-DI]` + `[IMPORT]` intra-sous-arbre (`validate-before-delete.sh`) protègent les fichiers contre tout `git rm` futur — le grep externe trouve les `workers/` consommateurs.

## Détail surface (pour traçabilité, sans action)

| Fichier | Consommé externe ? |
|---|---|
| `agentic-engine.module.ts` | non (`AgenticEngineModule` jamais importé) |
| `agentic-engine.controller.ts` | non (`@Controller('api/admin/agentic')` 0 caller) |
| `services/agentic-data.service.ts` | **OUI — workers/worker.module + workers/processors/agentic.processor** |
| `services/evidence-ledger.service.ts` | **OUI — idem** |
| `services/run-manager.service.ts` | **OUI — idem** |
| `services/critic.service.ts` | **OUI — idem** |
| `services/planner.service.ts` | non (interne au sous-arbre) |
| `services/solver.service.ts` | non (interne) |
| `services/arbiter.service.ts` | non (interne) |
| `services/verifier.service.ts` | non (interne) |
| `constants/agentic.constants.ts` | **OUI — workers/processors (static + dynamic)** |
| `types/job.types.ts` | **OUI — workers/processors** |
| `types/run-state.schema.ts` | non (interne) |
| `events/agentic.events.ts` | non (interne) |

14 fichiers, 6 vivants via workers/. Aucun drop per option B. Toute future refactor (relocation des services + constants vers `workers/services/agentic/` ou `agentic/` sous une raison plus stable) ouvrira un nouveau triage hors Step B.

## Knowledge

`.claude/knowledge/modules/agentic-engine.md` conservée per convention `refresh-knowledge.py`.

## Hors scope

- **Aucune migration DB / RPC / table touchée** (plan §10). Les tables `agentic_*` continuent à être lues/écrites par les services vivants.
- **Aucun fichier code modifié** — PR purement documentaire.
- Pas de mise à jour `audit/*.json`.
