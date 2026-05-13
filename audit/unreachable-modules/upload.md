# Triage upload

> Produit par **PR-3b-2 Step B** per plan `/home/deploy/.claude/plans/pr-3-backend-nestjs-aware-deadcode.md` §4 (matrice révisée post-canari `http_route_callers`).
> Snapshot post-#459 + #469 (prereq-1 + prereq-2 merged) sur main `156f02ac`.
> Méthode : protocole data-driven plan §4 — commandes `rg` + lecture `audit/*.json` + `validate-before-delete.sh` (HTTP-route-caller actif depuis prereq-2).

## Faits (verdict matrice §4 plan)

- **`nestjs_reachable_from_app_module`** : `false` (`runtime-entrypoints.json#nestjs_unreachable_modules`).
- **`static_importers`** (`rg --type=ts 'UploadModule|UploadController' backend/src frontend/app` hors sous-arbre) : `[]`.
- **`dynamic_importers`** (`audit/dynamic-import-edges.json`) : `[]`.
- **`string_refs`** : `[]` côté code routé. La seule mention restante de `UploadModule` est un **commentaire historique** dans `backend/src/modules/rag-proxy/rag-proxy.module.ts:80` (`// Image management (SupabaseStorageService registered locally to avoid UploadModule CACHE_MANAGER dep)`) — aucun import actif.
- **`bullmq_processors_referencing`** : `[]`.
- **`http_route_callers`** (check du prereq-2) : raised flag pour `@Controller('upload')` substring, **mais après triage manuel = 0 vrai caller**. Les hits frontend (`uploads/...`, `/upload/constructeurs-automobiles/...`) sont des **chemins d'assets statiques** (Supabase Storage / PHP legacy domain), **pas** des fetches vers `/upload/single|multiple|validate|stats|config|health|list`. Les hits `node_modules/` et `packages/design-tokens/node_modules/` sont du bruit d'environnement. Les 2 vrais call-sites `fetch` du frontend qui contiennent `upload` (`admin.r1-images.tsx:296`, `admin.keyword-planner.tsx:1638`) ciblent `/api/admin/r1-image-prompts/${ripId}/upload` — un endpoint servi par le module **admin**, pas `@Controller('upload')`.
- **`db_callsites`** (filtre `audit/db-usage-map.json` par les fichiers du sous-arbre) : 0.
- **`supabase_migrations_referencing`** : 0.

## Cas spécial : `SupabaseStorageService` LIVE (verdict `partial`)

`rg "SupabaseStorageService" backend/src` hors sous-arbre **trouve 5 occurrences live** :
- `backend/src/modules/rag-proxy/rag-proxy.module.ts:3` — `import { SupabaseStorageService } from '../upload/services/supabase-storage.service';`
- `backend/src/modules/rag-proxy/rag-proxy.module.ts:80` — registered as provider (locally, pas via UploadModule)
- `backend/src/modules/rag-proxy/services/rag-image-management.service.ts:18` — `import { SupabaseStorageService } from '../../upload/services/supabase-storage.service';`
- (+ 2 usage sites internes à rag-image-management)

`SupabaseStorageService` importe `FileUploadResult` depuis `../dto/upload.dto` → **`upload.dto.ts` est aussi indirectement live**.

Cross-check des 5 autres services du sous-arbre (rg classname externe au sous-arbre) :

| Service | Hits externes | Verdict file |
|---|---|---|
| `SupabaseStorageService` | **5 (rag-proxy)** | LIVE — keep |
| `ImageProcessingService` | 0 | dead — drop |
| `UploadService` | 0 | dead — drop |
| `FileValidationService` | 0 | dead — drop |
| `UploadAnalyticsService` | 0 (mention dans 2 audit reports JSON — pas du code) | dead — drop |
| `UploadOptimizationService` | 0 | dead — drop |

## Verdict matrice plan §4

| Constat | Verdict |
|---|---|
| `static_importers ≠ ∅` (`SupabaseStorageService` consommé par rag-proxy) **mais** le `*.module.ts` reste unreached | **`partial`** → statuer fichier par fichier, ne pas drop le module entier |

→ **verdict : `partial`** — drop 8 fichiers, retention 2 fichiers.

## Reason

Module `upload/` a été conçu comme une plateforme d'upload générique (admin-only, `@UseGuards(IsAdminGuard)`, endpoints `Post('single/:type')`, `Post('multiple/:type')`, etc.). Aucun de ces endpoints n'a jamais été câblé côté frontend (les 2 vrais fetches d'upload côté admin passent par un endpoint dédié dans `admin/`, pas par `@Controller('upload')`). Le seul morceau **réutilisé** est `SupabaseStorageService` (utilitaire d'accès Supabase Storage bucket) que rag-proxy importe directement pour son pipeline image-management. La décision de découpage est tracée dans le commentaire `rag-proxy.module.ts:80`.

## Action mécanique PR-3b-2

### Drop 8 fichiers (sous-arbre mort sauf storage utilitaire)

- `backend/src/modules/upload/upload.module.ts` (unreached, 0 importeur externe, le commentaire `rag-proxy.module.ts:80` confirme l'historique de non-import)
- `backend/src/modules/upload/upload.controller.ts` (admin-only, 0 caller frontend/script)
- `backend/src/modules/upload/dto/index.ts` (barrel `export * from './upload.dto'` — 0 consumer externe, les seuls importeurs vont en direct sur `'../dto/upload.dto'`)
- `backend/src/modules/upload/services/upload.service.ts` (0 ref externe)
- `backend/src/modules/upload/services/image-processing.service.ts` (0 ref externe)
- `backend/src/modules/upload/services/file-validation.service.ts` (0 ref externe)
- `backend/src/modules/upload/services/upload-analytics.service.ts` (0 ref externe ; mentions dans `scripts/cleanup-action-plan.json` et `scripts/correction-guide.json` = anciens rapports d'audit, pas du code exécuté)
- `backend/src/modules/upload/services/upload-optimization.service.ts` (0 ref externe)

### Retention 2 fichiers (consommés par rag-proxy, doc allowlist)

- `backend/src/modules/upload/services/supabase-storage.service.ts` — **LIVE** : utilisé par `rag-proxy/services/rag-image-management.service.ts` et `rag-proxy/rag-proxy.module.ts` (registered locally). Imports : `@nestjs/common/Injectable`, `@nestjs/config/ConfigService`, `@database/services/supabase-base.service`, `../dto/upload.dto/FileUploadResult`, `@common/exceptions`. **Aucune dépendance vers les 8 fichiers droppés** (vérifié `grep -E "^import" supabase-storage.service.ts`).
- `backend/src/modules/upload/dto/upload.dto.ts` — fournit `FileUploadResult` à `supabase-storage.service.ts`. Aucun autre consommateur, mais nécessaire à l'élément retenu.

### Knowledge inchangée

`.claude/knowledge/modules/upload.md` reste **conservée** per convention `refresh-knowledge.py` ("No deletion of .md files even if the underlying module disappears"). Le module n'a pas disparu — il a été réduit à 2 fichiers utilitaires consommés par rag-proxy. La fiche restera comme pointer d'intention historique. Sera mise à jour par le pre-commit hook `refresh-knowledge.py --headers-only`.

## Validation

`validate-before-delete.sh` post-prereq-2 sur les 8 fichiers à drop :
- `upload.controller.ts`, `upload.module.ts`, `dto/index.ts` + 5 services → 0 `[RUNTIME-ENTRYPOINT]` (unreachable-aware OK), 0 `[STRING-REF]` externe, `[HTTP-ROUTE-CALLER]` flags = manuellement triagés (faux positifs : assets statiques + node_modules + admin endpoint différent), `[NESTJS-DI]` / `[IMPORT]` intra-sous-arbre s'annulent au drop simultané, `[KNOWLEDGE]` adressé par la voie "keep + document" (artefact ici).

`npm run build` (turbo backend) post-drop : doit rester vert (les 2 fichiers retenus + leurs 5 imports externes sont intacts).

## Suivis (hors scope cette PR)

- **`cleanup-targets.md`** : mise à jour upload row → `partial — 2/10 retenus (storage service consommé par rag-proxy)`.
- **Future refactor optionnel** (hors PR-3) : déplacer `supabase-storage.service.ts` + `upload.dto.ts` vers `backend/src/modules/storage/` ou `backend/src/common/services/storage/` pour clarifier l'intention. Non-bloquant ; le file path actuel fonctionne.
- **DB cleanup** : 0 RPC/table touchée — strict plan §10.
