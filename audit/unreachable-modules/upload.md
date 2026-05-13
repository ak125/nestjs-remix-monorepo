# Triage upload — retention (no drop)

> Produit par **PR-3b-2 Step B** per plan `/home/deploy/.claude/plans/pr-3-backend-nestjs-aware-deadcode.md` §4 (matrice révisée post-canari `http_route_callers` #469).
> Snapshot post-#459 + #469 sur main `156f02ac`.
> **Option B retenue 2026-05-13** : pas de drop sur verdict `partial`, retention documentée (cf. substitution PR #469).

## Faits (verdict matrice §4 plan)

- **`nestjs_reachable_from_app_module`** : `false` (`runtime-entrypoints.json#nestjs_unreachable_modules`).
- **`static_importers`** : `SupabaseStorageService` importé directement par 2 fichiers `rag-proxy/` :
  - `backend/src/modules/rag-proxy/rag-proxy.module.ts:3` — `import { SupabaseStorageService } from '../upload/services/supabase-storage.service';`
  - `backend/src/modules/rag-proxy/services/rag-image-management.service.ts:18` — idem
  - `rag-proxy.module.ts:80` — registered as provider locally (comment historique : « registered locally to avoid UploadModule CACHE_MANAGER dep »).
- **`dynamic_importers`** (`audit/dynamic-import-edges.json`) : `[]`.
- **`string_refs`** : `[]` côté code routé.
- **`bullmq_processors_referencing`** : `[]`.
- **`http_route_callers`** (check du prereq-2) : flag levé sur substring `upload`, triage manuel = **0 vrai caller**. Les hits frontend (`uploads/...`, `/upload/constructeurs-automobiles/...`) sont des chemins d'assets statiques (Supabase Storage / PHP legacy), pas des fetches vers `@Controller('upload')` routes. Les 2 fetches réels du frontend ciblent `/api/admin/r1-image-prompts/...` (admin module, pas upload).
- **`db_callsites`** + **`supabase_migrations_referencing`** : 0.

## Verdict matrice plan §4

| Constat | Verdict |
|---|---|
| `static_importers ≠ ∅` (`SupabaseStorageService` consommé par rag-proxy) **mais** `*.module.ts` reste unreached | **`partial`** |

→ **verdict : `partial`** — retention requise (cf. arbitrage scope §"Décision" ci-dessous).

## Décision (arbitrage option A vs B, 2026-05-13)

**Option B retenue** : pas de drop sur verdict `partial`. Le scope Step B (cleanup-targets.md item #3) est strictement « delete modules **clearly-dead**, module-entier » — un sous-arbre `partial` (storage utilitaire consommé externe) ne fit pas. Une refactor préface (relocation `supabase-storage.service.ts` + `upload.dto.ts` → `backend/src/modules/storage/` ou `common/services/storage/`) serait un chantier séparé, non-Step-B.

→ **Action** : zero drop. Upload reste tel quel. Le check `[HTTP-ROUTE-CALLER]` du prereq-2 (#469) + `[NESTJS-DI]` + `[IMPORT]` intra-sous-arbre via `validate-before-delete.sh` continueront à protéger les fichiers du sous-arbre contre tout `git rm` futur tant que `SupabaseStorageService` reste consommé.

## Détail surface (pour traçabilité, sans action)

| Fichier | Consommé externe ? |
|---|---|
| `upload.module.ts` | non (mais wire les services internes) |
| `upload.controller.ts` | non (admin-only, 0 caller) |
| `dto/index.ts` | non (barrel) |
| `dto/upload.dto.ts` | indirectement (via `FileUploadResult` requis par `supabase-storage.service.ts`) |
| `services/supabase-storage.service.ts` | **OUI — 5 hits rag-proxy** |
| `services/image-processing.service.ts` | non |
| `services/upload.service.ts` | non |
| `services/file-validation.service.ts` | non |
| `services/upload-analytics.service.ts` | non |
| `services/upload-optimization.service.ts` | non |

8 fichiers nominalement dead, mais aucun n'est droppé per option B. Toute future refactor du sous-arbre (relocation du storage utilitaire) ouvrira un nouveau triage hors Step B.

## Knowledge

`.claude/knowledge/modules/upload.md` conservée per convention `refresh-knowledge.py`.

## Hors scope

- **Aucune migration DB / RPC / table touchée** (plan §10).
- **Aucun fichier code modifié** — c'est un PR purement documentaire.
- Pas de mise à jour `audit/*.json` (rien dans l'inventaire ne change, l'audit re-scan donnerait le même résultat).
