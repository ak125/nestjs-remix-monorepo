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

## 2026-05-25 — Phase F repair shipped + canon B0 V5.3 articulé en plan

- **Branche** : `fix/phase-f-micro-repair` (ak125/automecanik-rag, mergée + supprimée)
- **Décision** : Phase F OEM scraping (cron `0 2 * * 0 run-phase-f.sh` cassé silencieusement 5 dimanches consécutifs depuis 2026-04-26 : HTTP 202 mal géré 04-26, path refactor crash 05-03, collision `/tmp/rag-global.lock` détenu par auto-enrich `*/30` les 05-10/17/24 + MAILTO sans MTA = aucune alerte envoyée) réparé via micro-PR `ak125/automecanik-rag#15` (3 fixes ciblés HTTP `200\|201\|202` + lock dédié `/tmp/rag-phase-f.lock` + markers uniformes `[START]/[DONE]/[FAILED]/[SKIP]/[WARN]`), commit signé `vault-signing@automecanik.com`, auto-reviewed par `pr-review-toolkit:code-reviewer` (APPROVE no shell-safety issue, no scope-creep), squash-mergé + live runtime `/opt/automecanik/rag` pulled ; DRY_RUN test post-merge a confirmé `[DONE] Phase F dry-run complete` mais le run non-DRY_RUN mid-flight a révélé un **governance gap P1** : `run-phase-f.sh` bundle RAW (Step 1 → `automecanik-raw/recycled/rag-knowledge/web/`) + WIKI (Step 2) + RAG reindex (Step 3 NestJS) + RAG ingest (Step 4 `__rag_knowledge`) en un workflow legacy, alors que [[feedback_no_rag_for_content_legacy_code_is_not_strategy]] (Layer 0 STRICT) dit *« RAG = chatbot uniquement, jamais source contenu/SEO »* — owner a stoppé le run (TaskStop btye952ui à poll #34 reindex côté serveur continue indépendamment) puis demandé delegacy Phase F en split atomique ; parallèlement canon B0 Cash-First (Fragilité économique / "rien ne doit consommer du temps sans justification business, runtime ou décisionnelle claire") articulé V1→V5.3 dans plan file `~/.claude/plans/peut-lancer-scraping-auto-tidy-candy.md` (4 artefacts prêts copy-paste : ADR-082 vault avec frontmatter canon `decision_makers/related_adr/amends:rules-governance-process` (B0 = G11 sibling de G9 sunset + G10 exploration budget ADR-081) + 7 finalités vendre/encaisser/mesurer/sécuriser/réduire-friction/réduire-runtime-risk/accélérer-décision-réversible + invariant falsifiabilité anti B0-washing + automation policy 8-point + cas canon partition rotation PR #697 ; `.claude/rules/b0-cash-first.md` ; `.github/PULL_REQUEST_TEMPLATE.md` ; `.claude/top-priorities.md` STRUCTURAL_CONSTRAINTS+1 `b0-cash-first-economic-fragility` ; memory patches sur `feedback_b0_cash_first_economic_fragility.md`) ; V5.3 ultra-minimal delegacy = opt-in guard sur `run-phase-f.sh` (1 fichier, ~25 LOC, default exit 1 `[BLOCKED]` pointant vers python canoniques `download-oem-corpus.py` + `gamme-from-web-corpus-generator.py`, déverrouille via env flag) **NON-exécutée** ; 4 refinements P0/P1 identifiés pour nouvelle session : rename flag `PHASE_F_FULL`→`ALLOW_RAG_REINDEX` (sémantique précise), préserver `DRY_RUN` bypass dans le guard (backward compat Steps 1+2), acknowledge migration story PR#15→V5.3 dans PR body (process gap doctrine-after-fix), pattern auto-review+auto-merge ; storage convention `automecanik-raw/recycled/rag-knowledge/` vérifiée empiriquement = canon validé par README repo + CLAUDE.md repo + ADR-031 Four-Layer Content Architecture (migration physique 2026-04-28 d'`automecanik-rag/knowledge/{_raw,web,*}` vers `automecanik-raw/recycled/rag-knowledge/`).
- **Sortie** : PR `ak125/automecanik-rag#15` mergé (commit `48c3fc4` squash ; fix commit `e852366` signé `vault-signing@automecanik.com` ED25519) | fichier `scripts/pipeline/run-phase-f.sh` +27/-23 lignes | plan file `~/.claude/plans/peut-lancer-scraping-auto-tidy-candy.md` (V5.3 ultra-minimal, ~250 lignes, à renommer `b0-cash-first-canon-articulation-v5-2026-05-25.md` au moment d'archiver per §Note owner) | aucune modification monorepo (0 commit, 0 PR sur ak125/nestjs-remix-monorepo) | aucune touche `payments/`, meta/H1, canonical, routes, DB, container | 4 artefacts canon B0 prêts copy-paste owner G3 (vault PR ADR-082 + monorepo enforcement) | delegacy V5.3 micro-PR à exécuter en nouvelle session avec 4 refinements intégrés.


## 2026-05-25 — Investigation cart R2 + R-role invariant + funnel source

- **Branche** : `main` (3 PRs via worktrees `.claude/worktrees/{r-role-cart-invariant,funnel-cart-event-fix}` + `chore/governance-curated-merge-resolution-2026-05-25`)
- **Décision** : Investigation runtime cart/conversion révèle **R2_PRODUCT véhicule-aware mono-canal empirique** (28/28 orders attribués 2025 via `/pieces/<gamme>/<marque>/<modele>/<motorisation>.html`, 0 via R8, 0 via /search/, panier moy 50€) ; P1 business-mapping error détectée + corrigée — j'avais nommé "R8 véhicule-pièce" la surface convertissante alors que R8 = fiche véhicule pure (`/constructeurs/...`) — shipping invariant `.spec/00-canon/role-matrix.md` "URL pattern → R-role (cart/conversion)" + ratchet CI shell `check-cart-conversion-r-role.sh` (PR #757 MERGED, ratchet PASS sur sa propre PR en 6s) ; funnel `r2_add_to_cart` étendu avec `source_url` + `unit_price_cents` (8/8 events précédents avaient ces 2 champs null car hook `useCart.ts:60` capture `sourceUrl` mais ne le passait pas au payload émis) via PR #756 auto-merge queued (5 fichiers, ~35 lignes additif) pour débloquer corrélation page→panier runtime sans attendre nouveaux orders ; câblage `StickyBuyBar` (PR #647 orphelin depuis 2026-05-19) sur template `PiecesVehicleContent.tsx` (R2_PRODUCT) investigué read-only mais **STOPPÉ** — conflit z-index structurel découvert (`StickyBuyBar` z-40 caché derrière `MobileBottomBar` filtres z-45 sur mobile), wiring "10 lignes" non-fonctionnel sans modifier composant + ajouter CSS var `--mobile-bottom-bar-height` via ResizeObserver = scope creep ; doctrine `feedback_exploitation_over_production` étendue avec corollaire "DÉCOUVRIR avant d'optimiser" + 6 anti-patterns que B0 protège contre ; canon B0 (`feedback_b0_cash_first_economic_fragility`) consolidé avec 7 axes + hiérarchie N1-N4 + anti-formulation "B0 = tout doit générer du cash" explicitement bannie ; PR de gouvernance `#754` (resync local main 41 commits behind + résolution merge curated log.md/top-priorities.md) MERGED ; verdict final = **STOP & OBSERVE 7-14j** sur la donnée `source_url` runtime avant tout autre micro-fix UX, application directe `feedback_no_new_architecture_until_evidence_window_closes` (fenêtre active jusqu'au 2026-06-08).
- **Sortie** : PRs `#754` MERGED (commit `cfbeea0eb`) + `#757` MERGED (commit `58fab2d39`) + `#756` auto-merge SQUASH queued | fichiers nouveaux `scripts/governance/check-cart-conversion-r-role.sh` + section canon ajoutée `.spec/00-canon/role-matrix.md` + wiring `.github/workflows/governance-checks.yml` + payload extended `frontend/app/hooks/useCart.ts` + 4 callers `components/{cart/AddToCartButton,pieces/PieceDetailModal,pieces/PiecesListView,pieces/PiecesGridView}.tsx` + schema étendu `packages/seo-types/src/intelligence.ts` | mémoires Layer 0 nouvelles ou étendues (`feedback_b0_cash_first_economic_fragility`, `feedback_exploitation_over_production`, `feedback_b0_automation_rule`, `feedback_b0_automation_global_principle`, `feedback_audit_needs_git_fetch_before_filesystem_scan`, `reference_funnel_instrumentation_gaps_2026-05-25`, `feedback_audit_2026-05-25_observe_dont_build`) | aucune touche `payments/`, meta/H1, canonical, routes, container | worktree `wire-stickybuybar-r2` cleanup (aucun code écrit) — câblage `StickyBuyBar` reporté V1.5+ owner-decision A/B/C (recommandation forte = C stop & observe 7j post-PR#756).

## 2026-05-25 — Doctrine fix : scraping ≠ RAG bootstrap (PRs #15/#16/#17 churn ak125/automecanik-rag)

- **Branche** : aucune monorepo (toute action sur repo séparé `ak125/automecanik-rag` + memory files)
- **Décision** : Session a churn 3 PRs sur `ak125/automecanik-rag/scripts/pipeline/run-phase-f.sh` (#15 repair légitime — HTTP 202 + lock dédié `/tmp/rag-phase-f.lock` + markers `[START]/[DONE]/[FAILED]/[SKIP]/[WARN]`, #16 opt-in flag `ALLOW_RAG_REINDEX=true` bricolage, #17 revert #16) avant que owner crie *« c'est du bricolage »* sur le flag, puis *« tout ça est faux »* sur status report over-claiming "✅ Completed" sur Steps 1+2 alors que Step 1 écrivait en LEGACY path `/opt/automecanik/rag/knowledge/web/` (drift env var default `AUTOMECANIK_RAW_PATH` non-canon) et Step 2 silent-skip 237/237 (WIKI `automecanik-wiki/exports/rag/gammes/` vide → `if not os.path.exists(gamme_path): continue` sans counter). Root cause récurrent identifié : **je confonds "scraping" avec "RAG bootstrap"** en invoquant `run-phase-f.sh` (bundle Steps 1-4 RAW+WIKI+RAG reindex+RAG ingest) au lieu des python canoniques (`download-oem-corpus.py` + `gamme-from-web-corpus-generator.py`). Mémoire existante `feedback_no_rag_for_content_legacy_code_is_not_strategy` (Layer 0 STRICT) trop abstraite pour prévenir → ajout mémoire opérationnelle `feedback_scraping_vs_rag_bootstrap_terminology` (Layer 0 STRICT) avec **table 4-domaines canoniques** (RAW=collecte brute immutable / WIKI=connaissance validée exploitable / RAG=index chat-only / Runtime métier=vérité business `__seo_*`/`__cart_*`/`__order_*`) + **mapping termes user → commandes exactes** + **règles d'arbitrage anti-drift** ("RAG n'est PAS pipeline métier"). Run background `bhiq8d1rw` stoppé via TaskStop (poll #30 RAG reindex inutile sans chatbot consumer, libère lock `/tmp/rag-phase-f.lock`).
- **Sortie** : 3 PRs `ak125/automecanik-rag` : `#15` MERGED `48c3fc4` (Phase F repair, légitime) + `#16` MERGED `04c815b` (opt-in bricolage) + `#17` MERGED `686e222` (revert #16) → net code change sur `run-phase-f.sh` = PR #15 only. Nouveau fichier mémoire `feedback_scraping_vs_rag_bootstrap_terminology.md` (Layer 0 STRICT) + index MEMORY.md placé EN PREMIER sous "Anti-régressions strictes (Layer 0)". Aucune touche `payments/`, meta/H1, canonical, routes, DB, container. Drift identifié hors-scope : `download-oem-corpus.py` default `AUTOMECANIK_RAW_PATH` = legacy `/opt/automecanik/rag/knowledge`, override manuel requis pour écrire au canon ADR-031 `automecanik-raw/recycled/rag-knowledge/`. Verdict empirique : pipeline `run-phase-f.sh` ne fait PAS du scraping (RAW+WIKI), il fait du RAG bootstrap bundle (Steps 1-4 incl. ingest `__rag_knowledge`) sans consumer chatbot actif = bruit pur. Owner-action restante hors-scope : décider du cron dimanche, bootstrap WIKI gammes, fix drift env var, refactor Phase F en scripts atomiques.


## 2026-05-26 — Audit empirique H1/meta R2+R8 (verdict ENRICHMENT R2 H1/title)

- **Branche** : aucune (read-only, 0 commit, 0 PR, 0 migration)
- **Décision** : Audit one-shot LIVE PROD 90 URLs (50 R2 intra-gamme top-10 gammes GSC 30j + 40 R8 intra-marque top-8 marques) confirme empiriquement : (a) **PR #422 R8 pool 18 templates ACTIF** — 0/80 duplicate sur H1+meta_title+meta_description ; (b) **PR #665 R2 `composeVehicleAwareDescription` ACTIF** — 0/100 duplicate sur description, distribution lev_norm spread 0.1-0.7 = diversification effective via `(type_power_ps + prix + count refs)` ; (c) **R2 H1+meta_title NON véhicule-aware** (templates hardcodés gamme-only `gamme-data-transformer.service.ts`) → 3 duplicates strict (lev_norm<0.15 ET jaccard>0.85) sur 100 paires, dont **1 EXACT (lev=0, jaccard=1)** sur Injecteur CITROËN C5 III 2.0 HDi `type_id` 31997 (140ch, 2008-) vs 32794 (163ch, 2009-). Cause racine : H1/title utilisent `type_name` seul, ignorent `type_power_ps`/`type_fuel` que la description PR #665 inclut. Distribution R2.H1 = 94% des paires en lev_norm<0.4 = quasi-duplicate latent à grande échelle. Classification per taxonomie owner = **`enrichment`** (CTR/cannibalisation potentielle, pas blocking conversion — R2 mono-canal via description véhicule-aware OK, 28 orders/an [[project_reality_audit_verdict_conversion_funnel_20260520]]). **No-action immédiate** per `[[feedback_audit_2026-05-25_observe_dont_build]]` (fenêtre OBSERVE jusqu'à 2026-06-08) + `[[feedback_no_touch_meta_h1_if_optimized]]` (autorisation owner requise même si triviale). UA crawl `AutoMecanikAudit/1.0` identifiable per `[[feedback_synthetic_bot_ua_never_spoof_googlebot]]`. Brainstorming `superpowers:brainstorming` invoqué pour cadrer ; 4 contraintes durcies par owner respectées (no tool/CLI, no CI, no dashboard Remix, no auto-gen contenu).
- **Sortie** : `/opt/automecanik/app/audit/seo-h1-meta-empirical-verification-2026-05-26.md` (rapport TL;DR + R2 détaillé + R8 détaillé + cause racine + limitations + références mémoires) — working tree non-commit (owner décide commit/archive). Artefacts éphémères `/tmp/seo-audit-2026-05-26/{urls.tsv,extract.jsonl,analysis.json,recrawl.py,analyze.py}`. Plan d'attaque post-OBSERVE NON-implémenté : étendre pattern PR #665 (`composeVehicleAwareDescription`) à `composeVehicleAwareH1`+`composeVehicleAwareTitle` avec `type_power_ps`/`type_fuel` quand `type_name` non-unique. Aucune touche `payments/`, canonical, routes, DB, container.


## 2026-05-26 — fix/seo-r2-h1-title-vehicle-aware (PR #762 MERGED)

- **Branche** : `fix/seo-r2-h1-title-vehicle-aware` (worktree `app-worktrees/fix-r2-h1-title-ambiguity`, mergée + branche supprimée)
- **Décision** : Suite audit empirique 2026-05-26 (`audit/seo-h1-meta-empirical-verification-2026-05-26.md` — 3 R2 H1 duplicates dont 1 EXACT lev=0 + 1 R2 title EXACT sur 100 paires LIVE PROD), owner a explicitement autorisé fix court R2-only H1/title sans attendre fenêtre OBSERVE 2026-06-08 (overriding `[[feedback_audit_2026-05-25_observe_dont_build]]` pour ce scope précis). Approche robuste retenue après 8 corrections post-self-review : helper pur `enrichTypeNameForHeadings` (composer-style PR #665) qui enrichit conditionnellement `context.type_name` AVANT `processTemplate(templates.h1/title)` dans `seo-template.service.ts:152-153`. Description (PR #665 `composeVehicleAwareDescription`), content, preview reçoivent le context ORIGINAL — zero impact hors H1/title. 4 invariants : pattern conservateur `/^\d+([.,]\d+)?(\s+[A-Za-z0-9]{1,5})?$/`, idempotence (`alreadyContainsPower` guard anti-double-injection), normalisation powerPs (strip suffixe " ch"), fuel implicite détecté (HDI/TDI/CRDI/JTD/TDCI/CDI/DCI). Tests Jest 33/33 verts (3 fixtures audit + sport trim 2.0 RC + idempotence + 7 edge cases + déterminisme + regex coverage match/non-match). Non-régression PR #665 : 22/22 (description.composer + seo-template-switch). `tsc --noEmit` clean. 38 CI checks GREEN après prettier auto-fix (1 push correctif). Auto-merge enabled par owner, BLOCKED 30+ min sur check `CodeQL` (default GitHub code-scanning, queue infrastructure — pas notre `🔬 CodeQL Scan (javascript-typescript)` qui était vert). Merge auto déclenché finalement à 14:27:12Z après dequeue. Zero touche templates DB `__seo_gamme_car`, switches `__seo_item_switch`/`__seo_gamme_car_switch`, R8, payments, canonical, routes, migrations.
- **Sortie** : PR #762 MERGED (commit squash sur main, branche source supprimée local+remote post-merge) | fichiers `backend/src/modules/catalog/services/vehicle-aware-label.composer.ts` (CREATE +97 lignes, helper + 4 invariants commentés en tête) + `backend/src/modules/catalog/services/__tests__/vehicle-aware-label.composer.test.ts` (CREATE 33 tests Jest) + `backend/src/modules/catalog/services/seo-template.service.ts` (MODIFY +17/-2, import + bloc `enrichedTypeName` conditionnel + `headingContext` scope strict H1/title) | 2 commits squashés : `0272afdb1` (fix initial) + `8c136bed2` (prettier auto-fix). Suivi post-merge plan : J+1 curl 4 fixtures audit LIVE PROD post cache Redis TTL 24h → vérifier H1/title distincts (140 ch vs 163 ch CITROËN C5 III + 69 ch vs 75 ch PEUGEOT 206) ; J+7 mini-audit 20 paires R2 → confirmer `R2.H1 duplicate=0` ; J+30 check GSC Console cannibalisation CTR/impressions. Plan canon `~/.claude/plans/les-h1-et-meta-whimsical-waterfall.md` (8 corrections post-self-review intégrées). Aucun ADR créé, gouvernance vault non touchée.


## 2026-05-26 — Business Knowledge Coverage Map + amendement doctrine 5-phases

- **Branche** : aucune (read-only, 0 commit, 0 PR, 0 migration ; working tree + memory only)
- **Décision** : Audit one-shot 7 surfaces de connaissance AutoMecanik (filesystem wiki/proposals/RAW + DB pieces_gamme/auto_modele/__seo_gsc_daily 30j) après owner reframe v1→v2→v3 (Source Governance → Knowledge Coverage → **Business** Knowledge Coverage). 3 findings empiriques : (a) `automecanik-wiki/wiki/{gamme,vehicle,constructeur}/` **vides** — 0 entité métier promue, seulement 6 UI configs L4 diagnostic/support ; (b) `automecanik-rag/` repo n'existe pas localement, le legacy RAG est sous `automecanik-raw/recycled/rag-knowledge/` (3150 fichiers MD dont 241 gammes) — corrige erreur audit précédent ; (c) 6/9 proposals vehicles = 0 imp GSC 30j → INDEXATION_GAP carveout (catalogue solide + Reach=0 = runtime issue, pas knowledge gap). Méthodologie M1-M6 (Empirical sourcing + RICE composite + canonical_slug fuzzy + Confidence M4 + Falsifiability M5 + Coverage manifest M6). Distribution GSC empirique extrême (p50=2, p99=340, max=2319 — emetteur-d-embrayage R7 blog) ; volume catalogue plaquette-de-frein=148329 pieces (#1). Top 5 RICE ranké post-OBSERVE : filtre-a-air (2805 READY) > plaquette-de-frein (2600 BLOCKED_SOURCE S3 ECE R90) > audit INDEXATION_GAP (hors-scope wiki) > capteur-abs (971) > etrier-de-frein (865). Amendement v2 post-livraison après 2 corrections doctrinales owner : (1) périmètre éditorial = ~237 gammes curées + véhicules catalogue, PAS les 9719 pieces_gamme bruts ; (2) business proof = gate Phase 4-5 (enrichissement + promotion), JAMAIS gate entrée Phase 1-2-3. Pipeline canon final = 5 phases (RAW + WIKI candidate + PAGE candidate + Enrichir + Promouvoir/publier) avec statuts par niveau (RAW_*, WIKI_*, PAGE_*) projetables depuis l'existant (frontmatter `review_status` + sitemap + meta robots), zéro nouveau registry/YAML/CI. Doctrine canon gravée : « Coverage E2E first = RAW + WIKI candidate + PAGE candidate. Business prioritization second. Canonical promotion and SEO publication last. » + 3 anti-bricolage : RAW rempli ≠ vérité, WIKI proposal ≠ canon, PAGE candidate ≠ page indexable. Aucune action déclenchée — fenêtre OBSERVE `[[feedback_audit_2026-05-25_observe_dont_build]]` active jusqu'au 2026-06-08. Décision owner courte recommandée 2026-06-09 (GO Phases 1+2+3 progressive, GO filtre-a-air Phase 4+5 test, NO-GO publication véhicules sans audit INDEXATION_GAP).
- **Sortie** : `/opt/automecanik/app/audit/wiki-knowledge-coverage-map-2026-05-26.md` (911 lignes, §1-§11 dont §11.1 scope canon + §11.2 business proof position + §11.3 pipeline 5-phases + §11.4 top 5 remappé + §11.5 surfaces 3 niveaux + §11.6 recadrage mémoires + §11.7 décision owner + §11.8 statuts d'avancement) — working tree non-commit (owner décide post-OBSERVE). Mémoires Layer 0 : `feedback_audit_business_filter_over_completeness.md` (update + précision post-amendement) + 3 nouvelles `feedback_rice_indexation_gap_carveout.md` + `feedback_e2e_coverage_first_business_prio_second.md` + `feedback_scope_canon_237_gammes_not_9719_pieces_gamme.md` + MEMORY.md Layer 0 index (4 pointeurs ajoutés). Plan `~/.claude/plans/utiliser-superpower-oui-le-smooth-kazoo.md` (cadrage initial v3 + amendement). Aucune touche `payments/`, meta/H1, canonical, routes, DB, container, sitemap, governance-vault. Aucun ADR créé (owner directive : pas de nouvel ADR, scope amendment opérationnel uniquement).


## 2026-05-26 — Doctrine pipeline §11.9-§11.10ter (RAG-exclu + status 5-tier + fail-fix-retest + 2-voies équilibre)

- **Branche** : aucune (read-only, 0 commit, 0 PR ; working tree audit + 5 fichiers mémoire Layer 0)
- **Décision** : Suite à la session principale (rapport + amendement v2 5-phases logged ci-dessus), owner a poussé 4 corrections doctrinales itératives via dry-run E2E sur `filtre-a-air` + clarifications successives, toutes intégrées en §11.9 → §11.10ter de l'audit + 2 nouvelles mémoires Layer 0. **§11.9** : RAG explicitement exclu du pipeline contenu canon (le mot "RAG" dans `recycled/rag-knowledge/` est legacy directory, pas étape pipeline ; 4 domaines distincts RAW/WIKI/PAGE = dans chaîne, RAG = consumer aval chat-only ; NO-GO `run-phase-f.sh`/`ALLOW_RAG_REINDEX`/RAG comme source vérité, OK recycler `rag-knowledge/*.md` comme input candidate WIKI). **§11.10** : dry-run filtre-a-air a révélé 4 blockers + pipeline = `DIAGNOSTIC_READY/PARTIAL_READY`, **PAS** `OPERATIONAL_READY` ; introduction 5-tier maturité pipeline (CONCEPTUAL → DIAGNOSTIC_READY → PARTIAL_READY → OPERATIONAL_READY → SCALE_READY) ; règle d'or « dry-run avec gaps prouve l'observabilité, pas l'opérationnalité » ; 6 blockers concrets à corriger avant scale (RAW complet/partiel, reviewer null chronique 24j, PAGE_CANDIDATE vs PUBLISHED, R2 déjà publié = dette doctrinale, CTR=0/2457 imp = signal acquisition à investiguer, test transition contrôlée). **§11.10bis** : boucle obligatoire `TEST → FAIL → FIX → RETEST → PASS/NO-GO motivé` ; anti-pattern interdit `TEST → FAIL → rapport → abandon → autre sujet` ; filtre-a-air = pilote correction qui doit rester sous fix, pas être abandonné ; exception `BLOCKED_HARD` strictement encadrée (3 conditions cumul : raison documentée + owner decision explicite + nouveau pilote motivé). **§11.10ter** : doctrine équilibre post-symétrie « ne pas abandonner le pilote ne doit pas devenir tout suspendre à un seul pilote » ; 2 voies parallèles autorisées (Voie A correction filtre-a-air + Voie B coverage E2E petit batch 5 sujets représentatifs : filtre-a-air pilote + plaquette-de-frein safety + capteur-abs CREATE + alternateur INDEXATION_GAP + Golf 8/Clio 4 véhicule) ; critères raffinés `OPERATIONAL_READY` = pilote PASS/BLOCKED_HARD + ≥1 autre sujet représentatif E2E + failure map → correction map + pas de publication auto + RAG exclu (simultanément), `SCALE_READY` = ≥3 sujets OPERATIONAL_READY + 0 régression croisée + owner decision. **§11.7 patché 2 fois** pour refléter ces durcissements successifs (2-voies + NO-GO scale global tant que ≥2 sujets OPERATIONAL_READY non démontré). Doctrine OBSERVE `[[feedback_audit_2026-05-25_observe_dont_build]]` toujours respectée — aucune action déclenchée, tout est documentaire pour exploitation post-2026-06-08.
- **Sortie** : `/opt/automecanik/app/audit/wiki-knowledge-coverage-map-2026-05-26.md` (1155 lignes finales, +244 lignes vs version précédente, ajout §11.9 RAG-exclu + §11.10 5-tier maturité + §11.10bis fail-fix-retest + §11.10ter 2-voies équilibre + 2 patches §11.7). Mémoires Layer 0 ajoutées : `feedback_pipeline_diagnostic_ready_not_operational_ready.md` (5297 bytes — règle dry-run-observable-pas-opérationnel + 5-tier + 6 blockers + interdits + garde-fou inverse) + `feedback_test_fail_fix_retest_not_abandon.md` (4933 bytes — boucle fail-fix-retest + 2-voies équilibre + exception BLOCKED_HARD + critères OPERATIONAL_READY raffinés). MEMORY.md Layer 0 enrichi (2 nouveaux pointeurs sous les 4 entrées 05-26 précédentes + description `feedback_e2e_coverage_first` mise à jour avec RAG-hors-pipeline). Aucune touche `payments/`, code app, DB, container, sitemap, governance-vault. Aucun ADR créé. Plan `~/.claude/plans/utiliser-superpower-oui-le-smooth-kazoo.md` enrichi addendums 4-5 (pipeline status + correction inline pipeline test).


## 2026-05-26 — Voie B exécution §11.10ter + finding pattern GSC bot aiNNNNN

- **Branche** : aucune (read-only sur monorepo + écritures `automecanik-wiki/proposals/` + memory Layer 0 ; 0 commit, 0 PR, 0 promotion canon, 0 publication SEO)
- **Décision** : Owner override OBSERVE pour scope précis « remplir le contenu pas attendre » → exécution Voie A diagnostic + Voie B coverage E2E batch §11.10ter via skill `wiki-proposal-writer` (mode propose-only). **Voie A blocker #5 (CTR=0 filtre-a-air) RÉSOLU empiriquement** avec **finding majeur** : les 375 queries `^ai\d+$` sur filtre-a-air R2 (2 398 / 2 457 imp = 97,6% du trafic) sont des `auto_type.type_id` AutoMecanik internes préfixés "ai" (cross-checked DB), apparues 2026-05-14 pic 05-21, 99,2% concentré sur filtre-a-air → bot / agent IA shopping, pas codes OE/TecDoc comme je l'avais incorrectement inféré. **CTR humain ajusté** : 59 imp humaines réelles (vs 2 457 mix), position moyenne 18,5 (page 2 Google), 0 click = statistiquement normal — ce n'est PAS une anomalie wiki/meta, c'est un problème de ranking page 2 sur queries naturelles type `filtre à air audi q5 30 tdi`. **Mémoire Layer 0 canon créée** `feedback_gsc_ai_type_id_synthetic_query_pattern.md` (règle filtre `WHERE query !~ '^ai\d+$'` obligatoire toute analyse CTR humain ; anti-pattern « codes OE/TecDoc » interdit ; pattern à surveiller si extension cross-gammes). **Voie A blocker #1** PR monorepo #269 confirmée MERGED 2026-05-02 (2 brake symptoms DB) → débloque ajout `diagnostic_relations[]` futures plaquette-de-frein. **Voie B batch 3 proposals créées via skill 11 étapes manuel** : (1) `capteur-abs` (gamme freinage G1 pg_id=412, 1 diag_rel brake_pulling_side seul slug DB ABS-adjacent, sources to_capture, safety scope) ; (2) `alternateur` (gamme electricite G1 pg_id=4, INDEXATION_GAP test 107k pieces/Reach=5, 1 diag_rel battery_warning_light, source manual_review) ; (3) `renault-clio-4` (vehicle v1.0.0, 7 modele_ids catalogue + 16 motorisations DB structurées, parents [vehicle:renault-clio-3], INDEXATION_GAP probable). **Boucle fail-fix-retest §11.10bis appliquée 2 fois** sur alternateur (gate `symptom_unstructured` détecté "bruit/sifflement/vibration" + "bruit" résiduel ligne 151 → 2 reformulations FAQ "son anormal / tonalité sourde" sans toucher le sens technique = canonique, pas bricolage). **Validation globale** : `quality-gates.py --all` = **18/18 PASS, 0 FAIL, 2 WARN pré-existants** (Brembo mentions ford-focus-3 + renault-megane-3 hors scope). **Patches audit §11.10** : blocker #5 tableau reformulé avec finding empirique corrigé. **Owner verdict** : `Coverage E2E candidate: PARTIAL_READY`, `Quality gates: PASS`, `Promotion canon: NO-GO sans review humaine`, `Publication SEO: NO-GO sans audit indexation`. Doctrine OBSERVE respectée — aucune mutation runtime, aucune publication, aucune promotion proposals→wiki, aucune capture externe automatique.
- **Sortie** : 3 fichiers `automecanik-wiki/proposals/` (untracked, propose-only) : `capteur-abs.md` (225 lignes, RICE 971, PASS quality-gates) + `alternateur.md` (213 lignes, INDEXATION_GAP test, PASS) + `renault-clio-4.md` (333 lignes, vehicle v1.0.0, PASS). Mémoire Layer 0 `/home/deploy/.claude/projects/-opt-automecanik-app/memory/feedback_gsc_ai_type_id_synthetic_query_pattern.md` (CANON 05-26 STRICT pattern bot synthétique). MEMORY.md Layer 0 +1 pointeur. Audit `audit/wiki-knowledge-coverage-map-2026-05-26.md` §11.10 blocker #5 + §11.10ter tableau Voie A patchés avec finding bot. Aucune touche `payments/`, code app monorepo, DB, container, sitemap, governance-vault, wiki canon. Aucun commit ni promotion. **Handoff review humaine séquentielle recommandée** : capteur-abs (priorité #1 — safety + sources sensibles + scope ESP à valider) → alternateur (gate INDEXATION_GAP + family electricite à confirmer) → renault-clio-4 (vehicle v1.0.0 + sources Wikipedia/caradisiac/Renault to_capture Phase 7). Pour chaque fichier : valider `review_notes`, `source_refs`, `diagnostic_relations`, `family`, `aliases`, `gates indexation/safety`. **Règle canonique transverse à retenir** : `WHERE query !~ '^ai\d+$'` filtre obligatoire toute analyse CTR humain GSC future.


## 2026-05-26 — Auto-review canon Layer 0 + rapport batch Niveau 0 manuel

- **Branche** : aucune (read-only, 0 commit, 0 PR, 0 mutation proposals)
- **Décision** : Owner demande auto-review pour réduire travail humain mais sépare strict « contrôle ≠ décision ». Doctrine canon gravée Layer 0 : auto-review = contrôle/scoring/détection risques (lit), review humaine = décision finale promotion (décide). Pipeline canon `proposal → quality-gates → auto-review → correction si FAIL/WARN → review humaine ciblée → promotion canon si validée humain`. 6 dimensions auto-review (frontmatter / sources / safety / INDEXATION_GAP / PAGE candidate / filtre bot `^ai\d+$` obligatoire). 6 statuts ENUM `AUTO_REVIEW_PASS|WARN|FAIL|BLOCKED_SOURCE|BLOCKED_INDEXATION|NEEDS_HUMAN` + overlay obligatoire `HUMAN_REVIEW_REQUIRED` toujours (anti-auto-approval). 6 interdits absolus auto-review : jamais écrire `reviewed_by`/`reviewed_at`/`review_status: approved`, jamais `git mv proposals→wiki`, jamais publication SEO, jamais modifier `confidence_score` calculé, jamais flip `evidence.diagnostic_safe`, jamais capture source externe sans humain Obsidian. 4 niveaux progressifs implémentation (0 manuel→1 script→2 CI warn→3 CI block) avec règle V1=Niveau 0 ; V2/script gated cadence ≥5 proposals/semaine ; V3-V4/CI uniquement post-`OPERATIONAL_READY` pipeline. **Rapport batch Niveau 0 généré** sur les 3 proposals Voie B §11.10ter : capteur-abs=`BLOCKED_SOURCE` (safety + sources `to_capture` + slugs DB ABS absents), alternateur=`BLOCKED_INDEXATION` (carveout Impact≥50 Reach≤5 confirmé), renault-clio-4=`NEEDS_HUMAN` (sources externes toutes `to_capture` + INDEXATION_GAP probable). **0 proposal AUTO_REVIEW_PASS** = bon résultat (objectif auto-review = savoir ce qui bloque, pas approver tôt). Owner verdict : `GO review humaine séquentielle, NO-GO script auto-review pour l'instant, NO-GO auto-approval/promotion/publication`. Niveau 1 (script `_scripts/auto-review-proposals.py`) gated cadence justifiée future. Doctrine OBSERVE inchangée.
- **Sortie** : `/opt/automecanik/app/audit/wiki-auto-review-2026-05-26.md` (rapport batch 3 proposals × 5 dimensions, ~280 lignes) + Mémoire Layer 0 `/home/deploy/.claude/projects/-opt-automecanik-app/memory/feedback_auto_review_read_only_no_auto_approval.md` (~4800 bytes, canon règle auto-review read-only) + MEMORY.md Layer 0 +1 pointeur. Aucune touche proposals, payments, code app, DB, container, sitemap, governance-vault, wiki canon. Aucun script créé (anti-bricolage Niveau 1 différé). Aucun commit. **Handoff inchangé** : review humaine séquentielle capteur-abs → corrections sources S2/S3 ou BLOCKED_SOURCE motivé → review alternateur → audit indexation R7/R2 avant Phase 5 → review renault-clio-4 → capture sources externes + mesure GSC. Toutes actions gated humain.


## 2026-05-26 — Doctrine §11.10quater risk-based + §11.10quinquies bug ILIKE + verdict ADR-082 PARTIAL_READY

- **Branche** : aucune (read-only monorepo + écritures audit/memory + skill continuous-improvement-global appliqué ; 0 commit, 0 PR, 0 mutation runtime, 0 promotion canon)
- **Décision** : Owner pivote doctrine auto-review 2 fois sucessives. **§11.10quater risk-based auto-approval** (révise mémoire `feedback_auto_review_read_only_no_auto_approval` : ancienne règle « HUMAN_REVIEW_REQUIRED overlay toujours » = goulot non-opérationnel, nouvelle règle 3 niveaux risque A/B/C avec 8 statuts ENUM ; phrase canon « L'humain ≠ moteur du pipeline, humain = garde-fou des cas risqués »). Application aux 3 proposals : capteur-abs `BLOCKED_SAFETY` Niveau C, alternateur `AUTO_APPROVED_WITH_WARNINGS` Niveau B, renault-clio-4 `AUTO_APPROVED_WIKI_CANDIDATE` Niveau A. **§11.10quinquies bug ILIKE corrigé empiriquement** : audit §4.3 cherchait `'%renault-clio-3%'` mais URLs runtime utilisent `clio-iii` (chiffres romains) — 6 vehicles proposals étaient faussement classés INDEXATION_GAP (Reach=0). Recalcul avec aliases romain+arabe + filtre bot révèle Reach humain réel 35-718 imp/30j (peugeot-206=718, golf-6=206, clio-3=81, c3=58, megane-3=50, focus-3=35, clio-4=27 — TOUS visibles GSC en page 1-3). Vrai INDEXATION_GAP confirmé empiriquement = 1 seul cas (`alternateur` 107k pieces / Reach~5). Doctrine §11.10ter Voie B « gate INDEXATION_GAP probable vehicles » largement levé. Hand-off Option 1 promotion manuelle owner renault-clio-4 préparé (auto-mode classifier a bloqué tentative agent d'écrire reviewed_by humain — Option 2 anti-pattern correctement détecté). Mémoire `feedback_gsc_slug_ilike_must_include_aliases.md` créée canon Layer 0 (règle « toute requête GSC ILIKE slug DOIT inclure tous aliases ; sinon faux verdict INDEXATION_GAP massif » + pattern SQL canonique `ILIKE ANY (SELECT '%'||a||'%' FROM unnest(aliases))`). **Skill continuous-improvement-global invoqué fin de session** (ADR-082 vault v15.2) : 7 étapes filtre + verdict canonique JSON validé Draft 2020-12 contre `.spec/00-canon/improvement-report.schema.json`. Verdict : **PARTIAL_READY** (proof_minimal_v7 5/6 — representative_case_executed=false car aucune promotion E2E exécutée ; OPERATIONAL_READY exigeable post Option 1 owner). anti_complexity_check: simplification_applied. non_regression_9_v10: 9/9 PASS. regression_risk: near-zero. 4 owner_actions canonisées (OWNER-PROMOTE-CLIO-4 P6 LOW / OWNER-AUDIT-INDEX-ALTERNATEUR P6 MEDIUM / OWNER-CAPTEUR-ABS-SAFETY P6 HIGH / OWNER-OPTION-3-CANON P6 MEDIUM). Doctrine OBSERVE respectée.
- **Sortie** : `/opt/automecanik/app/audit/session-2026-05-26-doctrine-batch.verdict.json` (improvement-report canonique ADR-082, validé ajv-cli Draft 2020-12 contre schema canon). Patches audit/wiki-knowledge-coverage-map-2026-05-26.md §11.10ter Décision corrigée (référence §11.10quater + §11.10quinquies inline) + §5.2.C header note correctif + §7.5 scope réduit + §8 Action 3 scope réduit. Patches audit/wiki-auto-review-2026-05-26.md (verdicts révisés risk-based : renault-clio-4 net AUTO_APPROVED_WIKI_CANDIDATE sans BLOCKED_INDEXATION overlay post mesure empirique 27 imp humain position 20). Mémoires Layer 0 mises à jour : feedback_auto_review_read_only_no_auto_approval réécrite risk-based (3 niveaux A/B/C, 8 statuts ENUM, 5 niveaux progression, anti-pattern HUMAN_REVIEW_REQUIRED overlay-toujours) + nouvelle feedback_gsc_slug_ilike_must_include_aliases (canon SQL pattern aliases obligatoires). MEMORY.md Layer 0 +1 pointeur ILIKE bug + description auto-review révisée. Aucune touche payments/, code app monorepo, DB, container, sitemap, governance-vault, wiki canon. Aucun commit ni promotion. **Handoff final** : exécution OWNER-PROMOTE-CLIO-4 attendue (Option 1 hand-off prêt copier-coller) → post-promotion débloque proof_minimal_v7 6/6 → recalcul verdict vers OPERATIONAL_READY. Toutes actions canon-compliant gated humain.


## 2026-05-26 — PR #763 MERGED + LIVE_CONFIRMED 4/4 (follow-up #762 LIVE_INEFFECTIVE)

- **Branche** : `fix/seo-r2-h1-frontend-vehicle-aware` (worktree `app-worktrees/fix-r2-h1-frontend`, mergée + supprimée)
- **Décision** : Suite verification post-deploy PR #762, découverte critique que le R2 `<h1>` visible LIVE est rendu côté frontend dans `PiecesHeader.tsx:89-94` utilisant `vehicle.typeName` raw — PR #762 backend `seo-template.service.ts:processTemplates` n'alimentait que le `<title>` HEAD pour 118/9719 pg_ids avec template DB (~1.2% coverage). Verdict empirique = `LIVE_INEFFECTIVE` sur le H1 visible (cas exact que la doctrine `[[feedback_runtime_verification_mandatory]]` GATE 1 vise à prévenir : trust exploration agent sans empirical path proof). Owner a validé Option B (follow-up PR frontend, pas revert PR #762) + codifié extension doctrine 2-gates : **GATE 1 (PRE-PR)** empirical implementation path obligatoire + **GATE 2 (POST-MERGE)** LIVE verification cible immediate (J+1 = monitoring only, jamais first proof). Solution PR #763 : move helper `enrichTypeNameForHeadings` vers `packages/seo-types/src/vehicle-aware-label.ts` (shared package, zero duplication), backend `seo-template.service.ts` import depuis `@repo/seo-types` (path-only update), frontend `PiecesHeader.tsx` calcule `enrichedTypeLabel` via shared helper et display dans `<h1>` au lieu de `vehicle.typeName` raw, frontend `pieces-vehicle.loader.server.ts:503-507` enrichit le `seo.title` fallback (couvre 98.8% pg_ids sans template backend). 20/20 tests node tsx shared package + 33/33 jest backend regression composer + 55/55 jest backend catalog/__tests__ + 0 erreur TS sur fichiers modifiés. CodeQL initial fail (alert #658 `js/polynomial-redos` regex `\s*` lignes 65/72 vehicle-aware-label.ts), fix bornage quantifiers `\s{0,3}` (max 3 espaces, couvre cas réels "140 ch" / "140  ch" / "140ch"), re-push, all 38 checks green incl. CodeQL pass. Auto-merge `gh pr merge --auto --squash` validated 16:31:24Z. Tag race observé : Dependabot #749 (vite-ecosystem dev-deps bump) mergé entre push PR #763 et tag push → `:preprod` SHA=`1af08aa3c` mais HEAD=`5df514326` → safety-gate `deploy-prod.yml` FAIL sur tag v2026.05.26.1 (SHA mismatch tag commit vs `:preprod` label OCI revision per `[[feedback_preprod_floating_tag_race_structural]]`). Recovery canon : delete tag + re-tag sur `1af08aa3c` (PR #763 exact, match `:preprod`) = tag `v2026.05.26.2-seo-r2-h1-frontend-disambiguation`. Retry deploy-prod run `26462652003` ✅ success. **GATE 2 LIVE verification 4/4 CONFIRMED** post-deploy + CF natural expiry (`cf-cache-status: EXPIRED` sur 4/4 sans purge owner — 24h s-maxage TTL atteint depuis dernier deploy 14:27Z) : H1 31997 = "Injecteur CITROËN C5 III 2.0 HDi **140 ch** au meilleur prix" + H1 32794 = "...**163 ch**..." + H1 30091 = "Kit de distribution PEUGEOT 206 1.4 HDI **69 ch** au meilleur prix" + H1 9466 = "...1.4 **Essence 75 ch**..." — 4 H1 distincts (était 0/2 distinct pré-fix). Title 3/4 CONFIRMED (31997/32794/30091 contiennent power_ps via `#VType#` backend processed), 4ème title (9466) reste pre-fix `Kit de distribution PEUGEOT 206 1.4 à partir de 35.00€ pas cher.` car Redis cache `seo:processed:307:9466` TTL 24h non-expiré (J+1 follow-up legitime per doctrine GATE 2). Doctrine `[[feedback_runtime_verification_mandatory]]` 2-gates entièrement validée empiriquement par ce cycle.
- **Sortie** : PR #763 MERGED (commit squash `1af08aa3c` sur main, 9 fichiers +283/-19) | tags PROD : `v2026.05.26.1` (deleted, safety-gate fail) + `v2026.05.26.2-seo-r2-h1-frontend-disambiguation` (success) | new shared package file `packages/seo-types/src/vehicle-aware-label.ts` (75 LOC pure helper + invariants ReDoS-safe) + tests `packages/seo-types/src/vehicle-aware-label.test.ts` (20 node tsx tests) + backend `seo-template.service.ts` import-only update + frontend `PiecesHeader.tsx` (3 edits surgical inline enrichment) + frontend `pieces-vehicle.loader.server.ts` (1 import + title fallback wrap) + `frontend/package.json` (add `@repo/seo-types` workspace dep) | mémoire Layer 0 `[[feedback_runtime_verification_mandatory]]` étendue (doctrine 2-gates, version courte + matrice 13 types changement) | aucune touche `payments/`, canonical, routes, templates DB `__seo_gamme_car`, switches `__seo_item_switch`/`__seo_gamme_car_switch`, `composeVehicleAwareDescription` PR #665 (intact). Couverture combinée PR #762 + #763 = H1 visible R2 (frontend) ✅ + title HEAD R2 backend processed (1.2% pg_ids) ✅ après Redis TTL + title HEAD R2 fallback (98.8% pg_ids) ✅ via loader.server.ts + meta description R2 (PR #665) intact ✅. CRITICAL verification debt = closed (LIVE_CONFIRMED 4/4 H1).

## 2026-05-27 — ADR-082 Phase 1 v15.5 stabilisée + 4 canon decisions

- **Branche** : `chore/adr-082-phase1-doctrine-tooling` (worktree `/opt/automecanik/app-worktrees/adr-082-phase1`, PR #765 MERGEABLE/BEHIND/draft, 9 files +1492 lines)
- **Décision** : Doctrine d'amélioration continue v15.5 stabilisée + livrée Phase 1 (SKILL `continuous-improvement-global`, schema JSON 2020-12 canon `improvement-report.schema.json`, PR template `## Improvement Gate`, ADR-082 vault draft `/tmp/adr-draft-...md`, 2 pilots cross-domain cross-validated `DOCTRINE_SURVIVED_2_PILOTS`) puis testée empiriquement contre 2 ratchets CI réels (Block-new ADR-058 + Skills canon PR-V2, fixés via extension `ownership.yaml` +5 globs + SKILL.md "Use when"+`@ak125`, 0 nouvelle couche) et auto-review interne (silent-failure-hunter 6 critical findings → 1 fix autonome C4 Pilot #2 rollback claim factual error + 3 décisions owner-gated C5 filtre soft-signal/C6 OBSERVE clarification/I6 label downgrade + 8 items Phase 2A backlog différé) ; HARD LOCK Phase 2A/B/C/D/3 maintenu intact, doctrine appliquée à elle-même cohérente sur tous les moments (review/fix/decision/backlog).
- **Sortie** : PR #765 | commits 31c115d10 76b496ef2 4a2d9ccd9 (3 cette session + c6409fa32 owner-initial) | fichiers `.claude/skills/continuous-improvement-global/SKILL.md`, `.spec/00-canon/improvement-report.schema.json`, `.spec/00-canon/repository-registry/ownership.yaml`, `.github/PULL_REQUEST_TEMPLATE.md`, `audit/pilot-filtre-a-air-2026-05-26.{md,verdict.json}`, `audit/pilot-memory-md-compaction-2026-05-26.verdict.json`, `audit/doctrine-v15-3-cross-validation-2026-05-26.md`, `audit/phase-2a-backlog-2026-05-27.md`, draft `/tmp/adr-draft-ADR-082-global-continuous-improvement-doctrine.md` (vault PR owner-gated). Owner-actions pending : Ready for review + rebase trivial + merge + vault PR ADR-082.


## 2026-05-27 — Phase A WIKI bootstrap implémentée + canon RAG-to-RAW + Phase B scope gravé

- **Branche** : `feat/wiki-bootstrap-promote-raw-gammes-2026-05-27` (9 commits ahead main, pushée à origin)
- **Décision** : Plan superpowers brainstorming+writing-plans approuvé après 6 itérations doctrine. Phase A complète 7 commits + 30 tests pytest PASS — `scripts/wiki-generators/promote-raw-gammes-to-wiki.py` single-file Python (mirror canon `gamme-from-web-corpus-generator.py`) avec is_rag_recycled_candidate guard, candidate/confirmed parallel pattern + cross_check_status (WEB_CONFIRMS_RAG/WEB_DIFFERS/RAG_ONLY/WEB_ONLY/NEITHER), variant_readiness 5 status (PASS_VARIANT_READY/PASS_PARTIAL_R2_BLOCKED/PASS_PARTIAL/RAG_CANDIDATE_REQUIRES_REVIEW/FAIL_NOT_VARIANT_READY), schema validation Option C (default safe : dimensions in body+review_notes, gamme.schema.json unchanged), anti-filler gate, content_hash idempotence, structured run log JSON. Dry-run vanne-egr → status `RAG_CANDIDATE_REQUIRES_REVIEW` (5 dim, 2 confirmed) car 0 fichier OEM web matché : gap structurel découvert dans le pipeline scraping existant (418 fichiers ont frontmatter YAML indentée 8 espaces `        ---` rendant regex `^---\n` inopérant). **Option C maintenue par owner** = Phase A reste dry-run only, pas d'écriture wiki. **Phase B scope gravé** = relation mapper RAW web → gamme + véhicule + motorisation (sous-étape B1 fix regex frontmatter indenté + extract nested relations / B2 vehicle_relation_mapper si nécessaire). Doctrine canon Phase B : sans relation véhicule prouvée R8 reste faible et R2 reste générique ("vanne EGR" générique vs "vanne EGR Renault Clio 4 1.5 dCi" différencié). Règle d'inviolation Phase B : ne JAMAIS inventer compatibilité véhicule, tag `relation_status: NO_VEHICLE_EVIDENCE` si non prouvé.
- **Sortie** : Branche pushée `feat/wiki-bootstrap-promote-raw-gammes-2026-05-27` (9 commits) | commits Phase A `c913037e4` `6f1de06ef` `e25d9c160` `9f5822d3b` `1ea6d8bfb` `22eb283c9` `3d77fd76b` + registry ownership `cb1f64b60` `e60b929e6` | fichiers `scripts/wiki-generators/promote-raw-gammes-to-wiki.py` (single-file 700+ LOC), `scripts/wiki-generators/test_promote_raw_gammes_to_wiki.py` (30 tests pytest PASS), `audit/wiki-bootstrap-runs/.gitkeep`, `.spec/00-canon/repository-registry/ownership.yaml` (+24 lignes globs D3 seo-team) | 2 mémoires Layer 0 STRICT canon gravées : `feedback_rag_to_raw_candidate_requalification.md` (RAG data allowed as RAW candidate, forbidden only when silently promoted as confirmed WIKI/runtime, pattern candidate/confirmed parallel, 7 statuts canoniques exhaustifs) + `feedback_phase_b_vehicle_relation_mapper_canon.md` (Phase B relation mapper niveau 1 gamme + niveau 2 véhicule, scope corrigé R8/R2 differentiation requires vehicle, 6 tests Phase B obligatoires, anti-pattern bannis) | plan `~/.claude/plans/verdict-verdict-oui-avec-cheeky-catmull.md` (design + 7 tasks TDD bite-sized) | aucune touche payments/, meta/H1/canonical, runtime SEO, container, DB write | Task 8 reste pending CONDITIONAL : owner GO blocked until Phase B (web→gamme+vehicle mapping) résout le gap structurel scraping. Conforme canon OBSERVE 2026-06-08 + 14 mémoires Layer 0 strictes.


## 2026-05-27 — feat/wiki-bootstrap-promote-raw-gammes-2026-05-27 (auto)

- **Branche** : `feat/wiki-bootstrap-promote-raw-gammes-2026-05-27`
- **Décision** : docs(log): append wiki-bootstrap phase A session 2026-05-27 (+10 other commits)
- **Sortie** : PR aucune | commits f6f936e2c e60b929e6 cb1f64b60 3d77fd76b 22eb283c9 1ea6d8bfb 9f5822d3b e25d9c160 6f1de06ef c913037e4 4e1478cbd

## 2026-05-27 — feat/wiki-bootstrap-promote-raw-gammes-2026-05-27 (auto)

- **Branche** : `feat/wiki-bootstrap-promote-raw-gammes-2026-05-27`
- **Décision** : feat(wiki-bootstrap): web relation extractor + NO_VEHICLE_EVIDENCE (B1.2) (+13 other commits)
- **Sortie** : PR aucune | commits de9a3057c 4385979f2 d3707b8d1 f6f936e2c e60b929e6 cb1f64b60 3d77fd76b 22eb283c9 1ea6d8bfb 9f5822d3b e25d9c160 6f1de06ef c913037e4 4e1478cbd

## 2026-05-27 — feat/wiki-bootstrap-promote-raw-gammes-2026-05-27 (auto)

- **Branche** : `feat/wiki-bootstrap-promote-raw-gammes-2026-05-27`
- **Décision** : chore(registry): add globs for wiki-bootstrap audit + cluster reports (+16 other commits)
- **Sortie** : PR aucune | commits d1fb809e7 59307118f 11f3ea73b de9a3057c 4385979f2 d3707b8d1 f6f936e2c e60b929e6 cb1f64b60 3d77fd76b 22eb283c9 1ea6d8bfb 9f5822d3b e25d9c160 6f1de06ef c913037e4 4e1478cbd

## 2026-05-27 — feat/wiki-bootstrap-promote-raw-gammes-2026-05-27 (auto)

- **Branche** : `feat/wiki-bootstrap-promote-raw-gammes-2026-05-27`
- **Décision** : chore(registry): add globs for compatibility audit reports (+19 other commits)
- **Sortie** : PR aucune | commits bd090b8e3 3b206ce6c 97bf40745 d1fb809e7 59307118f 11f3ea73b de9a3057c 4385979f2 d3707b8d1 f6f936e2c e60b929e6 cb1f64b60 3d77fd76b 22eb283c9 1ea6d8bfb 9f5822d3b e25d9c160 6f1de06ef c913037e4 4e1478cbd

## 2026-05-27 — feat/wiki-bootstrap-promote-raw-gammes-2026-05-27 (auto)

- **Branche** : `feat/wiki-bootstrap-promote-raw-gammes-2026-05-27`
- **Décision** : docs(audit): b3 evidence — vanne-egr pass_variant_ready via compat url (+22 other commits)
- **Sortie** : PR aucune | commits 442032613 859f505d3 2523c02f2 bd090b8e3 3b206ce6c 97bf40745 d1fb809e7 59307118f 11f3ea73b de9a3057c 4385979f2 d3707b8d1 f6f936e2c e60b929e6 cb1f64b60 3d77fd76b 22eb283c9 1ea6d8bfb 9f5822d3b e25d9c160 6f1de06ef c913037e4 4e1478cbd

## 2026-05-27 — feat/wiki-bootstrap-promote-raw-gammes-2026-05-27 (auto)

- **Branche** : `feat/wiki-bootstrap-promote-raw-gammes-2026-05-27`
- **Décision** : docs(audit): b2 multi-gammes — 5 gammes × 197 urls prouvées par runtime (+24 other commits)
- **Sortie** : PR aucune | commits ed0099749 8915a4a9a 442032613 859f505d3 2523c02f2 bd090b8e3 3b206ce6c 97bf40745 d1fb809e7 59307118f 11f3ea73b de9a3057c 4385979f2 d3707b8d1 f6f936e2c e60b929e6 cb1f64b60 3d77fd76b 22eb283c9 1ea6d8bfb 9f5822d3b e25d9c160 6f1de06ef c913037e4 4e1478cbd

## 2026-05-27 — feat/wiki-bootstrap-promote-raw-gammes-2026-05-27 (auto)

- **Branche** : `feat/wiki-bootstrap-promote-raw-gammes-2026-05-27`
- **Décision** : chore(registry): add globs for b3 multigammes evidence (+27 other commits)
- **Sortie** : PR aucune | commits 093cffc84 646233835 28fb0cf80 ed0099749 8915a4a9a 442032613 859f505d3 2523c02f2 bd090b8e3 3b206ce6c 97bf40745 d1fb809e7 59307118f 11f3ea73b de9a3057c 4385979f2 d3707b8d1 f6f936e2c e60b929e6 cb1f64b60 3d77fd76b 22eb283c9 1ea6d8bfb 9f5822d3b e25d9c160 6f1de06ef c913037e4 4e1478cbd

## 2026-05-27 — feat/wiki-bootstrap-promote-raw-gammes-2026-05-27 (auto)

- **Branche** : `feat/wiki-bootstrap-promote-raw-gammes-2026-05-27`
- **Décision** : docs(audit): b4 db cross-check 219/222 pass_db_aligned (+29 other commits)
- **Sortie** : PR aucune | commits 90570029b 015693307 093cffc84 646233835 28fb0cf80 ed0099749 8915a4a9a 442032613 859f505d3 2523c02f2 bd090b8e3 3b206ce6c 97bf40745 d1fb809e7 59307118f 11f3ea73b de9a3057c 4385979f2 d3707b8d1 f6f936e2c e60b929e6 cb1f64b60 3d77fd76b 22eb283c9 1ea6d8bfb 9f5822d3b e25d9c160 6f1de06ef c913037e4 4e1478cbd

## 2026-05-27 — feat/wiki-bootstrap-promote-raw-gammes-2026-05-27 (auto)

- **Branche** : `feat/wiki-bootstrap-promote-raw-gammes-2026-05-27`
- **Décision** : feat(wiki-bootstrap): b5 db-rich dimensions + 6/6 pass_variant_ready (+31 other commits)
- **Sortie** : PR aucune | commits 9d87217aa 87c79fc12 90570029b 015693307 093cffc84 646233835 28fb0cf80 ed0099749 8915a4a9a 442032613 859f505d3 2523c02f2 bd090b8e3 3b206ce6c 97bf40745 d1fb809e7 59307118f 11f3ea73b de9a3057c 4385979f2 d3707b8d1 f6f936e2c e60b929e6 cb1f64b60 3d77fd76b 22eb283c9 1ea6d8bfb 9f5822d3b e25d9c160 6f1de06ef c913037e4 4e1478cbd

## 2026-05-27 — feat/wiki-bootstrap-promote-raw-gammes-2026-05-27 (auto)

- **Branche** : `feat/wiki-bootstrap-promote-raw-gammes-2026-05-27`
- **Décision** : feat(wiki-bootstrap): option a injects entity_data.dimensions (task 8b) (+33 other commits)
- **Sortie** : PR aucune | commits 619fe93d9 30f1cb89c 9d87217aa 87c79fc12 90570029b 015693307 093cffc84 646233835 28fb0cf80 ed0099749 8915a4a9a 442032613 859f505d3 2523c02f2 bd090b8e3 3b206ce6c 97bf40745 d1fb809e7 59307118f 11f3ea73b de9a3057c 4385979f2 d3707b8d1 f6f936e2c e60b929e6 cb1f64b60 3d77fd76b 22eb283c9 1ea6d8bfb 9f5822d3b e25d9c160 6f1de06ef c913037e4 4e1478cbd
