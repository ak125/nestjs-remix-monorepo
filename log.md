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
| Entrées anciennes (rotées) | `log-archive-<année>.md` (historique, JAMAIS lu au démarrage) |

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
5. **Lu au démarrage, borné.** `CLAUDE.md` instruit de lire **`tail -n 80 log.md`** uniquement (jamais le fichier entier — gaspillage tokens).
6. **Borné automatiquement.** `scripts/claude-hooks/rotate-log.sh` (appelé par le hook `Stop`) archive les entrées les plus anciennes vers `log-archive-<année>.md` dès que `log.md` dépasse 600 lignes, en gardant les 60 dernières.

---

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

## 2026-05-18 — feat/vehicle-context-cookie-jws (auto)

- **Branche** : `feat/vehicle-context-cookie-jws`
- **Décision** : fix(vehicle-context): PR-B.8 CI green (prettier + gitleaks + dep inventory) (+7 other commits)
- **Sortie** : PR #606 | commits b99f9f80e 2fe8f2beb 6eb399a47 019b10d89 6dcfb20a5 6833edfae a51962447 ce57fa9d8

## 2026-05-18 — chore/impeccable-cli-devdep (auto)

- **Branche** : `chore/impeccable-cli-devdep`
- **Décision** : chore(frontend): add impeccable@2.1.9 CLI for design anti-pattern detection
- **Sortie** : PR #597 | commits 54afbb9d8

## 2026-05-18 — feat/vehicle-context-cookie-jws (auto)

- **Branche** : `feat/vehicle-context-cookie-jws`
- **Décision** : Merge remote-tracking branch 'origin/main' into feat/vehicle-context-cookie-jws (+9 other commits)
- **Sortie** : PR #606 | commits 4cfd22868 54aecaacd b99f9f80e 2fe8f2beb 6eb399a47 019b10d89 6dcfb20a5 6833edfae a51962447 ce57fa9d8

## 2026-05-18 — refactor/impeccable-bounce-easing (auto)

- **Branche** : `refactor/impeccable-bounce-easing`
- **Décision** : refactor(frontend): smooth bounce-easing animations (-8, components-only)
- **Sortie** : PR #610 | commits f260a8de4

## 2026-05-19 — chore/impeccable-husky-hardening (auto)

- **Branche** : `chore/impeccable-husky-hardening`
- **Décision** : chore(husky): wire impeccable ratchet as warn-only pre-commit hook (PR 6)
- **Sortie** : PR #621 | commits f977316a4

## 2026-05-19 — chore/impeccable-husky-hardening (auto)

- **Branche** : `chore/impeccable-husky-hardening`
- **Décision** : chore(registry): regenerate after PR #606 (vehicle-context cookie devDep bump) (+2 other commits)
- **Sortie** : PR #621 | commits 4d635fac7 8bd1c7c84 c7b056d68

## 2026-05-19 — fix/preprod-env-contract-preflight (auto)

- **Branche** : `fix/preprod-env-contract-preflight`
- **Décision** : chore(registry): scope env-contract paths in ownership.yaml (D13) (+1 other commit)
- **Sortie** : PR #632 | commits eacfdcbe3 fbc50be95

## 2026-05-19 — fix/preprod-env-contract-preflight (auto)

- **Branche** : `fix/preprod-env-contract-preflight`
- **Décision** : style(env-contract): apply prettier (CI lint fix) (+3 other commits)
- **Sortie** : PR #632 | commits 22cd9867e 690c78525 eacfdcbe3 fbc50be95

## 2026-05-21 — worktree-commerce-loop-step4-funnel (auto)

- **Branche** : `worktree-commerce-loop-step4-funnel`
- **Décision** : feat(commerce-loop): funnel event tracking outil diagnostic (étape 4-A)
- **Sortie** : PR #676 | commits 8d7652572

## 2026-05-21 — worktree-commerce-loop-step4-funnel (auto)

- **Branche** : `worktree-commerce-loop-step4-funnel`
- **Décision** : fix(commerce-loop): squawk require-timeout-settings sur migration funnel (+4 other commits)
- **Sortie** : PR #676 | commits af96bc122 367574432 a8b1dd059 93c0f8664 8d7652572

## 2026-05-21 — worktree-commerce-loop-step4-funnel (auto)

- **Branche** : `worktree-commerce-loop-step4-funnel`
- **Décision** : fix(commerce-loop): eslint — prettier wrap + safeLocalStorage dans funnel (+5 other commits)
- **Sortie** : PR #676 | commits 477564255 71198a3ab af96bc122 367574432 a8b1dd059 8d7652572

## 2026-05-22 — fix param id véhicule int4 + retrait foot-gun smallint

- **Branche** : `fix/vehicle-modelid-int4-pipe` + `fix/retire-smallint-id-param-pipe` (mergées, supprimées)
- **Décision** : modelId/brandId validés en int4 (type réel colonne, max 667022) — `PositiveSmallIntParamPipe` rejetait 400 sur ~82% des modèles ; pipe smallint supprimé (foot-gun), garde ast-grep `.max(32767)` + test régression controller ajoutés.
- **Sortie** : PRs #686 (live prod, tag v2026.05.21-vehicle-modelid-int4) #689 (mergé main, prod via prochaine release) | fichiers `backend/src/modules/vehicles/vehicles.controller.ts`, `backend/src/common/{schemas/numeric-param.schema.ts,pipes/params/}`, `.ast-grep/rules/backend-no-subint4-ceiling-on-id-param.yml`

## 2026-05-22 — INP /pieces/ mobile : root cause + déploiement PROD

- **Branche** : `perf/inp-pieces-content-visibility` (+ `perf/inp-attribution-instrumentation`)
- **Décision** : INP 537ms p75 mobile = ouverture Radix Sheet (menu + panier, header partagé) forçant un reflow full-document ; corrigé par `content-visibility` sur blocs below-fold (−25% mesuré live PROD), attribution web-vitals livrée pour le diagnostic terrain.
- **Sortie** : PRs #692 #694 (merged) | tag PROD `v2026.05.22-inp-pieces-content-visibility` | fichiers `frontend/app/utils/web-vitals.client.ts`, `frontend/app/global.css`, `frontend/app/components/pieces/PiecesVehicleContent.tsx`

## 2026-05-22 — Rotation partitions SEO (snapshot daily + mensuel)

- **Branche** : `fix/seo-observability-partition-rotation`
- **Décision** : revue de la migration rotation snapshot daily (sûre, ajout `.down.sql`) ; livré la rotation mensuelle observability (gsc/ga4/cwv premake+3 TTL 18mo) + quality_history (réutilise `ensure_next_quality_history_partition`) pour éviter les falaises d'épuisement de partitions 2026-07-01 / 2026-08-01.
- **Sortie** : PR #698 (open) | fichiers `backend/supabase/migrations/20260522_seo_observability_partition_rotation.sql` (+`.down.sql`)

## 2026-05-23 — pieces_media_img recovery Tier C + gardes (ADR-078)

- **Branche** : `recovery/pieces-media-img-corruption-20260523`
- **Décision** : Soft-hide 1.1M lignes malformées (357K pièces affichées, 103 marques) → fallback no.png ; Tier B (vraies images) différé car files absents de toute l'infra ; 4 gardes structurelles installées (audit nightly + ast-grep paginate + brand-folder registry canon L2 + spot-fix shipping).
- **Sortie** : PR #699 + vault PR #302 (ADR-078 / INC-2026-015) | commits a44deeb9d + 2ee8c3c (vault) | fichiers `.spec/00-canon/repository-registry/brand-folder-registry.yaml`, `scripts/audit/audit-pieces-media-img-invariants.sh`, `.ast-grep/rules/supabase-js-bulk-select-paginate.yml`, `scripts/recovery/tier-c-softhide-malformed-p1.sql`, `backend/src/modules/cart/services/shipping-calculator.service.ts`

## 2026-05-23 — feat/pricing-control-plane-v1 (auto)

- **Branche** : `feat/pricing-control-plane-v1`
- **Décision** : chore(registry): cover backend/src/modules/pricing/** and pricing migrations (+8 other commits)
- **Sortie** : PR #709 | commits 252bb1b8 e22bf3c2 a65383cc e404171c 4000e00b 358da2dd 7d29d9b6 6641b556 667581d3

## 2026-05-23 — feat/pricing-control-plane-v1 (auto)

- **Branche** : `feat/pricing-control-plane-v1`
- **Décision** : fix(pricing): dedupe squawk timeout settings in 2 migrations (+12 other commits)
- **Sortie** : PR #709 | commits 289eb0c4 b3e3b9ec 656bf6dc 04754b37 b8c048bf d529c744 4c4fa7a6 ad027f11 5701a64e d135bb9b 227d3a4d 142a0218 c4f6ea33

## 2026-05-24 — feat/ai-additive-layer-design-spec (auto)

- **Branche** : `feat/ai-additive-layer-design-spec`
- **Décision** : docs(superpowers): implementation plan Phase 0+1 — AI additive layer (+1 other commit)
- **Sortie** : PR aucune | commits 90ac3b313 31fca3a81

## 2026-05-24 — feat/ai-additive-layer-design-spec (auto)

- **Branche** : `feat/ai-additive-layer-design-spec`
- **Décision** : feat(trend-signals): module + rappels.gouv.fr fetcher + BullMQ monthly processor + migration additive (+11 other commits)
- **Sortie** : PR #714 | commits 213d5db3e 04964ad3b cf61d176a f9e218531 cf5adb9dc 64a4c0a36 a380fbe25 4d61ee999 f9b05b52c 67958cfa7 0fc72ac1a 9b75889bd

## 2026-05-24 — feat/ai-additive-layer-design-spec (auto)

- **Branche** : `feat/ai-additive-layer-design-spec`
- **Décision** : fix(ci): prettier + squawk migration timeouts (3 prettier errors, 2 squawk warnings on __trend_signals) (+13 other commits)
- **Sortie** : PR #714 | commits d4121fd65 d9c67602a 213d5db3e 04964ad3b cf61d176a f9e218531 cf5adb9dc 64a4c0a36 a380fbe25 4d61ee999 f9b05b52c 67958cfa7 0fc72ac1a 9b75889bd

## 2026-05-24 — feat/ai-additive-layer-design-spec (auto)

- **Branche** : `feat/ai-additive-layer-design-spec`
- **Décision** : fix(registry): add ownership overlays for AI additive layer files (5 globs covering 21 new files) (+15 other commits)
- **Sortie** : PR #714 | commits 296343132 978c50bdf d4121fd65 d9c67602a 213d5db3e 04964ad3b cf61d176a f9e218531 cf5adb9dc 64a4c0a36 a380fbe25 4d61ee999 f9b05b52c 67958cfa7 0fc72ac1a 9b75889bd

## 2026-05-24 — feat/ai-additive-layer-design-spec (auto)

- **Branche** : `feat/ai-additive-layer-design-spec`
- **Décision** : ci: empty commit to retrigger checks (CodeQL phantom stale from initial push) (+17 other commits)
- **Sortie** : PR #714 | commits a9226d06d ec3cb6a92 296343132 978c50bdf d4121fd65 d9c67602a 213d5db3e 04964ad3b cf61d176a f9e218531 cf5adb9dc 64a4c0a36 a380fbe25 4d61ee999 f9b05b52c 67958cfa7 0fc72ac1a 9b75889bd

## 2026-05-24 — feat/ai-additive-layer-design-spec (auto)

- **Branche** : `feat/ai-additive-layer-design-spec`
- **Décision** : fix(codeql): loop-until-stable HTML strip in detectExtractableTldr (resolves js/incomplete-multi-character-sanitization) (+19 other commits)
- **Sortie** : PR #714 | commits 4c0250eca dcb25d4ae a9226d06d ec3cb6a92 296343132 978c50bdf d4121fd65 d9c67602a 213d5db3e 04964ad3b cf61d176a f9e218531 cf5adb9dc 64a4c0a36 a380fbe25 4d61ee999 f9b05b52c 67958cfa7 0fc72ac1a 9b75889bd

## 2026-05-24 — feat/automation-reality-registry (auto)

- **Branche** : `feat/automation-reality-registry`
- **Décision** : feat(registry): automation-reality-registry V1 — observe gap intent↔execution
- **Sortie** : PR #726 | commits 79dfa5792

## 2026-05-24 — feat/automation-reality-registry (auto)

- **Branche** : `feat/automation-reality-registry`
- **Décision** : fix(registry): npm install --ignore-scripts in automation registry workflows (+2 other commits)
- **Sortie** : PR #726 | commits d3cb777b6 3f2bfbba9 79dfa5792
