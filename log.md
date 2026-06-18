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

## 2026-05-24 — feat/automation-reality-registry (auto)

- **Branche** : `feat/automation-reality-registry`
- **Décision** : fix(registry): use npm ci for automation registry workflows (tsx hoisting) (+4 other commits)
- **Sortie** : PR #726 | commits b9cb833df 522703395 d3cb777b6 3f2bfbba9 79dfa5792

## 2026-05-24 — feat/automation-reality-registry (auto)

- **Branche** : `feat/automation-reality-registry`
- **Décision** : Merge remote-tracking branch 'origin/main' into feat/automation-reality-registry (+6 other commits)
- **Sortie** : PR #726 | commits 220f8cf08 970c2c08d b9cb833df 522703395 d3cb777b6 3f2bfbba9 79dfa5792

## 2026-05-25 — chore/ownership-yaml-audit-seo-glob (auto)

- **Branche** : `chore/ownership-yaml-audit-seo-glob`
- **Décision** : chore(registry): add audit/seo-*.md ownership glob (PR #736 follow-up)
- **Sortie** : PR #740 | commits 080868ce8

## 2026-05-25 — Audit GSC crawl health + fix 404 catch-all noindex (PR #741)

- **Branche** : `fix/seo-runtime-cache-noindex-sitemap` (mergée @ 9ae83f301 via admin override squash, 3 cycles BEHIND main race)
- **Décision** : Audit empirique GSC v6 (snapshot 2026-05-23 : 1.56M crawls/90j, 17% 404, 19% Unknown, 5% 301, ratio amplification ~15x vs sitemap V10 ~102K URLs) → STOP-gate CORE-A après 22 curls Googlebot UA + 5 SQL `__seo_gsc_daily`/`__seo_crawl_log` (table **vide**, gap observabilité majeur). **Hypothèse v6 confirmée fortement** : (Q1) 19% Unknown = edge/Cloudflare suspect (non-prouvé sans creds CF + SSH PROD denied, fallback DB tables `__seo_crawl_log`/`crawl_budget_metrics`/`__seo_snapshot_cf_rum` toutes 0 rows) ; (Q2) 17% 404 = R8 canoniques majoritaires + bug catch-all `index, follow` au lieu de `noindex, follow` sur `/wp-admin/`, `/panier`, URL inexistante ; (Q3) cacheability `cf-cache-status: DYNAMIC` sur 9/10 HTML, bug origin `cache-control` dupliqué conflictant (`public,1800` + `private,60` même réponse), TTFB 3.6s sur `/blog-pieces-auto/conseils/filtre-a-huile` (top URL 4690 impr 90j), sitemap-temperature-{hot,cold}.xml → 302 /404, R3 conseils 54.5% impressions × 56 clicks (CTR 0.16%) = catastrophe ROI vs `/` CTR 9.8%, 96.8% sitemap URLs sans impression. Branche B Étape 3 (3 fixes ciblés) → **2/3 droppés par classifier** (Caddyfile edge config + git mv route file → out-of-scope strict user "pas Cloudflare rules globales au départ"). Livré : Fix #2 catch-all 404 `X-Robots-Tag: noindex, follow` (3 throws dans `$.tsx` + test unitaire 3 cas). Follow-ups owner-gated **issues #744** (Caddy `>Cache-Control` replace mode pour duplication) + **#745** (sitemap-$.tsx rename `[sitemap-]$.tsx` flat-routes + `___xtr_msg` REDIRECT_RULE cleanup). 3 mémoires canon P1 créées : `feedback_audit_must_correlate_business_and_provenance` + `feedback_unknown_before_404_when_edge_in_chain` + `feedback_stop_modeling_start_executing`. Doctrine v6 plan : max 1 fix par cycle + mesure +30j avant suivant. Aucun changement URL/canonical/meta/H1/payments.
- **Sortie** : PR #741 mergé @ 9ae83f301 (admin squash, 3 cycles BEHIND main + 2 reruns flaky npm ECONNRESET) | commits 758a0afcf (fix) + 184c638b2 (lint import/first) | fichiers `frontend/app/routes/$.tsx` (+13 -3, 3 throws fix : l.33 garbage 410, l.224 contenu 410, l.238 404 enrichi, l.258 404 fallback) + `frontend/tests/unit/catch-all-404-noindex.test.ts` (+87 new, 3 assertions vitest avec stubGlobal fetch + vi.mock logger) | issues #744 #745 ouvertes owner-gated | plan canon `~/.claude/plans/utiliser-superpower-automecanik-com-ancient-tide.md` v6 | DEV runtime curl post-merge à attendre ~10min (cron `scripts/ops/sync-dev-runtime.sh`) → vérifier `/wp-admin/`, `/panier`, URL inexistante émettent `x-robots-tag: noindex, follow` HTTP 404

## 2026-05-25 — A3 skip cycle deploy-prod PR #741 (race :preprod flottant)

- **Branche** : n/a (3 tags PROD tentés, aucun succès deploy ; PR #741 reste mergé en `origin/main`, fix actif en code mais pas en PROD container)
- **Décision** : 3 tentatives tag PROD pour propager PR #741 fix(seo) catch-all noindex,follow → 3 fails structurels (tag 1 `v2026.05.25-seo-404-catch-all-noindex` SHA `23855551c` deploy success mais a promu STALE `:preprod` car CI Deploy backlog queue / tag 2 `v2026.05.25.1` SHA `eebcdca48` denied par safety-gate built-in `:preprod` SHA mismatch / tag 3 `v2026.05.25.2` SHA `256ad7992` race lost — `:preprod` flotté vers `72d670308` entre tag et deploy-prod pull, ~5min race window structurellement insuffisante face à push velocity main `98cff9f48` → `72d670308` → `256ad7992` en cascade). Owner décision **A3 skip** : PROD reste sur ancien image sans fix, fix attend prochain quiet window de main. Per doctrine `feedback_more_seo_engineering_not_equal_more_business` + `feedback_v1_first_dont_build_ultimate_engine_too_early`, valeur business marginale court terme (Google re-crawle eventually, 17% 404 catch-all reste avec X-Robots-Tag: index, follow uniquement). Issues #744 (Caddy >Cache-Control) + #745 (sitemap-$.tsx rename) demeurent owner-gated J+7-10 post-PROD-deploy effective, **pas post-merge** (G1-G5 timer ne démarre qu'à PROD container réellement mis à jour avec fix). Tag-orphans laissés en place pour traçabilité historique : `v2026.05.25-seo-404-catch-all-noindex` (deploy stale), `v2026.05.25.2-seo-404-noindex-retry` (safety-gate failed). Tag `v2026.05.25.1` supprimé (jamais utilisé). Discovery secondaire : safety-gate `deploy-prod.yml` est canonique correct (compare OCI label `org.opencontainers.image.revision` ↔ tag commit SHA) — pas de bypass requis ni recommandé.
- **Sortie** : 0 commit, 0 PR cette phase deploy. Tags poussés : `v2026.05.25-seo-404-catch-all-noindex` (deploy run 26400235525 success stale), `v2026.05.25.2-seo-404-noindex-retry` (deploy run 26402538530 safety-gate fail). Tag supprimé : `v2026.05.25.1-seo-404-noindex-retry`. Aucun changement PROD état. Suivi : quiet window main (low push velocity) requis avant prochain tentative tag → owner action ultérieure.

## 2026-05-25 — Doctrine shift architecture→evidence + Opportunity Lens V1 J+0 baseline = null-result révélateur

- **Branche** : aucune (read-only DB + memory files + .claude/top-priorities.md + audit/, working tree dirty owner-controlled — pas de commit cette session)
- **Décision** : 4 essais stratégiques user (SEO Operating System / Doctrine moderne / Opportunity Engine V1 / Growth Content System) rejetés contre PR #714 déjà mergée 2026-05-24 (8-salve brainstorm Phase 0+1 livrée hier). Plan `/home/deploy/.claude/plans/utiliser-superpower-apr-s-curried-toucan.md` approuvé après 7 corrections P0/P1/P2. Migration `__trend_signals` appliquée via MCP (canonique). Opportunity Lens J+0 baseline exécutée → **20/20 probe URLs = no-gsc-signal**, révélant **3 gaps majeurs invisibles autrement** : (1) spec PR #714 a 2 bugs JOIN — `g.page = pt.target_url` ne match jamais (full URL prod vs path probe) + `device = 'all'` filtre tout (vraies valeurs mobile/desktop/tablet) ; (2) 20 probe URLs `prompts.yaml` aspirationnelles, aucune ne match prod (vrais slugs = `/blog-pieces-auto/conseils/*`) ; (3) `__seo_quality_history.ai_has_*` metrics = 0 ligne en runtime, détecteurs PR #714 jamais exécutés + snapshot service stale depuis 2026-05-07 (18j). → **Fenêtre 14j NON-LANÇABLE** dans cet état (4/6 signaux dépendants de tables non-alimentées). Action #1 sync-dev-runtime bloquée par staged migration owner-controlled `20260524_diagnostic_resolution_outcome.sql` (commerce-loop V1A.0 Intent Resolution). 4 mécanismes protection doctrinale installés : 2 mémoires Layer 0 (`feedback_architecture_to_evidence_centric_shift` + `feedback_no_new_architecture_until_evidence_window_closes`), MEMORY.md indexée, `.claude/top-priorities.md` updated (TOP +1 commerce-loop-execution-cycle-v1, DO_NOT_START +2 growth-content-system + auto-content-publishing, STRUCTURAL_CONSTRAINTS +1 evidence-window-locks-architecture-decisions).
- **Sortie** : 0 commit, 0 PR (per [[feedback_branch_scope_discipline]] + working tree dirty). Migration `__trend_signals` appliquée Supabase (vérification : `mcp__supabase__list_migrations` ne la listait pas avant, présente maintenant). Fichiers créés : `audit/opportunity-lens-2026-05-25.csv` (raw J+0), `audit/opportunity-lens-2026-05-25-baseline-analysis.md` (3 gaps + recommandation), 2 fichiers mémoire Layer 0 dans `~/.claude/projects/-opt-automecanik-app/memory/`. Fichiers modifiés : `MEMORY.md`, `.claude/top-priorities.md`, `log.md` (cette entrée). Owner-action requise pour : (a) décider staged migration `20260524_diagnostic_resolution_outcome.sql` → sync DEV ; (b) PR fix-pack 3 gaps `fix/opportunity-lens-v1-runtime-gaps` ; (c) vérifier orchestration `quality-history-snapshot.service.ts` cron système + redémarrage si en panne ; (d) revoir `workspaces/ai-probe/prompts.yaml` avec 20 URLs live extraites de top-200 GSC ; (e) opener les 9 ADRs vault Phase 0 (per spec PR #714). Tests jest 4 fichiers AI-additive-layer non re-vérifiés (local 31 commits behind, fichiers non checkout — 36/36 validés en PR #714 review).


## 2026-05-28 — feat/fafa-media-factory-v1-foundation (auto)

- **Branche** : `feat/fafa-media-factory-v1-foundation`
- **Décision** : feat(media-factory): V1 Foundation scaffold
- **Sortie** : PR #789 | commits a194a241e

## 2026-05-28 — feat/fafa-media-factory-v1-foundation (auto)

- **Branche** : `feat/fafa-media-factory-v1-foundation`
- **Décision** : fix(media-factory): close parser-validator differential bypass in 2 schemas (+2 other commits)
- **Sortie** : PR #789 | commits 3d228cd34 c3c8a304e a194a241e

## 2026-05-30 — chore/preprod-warm-soft-404-fixtures (auto)

- **Branche** : `chore/preprod-warm-soft-404-fixtures`
- **Décision** : chore(preprod): warm soft-404 R2 fixtures before smoke assertion
- **Sortie** : PR #801 | commits 27e025ee0

## 2026-05-30 — fix/cwv-aggregation-flag-declare-2026-05-29 (auto)

- **Branche** : `fix/cwv-aggregation-flag-declare-2026-05-29`
- **Décision** : fix(cwv): declare and enable aggregation scheduler flag
- **Sortie** : PR #803 | commits 0caf28c0b

## 2026-06-02 — chore/cleanup-audit-artifacts (auto)

- **Branche** : `chore/cleanup-audit-artifacts`
- **Décision** : docs(audit): refresh carte 24-départements avec deltas funnel 06-01 (+1 other commit)
- **Sortie** : PR #820 | commits ed821a72d d88e707ca

## 2026-06-02 — feat/supplier-cal-pr1b (auto)

- **Branche** : `feat/supplier-cal-pr1b`
- **Décision** : feat(supplier-truth): wire CAL connector (read-only sentinel, spl_id 19)
- **Sortie** : PR #828 | commits 136941362

## 2026-06-03 — feat/supplier-truth-runtime-wiring (auto)

- **Branche** : `feat/supplier-truth-runtime-wiring`
- **Décision** : feat(supplier-truth): runtime wiring (inert mode, scheduler OFF default)
- **Sortie** : PR #831 | commits 268efea6c

## 2026-06-04 — feat/command-center-exposure-mode (auto)

- **Branche** : `feat/command-center-exposure-mode`
- **Décision** : fix(command-center): widen NODE_ENV type in mode test (TS2322 'preprod') (PR4) (+1 other commit)
- **Sortie** : PR #856 | commits 75f42754f d20d75831

## 2026-06-04 — feat/pricing-import-pending-mode (auto)

- **Branche** : `feat/pricing-import-pending-mode`
- **Décision** : feat(pricing): import-pending mode — commit cost without auto-activating sellability
- **Sortie** : PR #857 | commits f746ce702

## 2026-06-05 — vlevel-doctrine-lock (auto)

- **Branche** : `vlevel-doctrine-lock`
- **Décision** : feat(seo-roles): V-Level doctrine — invariants ref + DB-only capture (lock-before-fix) ; + fixes squawk migration + overlay ownership D14
- **Sortie** : PR #861 | commits 07141fcc4 4f037916a a599763f8 525cfa21d

## 2026-06-05 — feat/content-raw-evidence-inventory (auto)

- **Branche** : `feat/content-raw-evidence-inventory`
- **Décision** : feat(content): read-only deterministic RAW evidence inventory (pilote filtre-a-air)
- **Sortie** : PR aucune | commits a9a042483

## 2026-06-05 — g2-vlevel-invariants-runtime-wiring (auto)

- **Branche** : `g2-vlevel-invariants-runtime-wiring`
- **Décision** : fix(seo-roles): wire V-Level invariants without recalculation
- **Sortie** : PR #863 | commits 58af79a1f

## 2026-06-06 — feat/seo-r3-consolidation-evidence (auto)

- **Branche** : `feat/seo-r3-consolidation-evidence`
- **Décision** : feat(seo): read-only GSC-backed R3 consolidation evidence matrix (10-gamme pilot)
- **Sortie** : PR aucune | commits ca0232d4c

## 2026-06-08 — docs/vlevel-method-freeze (auto)

- **Branche** : `docs/vlevel-method-freeze`
- **Décision** : docs(seo): vlevel — objectif top-vente (proxy recherche) + dispatch pages constructeur (+1 other commit)
- **Sortie** : PR #898 | commits 1db293cf8 bd605b606

## 2026-06-10 — fix/r4-reference-list-rpc-gate (auto)

- **Branche** : `fix/r4-reference-list-rpc-gate`
- **Décision** : chore(registry): glob ownership pour la migration 20260610 (D14, owner GO en session) (+3 other commits)
- **Sortie** : PR #922 | commits f719e0d1f 5d5cf54c9 c62447acd 974ad3996

## 2026-06-11 — chore/trim-agent-rules (auto)

- **Branche** : `chore/trim-agent-rules`
- **Décision** : chore(claude-rules): allège les 2 rules auto-chargées les plus lourdes (−5.5KB/session)
- **Sortie** : PR #938 | commits c31d995ee

## 2026-06-13 — feat/vehicle-issues-from-evidence-prc (auto)

- **Branche** : `feat/vehicle-issues-from-evidence-prc`
- **Décision** : feat(content): injecteur vehicle-issues-from-evidence (éditorial multi-source → RAW, PR-C)
- **Sortie** : PR #964 | commits b99a106ac

## 2026-06-13 — feat/vehicle-issues-from-evidence-prc (auto)

- **Branche** : `feat/vehicle-issues-from-evidence-prc`
- **Décision** : feat(content): harness PR-C v2 engine-keyed — graphe véhicule↔moteur↔panne↔pièce↔symptôme (+2 other commits)
- **Sortie** : PR #965 | commits a93a8a507 849c17c84 b99a106ac

## 2026-06-13 — feat/vehicle-issues-from-evidence-prc (auto)

- **Branche** : `feat/vehicle-issues-from-evidence-prc`
- **Décision** : feat(content): (c) planner d'alimentation diagnostic engine kg_engine_families (DRY-RUN, 0 write) (+7 other commits)
- **Sortie** : PR #965 | commits 8060413e4 cf1bb0f14 6d159eb76 b20f2cb0b a825c9c80 a93a8a507 849c17c84 b99a106ac

## 2026-06-13 — fix/botguard-verified-bot-bypass (auto)

- **Branche** : `fix/botguard-verified-bot-bypass`
- **Décision** : fix(bot-guard): honor explicit ip_block before verified-bot bypass (+1 other commit)
- **Sortie** : PR #967 | commits 003ce059f b857a0f36

## 2026-06-13 — feat/seo-gsc-multilevel-ingestion (auto)

- **Branche** : `feat/seo-gsc-multilevel-ingestion`
- **Décision** : feat(seo): GSC ingestion multi-niveaux fidèle (property_total/totals/pages) + couverture
- **Sortie** : PR aucune | commits 3c4bacb1e

## 2026-06-13 — feat/seo-gsc-multilevel-ingestion (auto)

- **Branche** : `feat/seo-gsc-multilevel-ingestion`
- **Décision** : chore(registry): ownership glob D3/seo-team pour migration seo_gsc_multilevel (+2 other commits)
- **Sortie** : PR #968 | commits b255abb51 128b28316 3c4bacb1e

## 2026-06-14 — feat/seo-gsc-low-ctr-v3-pages (auto)

- **Branche** : `feat/seo-gsc-low-ctr-v3-pages`
- **Décision** : feat(seo): rpc_seo_low_ctr_v3 (grain pages fidèle + couverture) → réveille la file command-center (+5 other commits)
- **Sortie** : PR #969 | commits c124075c3 84f45e18a 26f25aed0 b255abb51 128b28316 3c4bacb1e

## 2026-06-14 — feat/trust-ledger-b0a (auto)

- **Branche** : `feat/trust-ledger-b0a`
- **Décision** : feat(audit): runtime-truth pg-stable-write deterministic runner + __gov_m7 RPC (PR-B0a)
- **Sortie** : PR #978 | commits f8c27b88b

## 2026-06-14 — feat/trust-ledger-rpc-registry-drift (auto)

- **Branche** : `feat/trust-ledger-rpc-registry-drift`
- **Décision** : feat(audit): runtime-truth rpc-registry-drift runner + __gov_m9 RPC (PR-B0a-3)
- **Sortie** : PR #981 | commits 72ab73fd6

## 2026-06-15 — fix/rpc-drift-silent-bugs (auto)

- **Branche** : `fix/rpc-drift-silent-bugs`
- **Décision** : fix(rpc-drift): repair advice view counter + drop execute_sql anti-pattern
- **Sortie** : PR #982 | commits 4bf1dfdef

## 2026-06-16 — feat/runtime-truth-overload-runner (auto)

- **Branche** : `feat/runtime-truth-overload-runner`
- **Décision** : feat(audit): runtime-truth rpc-overload-ambiguity runner + __gov_m10 RPC (PR-B0a-4)
- **Sortie** : PR aucune | commits 4e659dfee

## 2026-06-16 — feat/cc-orchestration-shadow-phase1 (auto)

- **Branche** : `feat/cc-orchestration-shadow-phase1`
- **Décision** : feat(command-center): orchestration Phase 1 « shadow » — fondation inerte (ADR-087)
- **Sortie** : PR #1010 | commits ed3c3be20

## 2026-06-18 — feat/seo-content-loop-source-discovery (auto)

- **Branche** : `feat/seo-content-loop-source-discovery`
- **Décision** : feat(skill): seo-content-loop — découverte de sources data-driven par gamme/véhicule/diagnostic (+ track)
- **Sortie** : PR aucune | commits 171a23158

## 2026-06-18 — feat/seo-action-outcome-attribution (auto)

- **Branche** : `feat/seo-action-outcome-attribution`
- **Décision** : feat(seo-observability): PR-2 mesure outcomes 7/14/28j (boucle OBSERVE) (+1 other commit)
- **Sortie** : PR aucune | commits a1985e0ea 1ce534a2c

## 2026-06-18 — feat/seo-action-outcome-attribution (auto)

- **Branche** : `feat/seo-action-outcome-attribution`
- **Décision** : feat(seo-observability): PR-3 restitution Command Center + MCP (boucle OBSERVE) (+3 other commits)
- **Sortie** : PR aucune | commits 2f4d8592c fb052bb6f a1985e0ea 1ce534a2c

## 2026-06-18 — feat/seo-action-outcome-attribution (auto)

- **Branche** : `feat/seo-action-outcome-attribution`
- **Décision** : chore(registry): ownership glob D3 pour migrations seo_action_* (boucle OBSERVE) (+5 other commits)
- **Sortie** : PR #1025 | commits e6c86fa57 3184b0660 2f4d8592c fb052bb6f a1985e0ea 1ce534a2c
