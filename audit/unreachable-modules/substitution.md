# Triage substitution — retention (http_live, no drop)

> Formalisation rétroactive du pivot 2026-05-13 documenté par PR #469 (prereq-2 `validate-before-delete.sh` HTTP-route-caller aware) et PR #466 closed (canari échoué). Aligné sur le pattern d'`upload.md` (PR #476) et `agentic-engine.md` (PR #477).
> Snapshot post-#469 sur main.

## Faits (verdict matrice §4 plan)

- **`nestjs_reachable_from_app_module`** : `false` (`runtime-entrypoints.json#nestjs_unreachable_modules`).
- **`static_importers`** : aucun import direct du module.
- **`dynamic_importers`** (`audit/dynamic-import-edges.json`) : `[]`.
- **`string_refs`** : `[]` côté backend/scripts (scope initial du triage). **Le scope frontend était omis.**
- **`bullmq_processors_referencing`** : `[]`.
- **`http_route_callers`** (check du prereq-2 #469) : **`@Controller('api/substitution') @Get('check')`** consommé par `frontend/app/routes/pieces.$slug.tsx:206` (`fetch('${API_URL}/api/substitution/check?...')`). TS ne voit pas l'edge HTTP. Le triage initial avait omis ce check (`string_refs` scopé à `backend/src + .github + scripts + supabase/migrations`, **`frontend/app` exclu**).
- **`db_callsites`** + **`supabase_migrations_referencing`** : 0.

## Verdict matrice plan §4

| Constat | Verdict |
|---|---|
| `*.module.ts` unreached **mais** `@Controller('api/substitution')` consommé par `pieces.$slug.tsx` (HTTP runtime) | **`http_live`** |

→ **verdict : `http_live`** — retention requise.

## Incident / canari (2026-05-13)

PR #466 (canari `substitution` drop) closed 2026-05-13 avant merge — la review auto a détecté la consommation HTTP runtime. Sans cette détection, le drop aurait cassé `/pieces/:slug` en prod (404 sur chaque appel `/api/substitution/check`, fallback `.catch(() => null)` aurait mangé le signal silencieusement).

→ **Méthodologie révisée** : tout sous-arbre contenant un `@Controller(...)` est `http_live` par défaut jusqu'à preuve grep contraire sur l'intégralité des workspaces (`frontend/app` inclus). Implémenté dans `validate-before-delete.sh` section 4b (PR #469).

## Décision (retention permanente, no bricolage)

**0 drop**. substitution reste tel quel. Le check `[HTTP-ROUTE-CALLER]` de `validate-before-delete.sh` (prereq-2 #469) protège mécaniquement les fichiers du sous-arbre contre tout `git rm` futur tant que le caller frontend reste actif.

## Détail surface (pour traçabilité, sans action)

| Fichier | Consommé externe ? |
|---|---|
| `substitution.module.ts` | non (mais wire les services internes) |
| `controllers/substitution.controller.ts` | **OUI — `@Controller('api/substitution')` consommé par `frontend/app/routes/pieces.$slug.tsx:206`** |
| `services/substitution.service.ts` | non (interne, mais critique pour le controller) |
| `services/intent-extractor.service.ts` | non (interne) |
| `services/substitution-logger.service.ts` | non (interne) |
| `types/substitution.types.ts` | non (interne) |

6 fichiers, 1 vivant via HTTP route (toute la chaîne du controller est requise). Aucun drop. Toute future refactor du sous-arbre devra d'abord migrer le caller frontend ou déprécier la route.

## Knowledge

`.claude/knowledge/modules/substitution.md` Gotchas section mise à jour dans le même PR.

## Hors scope

- **Aucune migration DB / RPC / table touchée**.
- **Aucun fichier code modifié** — PR purement documentaire.
- Pas de mise à jour `audit/*.json` (rien dans l'inventaire ne change ; la matrice évolue via le check `[HTTP-ROUTE-CALLER]` à chaque run de `validate-before-delete.sh`).

## Références

- PR #466 (closed) — canari échoué qui a déclenché le pivot
- PR #469 — `validate-before-delete.sh` HTTP-route-caller check (prereq-2)
- PR #476 — pattern `unreachable-modules/<module>.md` initial (upload retention)
- PR #477 — agentic-engine retention (même pattern)
- `.claude/knowledge/ops/cleanup-targets.md` ligne substitution
