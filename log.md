# Log — Timeline des sessions Claude Code

> **But** : trace append-only des sessions Claude Code "importantes"
> (commits / PRs créés). Lu au début de chaque nouvelle session pour
> donner du contexte récent au LLM. Complémentaire à `MEMORY.md`
> (apprentissages) et aux PR descriptions GitHub (détails techniques).

## Délimitation

| Quoi | Où |
|---|---|
| Timeline session : date, sujet, branche, sortie | **`log.md`** (ce fichier) |
| Règles persistantes, gotchas, feedback utilisateur | `~/.claude/projects/.../memory/MEMORY.md` |
| Détails techniques d'un changement | PR description GitHub |
| Décision architecturale canon | `governance-vault/ledger/decisions/adr/` |
| Transcripts session bruts | `.remember/logs/memory-*.log` (gitignored) |

## Format strict (imposé par le skill `/log-session`)

```markdown
## YYYY-MM-DD — sujet bref (≤ 60 chars)

- **Branche** : `feat/<sujet>`
- **Décision** : 1 ligne en français, l'essentiel
- **Sortie** : PRs #XXX | commits abc1234 | fichiers `path/X`, `path/Y`

```

Une entrée = 3 à 4 lignes. Heading H2 par session = greppable + naviguable.

## Règles

1. **Append-only.** Jamais éditer une entrée passée. Une correction = nouvelle entrée datée.
2. **Pas de secrets.** Pas de tokens, IPs internes, credentials. `gitleaks` actif en pre-commit.
3. **Filtre auto.** Hook `Stop` détecte commits/PRs créés et déclenche le skill. Sessions de simple lecture ne loguent pas.
4. **Curated.** Seul Claude Code (via skill `/log-session`) écrit. Les autres agents n'écrivent pas ici.
5. **Lu au démarrage.** `CLAUDE.md` instruit de lire les ~100 dernières lignes en début de session.

---

# Timeline

## 2026-04-27 — INC-2026-010 fix root-cause 503 R8 + steady state J+2

- **Branche** : `fix/inc-2026-007-build-vehicle-page-payload-optim` (monorepo) + `incident/inc-2026-007-503-vehicle-build-payload-slow` (vault) — note : nom branches garde `007` historique, ID incident vault renumerote `INC-2026-010` post collision detectee par CI vault
- **Décision** : Root-cause 503 R8 vehicle pages = `build_vehicle_page_payload` cree par Phase 1 ADR-016 (21/04) avec sous-requete `catalog` qui force le PK 12 GB au lieu de l'index covering 4 GB existant (~2 s rebuild vs timeout 2 s = 503). Fix structurel : reecriture en deux phases (CTE) -> warm 27 ms (-96 %) + steady-state guarantees (cron one-shot backfill + trigger auto_type + wrapper canon mark_stale_with_followup_rebuild + check CI guard). Validation J+2 : stale=0/28 505, watcher auto-unschedule, page 34746 = 200, stress 100 hits = 100/100 = 200.
- **Sortie** : PR monorepo #167 OPEN (4 commits, 4 migrations DB + 2 controllers NestJS + instrumentation loader Remix + smoke 12 URLs + check CI) | PR vault #65 OPEN (post-mortem INC-2026-010 + steady state J+2 + fix CI G2/wikilinks) | DB deja patchee en prod via MCP (idempotent) | Reste : merge user PR #167 + tag semver pour deploy PROD, Etape 6 RPC_TIMEOUT_MS=500 (post-merge), Etape 10 ADR-016 accepted (J+7 = 2026-05-02), J+14 verif __error_logs + GSC

## 2026-04-25 — bootstrap log.md timeline

- **Branche** : `chore/log-md-session-timeline-1777110107`
- **Décision** : Adoption d'un `log.md` append-only à la racine, complémentaire à `MEMORY.md` (apprentissages) et aux PR descriptions (détails). Hook `Stop` auto-déclenche le skill `/log-session` si commits ou PRs créés. Format strict 3-4 lignes par entrée.
- **Sortie** : nouvelle PR (numéro à venir) | fichiers `log.md`, `.claude/skills/session-log/SKILL.md`, `scripts/claude-hooks/stop-log-session-suggest.sh`, `.claude/settings.json`, `CLAUDE.md`, `.claude/knowledge/README.md`

## 2026-04-25 — vague cleanup batches 1-3 (rétroactif)

- **Branche** : multiples — `chore/cleanup-backend-root-js-...`, `chore/cleanup-dead-components-search-...`, `chore/cleanup-dead-components-forms-...`
- **Décision** : Lancement vague cleanup post-Phase-0. Pattern adopté : worktree isolé + branches timestamp uniques + sequence atomique (rm + commit + push + PR sans typecheck local) pour zero collision avec IDE actif. Validation par CI uniquement.
- **Sortie** : PR #157 mergée (62 scripts `.js` backend root, 5991 lignes) | PRs #158 + #160 ouvertes (3 + 4 composants `frontend/app/components/{search,forms}/`, ~3500 lignes) | git worktree à `/tmp/claude-cleanup-worktree`

## 2026-04-24 — infrastructure Phase 0 cleanup tooling

- **Branche** : `feat/claude-knowledge-base`, `feat/audit-ci-integration`, `feat/cleanup-tooling-prep`
- **Décision** : Adoption knip + madge + dependency-cruiser + ast-grep en gates déterministes (warning-mode Phase 0). Création `.claude/knowledge/` (42 modules + 4 db + 4 integrations). CI workflow `audit.yml` blockant ast-grep. Safe-delete script + baseline JSON regression gate + 3 runbooks ops.
- **Sortie** : PRs #149, #152, #155 mergées | knip 6.6.2 (avec nested zod@4 override) + madge 8 + dep-cruiser 17.3 + @ast-grep/cli 0.42 installés | baseline 362 unused / 17 cycles / 148 violations / 0 ast-errors capturée

## 2026-04-25 — feat/seo-department-phase-0 (auto)

- **Branche** : `feat/seo-department-phase-0`
- **Décision** : feat(seo-department): phase 0 foundations - seo-types package + runbook + recharts + env
- **Sortie** : PR #166 | commits c7d166e3

## 2026-04-25 — feat/seo-department-phase-0 (auto)

- **Branche** : `feat/seo-department-phase-0`
- **Décision** : fix(seo-department): align env var names + domain on existing codebase conventions (+2 other commits)
- **Sortie** : PR #166 | commits 8d6ef182 db07048c c7d166e3

## 2026-04-25 — feat/seo-department-phase-1 (auto)

- **Branche** : `feat/seo-department-phase-1`
- **Décision** : feat(seo-department): phase 1a - observability foundations (migrations + module + endpoints)
- **Sortie** : PR #170 | commits 7d4ce121

## 2026-04-25 — feat/seo-department-phase-2a (auto)

- **Branche** : `feat/seo-department-phase-2a`
- **Décision** : feat(seo-department): phase 2a - audit findings table + canonical auditor
- **Sortie** : PR #174 | commits 9581f6c2

## 2026-04-25 — fix/inc-2026-007-build-vehicle-page-payload-optim (auto)

- **Branche** : `fix/inc-2026-007-build-vehicle-page-payload-optim`
- **Décision** : fix(ci): smoke /constructeurs/* — replace inactive type + redirect URL with valid ones (+3 other commits)
- **Sortie** : PR #167 | commits 84aa9655 9dc8f71b 26d3cea0 26812832

## 2026-04-27 — feat/r1-gamme-page-cache-phase1 (auto)

- **Branche** : `feat/r1-gamme-page-cache-phase1`
- **Décision** : feat(r1-cache): adr-024 phase 1 gamme_page_cache scaffolding (no runtime impact)
- **Sortie** : PR #194 | commits a95a8b74

## 2026-04-27 — feat/r1-gamme-page-cache-phase1 (auto)

- **Branche** : `feat/r1-gamme-page-cache-phase1`
- **Décision** : fix(r1-cache): add gamme_cache RPCs to allowlist + APPROVED comment for DROP POLICY (+2 other commits)
- **Sortie** : PR #194 | commits 39c034be 8b289897 a95a8b74

## 2026-04-29 — feat/db-diag-maintenance-via-kg-and-cleanup (auto)

- **Branche** : `feat/db-diag-maintenance-via-kg-and-cleanup`
- **Décision** : feat(adr-032-pr1): kg_* canon for maintenance/safety/DTC + DROP __diag_safety_rule
- **Sortie** : PR #207 | commits 3ca8db82

## 2026-04-29 — feat/be-maintenance-calculator-service-v2 (auto)

- **Branche** : `feat/be-maintenance-calculator-service-v2`
- **Décision** : fix(adr-032-pr2): drop @jest/globals import in calculator test (+1 other commit)
- **Sortie** : PR #211 | commits 317ccb67 a55d03ee

## 2026-04-29 — feat/fe-diagnostic-wizard-dynamic (auto)

- **Branche** : `feat/fe-diagnostic-wizard-dynamic`
- **Décision** : feat(adr-032-pr10): make DiagnosticWizard.tsx dynamic via /wizard-steps endpoint
- **Sortie** : PR #219 | commits d55e5beb

## 2026-04-30 — fix/permissions-canonical-backend (auto)

- **Branche** : `fix/permissions-canonical-backend`
- **Décision** : feat(auth): add UserPermissions DTO + level constants (+2 other commits)
- **Sortie** : PR aucune | commits fa3c03ef 8ba4394a 2b9678b3

## 2026-04-30 — fix/cache-warm-non-blocking (auto)

- **Branche** : `fix/cache-warm-non-blocking`
- **Décision** : fix(boot): make cache-warm non-blocking in CatalogService + InternalLinkingService
- **Sortie** : PR #224 | commits a0a67c66

## 2026-04-30 — fix/cache-warm-non-blocking (auto)

- **Branche** : `fix/cache-warm-non-blocking`
- **Décision** : fix(boot): finish non-blocking onModuleInit + lock contract via lint (+2 other commits)
- **Sortie** : PR #224 | commits 5d503e1a 31e9517e a0a67c66

## 2026-04-30 — fix/cache-warm-non-blocking (auto)

- **Branche** : `fix/cache-warm-non-blocking`
- **Décision** : fix(boot): non-blocking onModuleInit for Meilisearch services (+4 other commits)
- **Sortie** : PR #224 | commits e489ecbe 5b7c5530 5d503e1a 31e9517e a0a67c66

## 2026-04-30 — fix/cache-warm-non-blocking (auto)

- **Branche** : `fix/cache-warm-non-blocking`
- **Décision** : fix(boot): align bullmq redis config with REDIS_URL + remove diagnostics (+7 other commits)
- **Sortie** : PR #224 | commits 919ba33a abc6cd6a 45cddefd e489ecbe 5b7c5530 5d503e1a 31e9517e a0a67c66

## 2026-04-30 — fix/cache-warm-non-blocking (auto)

- **Branche** : `fix/cache-warm-non-blocking`
- **Décision** : fix(ci): correct constructeur URL format in perf-gates lighthouse list (+12 other commits)
- **Sortie** : PR #224 | commits 74c9305e fdf691af 20d8e294 5a6e63b4 5e034ca4 919ba33a abc6cd6a 45cddefd e489ecbe 5b7c5530 5d503e1a 31e9517e a0a67c66

## 2026-04-30 — fix/cache-warm-non-blocking (auto)

- **Branche** : `fix/cache-warm-non-blocking`
- **Décision** : fix(ci): unblock lighthouse — drop budget `name` + disable broken artifact upload (+14 other commits)
- **Sortie** : PR #224 | commits 96fa0553 a580ba03 74c9305e fdf691af 20d8e294 5a6e63b4 5e034ca4 919ba33a abc6cd6a 45cddefd e489ecbe 5b7c5530 5d503e1a 31e9517e a0a67c66

## 2026-04-30 — fix/cache-warm-non-blocking (auto)

- **Branche** : `fix/cache-warm-non-blocking`
- **Décision** : Revert "perf(home): lazy-load below-the-fold sections via React.lazy + Suspense" (+17 other commits)
- **Sortie** : PR #224 | commits 74148c9e 374cba10 e5b05cac 96fa0553 a580ba03 74c9305e fdf691af 20d8e294 5a6e63b4 5e034ca4 919ba33a abc6cd6a 45cddefd e489ecbe 5b7c5530 5d503e1a 31e9517e a0a67c66

## 2026-04-30 — perf/warm-cache-homepage-families (auto)

- **Branche** : `perf/warm-cache-homepage-families`
- **Décision** : perf(home): warm homepage:families cache key alongside below-fold
- **Sortie** : PR #227 | commits a0dc5519

## 2026-04-30 — feat/marketing-phase1-db (auto)

- **Branche** : `feat/marketing-phase1-db`
- **Décision** : feat(adr-036-pr1.1): marketing phase 1 db migration + python apply scripts
- **Sortie** : PR #238 | commits 2200cb61

## 2026-04-30 — feat/marketing-phase1-db (auto)

- **Branche** : `feat/marketing-phase1-db`
- **Décision** : fix(migration-safety): approve idempotent drop policy pattern (recreate immediate) (+2 other commits)
- **Sortie** : PR #238 | commits 3c446aa8 8c742bc8 2200cb61

## 2026-04-30 — chore/matrix-pr-d3-zero-unmappable (auto)

- **Branche** : `chore/matrix-pr-d3-zero-unmappable`
- **Décision** : feat(matrix): ADR-037 agent-naming-canon — frontmatter `role:` Zod-validated, fail-fast
- **Sortie** : PR #239 | commits 043daeb9

## 2026-04-30 — chore/matrix-pr-d3-zero-unmappable (auto)

- **Branche** : `chore/matrix-pr-d3-zero-unmappable`
- **Décision** : fix(matrix): remove TOCTOU race in inject-agent-role.ts (CodeQL js/file-system-race) (+3 other commits)
- **Sortie** : PR #239 | commits d62eafab 6d1b7db3 eba3c643 043daeb9

## 2026-04-30 — feat/marketing-phase1-dto-scoring (auto)

- **Branche** : `feat/marketing-phase1-dto-scoring`
- **Décision** : fix(adr-036-pr1.3): broaden env signature to record (avoids unknown cast) (+2 other commits)
- **Sortie** : PR #241 | commits d1baf143 a5c86dca 7f4ebdf1

## 2026-05-01 — feat/p3-diag-canon-flat-map-composite-fk (auto)

- **Branche** : `feat/p3-diag-canon-flat-map-composite-fk`
- **Décision** : feat(p3): diag-canon flat map + composite FK validator + drop hardcoded fallback
- **Sortie** : PR aucune | commits 714b742e

## 2026-05-01 — Roadmap globale 2026 + Chantier C ADR-033 READY

- **Branche** : `audit/2026-05-01-roadmap-chantier-c-clean` (vault)
- **Décision** : Re-cadrage ADR-033 → Chantier C (1/9) via MOC-Roadmap-2026 + verdict wiki-readiness-check READY après 2 hotfixes cron PR-D
- **Sortie** : PRs vault #128 #131 | monorepo #256 #257 | commits b3f820a ec17aaa b70ca1e6 097d3558 | fichiers `ops/moc/MOC-Roadmap-2026.md`, `scripts/wiki/export-diag-canon-slugs.py`

## 2026-05-01 — ADR-033 wave 2/3 closed + canonisation vault

- **Branche** : `feat/p3-diag-canon-flat-map-composite-fk`
- **Décision** : Wave Phase 2/3 ADR-033 livrée (10 PRs : rag #7 + wiki #10 + monorepo #249 #250 #251 #253 + 3 fixes) ; verdict wiki-readiness-check READY 6/6 atteint run #25211876381 ; knowledge canonisé vault PR #129
- **Sortie** : PRs vault #129 | monorepo #249 #250 #251 #253 | rag #7 | wiki #10 | commits 224e4c63 7d77be6d d0b32a0b 96837b95 b6a73af8 c6c8eae4 | fichiers `workspaces/wiki/`, `scripts/wiki/`, `.github/workflows/{wiki-validate,diag-canon-slugs-export,wiki-readiness-check}.yml`, `ledger/knowledge/adr-033-wave-2-closed-20260501.md`

## 2026-05-01 — feat/p3-diag-canon-flat-map-composite-fk (auto)

- **Branche** : `feat/p3-diag-canon-flat-map-composite-fk`
- **Décision** : feat(p3): zod ts as single sot, schema derived, drift via parse runtime (+3 other commits)
- **Sortie** : PR aucune | commits 4e24f1b9 85214f84 9a6b9240 714b742e

## 2026-05-01 — feat/p3-diag-canon-flat-map-composite-fk (auto)

- **Branche** : `feat/p3-diag-canon-flat-map-composite-fk`
- **Décision** : fix(p3): wrap tsx -e parse step in async iife (cjs forbids top-level await) (+5 other commits)
- **Sortie** : PR #262 | commits 8fe27520 7669f75d 4e24f1b9 85214f84 9a6b9240 714b742e

## 2026-05-02 — feat/p3-diag-canon-flat-map-composite-fk (auto)

- **Branche** : `feat/p3-diag-canon-flat-map-composite-fk`
- **Décision** : Merge branch 'main' into feat/p3-diag-canon-flat-map-composite-fk (+7 other commits)
- **Sortie** : PR #262 | commits 683178d4 2a4cf7d7 8fe27520 7669f75d 4e24f1b9 85214f84 9a6b9240 714b742e

## 2026-05-02 — feat/p3-diag-canon-flat-map-composite-fk (auto)

- **Branche** : `feat/p3-diag-canon-flat-map-composite-fk`
- **Décision** : Merge branch 'main' into feat/p3-diag-canon-flat-map-composite-fk (+10 other commits)
- **Sortie** : PR #262 | commits 9b94dc04 0862f103 a0c05032 683178d4 2a4cf7d7 8fe27520 7669f75d 4e24f1b9 85214f84 9a6b9240 714b742e

## 2026-05-02 — feat/p3-diag-canon-flat-map-composite-fk (auto)

- **Branche** : `feat/p3-diag-canon-flat-map-composite-fk`
- **Décision** : chore(audit): bump knip.unused_types baseline 310 → 326 (zod types prep partie 3) (+12 other commits)
- **Sortie** : PR #262 | commits cd2789fe 2fd4f936 9b94dc04 0862f103 a0c05032 683178d4 2a4cf7d7 8fe27520 7669f75d 4e24f1b9 85214f84 9a6b9240 714b742e

## 2026-05-02 — feat/p3-diag-canon-flat-map-composite-fk (auto)

- **Branche** : `feat/p3-diag-canon-flat-map-composite-fk`
- **Décision** : Merge branch 'main' into feat/p3-diag-canon-flat-map-composite-fk (+14 other commits)
- **Sortie** : PR #262 | commits 6992eea5 ce7f7c7f cd2789fe 2fd4f936 9b94dc04 0862f103 a0c05032 683178d4 2a4cf7d7 8fe27520 7669f75d 4e24f1b9 85214f84 9a6b9240 714b742e

## 2026-05-02 — feat/p3-diag-canon-flat-map-composite-fk (auto)

- **Branche** : `feat/p3-diag-canon-flat-map-composite-fk`
- **Décision** : Merge branch 'main' into feat/p3-diag-canon-flat-map-composite-fk (+16 other commits)
- **Sortie** : PR #262 | commits 9d5af4da baa8ee78 6992eea5 ce7f7c7f cd2789fe 2fd4f936 9b94dc04 0862f103 a0c05032 683178d4 2a4cf7d7 8fe27520 7669f75d 4e24f1b9 85214f84 9a6b9240 714b742e

## 2026-05-02 — feat/p3-diag-canon-flat-map-composite-fk (auto)

- **Branche** : `feat/p3-diag-canon-flat-map-composite-fk`
- **Décision** : Merge branch 'main' into feat/p3-diag-canon-flat-map-composite-fk (+18 other commits)
- **Sortie** : PR #262 | commits 21ea2b3a 0d300149 9d5af4da baa8ee78 6992eea5 ce7f7c7f cd2789fe 2fd4f936 9b94dc04 0862f103 a0c05032 683178d4 2a4cf7d7 8fe27520 7669f75d 4e24f1b9 85214f84 9a6b9240 714b742e

## 2026-05-02 — chore/husky-pre-push-main-guard (auto)

- **Branche** : `chore/husky-pre-push-main-guard`
- **Décision** : chore(husky): add pre-push hook blocking direct pushes to main/dev
- **Sortie** : PR aucune | commits e5c5d261

## 2026-05-02 — fix/diag-canon-jsonschema-typed-cast (auto)

- **Branche** : `fix/diag-canon-jsonschema-typed-cast`
- **Décision** : fix(p3): replace @ts-nocheck with typed cast on zodToJsonSchema import
- **Sortie** : PR aucune | commits 5e56077a

## 2026-05-02 — fix/diag-canon-jsonschema-typed-cast (auto)

- **Branche** : `fix/diag-canon-jsonschema-typed-cast`
- **Décision** : chore(audit): ratchet baseline unused_types 355→326 (revert post-#262 over-bump) (+2 other commits)
- **Sortie** : PR #265 | commits 12f54d26 cefeb9ae 5e56077a

## 2026-05-02 — fix/diag-canon-jsonschema-typed-cast (auto)

- **Branche** : `fix/diag-canon-jsonschema-typed-cast`
- **Décision** : revert(audit): undo baseline ratchet 355→326 (was based on stale local knip) (+4 other commits)
- **Sortie** : PR #265 | commits c0ca674e 4e290722 12f54d26 cefeb9ae 5e56077a

## 2026-05-02 — fix/diag-canon-jsonschema-typed-cast (auto)

- **Branche** : `fix/diag-canon-jsonschema-typed-cast`
- **Décision** : Merge remote-tracking branch 'origin/main' into fix/diag-canon-jsonschema-typed-cast (+6 other commits)
- **Sortie** : PR #265 | commits c9b7a2be a9f8741a c0ca674e 4e290722 12f54d26 cefeb9ae 5e56077a

## 2026-05-03 — feat/audit-claude-md-agents-md (auto)

- **Branche** : `feat/audit-claude-md-agents-md`
- **Décision** : feat(agents): audit + structural gate for AGENTS.md / CLAUDE.md
- **Sortie** : PR aucune | commits 9842fa00

## 2026-05-03 — chore/bump-wiki-submodule-pointer (auto)

- **Branche** : `chore/bump-wiki-submodule-pointer`
- **Décision** : chore: bump wiki submodule pointer to current origin/main
- **Sortie** : PR #273 | commits 707a1775

## 2026-05-03 — feat/wiki-generators-output-redirect (auto)

- **Branche** : `feat/wiki-generators-output-redirect`
- **Décision** : feat(scripts): refactor placement vers sous-dossiers thematiques (Etape 5 plan v3)
- **Sortie** : PR aucune | commits b6400f07

## 2026-05-04 — fix/perf-gates-read-only-adr028 (auto)

- **Branche** : `fix/perf-gates-read-only-adr028`
- **Décision** : fix(ci): mock SERVICE_ROLE_KEY for boot — ~30 services bypass SupabaseBaseService (+1 other commit)
- **Sortie** : PR #285 | commits 442f5956 af006c72

## 2026-05-04 — chore/sync-rag-from-wiki-cron-canon (auto)

- **Branche** : `chore/sync-rag-from-wiki-cron-canon`
- **Décision** : chore(cron): sync-rag-from-wiki canon DEV VPS — meilleure approche (zero PAT)
- **Sortie** : PR #288 | commits 005b9d0a

## 2026-05-04 — chore/sync-rag-from-wiki-cron-canon (auto)

- **Branche** : `chore/sync-rag-from-wiki-cron-canon`
- **Décision** : fix(cron): log path /opt/automecanik/rag/logs/ (le user deploy n'a pas droit /var/log) (+2 other commits)
- **Sortie** : PR #288 | commits ee0ba019 8fc09139 005b9d0a

## 2026-05-04 — chore/canon-mirrors-relocation (auto)

- **Branche** : `chore/canon-mirrors-relocation`
- **Décision** : chore(canon): relocate AEC + Marketing Voice mirrors to canon-mirrors/
- **Sortie** : PR aucune | commits aa0e8980

## 2026-05-05 — chore/cleanup-dead-page-type-map (auto)

- **Branche** : `chore/cleanup-dead-page-type-map`
- **Décision** : chore(seo-roles): drop dead-code PAGE_TYPE_TO_CANONICAL_ROLE map
- **Sortie** : PR #311 | commits 10135a2f

## 2026-05-05 — canon SEO R0..R8 — 9 PRs livrées d'un trait

- **Branche** : `main` (squash cascade)
- **Décision** : Stack canon SEO complet livré : foundation `@repo/seo-roles@0.2.0` + admin display + Zod boundary + lint enforcement observe + dead-code cleanup + MCP inventory pivot Option C ; 4 couches enforcement (TS branded + Zod runtime + lint statique + observability), DB CHECK retiré (worker vocab vs canon séparation intentionnelle).
- **Sortie** : PRs #304 #305 #306 #307 #308 #309 #310 #311 #312 | commits 0a792dcc 7f139d91 0545f36c d06677ae 179bbfdb | fichiers `packages/seo-roles/`, `frontend/app/routes/admin.*.tsx`, `backend/src/modules/seo/utils/parse-response.ts`, `.ast-grep/rules/seo-no-bare-role-literal.yml`, `.spec/00-canon/db-governance/legacy-canon-map.md`

## 2026-05-05 — chore/seo-roles-r6-intenttype-canonical (auto)

- **Branche** : `chore/seo-roles-r6-intenttype-canonical`
- **Décision** : refactor(seo-roles): migrate R6 payload discriminators to canonical R6_GUIDE_ACHAT
- **Sortie** : PR #315 | commits f9824922
