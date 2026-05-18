---
module: substitution
sources:
- backend/src/modules/substitution
last_scan: '2026-05-17'
primary_files:
- backend/src/modules/substitution/controllers/substitution.controller.ts
- backend/src/modules/substitution/services/intent-extractor.service.ts
- backend/src/modules/substitution/services/substitution-logger.service.ts
- backend/src/modules/substitution/services/substitution.service.ts
- backend/src/modules/substitution/substitution.module.ts
- backend/src/modules/substitution/types/substitution.types.ts
depends_on:
- ConfigModule
---

# Module Substitution

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `SubstitutionService`
- `IntentExtractorService`

### Providers (top 15)
- `IntentExtractorService`
- `SubstitutionService`
- `SubstitutionLoggerService`

### Fichiers primaires
- [backend/src/modules/substitution/controllers/substitution.controller.ts](../../../backend/src/modules/substitution/controllers/substitution.controller.ts)
- [backend/src/modules/substitution/services/intent-extractor.service.ts](../../../backend/src/modules/substitution/services/intent-extractor.service.ts)
- [backend/src/modules/substitution/services/substitution-logger.service.ts](../../../backend/src/modules/substitution/services/substitution-logger.service.ts)
- [backend/src/modules/substitution/services/substitution.service.ts](../../../backend/src/modules/substitution/services/substitution.service.ts)
- [backend/src/modules/substitution/substitution.module.ts](../../../backend/src/modules/substitution/substitution.module.ts)
- [backend/src/modules/substitution/types/substitution.types.ts](../../../backend/src/modules/substitution/types/substitution.types.ts)

<!-- END AUTO-GENERATED -->

## Pourquoi
<!-- À compléter à la main : contraintes architecturales, décisions historiques, trade-offs. -->
_Section à rédiger._

## Gotchas

### `http_live` retention — NE PAS dropper (incident 2026-05-13)

Le module `substitution` apparaît dans `runtime-entrypoints.json#nestjs_unreachable_modules` (NestJS DI ne le voit pas, aucun `static_importer`). **Mais** son `@Controller('api/substitution') @Get('check')` est consommé en runtime par `frontend/app/routes/pieces.$slug.tsx:206` via un `fetch('${API_URL}/api/substitution/check?...')`. TypeScript ne voit pas cet edge HTTP.

PR #466 (canari `substitution` drop) closed 2026-05-13 — sans le check HTTP-route-caller du prereq-2 (PR #469), le drop aurait cassé `/pieces/:slug` en prod (404 sur chaque appel, fallback `.catch(() => null)` muet).

**Règle dérivée** : tout sous-arbre contenant un `@Controller(...)` est `http_live` par défaut jusqu'à preuve grep contraire sur l'intégralité des workspaces (`frontend/app` inclus). Le check `[HTTP-ROUTE-CALLER]` de `scripts/cleanup/validate-before-delete.sh` (section 4b) fire automatiquement.

Triage canonique : [`audit/unreachable-modules/substitution.md`](../../../audit/unreachable-modules/substitution.md).

## Références

- Triage retention : [`audit/unreachable-modules/substitution.md`](../../../audit/unreachable-modules/substitution.md)
- PR #466 (closed) — canari échoué
- PR #469 — `validate-before-delete.sh` HTTP-route-caller check
- `.claude/knowledge/ops/cleanup-targets.md` (ligne `modules/substitution/`)
- Caller frontend : [`frontend/app/routes/pieces.$slug.tsx`](../../../frontend/app/routes/pieces.$slug.tsx) ligne 206
