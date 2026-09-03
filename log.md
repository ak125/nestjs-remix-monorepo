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

## 2026-06-19 — chore/rag-purge-b8-pipeline-service (auto)

- **Branche** : `chore/rag-purge-b8-pipeline-service`
- **Décision** : chore(rag-proxy): retire RagPipelineService + endpoints pipeline (rag-purge B8)
- **Sortie** : PR aucune | commits f5d45041f

## 2026-06-19 — feat/adr059-pr6-seo-projection-schema (auto)

- **Branche** : `feat/adr059-pr6-seo-projection-schema`
- **Décision** : feat(db): ADR-059 PR-6 — SEO projection schema (7 tables + 2 MV, kg_v3 pattern)
- **Sortie** : PR aucune | commits 3771252c1

## 2026-06-20 — feat/seo-projection-block-content-adapter (auto)

- **Branche** : `feat/seo-projection-block-content-adapter`
- **Décision** : fix(seo-projection): PR-0 — adapt flat wiki export blocks to DB content shape
- **Sortie** : PR aucune | commits a8b79cd87

## 2026-06-20 — feat/seo-projection-block-content-adapter (auto)

- **Branche** : `feat/seo-projection-block-content-adapter`
- **Décision** : feat(seo-brief): D1 — WIKI evidence-driven brief generator core (SeoBriefService, dark) (+2 other commits)
- **Sortie** : PR aucune | commits b4a226f6a 4961b59fa a8b79cd87

## 2026-06-20 — feat/seo-projection-block-content-adapter (auto)

- **Branche** : `feat/seo-projection-block-content-adapter`
- **Décision** : feat(seo-brief): D1 wiring — brief-template uses WIKI evidence brief when flag ON (dark) (+4 other commits)
- **Sortie** : PR aucune | commits 6350b71ff 1d8c45715 b4a226f6a 4961b59fa a8b79cd87

## 2026-06-20 — feat/seo-projection-block-content-adapter (auto)

- **Branche** : `feat/seo-projection-block-content-adapter`
- **Décision** : fix(migration): D1 columns — squawk gate (timeouts + text/bigint) (+7 other commits)
- **Sortie** : PR #1045 | commits cec9dca92 e4df62251 1e61e0792 6350b71ff 1d8c45715 b4a226f6a 4961b59fa a8b79cd87

## 2026-06-20 — feat/media-factory-revive-fetch (auto)

- **Branche** : `feat/media-factory-revive-fetch`
- **Décision** : chore(governance): restore main's deterministic baseline — do NOT bless main's pre-existing SEO ast-grep debt (+11 other commits)
- **Sortie** : PR #1043 | commits c95c5c113 79bd9fb96 66a8a906e 8c2a5e5a8 ef7a98b7f 0b2fade99 03f308e68 b6d0907bc cb857874f 7ff079f64 a0e645f53 e410a5194

## 2026-06-20 — feat/media-factory-revive-fetch (auto)

- **Branche** : `feat/media-factory-revive-fetch`
- **Décision** : Merge remote-tracking branch 'origin/main' into feat/media-factory-revive-fetch (+13 other commits)
- **Sortie** : PR #1043 | commits 341285c3c 029e2eac3 c95c5c113 79bd9fb96 66a8a906e 8c2a5e5a8 ef7a98b7f 0b2fade99 03f308e68 b6d0907bc cb857874f 7ff079f64 a0e645f53 e410a5194

## 2026-06-21 — fix/sitemap-children-dev-parity (auto)

- **Branche** : `fix/sitemap-children-dev-parity`
- **Décision** : fix(sitemap): serve /sitemap*.xml from Node for DEV/PROD edge parity
- **Sortie** : PR #1068 | commits 05ca12857

## 2026-06-21 — fix/sitemap-children-dev-parity (auto)

- **Branche** : `fix/sitemap-children-dev-parity`
- **Décision** : Merge remote-tracking branch 'origin/main' into fix/sitemap-children-dev-parity (+3 other commits)
- **Sortie** : PR #1068 | commits e0bd733a0 77a4a82ca 59b7e510f 05ca12857

## 2026-06-21 — fix/rpc-drift-maintenance-adr032 (auto)

- **Branche** : `fix/rpc-drift-maintenance-adr032`
- **Décision** : fix(diagnostic): apply ADR-032 PR-1 maintenance kg_* RPCs (runtime-truth-p0 drift)
- **Sortie** : PR #1084 | commits 0a25d1b80

## 2026-06-22 — fix/client-ip-429-throttle (auto)

- **Branche** : `fix/client-ip-429-throttle`
- **Décision** : Merge remote-tracking branch 'origin/main' into fix/client-ip-429-throttle (+10 other commits)
- **Sortie** : PR #1097 | commits 7b58ac6d1 5bb95cac4 951bb51ab fb7fe4dff 349d7653b 9414165c8 f74cac270 2c8179fa0 3ad43e1f4 6047cf3c9 1334a4234

## 2026-06-23 — feat/rr8-prep-sentry-decouple (auto)

- **Branche** : `feat/rr8-prep-sentry-decouple`
- **Décision** : refactor(observability): single server Sentry SDK — decouple SSR from React Router (prep RR8)
- **Sortie** : PR #1116 | commits 33a3c6a44

## 2026-06-23 — feat/rr8-prep-sentry-decouple (auto)

- **Branche** : `feat/rr8-prep-sentry-decouple`
- **Décision** : chore(canon): align dep-governance Sentry ids (owner) (+2 other commits)
- **Sortie** : PR #1116 | commits 5233664db c583c9cfa 33a3c6a44

## 2026-06-23 — feat/rr8-prep-a6-middleware (auto)

- **Branche** : `feat/rr8-prep-a6-middleware`
- **Décision** : feat(rr8-prep): A6 — adopt future.v8_middleware + RouterContextProvider bridge (RR7.18)
- **Sortie** : PR #1124 | commits 75dfb7275

## 2026-06-24 — worktree-feat+pr9e1-session-store-abstraction (auto)

- **Branche** : `worktree-feat+pr9e1-session-store-abstraction`
- **Décision** : refactor(session): encapsulate store in SessionStoreService (PR-9e.1) (+1 other commit)
- **Sortie** : PR aucune | commits 5cbe8a899 96db34e5f

## 2026-06-24 — worktree-feat+pr9e1-session-store-abstraction (auto)

- **Branche** : `worktree-feat+pr9e1-session-store-abstraction`
- **Décision** : chore(registry): map backend/src/modules/session/** ownership (D11/auth-team) (+3 other commits)
- **Sortie** : PR aucune | commits bd7d1a547 3670bc1b7 5cbe8a899 96db34e5f

## 2026-06-25 — worktree-feat+pr9e2-session-impl-swap (auto)

- **Branche** : `worktree-feat+pr9e2-session-impl-swap`
- **Décision** : feat(session): swap session store to connect-redis@9 + node-redis v5, fail-fast boot (PR-9e.2)
- **Sortie** : PR aucune | commits 9e8a273bb

## 2026-06-25 — feat/seo-a1a-observe-placeholder-events (auto)

- **Branche** : `feat/seo-a1a-observe-placeholder-events`
- **Décision** : feat(seo): A1a-observe — make silent placeholder strip + runtime fallback observable
- **Sortie** : PR #1146 | commits d949b723e

## 2026-06-25 — feat/seo-a1a-observe-placeholder-events (auto)

- **Branche** : `feat/seo-a1a-observe-placeholder-events`
- **Décision** : fix(seo): A1a-observe CI gates — prettier format + role-purity skip on aggregator module (+2 other commits)
- **Sortie** : PR #1146 | commits 4b3d6ffb9 427927bdc d949b723e

## 2026-06-25 — feat/seo-a1d-sanitize-editorial-sgcontent (auto)

- **Branche** : `feat/seo-a1d-sanitize-editorial-sgcontent`
- **Décision** : fix(seo): A1d — sanitize sg_content editorial HTML at the render boundary (latent stored-XSS)
- **Sortie** : PR #1151 | commits bc3821665

## 2026-06-25 — feat/seo-a1d-sanitize-editorial-sgcontent (auto)

- **Branche** : `feat/seo-a1d-sanitize-editorial-sgcontent`
- **Décision** : Merge branch 'feat/seo-a1d-sanitize-editorial-sgcontent' of https://github.com/ak125/nestjs-remix-monorepo into feat/seo (+4 other commits)
- **Sortie** : PR #1151 | commits 89db0ec7d ea2fe82e7 ccb2b15e4 e45eddf2b bc3821665
## 2026-06-25 — fix/catchall-data-suffix-redirects (auto)

- **Branche** : `fix/catchall-data-suffix-redirects`
- **Décision** : fix(catch-all): strip RR8 .data suffix so legacy 301 redirects fire on client-nav
- **Sortie** : PR #1150 | commits 601ee8c43

## 2026-06-25 — feat/pr9f-nestjs11 (auto)

- **Branche** : `feat/pr9f-nestjs11`
- **Décision** : chore(registry): register backend/src/common/{utils,decorators} ownership (PR-9f, owner-applied) (+1 other commit)
- **Sortie** : PR #1152 | commits bffbf89f9 e74b57c6d

## 2026-06-26 — feat/tw4-gate-0-visual-gate (auto)

- **Branche** : `feat/tw4-gate-0-visual-gate`
- **Décision** : feat(tw4-gate-0): wire authoritative visual-regression gate + 2-tier snapshot topology
- **Sortie** : PR #1160 | commits 83de3e0f5

## 2026-06-26 — fix/visual-gate-recapture-preprod (auto)

- **Branche** : `fix/visual-gate-recapture-preprod`
- **Décision** : fix(tw4-gate-0): purge root-owned Docker leftovers pre-checkout + fix report path (+1 other commit)
- **Sortie** : PR #1170 | commits f94b7ad9d 9a7f2acc0

## 2026-06-26 — fix/visual-gate-recapture-preprod (auto)

- **Branche** : `fix/visual-gate-recapture-preprod`
- **Décision** : feat(tw4-gate-0): re-capture 11 visual baselines against PREPROD:3200 (gate env) (+3 other commits)
- **Sortie** : PR #1170 | commits 023c2a43f d8bc28dad f94b7ad9d 9a7f2acc0

## 2026-06-27 — feat/wiki-exports-seo-generate-ci (auto)

- **Branche** : `feat/wiki-exports-seo-generate-ci`
- **Décision** : feat(ci): generate exports/seo from wiki canon + commit back (ADR-059 PR-5a)
- **Sortie** : PR #1174 | commits c7ee94b18

## 2026-06-27 — feat/wiki-exports-seo-generate-ci (auto)

- **Branche** : `feat/wiki-exports-seo-generate-ci`
- **Décision** : fix(ci): exports-seo generator — ajv-formats, untracked+deletion gate, gitignore assert (review) (+2 other commits)
- **Sortie** : PR #1174 | commits f84c8af9d ad8e84d0a c7ee94b18

## 2026-06-27 — feat/tw2-tailwind4-engine (auto)

- **Branche** : `feat/tw2-tailwind4-engine`
- **Décision** : feat(tw-2): install Tailwind CSS v4.3.1 (engine swap, @config bridge, @tailwindcss/vite)
- **Sortie** : PR #1181 | commits fe3aef3b8

## 2026-06-27 — fix/home-translate-no-removechild (auto)

- **Branche** : `fix/home-translate-no-removechild`
- **Décision** : fix(home): translate="no" sur widgets interactifs — stoppe le crash removeChild dû à la traduction navigateur
- **Sortie** : PR aucune | commits bda4ee6d5

## 2026-07-01 — fix/lazy-rolldown-mixed-import (auto)

- **Branche** : `fix/lazy-rolldown-mixed-import`
- **Décision** : fix(lazy): stop Footer mixed static+dynamic import crashing R2 pages (Rolldown fulfill-undefined)
- **Sortie** : PR #1200 | commits 4c536b958

## 2026-07-04 — docs/claude-md-slim (auto)

- **Branche** : `docs/claude-md-slim`
- **Décision** : docs(claude-md): slim referential sections into pointers (P1/P3 token lever)
- **Sortie** : PR aucune | commits e34d4ee5c

## 2026-07-05 — fix/ios16-webkit-lookbehind-crash (auto)

- **Branche** : `fix/ios16-webkit-lookbehind-crash`
- **Décision** : fix(frontend): WebKit <16.4 regex lookbehind crash on iOS (Sentry PROD)
- **Sortie** : PR aucune | commits c2fbda72e

## 2026-07-05 — fix/ios16-webkit-lookbehind-crash (auto)

- **Branche** : `fix/ios16-webkit-lookbehind-crash`
- **Décision** : fix(frontend): harden gamme-autolink tokenizer (adversarial-verify findings) (+2 other commits)
- **Sortie** : PR aucune | commits 08adf15c7 541181a61 c2fbda72e

## 2026-07-06 — feat/tranche-b1b-no-new-unowned-served-write (auto)

- **Branche** : `feat/tranche-b1b-no-new-unowned-served-write`
- **Décision** : feat(audit): served-content write-sink ratchet — block-new gate (Tranche B1b)
- **Sortie** : PR #1238 | commits 149bb3a10

## 2026-07-06 — feat/tranche-b1b-no-new-unowned-served-write (auto)

- **Branche** : `feat/tranche-b1b-no-new-unowned-served-write`
- **Décision** : fix(audit): close 3 ratchet gaps — occurrence-count, removed=fail, SQL DELETE/TRUNCATE (Tranche B1b, #1238 review) (+2 other commits)
- **Sortie** : PR #1238 | commits fe47346d4 a534d23b6 149bb3a10

## 2026-07-14 — fix/payment-tunnel-guest-session (auto)

- **Branche** : `fix/payment-tunnel-guest-session`
- **Décision** : fix(checkout): redirect Paybox depuis la réponse du POST — plus de re-GET au cookie invalidé
- **Sortie** : PR #1256 | commits 67833d2b5

## 2026-07-14 — fix/payment-tunnel-guest-session (auto)

- **Branche** : `fix/payment-tunnel-guest-session`
- **Décision** : test(checkout): intégration action guest — invariant zéro re-GET après le POST (+2 other commits)
- **Sortie** : PR #1256 | commits 0de18a874 6a877c503 67833d2b5

## 2026-07-14 — fix/frontend-interactive-list-keys (auto)

- **Branche** : `fix/frontend-interactive-list-keys`
- **Décision** : fix(frontend): stable keys on interactive lists (admin.seo checklist + AI generator rows)
- **Sortie** : PR #1263 | commits 6990bc13f

## 2026-07-14 — feat/attribution-beacon-cache-cutover-prA (auto)

- **Branche** : `feat/attribution-beacon-cache-cutover-prA`
- **Décision** : feat(analytics): déplace l'attribution first-touch GET→POST beacon (cutover cache HTML, PR A)
- **Sortie** : PR #1271 | commits 7f288d9da

## 2026-07-15 — fix/substitution-fail-open-on-rpc-error (auto)

- **Branche** : `fix/substitution-fail-open-on-rpc-error`
- **Décision** : fix(migration): add statement_timeout + lock_timeout guards (squawk migration-safety) (+2 other commits)
- **Sortie** : PR #1148 | commits d04a1b2e8 68b87e00b 9044444c4

## 2026-07-15 — feat/p2r3b-producer (auto)

- **Branche** : `feat/p2r3b-producer`
- **Décision** : feat(seo-projection): durable reproducible snapshot producer + role-scoped writer (P2-R3-B)
- **Sortie** : PR aucune | commits a5434bb61

## 2026-07-15 — feat/p2r3b-producer (auto)

- **Branche** : `feat/p2r3b-producer`
- **Décision** : fix(seo-projection): idempotent regress-draft, per-run manifest, empty-export guard (+2 other commits)
- **Sortie** : PR #1282 | commits b7f8c7601 18ae1a0ed 91d7a7dbd

## 2026-07-16 — feat/c0-projection-read-module (auto)

- **Branche** : `feat/c0-projection-read-module`
- **Décision** : feat(seo-projection): extract dark projection reader (C0, behavior-identical)
- **Sortie** : PR #1284 | commits 6c5d82c82

## 2026-07-16 — feat/p2-r3c-projection-r3-mapper (auto)

- **Branche** : `feat/p2-r3c-projection-r3-mapper`
- **Décision** : feat(seo-projection): add dark r3 projection mapper (P2-R3-C, pure)
- **Sortie** : PR #1286 | commits 645e33eea

## 2026-07-18 — feat/runtime-verification-contract (auto)

- **Branche** : `feat/runtime-verification-contract`
- **Décision** : docs(agent-method): add thin runtime-verification proof contract (§9 + PR template)
- **Sortie** : PR #1293 | commits b06e869a9

## 2026-07-26 — chore/ts7-shadow-parity (auto)

- **Branche** : `chore/ts7-shadow-parity`
- **Décision** : chore(audit): ts6/ts7 shadow parity harness, observation-only, 0 lockfile mutation
- **Sortie** : PR #1318 | commits 23a3e4e94

## 2026-07-27 — chore/ts7-shadow-parity (auto)

- **Branche** : `chore/ts7-shadow-parity`
- **Décision** : docs(audit): matrix returns NO-GO for the node10 line removal (+4 other commits)
- **Sortie** : PR #1318 | commits 03a7834fa 39330f86e 864633cc6 30381040c 23a3e4e94

## 2026-07-27 — fix/size-limit-initial-load-globs (auto)

- **Branche** : `fix/size-limit-initial-load-globs`
- **Décision** : fix(perf): make the initial-load budget measure the real initial load
- **Sortie** : PR #1319 | commits 056e886a6

## 2026-07-27 — fix/size-limit-initial-load-globs (auto)

- **Branche** : `fix/size-limit-initial-load-globs`
- **Décision** : fix(perf): tolerate sub-KB initial-load chunk churn, keep the blind-spot check strict (+2 other commits)
- **Sortie** : PR #1319 | commits a40f91283 17c644a5a 056e886a6

## 2026-09-03 — fix+ledger-probe-truly-readonly (auto)

- **Branche** : `fix+ledger-probe-truly-readonly`
- **Décision** : fix(migrations): rendre la sonde de fraîcheur réellement en lecture seule + résumé exploitable
- **Sortie** : PR #1387 | commits ac9227a4e

## 2026-09-03 — feat+engine-reapply-drifted-migration (auto)

- **Branche** : `feat+engine-reapply-drifted-migration`
- **Décision** : feat(migrations): --reapply — réparer une ligne en drift par exécution, pas par affirmation
- **Sortie** : PR #1389 | commits 9601898bf

## 2026-09-04 — fix+migrations-preserve-search-path-and-acl (auto)

- **Branche** : `fix+migrations-preserve-search-path-and-acl`
- **Décision** : fix(migrations): préserver search_path et ACL dans deux migrations en attente
- **Sortie** : PR #1391 | commits 6720119db
