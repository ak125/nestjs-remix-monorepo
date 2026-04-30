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
