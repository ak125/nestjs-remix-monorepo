# Triage blog-metadata (PR-3b-1 canari, Step B)

> Produit en commit 1 de PR-3b-1 per plan §4. Snapshot main `8e10b5d3` (post-#459 + #461).
> Méthode : protocole data-driven plan §4, commandes `rg` + lecture `audit/*.json` (pas de nouveau script).

## Faits (matrice plan §4)

| Bullet | Valeur |
|--------|--------|
| `nestjs_reachable_from_app_module` | `false` (présent dans `runtime-entrypoints.json#entrypoints.nestjs_unreachable_modules[2]`) |
| `static_importers` (`rg --type=ts 'BlogMetadataModule\|BlogMetadataController\|BlogMetadataService' backend/src` hors sous-arbre) | `[]` |
| `dynamic_importers` (`audit/dynamic-import-edges.json`) | `[]` |
| `string_refs` (`rg "['\"]blog-metadata" backend/src .github scripts backend/supabase/migrations`) | `[]` |
| `bullmq_processors_referencing` (`rg --type=ts "blog-metadata\|BlogMetadata" backend/src/workers`) | `[]` |
| `db_callsites` (filtre `audit/db-usage-map.json` par files du sous-arbre) | `0` |
| `supabase_migrations_referencing` | `[]` réel (les hits initiaux sur `__blog_meta_tags_ariane` / `__blog_seo_marque` sont des faux-positifs — tables consommées par `seo-meta-registry.service.ts` actif) |

## Faits complémentaires (observabilité hors matrice)

- **Routes HTTP exposées** : `@Controller('api/blog/metadata')` expose `GET :alias`, `GET`, `GET aliases/list`, `DELETE cache/:alias`, `DELETE cache` — **mais non-routables** car le module n'est pas dans `AppModule.imports[]`, donc 0 controller registered au boot NestJS. Toute requête frontend sur `/api/blog/metadata/*` retourne 404 en production.
- **Frontend util** : `frontend/app/utils/blog-metadata.tsx` définit `loadBlogMetadata()` + `useBlogMetadata()`. **Aucun route/component frontend ne les importe** (`rg "loadBlogMetadata|useBlogMetadata" frontend/app` ne retourne que le fichier de définition lui-même). Chaîne morte côté frontend aussi.
- **Table `__blog_meta_tags_ariane`** : reste lue par `backend/src/modules/seo/services/chain/seo-meta-registry.service.ts:blog: TABLES.blog_meta_tags_ariane`. **Hors scope ce drop** — pas de modification DB.

## Verdict matrice plan §4

| Constat | Verdict |
|---------|---------|
| Tous les bullets vides | **`dead_subtree`** |

→ **verdict : `dead_subtree`**

## Reason

Module orphelin de bout en bout : backend non-wired DI (routes inactives au runtime), frontend util jamais importé. La table SoT `__blog_meta_tags_ariane` reste lue par le chain SEO actif, indépendamment de ce module.

## Action mécanique PR-3b-1

Drop des 3 fichiers backend (scope strict plan §10 — frontend hors PR-3b, traité en PR-4) :

1. `backend/src/modules/blog-metadata/blog-metadata.module.ts` (bottom-up step 1)
2. `backend/src/modules/blog-metadata/blog-metadata.controller.ts` (step 2, après re-audit)
3. `backend/src/modules/blog-metadata/blog-metadata.service.ts` (step 2, après re-audit)

Bottom-up nécessaire : le module file référence le controller/service en `@Module(providers, controllers)`, donc le validator flag `[NESTJS-DI]` tant que le module n'est pas supprimé. Drop module en premier → validator SAFE pour controller/service.

Validation : `bash scripts/cleanup/validate-before-delete.sh <path>` (conditions #0-#6) doit dire SAFE pour chaque path après bottom-up. Build + tests verts. `audit:inventory && audit:baseline:refresh` committés.

## Suivis (hors scope cette PR)

- **PR-4 frontend** : drop `frontend/app/utils/blog-metadata.tsx` une fois PR-3 close (plan §1 dernière ligne).
- **DB cleanup** : la table `__blog_meta_tags_ariane` reste active via `seo-meta-registry.service.ts`. Hors scope ce chantier (cleanup-plan-by-domain.md §"DB surface — NOT a code-cleanup PR").
