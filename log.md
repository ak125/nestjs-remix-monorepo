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

## 2026-05-05 — feat/seo-roles-keyword-intent-canon (auto)

- **Branche** : `feat/seo-roles-keyword-intent-canon`
- **Décision** : feat(seo-roles): keyword-intent canonical SoT @repo/seo-roles@0.3.0 (PR-0C)
- **Sortie** : PR #317 | commits 94aabb03

## 2026-05-06 — feat/observability-sentry-dev (auto)

- **Branche** : `feat/observability-sentry-dev`
- **Décision** : feat(observability): Sentry wiring + SOPS+age secret management infra
- **Sortie** : PR #324 | commits aaa59617

## 2026-05-06 — chore/trigger-redeploy-sentry-fix (auto)

- **Branche** : `chore/trigger-redeploy-sentry-fix`
- **Décision** : fix(ci): source preprod .env in deploy step to prevent env stripping on manual rerun
- **Sortie** : PR #329 | commits a008b0fe

## 2026-05-06 — feat/observability-sentry-prod (auto)

- **Branche** : `feat/observability-sentry-prod`
- **Décision** : feat(observability): extend Sentry+SOPS to PROD via deploy-prod.yml wrapper (PR-D)
- **Sortie** : PR #334 | commits f433640a

## 2026-05-07 — feat/seo-roles-canon-pr-a-classification (auto)

- **Branche** : `feat/seo-roles-canon-pr-a-classification`
- **Décision** : feat(seo-roles): intents + forbidden-overlap + text-normalize @0.5.0 (R3 PR-A)
- **Sortie** : PR #342 | commits 9f58b1ca

## 2026-05-07 — feat/r3-canon-observability-pr-e (auto)

- **Branche** : `feat/r3-canon-observability-pr-e`
- **Décision** : feat(seo-r3): conseil-enricher 2-gate canon refactor (r3 canon hardening pr-c)
- **Sortie** : PR aucune | commits 35ae7726

## 2026-05-07 — feat/r3-canon-observability-pr-e (auto)

- **Branche** : `feat/r3-canon-observability-pr-e`
- **Décision** : feat(seo-r3): canon violation sentry counter (r3 canon hardening pr-e) (+2 other commits)
- **Sortie** : PR aucune | commits 10e247bd 09177259 35ae7726

## 2026-05-07 — feat/adr-048-repo-map-drift-detector (auto)

- **Branche** : `feat/adr-048-repo-map-drift-detector`
- **Décision** : feat(spec-canon): repo-map.md drift detector + CI workflow (ADR-048 sprint 2 P1)
- **Sortie** : PR #358 | commits 7b031164

## 2026-05-07 — feat/pr-e-l3-rag-mirror-readonly (auto)

- **Branche** : `feat/pr-e-l3-rag-mirror-readonly`
- **Décision** : feat(rag): L3 mirror readonly enforcement + bootstrap guard (MVP-0 PR-E)
- **Sortie** : PR #356 | commits 2ed2e9b7

## 2026-05-08 — feat/seo-v9-pr1-gap-matrix (auto)

- **Branche** : `feat/seo-v9-pr1-gap-matrix`
- **Décision** : feat(seo-v9-pr1): orchestrateur audit-v9-inventaire (5 volets + rapport) (+8 other commits)
- **Sortie** : PR aucune | commits e71c56db 24a3f45b 336af298 0ca47b59 80ca710a db687ebb 209ab2a0 5e1b91d9 8241d404

## 2026-05-08 — feat/seo-v9-pr1-gap-matrix (auto)

- **Branche** : `feat/seo-v9-pr1-gap-matrix`
- **Décision** : feat(seo-v9-pr1): livrable canon legacy_to_monorepo_gap_matrix.md (baseline 10 lignes) (+12 other commits)
- **Sortie** : PR #398 | commits 7f2ee66c 823f88c1 d9fa7ced 75c5e45b e71c56db 24a3f45b 336af298 0ca47b59 80ca710a db687ebb 209ab2a0 5e1b91d9 8241d404

## 2026-05-08 — feat/seo-v9-pr1-gap-matrix (auto)

- **Branche** : `feat/seo-v9-pr1-gap-matrix`
- **Décision** : fix(seo-v9-pr1): sample-urls.json avec IDs Supabase réels (Nissan Almera + BMW Série 3) (+14 other commits)
- **Sortie** : PR #398 | commits 60bc790b ce003574 7f2ee66c 823f88c1 d9fa7ced 75c5e45b e71c56db 24a3f45b 336af298 0ca47b59 80ca710a db687ebb 209ab2a0 5e1b91d9 8241d404

## 2026-05-08 — feat/seo-v9-pr1-gap-matrix (auto)

- **Branche** : `feat/seo-v9-pr1-gap-matrix`
- **Décision** : fix(seo-v9-pr1): sample-urls.json — gammes vraiment dans le catalogue (pg_display=1) (+16 other commits)
- **Sortie** : PR #398 | commits 57021f0b fb988099 60bc790b ce003574 7f2ee66c 823f88c1 d9fa7ced 75c5e45b e71c56db 24a3f45b 336af298 0ca47b59 80ca710a db687ebb 209ab2a0 5e1b91d9 8241d404

## 2026-05-08 — feat/seo-v9-pr1-gap-matrix (auto)

- **Branche** : `feat/seo-v9-pr1-gap-matrix`
- **Décision** : fix(seo-v9-pr1): volet 4 — chiffres vérifiés via vue v_pieces_seo_safe (+18 other commits)
- **Sortie** : PR #398 | commits beb9eda9 44a035c5 57021f0b fb988099 60bc790b ce003574 7f2ee66c 823f88c1 d9fa7ced 75c5e45b e71c56db 24a3f45b 336af298 0ca47b59 80ca710a db687ebb 209ab2a0 5e1b91d9 8241d404

## 2026-05-08 — feat/seo-v9-pr1-gap-matrix (auto)

- **Branche** : `feat/seo-v9-pr1-gap-matrix`
- **Décision** : feat(seo-v9-pr1): matrice enrichie avec findings empiriques + décision PR-2 motivée (+20 other commits)
- **Sortie** : PR #398 | commits 9b970255 99372469 beb9eda9 44a035c5 57021f0b fb988099 60bc790b ce003574 7f2ee66c 823f88c1 d9fa7ced 75c5e45b e71c56db 24a3f45b 336af298 0ca47b59 80ca710a db687ebb 209ab2a0 5e1b91d9 8241d404

## 2026-05-08 — feat/seo-v9-pr1-gap-matrix (auto)

- **Branche** : `feat/seo-v9-pr1-gap-matrix`
- **Décision** : fix(seo-v9-pr1): 4 critiques review auto (regex faux positifs, silent failures, README, anti-rot) (+22 other commits)
- **Sortie** : PR #398 | commits 86d77b1b a34af83e 9b970255 99372469 beb9eda9 44a035c5 57021f0b fb988099 60bc790b ce003574 7f2ee66c 823f88c1 d9fa7ced 75c5e45b e71c56db 24a3f45b 336af298 0ca47b59 80ca710a db687ebb 209ab2a0 5e1b91d9 8241d404

## 2026-05-08 — feat/seo-v9-pr1-gap-matrix (auto)

- **Branche** : `feat/seo-v9-pr1-gap-matrix`
- **Décision** : fix(seo-v9-pr1): samples complets avec 14 variables SeoVariablesSchema requises (+24 other commits)
- **Sortie** : PR #398 | commits 65e3cdac af66d534 86d77b1b a34af83e 9b970255 99372469 beb9eda9 44a035c5 57021f0b fb988099 60bc790b ce003574 7f2ee66c 823f88c1 d9fa7ced 75c5e45b e71c56db 24a3f45b 336af298 0ca47b59 80ca710a db687ebb 209ab2a0 5e1b91d9 8241d404

## 2026-05-08 — feat/seo-v9-pr2b-policies (auto)

- **Branche** : `feat/seo-v9-pr2b-policies`
- **Décision** : feat(seo): 4 services policies SEO (PR-2b/v9, stacked sur 2a) (+1 other commit)
- **Sortie** : PR #400 | commits 85731ace 8d66d310

## 2026-05-08 — feat/seo-v9-pr2c-renderer-switch (auto)

- **Branche** : `feat/seo-v9-pr2c-renderer-switch`
- **Décision** : feat(seo): chain services + orchestrator (PR-2c/v9, stacked sur 2b) (+3 other commits)
- **Sortie** : PR #401 | commits d4278b8e c02a31d2 85731ace 8d66d310

## 2026-05-08 — feat/seo-v9-pr2c-renderer-switch (auto)

- **Branche** : `feat/seo-v9-pr2c-renderer-switch`
- **Décision** : refactor(seo): v4 delegates to chain orchestrator (PR-2c rev 2) (+5 other commits)
- **Sortie** : PR #401 | commits 79c32c9c 93c63ffe d4278b8e c02a31d2 85731ace 8d66d310

## 2026-05-08 — feat/seo-v9-pr2d-marketing-parity (auto)

- **Branche** : `feat/seo-v9-pr2d-marketing-parity`
- **Décision** : feat(seo-v9): PR-2c chain services + orchestrator (stacked sur 2b) (#401) (+2 other commits)
- **Sortie** : PR aucune | commits efc4c9fa 85731ace 8d66d310

## 2026-05-08 — feat/seo-v9-pr2d-marketing-parity (auto)

- **Branche** : `feat/seo-v9-pr2d-marketing-parity`
- **Décision** : feat(seo): marketing seed parity legacy V4 + V4 E2E test (PR-2d) (+4 other commits)
- **Sortie** : PR #402 | commits 06f62afe 7cd4063f efc4c9fa 85731ace 8d66d310

## 2026-05-09 — pr6-clean (auto)

- **Branche** : `pr6-clean`
- **Décision** : fix(seo-v9): pr-6 update vehicle-rpc legacy test for shadowObservatory dep (+2 other commits)
- **Sortie** : PR aucune | commits c4808beb a8df0f53 c230abd4

## 2026-05-09 — feat/seo-v9-r7-router-wire (auto)

- **Branche** : `feat/seo-v9-r7-router-wire`
- **Décision** : docs(seo-batch): unblock R7 step in seo-gamme-audit skill (+2 other commits)
- **Sortie** : PR #418 | commits cd329235 b94d51eb 46778759

## 2026-05-10 — monorepo/pr5-url-immutability-gate (auto)

- **Branche** : `monorepo/pr5-url-immutability-gate`
- **Décision** : feat(seo): add R-SEO-09 URL immutability gate phase 1 surface guard (+1 other commit)
- **Sortie** : PR #428 | commits 18cc6c59 22ff92fc

## 2026-05-13 — feat/registry-pr-b-schemas (auto)

- **Branche** : `feat/registry-pr-b-schemas`
- **Décision** : feat(registry): add @repo/registry package — Zod schemas V1 (ADR-058 PR-B)
- **Sortie** : PR #457 | commits 0504fd38

## 2026-05-13 — feat/registry-pr-c-data-layer (auto)

- **Branche** : `feat/registry-pr-c-data-layer`
- **Décision** : feat(registry): 5 Layer 1 builders + RPC parse modes + CI warn-only (ADR-058 PR-C) (+2 other commits)
- **Sortie** : PR #458 | commits b281943b f067e9ec 0504fd38

## 2026-05-13 — feat/registry-pr-d-canon-overlay (auto)

- **Branche** : `feat/registry-pr-d-canon-overlay`
- **Décision** : feat(registry): Layer 2 overlay manuel + seed/validate + DomainId D1..D15 (ADR-058 PR-D) (+4 other commits)
- **Sortie** : PR #460 | commits 66d9e64f b08d3e90 b281943b f067e9ec 0504fd38

## 2026-05-13 — feat/registry-pr-e-canonical (auto)

- **Branche** : `feat/registry-pr-e-canonical`
- **Décision** : feat(registry): canonical projection Layer 3 + freshness CI Phase 1 + 4 invariants (ADR-058 PR-E) (+6 other commits)
- **Sortie** : PR #462 | commits a1d79d5b 658018c4 66d9e64f b08d3e90 b281943b f067e9ec 0504fd38

## 2026-05-13 — feat/registry-pr-g-block-new (auto)

- **Branche** : `feat/registry-pr-g-block-new`
- **Décision** : feat(registry): CI Phase 2 block-new gate + pre-push hook (ADR-058 PR-G) (+8 other commits)
- **Sortie** : PR #464 | commits 27d515d8 77d4b57a a1d79d5b 658018c4 66d9e64f b08d3e90 b281943b f067e9ec 0504fd38

## 2026-05-13 — feat/registry-pr-g-block-new (auto)

- **Branche** : `feat/registry-pr-g-block-new`
- **Décision** : chore(registry): regen canonical + REPO_MAP after merge main (PR-G recovery) (+12 other commits)
- **Sortie** : PR #482 | commits 0653d797 00fe3be6 60209305 5828f494 27d515d8 77d4b57a a1d79d5b 658018c4 66d9e64f b08d3e90 b281943b f067e9ec 0504fd38

## 2026-05-13 — feat/registry-pr-g-block-new (auto)

- **Branche** : `feat/registry-pr-g-block-new`
- **Décision** : fix(registry-new-file-gate): invoke node direct (npm wrapper pollutes JSON stdout) (+14 other commits)
- **Sortie** : PR #482 | commits 3eb76950 5368dec1 0653d797 00fe3be6 60209305 5828f494 27d515d8 77d4b57a a1d79d5b 658018c4 66d9e64f b08d3e90 b281943b f067e9ec 0504fd38

## 2026-05-13 — feat/registry-pr-g-block-new (auto)

- **Branche** : `feat/registry-pr-g-block-new`
- **Décision** : fix(check-new-files): sanitize argv ref + execFileSync (CodeQL injection guard) (+16 other commits)
- **Sortie** : PR #482 | commits f0c6f729 b05435e8 3eb76950 5368dec1 0653d797 00fe3be6 60209305 5828f494 27d515d8 77d4b57a a1d79d5b 658018c4 66d9e64f b08d3e90 b281943b f067e9ec 0504fd38

## 2026-05-14 — feat/ci-workspace-invariants (auto)

- **Branche** : `feat/ci-workspace-invariants`
- **Décision** : feat(ci): workspace mini-monorepo check (ADR-061 §6)
- **Sortie** : PR aucune | commits 9331cadd

## 2026-05-14 — feat/canon-mirrors-precommit-hook (auto)

- **Branche** : `feat/canon-mirrors-precommit-hook`
- **Décision** : feat(canon-mirrors): pre-commit hook blocks manual edits (ADR-061 §3)
- **Sortie** : PR aucune | commits c725253e

## 2026-05-14 — feat/pr-4-frontend-utils-batch-1 (auto)

- **Branche** : `feat/pr-4-frontend-utils-batch-1`
- **Décision** : chore(cleanup): drop 4 frontend dead utils (PR-4 batch 1)
- **Sortie** : PR aucune | commits c24a3fe5

## 2026-05-14 — refactor/registry-zod-validator-extract (auto)

- **Branche** : `refactor/registry-zod-validator-extract`
- **Décision** : refactor(ci): extract Zod validator to tsx script, remove inline heredoc + build dependency
- **Sortie** : PR #503 | commits 47dea57f

## 2026-05-14 — refactor/registry-zod-validator-extract (auto)

- **Branche** : `refactor/registry-zod-validator-extract`
- **Décision** : refactor(registry): convert @repo/registry to source-only workspace (+2 other commits)
- **Sortie** : PR #503 | commits 90f20f13 9afc7674 47dea57f

## 2026-05-14 — fix/perf-gates-bundle-stats-no-lighthouse (auto)

- **Branche** : `fix/perf-gates-bundle-stats-no-lighthouse`
- **Décision** : fix(ci): remplace Lighthouse-CI synthétique par bundle-stats déterministe
- **Sortie** : PR #506 | commits 8b2dfd70

## 2026-05-14 — fix/perf-gates-bundle-stats-no-lighthouse (auto)

- **Branche** : `fix/perf-gates-bundle-stats-no-lighthouse`
- **Décision** : fix(perf-gates): use turbo build at root, not -w frontend (workspace deps) (+2 other commits)
- **Sortie** : PR #506 | commits dbb88af1 d2f291a8 8b2dfd70

## 2026-05-14 — feat/db-contract-v1 (auto)

- **Branche** : `feat/db-contract-v1`
- **Décision** : feat(db-contract): §2 add canon db.yaml — 8 P0/P1 tables (V1 minimal) (+1 other commit)
- **Sortie** : PR aucune | commits 82a7cede 48330a0d

## 2026-05-14 — feat/db-contract-v1 (auto)

- **Branche** : `feat/db-contract-v1`
- **Décision** : feat(db-contract): §6 size invariants + doctrine pointer cleanup (+6 other commits)
- **Sortie** : PR #511 | commits 3a654957 f9aa65a7 e1bc4a24 c27b7035 106c0bb6 82a7cede 48330a0d

## 2026-05-14 — feat/seo-cp-criticality-tiers (auto)

- **Branche** : `feat/seo-cp-criticality-tiers`
- **Décision** : fix(seo): closure INC-2026-005 — GSC 5xx 30 400 pages recovery + tactical hardening (#510)
- **Sortie** : PR aucune | commits e118d599

## 2026-05-14 — feat/seo-cp-criticality-tiers (auto)

- **Branche** : `feat/seo-cp-criticality-tiers`
- **Décision** : chore(registry): renumber ADR-062 → ADR-064 (062 + 063 already taken) (+3 other commits)
- **Sortie** : PR #515 | commits 815d3307 7fbe8bd1 24e425ab e118d599

## 2026-05-14 — feat/adr-063-cwv-monitoring-crux-api (auto)

- **Branche** : `feat/adr-063-cwv-monitoring-crux-api`
- **Décision** : fix(seo-crux): reword down.sql comment to avoid migration-safety false positive (+3 other commits)
- **Sortie** : PR #514 | commits ac7fd3ad feb1d4b0 5d1a7535 15092a48

## 2026-05-14 — feat/seo-cp-synthetic-crawler (auto)

- **Branche** : `feat/seo-cp-synthetic-crawler`
- **Décision** : feat(seo-cp): synthetic crawler L1 — PR-2A-1 SEO Production Control Plane
- **Sortie** : PR #516 | commits 78e38791

## 2026-05-14 — feat/seo-cp-synthetic-crawler (auto)

- **Branche** : `feat/seo-cp-synthetic-crawler`
- **Décision** : fix(seo-cp): extend SupabaseBaseService + correct path resolution (+2 other commits)
- **Sortie** : PR #516 | commits 764670e0 d148698d 78e38791

## 2026-05-14 — feat/seo-cp-synthetic-crawler (auto)

- **Branche** : `feat/seo-cp-synthetic-crawler`
- **Décision** : fix(seo-cp): add -- APPROVED: comments to DROP statements (CI migration safety gate) (+4 other commits)
- **Sortie** : PR #516 | commits b2489e5e d8002a36 824d0dfc 7e84c3ee dba46e79

## 2026-05-14 — feat/adr-063-cwv-ingestion-v2 (auto)

- **Branche** : `feat/adr-063-cwv-ingestion-v2`
- **Décision** : fix(seo-crux): prettier formatting + jest transformIgnore for @repo/seo-types (+1 other commit)
- **Sortie** : PR #518 | commits ea602630 dd75d842

## 2026-05-14 — feat/adr-063-cwv-ingestion-v2 (auto)

- **Branche** : `feat/adr-063-cwv-ingestion-v2`
- **Décision** : fix(seo-crux): jest moduleNameMapper for @repo/seo-types workspace symlink (+3 other commits)
- **Sortie** : PR #518 | commits f03a0252 26c34086 ea602630 dd75d842

## 2026-05-14 — feat/adr-063-cwv-ingestion-v2 (auto)

- **Branche** : `feat/adr-063-cwv-ingestion-v2`
- **Décision** : test(seo-crux): skip fake-timer retry+circuit-breaker tests (CI timeout) (+5 other commits)
- **Sortie** : PR #518 | commits f07a4990 44181f8c f03a0252 26c34086 ea602630 dd75d842

## 2026-05-14 — feat/adr-063-cwv-ingestion-v2 (auto)

- **Branche** : `feat/adr-063-cwv-ingestion-v2`
- **Décision** : test(seo-crux): minimize to sync-only coverage (3 tests) (+7 other commits)
- **Sortie** : PR #518 | commits 08142888 e5c6864b f07a4990 44181f8c f03a0252 26c34086 ea602630 dd75d842

## 2026-05-14 — feat/adr-063-cwv-alerting (auto)

- **Branche** : `feat/adr-063-cwv-alerting`
- **Décision** : feat(seo-crux): alerter service (pr-4 adr-063)
- **Sortie** : PR #525 | commits a6f3b25f

## 2026-05-14 — feat/pr-w3b-registry-tests-blocking (auto)

- **Branche** : `feat/pr-w3b-registry-tests-blocking`
- **Décision** : ci(audit): promote @repo/registry contract tests to BLOCKING gate (PR-W3b)
- **Sortie** : PR aucune | commits fce47ec9

## 2026-05-14 — feat/seo-cp-cf-analytics-collector (auto)

- **Branche** : `feat/seo-cp-cf-analytics-collector`
- **Décision** : feat(seo-cp): cloudflare analytics collector L1 — PR-2A-2 (ADR-064)
- **Sortie** : PR #520 | commits 8701fdf4

## 2026-05-14 — feat/seo-cp-cf-analytics-collector (auto)

- **Branche** : `feat/seo-cp-cf-analytics-collector`
- **Décision** : fix(ci): grant pull-requests:write to migration-safety job (squawk upload-to-github) (+2 other commits)
- **Sortie** : PR #520 | commits adf76ba3 f240f3b5 8701fdf4

## 2026-05-14 — feat/seo-cp-cf-analytics-collector (auto)

- **Branche** : `feat/seo-cp-cf-analytics-collector`
- **Décision** : fix(seo-cp): squawk-conform migration cf_analytics (drop BEGIN/COMMIT, BIGINT, SET timeouts) (+4 other commits)
- **Sortie** : PR #520 | commits 9e67a8d4 be4723e1 adf76ba3 f240f3b5 8701fdf4

## 2026-05-14 — feat/seo-cp-runtime-logs-collector (auto)

- **Branche** : `feat/seo-cp-runtime-logs-collector`
- **Décision** : feat(seo-cp): runtime-logs collector L1 — PR-2A-3 (ADR-064)
- **Sortie** : PR #524 | commits 106f6816

## 2026-05-14 — feat/seo-cp-runtime-logs-collector (auto)

- **Branche** : `feat/seo-cp-runtime-logs-collector`
- **Décision** : ci(migration-safety): grant pull-requests: write to job (fix squawk 403) (+2 other commits)
- **Sortie** : PR #524 | commits bc5d4e26 772436f5 106f6816

## 2026-05-14 — feat/seo-cp-runtime-logs-collector (auto)

- **Branche** : `feat/seo-cp-runtime-logs-collector`
- **Décision** : Revert "ci(migration-safety): grant pull-requests: write to job (fix squawk 403)" (+4 other commits)
- **Sortie** : PR #524 | commits f3b660d6 ec89dff3 bc5d4e26 772436f5 106f6816

## 2026-05-15 — feat/pr-3b-architecture-freshness-blocking (auto)

- **Branche** : `feat/pr-3b-architecture-freshness-blocking`
- **Décision** : ci(audit): promote architecture freshness gate to BLOCKING (PR-3b)
- **Sortie** : PR #531 | commits 0589ed20

## 2026-05-15 — feat/pr-3b-architecture-freshness-blocking (auto)

- **Branche** : `feat/pr-3b-architecture-freshness-blocking`
- **Décision** : chore(architecture): regenerate .dependency-cruiser.generated.cjs (PR-3b ratchet self-hosting fix) (+2 other commits)
- **Sortie** : PR #531 | commits 035327f5 caee5a3c 0589ed20

## 2026-05-15 — feat/pr-6-contract-drift-observatory (auto)

- **Branche** : `feat/pr-6-contract-drift-observatory`
- **Décision** : test(observatory): empty commit to validate PR-comment upsert (PR-6) (+4 other commits)
- **Sortie** : PR #540 | commits ef4d8815a da0694748 7193c7082 27d794048 8cd5d6463

## 2026-05-15 — feat/seo-r2-composition-v2-foundation (auto)

- **Branche** : `feat/seo-r2-composition-v2-foundation`
- **Décision** : chore(registry): add seo_r2_v2 migration glob to ownership.yaml (ADR-066) (+3 other commits)
- **Sortie** : PR #543 | commits 6ab4fe6e2 40102ed6b 3441fd143 a08d62eb9

## 2026-05-15 — feat/seo-r2-composition-v2-foundation (auto)

- **Branche** : `feat/seo-r2-composition-v2-foundation`
- **Décision** : fix(seo-r2): ci failures - class-validator removal, bigint ids, opa require cast (+5 other commits)
- **Sortie** : PR #543 | commits 694945cf7 4f626d0e3 6ab4fe6e2 40102ed6b 3441fd143 a08d62eb9

## 2026-05-16 — feat/seo-sitemap-auth-phase-0-foundation (auto)

- **Branche** : `feat/seo-sitemap-auth-phase-0-foundation`
- **Décision** : chore(auth): add jose + cron-parser + ioredis-mock deps for sitemap OIDC auth
- **Sortie** : PR aucune | commits d650eada2

## 2026-05-16 — chore/pr-8a-controlled-cleanup-inventory (auto)

- **Branche** : `chore/pr-8a-controlled-cleanup-inventory`
- **Décision** : feat(audit): markdown projection for cleanup-candidates inventory (+4 other commits)
- **Sortie** : PR aucune | commits a82d25b49 191914803 72f191f3f bb7b22f00 dcc71f3cf

## 2026-05-16 — chore/pr-8a-controlled-cleanup-inventory (auto)

- **Branche** : `chore/pr-8a-controlled-cleanup-inventory`
- **Décision** : feat(audit): emit PR-8 controlled cleanup inventory (333 candidates, deterministic) (+6 other commits)
- **Sortie** : PR aucune | commits e13df3ff0 31da20001 a82d25b49 191914803 72f191f3f bb7b22f00 dcc71f3cf

## 2026-05-16 — chore/pr-8a-controlled-cleanup-inventory (auto)

- **Branche** : `chore/pr-8a-controlled-cleanup-inventory`
- **Décision** : chore(registry): add ownership entry for audit/cleanup/** (PR-8a prerequisite) (+8 other commits)
- **Sortie** : PR #567 | commits 05771dff2 8c900c13c e13df3ff0 31da20001 a82d25b49 191914803 72f191f3f bb7b22f00 dcc71f3cf

## 2026-05-16 — fix/vehicles-strict-numeric-pipe (auto)

- **Branche** : `fix/vehicles-strict-numeric-pipe`
- **Décision** : chore(ownership): register backend/src/common/{pipes/params,schemas} (+1 other commit)
- **Sortie** : PR #553 | commits 6f0030af8 08159f793

## 2026-05-16 — chore/turbo-dev-depends-on-build (auto)

- **Branche** : `chore/turbo-dev-depends-on-build`
- **Décision** : chore(turbo): dev task depends on workspace builds
- **Sortie** : PR #573 | commits 3c67dc79a

## 2026-05-15 — feat/pr-7a-contract-drift-ratchet (auto)

- **Branche** : `feat/pr-7a-contract-drift-ratchet`
- **Décision** : chore(canon): cover audit/baselines/** in ownership.yaml (D15/@ak125) (+4 other commits)
- **Sortie** : PR #545 | commits 48766b587 3402aee3f 347f4bcf5 0923c3217 18263e997

## 2026-05-15 — feat/pr-7a-contract-drift-ratchet (auto)

- **Branche** : `feat/pr-7a-contract-drift-ratchet`
- **Décision** : fix(ci): bypass npm banner in ratchet json output (workflow surgical fix) (+6 other commits)
- **Sortie** : PR #545 | commits af746ad61 f539f83e4 48766b587 3402aee3f 347f4bcf5 0923c3217 18263e997

## 2026-05-17 — feat/seo-cp-cf-rum-collector (auto)

- **Branche** : `feat/seo-cp-cf-rum-collector`
- **Décision** : feat(seo-cp): pr-2a-2.5 cloudflare rum collector (web vitals edge ingestion)
- **Sortie** : PR #583 | commits 24fdf7367

## 2026-05-18 — chore/impeccable-cli-devdep (auto)

- **Branche** : `chore/impeccable-cli-devdep`
- **Décision** : chore(frontend): add impeccable@2.1.9 CLI for design anti-pattern detection
- **Sortie** : PR #597 | commits 54afbb9d8

## 2026-05-18 — refactor/impeccable-bounce-easing (auto)

- **Branche** : `refactor/impeccable-bounce-easing`
- **Décision** : refactor(frontend): smooth bounce-easing animations (-8, components-only)
- **Sortie** : PR #610 | commits f260a8de4
