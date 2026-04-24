---
scope: Ops / Cleanup backlog
audience: human + Claude
sources:
  - audit-reports/phase0-baseline.json
  - npm run audit:knip
  - npm run audit:madge
last_scan: 2026-04-24
---

# Cleanup Targets — Backlog structuré

> Source des chiffres : Phase 0 baseline capturée 2026-04-24 sur commit
> `c18cd233`. Taux de faux positifs réel mesuré : **15-20 %** (pas 60-70 %
> comme initialement suspecté — le plugin knip `nest` et `remix` sont
> actifs et font leur job sur la majorité des classes DI / routes).

## Légende des statuses

- `backlog` — identifié, pas encore attaqué
- `in-progress-pr#XXX` — PR ouverte
- `done-pr#XXX` — mergé
- `wontfix (<raison>)` — gardé volontairement, raison documentée

## Section 1 — Obsolètes évidents

### Scripts `.js` à la racine `backend/` (76 fichiers)

Script de dev / migration / debug laissés en place. Aucune référence runtime ni import.

| Pattern | Count | Exemples | Status |
|---|---|---|---|
| `backend/check-*.js` | ~25 | `check-bmw-data.js`, `check-cgc-data.js`, `check-clio-structure.js`, `check-db-stats.js`, `check-display-types.js`, `check-models.js`, `check-pieces-gamme-columns.js`, `check-supabase-tables.mjs`, `check-tables.js`, `check-type-9040.js`, `check-type-id.js`, `check-type-modele-link.js`, `check-v2-duplicates.js`, `check-v3-candidates.js`, `check-vlevel.js`, `check-volumes.js`, `check-function-exists.js`, `check-9040-usage.js`, `check-bestsellers-data.js`, `check-tables-columns.js` | `backlog` |
| `backend/deploy-rpc-*.js` | ~12 | `deploy-oem-refs-rpc.js`, `deploy-rpc-bestsellers.js`, `deploy-rpc-function.js`, `deploy-rpc-function-v2.js` (+ v3/v4/v5/v6) | `backlog` |
| `backend/populate-*.js`, `backend/assign-*.js`, `backend/debug-*.js`, `backend/fix-*.js` | ~15 | `populate-clio3-pilot.js`, `assign-v4-fixed.js`, `debug-v4.js`, `fetch-trends-volumes.js`, `analyze-options.js`, `analyze_gammes_structure.js` | `backlog` |

**Procédure** : `./scripts/cleanup/validate-before-delete.sh backend/<file>.js` puis `git rm`. Par batch de 10-15 pour review fluide. Ouvrir 3-4 PRs.

### Module `backend/src/modules/knowledge-graph/` (5 fichiers)

- Import commenté dans `backend/src/app.module.ts` → module jamais chargé en runtime
- Tous fichiers flaggés unused par knip
- **Action à décider** : `delete` (si l'intention a été abandonnée) ou `promote` (restaurer l'import + ajouter tests)
- Status : `backlog — decision pending`

### Templates `.spec/templates/*.ts` orphans

- `type-schema-template.ts`, `cart.schema.ts`, `payment.schema.ts` sous `.spec/types/` et `.spec/templates/`
- Tous flaggés unused
- Status : `backlog — vérifier si référencés par un générateur (scripts/generate-specs.sh)`

## Section 2 — Dead frontend components (147 fichiers `.tsx`)

**Tous dans `frontend/app/components/`** — aucun sous `app/routes/` (plugin remix OK).
Chaque sous-dossier est une **PR batch** candidate.

| Sous-dossier | ~Count | Note |
|---|---|---|
| `components/admin/` | ~25 | Dashboards / gestion internes — valider si tous les écrans admin sont encore utilisés |
| `components/cart/` | ~10 | `AddToCartButton`, `CartIcon`, `CartItem` — certains peuvent être d'anciennes versions avant refonte |
| `components/catalog/` | ~15 | `FilterAccordion`, `PiecesCatalogGrid`, `PurchaseGuide`, `ProductCatalog` — vérifier les intents R2 / R4 live |
| `components/constructeurs/` | ~10 | `BrandHero` + variants — pages R7 brand |
| `components/account/` | ~5 | `UserShipmentTracking` etc. — flow customer |
| `components/blog/` | ~8 | Mis en place puis remplacé |
| `components/vehicle/r8/sections/` | ~5 | Visibles sur git status récent (créées en parallèle d'autres PRs) — **vérifier activement** avant delete |
| autres | ~70 | Répartis entre `common/`, `diagnostic/`, `seo/`, `navigation/`, `layout/` |

**Procédure batch** par sous-dossier :
1. `ls frontend/app/components/<subdir>/*.tsx` → liste
2. Pour chaque : `validate-before-delete.sh <path>`
3. Supprimer les SAFE, documenter les BLOCKED
4. `npm run build` (Remix build catch les refs hiérarchiques)
5. PR ciblée "chore(cleanup): remove unused components in `<subdir>/`"

## Section 3 — Fusion candidates

| De | Vers | Confiance | Raison |
|---|---|---|---|
| `backend/src/modules/blog-metadata/` | `backend/src/modules/blog/metadata/` | Haute | 3 fichiers (module + service + controller), tous unused. Fragment artificiel. |
| `backend/src/modules/customers/` (1 DTO seul) | `backend/src/modules/users/dto/` | Moyenne | Module réduit à un DTO orphelin → juste déplacer le DTO |
| `backend/src/modules/seo-logs/` | `backend/src/modules/seo/` (sous `logs/` ou `audit/`) | Moyenne | Overlap logique (audit / KPI SEO) ; 2 modules au lieu d'1 sans bénéfice |
| `backend/src/modules/admin/` (split) | `admin-gammes/`, `admin-briefs/`, `admin-content/`, `admin-operations/` | **Faible — décision archi** | God module (69 services détectés). Requiert ADR avant exécution. |

Fusions = PR **plus lourdes** que simple delete (nécessitent update des imports côté consumers). Faire séparément des cleanup "simple delete".

## Section 4 — Cycles (17 au total)

Classification tirée de `npm run audit:madge` + inspection code.

### Fortuits (résolus par 1 inversion d'import, voir playbook)

| # | Cycle | Solution |
|---|---|---|
| 1 | `config/role-ids.ts` ↔ `workers/types/content-refresh.types.ts` | Extraire types partagés dans `shared-types.ts` |
| 2 | `products/cross-selling.service` ↔ `cross-selling-seo.service` | Inverser direction (SEO depends on base, pas l'inverse) |
| 3 | `products/cross-selling.service` ↔ `cross-selling-source.service` | Idem |

### Structurels (refactor non-trivial)

| # | Cycle | Complexité | Solution |
|---|---|---|---|
| 4 | `rag-proxy/*` (3 cycles internes : cleanup↔detection↔knowledge, rag-proxy↔ingestion↔redis-job, rag-proxy↔webhook) | Haute | Extraire interfaces vers `rag-proxy/interfaces/` + implémentations vers `services/impl/`. ADR possible. |
| 5 | `auth/auth.module` ↔ `modules/users/users.module` | Moyenne | Inverser : users dépend de auth, auth ne doit pas dépendre de users. Extract shared types si besoin. |

### Acceptables (cycles intra-module orchestrateur-workers, pattern NestJS courant)

| # | Cycle | Statut |
|---|---|---|
| 10 | `admin/services/admin-gammes-seo` ↔ `admin/services/gamme-detail-enricher` | Acceptable — pattern orchestrateur |
| 11 | `admin/services/stock-management` ↔ `stock-movement` | Acceptable |
| 12 | `admin/services/stock-management` ↔ `stock-report` | Acceptable |
| 13 | `blog/services/advice` ↔ `advice-enrichment` | Acceptable |
| 14 | `blog/services/constructeur` ↔ `constructeur-search` | Acceptable |
| 15-16 | `support/services/legal` ↔ `legal-page`/`legal-version` | Acceptable |
| 17 | Frontend `root.tsx` ↔ `hooks/useRootData.ts` | Acceptable — pattern Remix SSR |

Les cycles "acceptables" sont documentés ici comme **explicitement tolérés**.
À re-évaluer si une nouvelle règle `no-circular` strict s'active côté CI.

## Section 5 — Dependency-cruiser violations (148 warnings)

Breakdown exact disponible via `npm run audit:depcruise 2>&1 | tail -100`. Principales catégories :

- `no-circular` — duplicates des 17 cycles (chacun appelé plusieurs fois selon l'entry point)
- `no-orphans` — fichiers sans dépendants visibles (overlap partiel avec knip unused)
- `no-deep-module-access` — imports cross-modules directs (targets de refactor "module barrels")
- `no-non-package-json` — 1 seul hit : `file-type` importé par `upload/services/file-validation.service.ts` sans entrée package.json → **phantom dep**, à corriger rapidement (`npm i -D file-type` ou retirer l'import).

## Priorisation recommandée

| Ordre | Action | Effort | Gain |
|---|---|---|---|
| 1 | Archiver les 76 `.js` backend racine | Faible (2h) | Gros volume éliminé, 0 risque |
| 2 | Fix phantom dep `file-type` | Très faible (15 min) | Promouvoir `no-non-package-json` à `error` |
| 3 | Delete 147 .tsx components par batch de sous-dossiers | Moyen (1j itératif) | Nettoie le frontend, signal/bruit gagné |
| 4 | Fusion `blog-metadata/` → `blog/metadata/` | Faible (1h) | Supprime fragment artificiel |
| 5 | Fusion `customers/` DTO → `users/dto/` | Très faible (30 min) | Idem |
| 6 | Résoudre 3 cycles fortuits (voir playbook) | Moyen (3h total) | -3 cycles, gain clarté |
| 7 | Fusion `seo-logs/` → `seo/` | Moyen | Consolidation logique |
| 8 | Split `admin/` god-module | Lourd, ADR requis | Long terme |
| 9 | Refactor cycles structurels rag-proxy / auth↔users | Lourd | Long terme, casse cycle restants |

---

_Mettre à jour ce doc à chaque PR cleanup mergée (status column). Mettre à jour `audit-reports/phase0-baseline.json` parallèlement._
