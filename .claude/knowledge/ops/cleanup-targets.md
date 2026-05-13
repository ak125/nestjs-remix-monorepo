---
scope: Ops / Cleanup backlog
audience: human + Claude
sources:
  - audit/cleanup-plan-by-domain.md   # Phase 2 driver — séquence canon PR-2…PR-6 (PR-0b)
  - audit/risk-register.md            # par domaine : surface / candidats / cycles / couverture / risque (PR-0b)
  - audit/runtime-entrypoints.json    # zone never-auto-delete + nestjs_unreachable_modules (PR-0a)
  - audit/dead-code-candidates.json   # 339 candidats high/med/low (PR-0a)
  - audit/cycle-map.json              # 15 cycles (PR-0a)
  - audit/db-usage-map.json           # 60 candidate-orphan tables / 141 candidate-orphan RPC (PR-0b)
  - audit-reports/phase0-baseline.json # ratchet baseline (PR-1 audit-baseline = #267 en cours)
last_scan: 2026-05-13
---

# Cleanup Targets — Backlog structuré

> **SoT à jour pour les chiffres et la séquence des PRs : [`audit/cleanup-plan-by-domain.md`](../../../audit/cleanup-plan-by-domain.md) + [`audit/risk-register.md`](../../../audit/risk-register.md)** (générés par `npm run audit:inventory` depuis PR-0a/0b mergés 2026-05-11). Ce doc garde : (a) les **statuts PR par cluster** (in-progress / done / wontfix), (b) les **procédures batch** locales, (c) les **décisions humaines** (fusion vs delete, *decision pending*), (d) l'**historique** des cleanup-waves. Il ne duplique plus les chiffres bruts — les sections numériques pointent vers `audit/*.json`.
>
> Snapshot 2026-05-13 (post-#441/#447/#448, commit `cd3dea5c`) : **339 dead-code candidates** (high 23 / med 222 / low 94) · **15 cycles** · **41 duplicate exports** · **82 `no-deep-module-access` violations** · DB : 60 candidate-orphan tables (`low`) + 141 candidate-orphan RPC (`medium`). Taux de faux positifs ~15-20 % comme observé en 2026-04-24 — knip + plugin Nest auto-activé (`@nestjs/*` détecté) + plugin Remix font leur job sur les classes DI / routes.

## Légende des statuses

- `backlog` — identifié, pas encore attaqué
- `in-progress-pr#XXX` — PR ouverte
- `done-pr#XXX` — mergé
- `wontfix (<raison>)` — gardé volontairement, raison documentée

## Section 1 — Obsolètes évidents

### Scripts `.js` à la racine `backend/` — ~~76~~ → **14 fichiers** (wave largement attaquée)

État 2026-05-13 : `git ls-files 'backend/*.js' 'backend/*.mjs'` → **14** (vs 76 en 2026-04-24). 0 `check-*.js` / 0 `deploy-rpc-*.js` / 0 `populate|assign|debug|fix-*.js` restants — les 3 patterns originaux sont **vidés**. Status : `mostly done` — re-checker les 14 résiduels au prochain pass.

**Procédure** (toujours valable pour le résidu et tout futur dump scripts à la racine) : `./scripts/cleanup/validate-before-delete.sh backend/<file>.js` puis `git rm`. Par batch de 10-15.

### Modules NestJS unreachable — drill-down 2026-05-13

Source d'évidence : [`audit/runtime-entrypoints.json#nestjs_unreachable_modules`](../../../audit/runtime-entrypoints.json) (la BFS DI depuis `app.module.ts`/`worker.module.ts` ne les atteint pas) + grep statique d'importeurs sur `backend/src/**`. **39 candidats sur les 339 totaux** sont concentrés dans ces 6 sous-arbres.

| Module | Fichiers | 1er commit | Importeurs statiques | Doc humaine | Verdict |
|---|---|---|---|---|---|
| `modules/upload/` | 10 | 2025-08-28 | **aucun import direct du module** ; **mais** `SupabaseStorageService` (`services/supabase-storage.service.ts`) consommé par `rag-proxy/rag-proxy.module.ts` + `rag-proxy/services/rag-image-management.service.ts` | `.claude/knowledge/modules/upload.md` | **`partial` — retention requise** (PR-3b-2 doc 2026-05-13, option B). 0 drop : Step B canonique exige `clearly dead` module-entier ; un storage util vivant fait sortir upload du scope. Refactor préface (relocation `storage/` séparée) reste optionnelle hors-Step-B. Protection via `validate-before-delete.sh` (`[NESTJS-DI]`+`[IMPORT]` intra-sous-arbre fire automatiquement). |
| `modules/agentic-engine/` | 14 | 2026-03-09 | **aucun import du module** ; **mais** 4 services + constants + types consommés par `backend/src/workers/{worker.module.ts, processors/agentic.processor.ts}` (registered locally + dynamic import lazy-eval) ; `agentic.processor.ts` est un `@Processor` BullMQ entièrement bâti dessus | knowledge note seule | **`partial` — retention requise** (PR-3b-3 doc 2026-05-13, option B). Deeply live via workers. Le `@Controller('api/admin/agentic')` est fonctionnellement mort (0 caller HTTP), mais les services le sont via workers DI. Protection via `validate-before-delete.sh` (`[IMPORT]` workers/ fire automatiquement). |
| `modules/mcp-validation/` | **19** | 2026-01-26 | **aucun** | knowledge note seule | **clearly dead** — candidat delete (plus gros bucket) |
| `modules/substitution/` | 6 | 2026-01-12 | **aucun import statique** ; **mais** `@Controller('api/substitution') @Get('check')` consommé par `frontend/app/routes/pieces.$slug.tsx:206` (HTTP runtime — TS ne voit pas l'edge) | knowledge note + ref `.claude/knowledge/integrations/parts-feed.md` | **`http_live` — retention requise** (canari PR-3b-1 PR #466 closed 2026-05-13 ; le drop aurait cassé `/pieces/:slug` en prod). Allowlist via `validate-before-delete.sh` (le check `[HTTP-ROUTE-CALLER]` du prereq-2 fire automatiquement). |
| `modules/knowledge-graph/` | 6 | 2025-12-30 | `app.module.ts` ligne 59 + 224 (**commentés** `DEV ONLY — Experimental`) | cette section, déjà flaggée backlog 2026-04-24 | `backlog — decision pending: delete vs promote` |
| `modules/blog-metadata/` | 3 | 2025-10-04 | **aucun** | Section 3 (fusion candidate) | **refactor, pas delete** — fusion `→ blog/metadata/` |

0 dynamic import edge vers aucun de ces 6 sous-arbres ([`audit/dynamic-import-edges.json`](../../../audit/dynamic-import-edges.json)). Aucun n'est dans `runtime-entrypoints.json#never_auto_delete_globs`. Toutes les conditions #0-#6 de `validate-before-delete.sh` à re-vérifier avant `git rm`.

**Action recommandée (révisée 2026-05-13 post-canari + arbitrage option B)** : seul `mcp-validation` reste candidat Step B `dead_subtree` à vérifier. `substitution` et `upload` sont sortis (verdict `http_live` / `partial` documenté retention, 0 drop). `agentic-engine` présomption forte `partial` (`workers/processors/agentic.processor.ts` importe `agentic-engine/services/*` directement) → vraisemblablement retention. `knowledge-graph` reste en `decision pending` (delete vs restore) — choix humain. `blog-metadata` traité via Section 3 (fusion).

**Principe option B (no bricolage)** : un sous-arbre `partial` (un fichier vivant consommé externe) n'est pas un Step B canonique. Pas de drop file-by-file (sortirait du scope « delete module-entier clearly-dead »). Refactor préface (relocation des utilitaires vivants) reste une option future hors Step B, à arbitrer séparément.

### Templates `.spec/templates/*.ts` orphans

- `type-schema-template.ts`, `cart.schema.ts`, `payment.schema.ts` sous `.spec/types/` et `.spec/templates/`
- Tous flaggés unused
- Status : `backlog — vérifier si référencés par un générateur (scripts/generate-specs.sh)`

## Section 2 — Dead frontend components — voir PR-4 du plan canon

État 2026-05-13 : **187 candidats `frontend-shared`** (high 7 / med 148 / low 32) + **29 duplicate exports** dans ce cluster — le plus gros bucket du repo. Tous dans `frontend/app/{components,hooks,utils,services}/` — **aucun sous `app/routes/`** (plugin Remix OK).

Le détail (sous-dossier × count × note) et la séquence batch sont maintenant dans **PR-4** de [`audit/cleanup-plan-by-domain.md`](../../../audit/cleanup-plan-by-domain.md) (Step B = delete confirmé-orphan par batch ~30-40 → PR-4a / PR-4b / PR-4c ; Step C = collapse les 29 duplicate exports). Ne pas dupliquer les chiffres ici — re-générer via `npm run audit:inventory` avant chaque batch.

**Procédure batch** par sous-dossier (inchangée) :
1. `ls frontend/app/components/<subdir>/*.tsx` → liste
2. Pour chaque : `validate-before-delete.sh <path>` + grep manuel (basename, dynamic import, Remix `useLoaderData` indirection)
3. Supprimer les SAFE, documenter les BLOCKED
4. **Supprimer aussi les `*.test.tsx` co-localisés**
5. `npm run build` ×2 + `npm test` (Remix build catch les refs hiérarchiques)
6. PR ciblée "chore(cleanup): remove unused components in `<subdir>/`"

Statuts PR connus (à compléter quand mergent) :
- #158 — `chore(cleanup): remove 3 dead search components (batch 2)` — `in-progress-pr#158` (OPEN depuis 2026-04, vieillissant)
- #160 — `chore(cleanup): remove 4 dead forms components (batch 3)` — `in-progress-pr#160` (idem)

## Section 3 — Fusion candidates

| De | Vers | Confiance | Raison |
|---|---|---|---|
| `backend/src/modules/blog-metadata/` | `backend/src/modules/blog/metadata/` | Haute | 3 fichiers (module + service + controller), tous unused. Fragment artificiel. |
| `backend/src/modules/customers/` (1 DTO seul) | `backend/src/modules/users/dto/` | Moyenne | Module réduit à un DTO orphelin → juste déplacer le DTO |
| `backend/src/modules/seo-logs/` | `backend/src/modules/seo/` (sous `logs/` ou `audit/`) | Moyenne | Overlap logique (audit / KPI SEO) ; 2 modules au lieu d'1 sans bénéfice |
| `backend/src/modules/admin/` (split) | `admin-gammes/`, `admin-briefs/`, `admin-content/`, `admin-operations/` | **Faible — décision archi** | God module (69 services détectés). Requiert ADR avant exécution. |

Fusions = PR **plus lourdes** que simple delete (nécessitent update des imports côté consumers). Faire séparément des cleanup "simple delete".

## Section 4 — Cycles (**15** au total, ~~17~~)

État 2026-05-13 : [`audit/cycle-map.json`](../../../audit/cycle-map.json) en compte **15** (vs 17 estimés en 2026-04-24 — 2 cycles fortuits ont été résolus depuis). Liste exhaustive : voir le JSON ; classification humaine ci-dessous toujours valable. Séquence d'attaque dans PR-5 du plan canon ([`audit/cleanup-plan-by-domain.md`](../../../audit/cleanup-plan-by-domain.md) §PR-5).

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

## Section 5 — Dependency-cruiser violations

État 2026-05-13 : breakdown précis dans [`audit/module-boundaries.json`](../../../audit/module-boundaries.json) (`cross_domain_edges` + `deep_access_violations`). Principales catégories :

- `no-circular` — duplicates des **15** cycles (chacun appelé plusieurs fois selon l'entry point) → voir Section 4 + PR-5.
- `no-orphans` — fichiers sans dépendants visibles (overlap partiel avec knip unused) → ils alimentent `audit/dead-code-candidates.json` (PR-3/PR-4).
- `no-deep-module-access` — **82 violations** : `admin` 32, `blog` 23, `gamme-rest` 5, `vehicles` 5, `seo` 4, `cart`/`orders`/`rag-proxy` 2 each, autres 1 → cible PR-6 (barrels, surface publique).
- ~~`no-non-package-json` — phantom dep `file-type`~~ → **RÉSOLU** : `backend/package.json` déclare `"file-type": "^20.4.1"` en `dependencies` (toujours importé par `upload/services/file-validation.service.ts:11`, mais le module `upload/` est lui-même candidat à la suppression, cf. Section 1).

## Priorisation recommandée — état 2026-05-13

| Ordre | Action | Effort | Gain | Statut |
|---|---|---|---|---|
| ~~1~~ | ~~Archiver les 76 `.js` backend racine~~ | — | — | **mostly done** (76 → 14, voir Section 1) |
| ~~2~~ | ~~Fix phantom dep `file-type`~~ | — | — | **done** (déclaré en `dependencies`, voir Section 5) |
| 3 | **PR-3 Step B** — seul `mcp-validation` reste candidat `dead_subtree` plausible ; `upload` sorti (`partial` retention, PR-3b-2 doc 2026-05-13) ; `substitution` sorti (`http_live` retention, PR-3b prereq-2 2026-05-13) ; `agentic-engine` présomption `partial` (worker DI live) | Faible (1 PR au max, mcp-validation) | 0 à 17 fichiers selon triage | `backlog` |
| 4 | Decider `knowledge-graph` (delete vs promote) | Faible (décision) puis Moyen (exécution) | -6 fichiers OU intent restauré | `backlog — decision pending` |
| 5 | Fusion `blog-metadata/` → `blog/metadata/` | Faible (1h) | Supprime fragment artificiel | `backlog` |
| 6 | **PR-4** Frontend Remix-aware — 187 candidats `frontend-shared` + 29 dup exports, par batch | Moyen-lourd (~3-4 PRs) | Cleanup du gros bucket | `backlog` (+ #158/#160 vieillissants) |
| 7 | Fusion `customers/` DTO → `users/dto/` | Très faible (30 min) | Cohérence | `backlog` |
| 8 | **PR-5a** — cycles fortuits (`root↔useRootData`, config-types cluster, rag-proxy×3) | Moyen (3h total) | -7 cycles, gain clarté | `backlog` |
| 9 | Fusion `seo-logs/` → `seo/` | Moyen | Consolidation logique | `backlog` |
| 10 | **PR-5b** — cycles intra-module orchestrateur-workers + promotion `no-circular warn→error` | Lourd | -8 cycles restants, gate strict | `backlog` |
| 11 | **PR-6** — 82 `no-deep-module-access` violations (admin 32 + blog 23 prioritaires) + barrels + promotion `warn→error` | Lourd | Frontière modules nette | `backlog` |
| 12 | Split `admin/` god-module | Lourd, ADR requis | Long terme | `backlog — ADR à rédiger` |
| 13 | DB surface (141 RPC + 60 tables candidats) | Lourd, hors monorepo | Vault ADR + RPC Gate, jamais code PR ici | `backlog — vault track` |

---

_Mettre à jour ce doc à chaque PR cleanup mergée (column Statut). Pour les chiffres : ne JAMAIS éditer à la main — `npm run audit:inventory` régénère `audit/*.json`. Pour le baseline ratchet : `npm run audit:baseline:refresh` (manuel, maintainer-only — cf. PR #267)._
