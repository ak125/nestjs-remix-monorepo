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
- **Décision** : fix(migrations): désigner l'instruction par son nom, pas par son numéro de ligne (+2 other commits)
- **Sortie** : PR #1391 | commits 04c4d72f1 e70ad7c79 6720119db

## 2026-09-04 — chore/codex-agents-md-bootstrap (auto)

- **Branche** : `chore/codex-agents-md-bootstrap`
- **Décision** : docs(agents): amorcer Codex sur le canon via un AGENTS.md racine pointeur
- **Sortie** : PR aucune | commits 64e534ecb

## 2026-09-04 — fix/fabricated-rpc-safety-gate-reference (auto)

- **Branche** : `fix/fabricated-rpc-safety-gate-reference`
- **Décision** : docs(governance): retirer une référence de gate fabriquée, nommer les vrais carriers
- **Sortie** : PR #1392 | commits 5ce3cc612

## 2026-09-04 — fix/20260529-idempotent-concurrent-index (auto)

- **Branche** : `fix/20260529-idempotent-concurrent-index`
- **Décision** : fix(migrations): rendre 20260529 idempotent sur le SECOND index aussi
- **Sortie** : PR #1393 | commits d238d79ec

## 2026-09-04 — fix/engine-retry-failed-migration (auto)

- **Branche** : `fix/engine-retry-failed-migration`
- **Décision** : fix(migrations): --retry pour une migration en échec + lever le timeout hérité
- **Sortie** : PR #1395 | commits 09dd81c97

## 2026-09-07 — docs/guardrails-silenced-guard-mirror-case

- **Branche** : `docs/guardrails-silenced-guard-mirror-case`
- **Décision** : docs(guardrails): le cas miroir — une garde juste réduite au silence par un motif faux (passes 5–6) + entrées log.md #1392/#1393/#1395
- **Sortie** : PR #1398 | commits 233a9e3a5

## 2026-09-07 — fix/migration-engine-closure-gaps

- **Branche** : `fix/migration-engine-closure-gaps`
- **Décision** : clôture 20260529 — note de reprise avec `git_sha`, trace CI vivante (`PYTHONUNBUFFERED`), README projeté depuis l'engine
- **Sortie** : PR #1399 | commits bf263d73d 1d84a4fbe 5357ac0c8 (+ correctifs revue)

## 2026-09-07 — chore/types-resync-supabase-generated (auto)

- **Branche** : `chore/types-resync-supabase-generated`
- **Décision** : chore(types): resync des types Supabase générés (MCP) — catch-up dédié après 20260611
- **Sortie** : PR #1401 | commits b3c9c1c85

## 2026-09-07 — fix/payment-tunnel-alerting-rules (auto)

- **Branche** : `fix/payment-tunnel-alerting-rules`
- **Décision** : fix(monitoring): la règle qui aurait vu la panne de 8 semaines, et la fin des doubles alertes
- **Sortie** : PR aucune | commits 4cd98c0b3

## 2026-09-07 — fix/payment-tunnel-alerting-rules (auto)

- **Branche** : `fix/payment-tunnel-alerting-rules`
- **Décision** : chore(registry): ownership D11 pour les dossiers d'incident et le runbook paiement (+2 other commits)
- **Sortie** : PR #1413 | commits 6429b40a5 9f1790ef3 c9f26ee75

## 2026-09-07 — security/tecdoc-api-surface-lockdown (auto)

- **Branche** : `security/tecdoc-api-surface-lockdown`
- **Décision** : chore(registry): resync L1+L3 projections (+1 other commit)
- **Sortie** : PR #1414 | commits 6343b3f5e 297d6c3b3

## 2026-09-08 — feat/tecdoc-pipeline-recovery (auto)

- **Branche** : `feat/tecdoc-pipeline-recovery`
- **Décision** : feat(tecdoc): rapatrier les 16 scripts du pipeline et instrumenter le rejeu source-truth
- **Sortie** : PR #1417 | commits ae0871d03

## 2026-09-08 — feat/tecdoc-pipeline-recovery (auto)

- **Branche** : `feat/tecdoc-pipeline-recovery`
- **Décision** : docs(tecdoc): consigner le piege latent de derivation du DLNR par str.replace (+2 other commits)
- **Sortie** : PR #1417 | commits 9c4b7640f b1dd9aa25 ae0871d03

## 2026-09-08 — feat/tecdoc-rebuild-environment (auto)

- **Branche** : `feat/tecdoc-rebuild-environment`
- **Décision** : feat(tecdoc): spécifier et outiller l'environnement de rebuild isolé (~250 Go)
- **Sortie** : PR #1419 | commits e4d4f650e

## 2026-09-09 — feat/tecdoc-rebuild-environment (auto)

- **Branche** : `feat/tecdoc-rebuild-environment`
- **Décision** : feat(tecdoc): rejeu par vagues — le pic disque passe de 250 Go à ~5 Go, et la preuve survit à la donnée (+2 other commits)
- **Sortie** : PR #1419 | commits 647dc5b6a 01bd9a0c8 e4d4f650e

## 2026-09-09 — feat/tecdoc-rebuild-environment (auto)

- **Branche** : `feat/tecdoc-rebuild-environment`
- **Décision** : feat(ops): rotation d'identifiant de base par le chemin supporté, et le piège qu'il évite (+4 other commits)
- **Sortie** : PR #1419 | commits 716c4085c e28197c57 647dc5b6a 01bd9a0c8 e4d4f650e

## 2026-09-09 — feat/tecdoc-rebuild-environment (auto)

- **Branche** : `feat/tecdoc-rebuild-environment`
- **Décision** : fix(ops): vérifier le jeton avant d'engendrer un secret, et nommer le piège du collage (+6 other commits)
- **Sortie** : PR #1419 | commits c67f82a31 fed9560b8 716c4085c e28197c57 647dc5b6a 01bd9a0c8 e4d4f650e

## 2026-09-09 — feat/tecdoc-rebuild-environment (auto)

- **Branche** : `feat/tecdoc-rebuild-environment`
- **Décision** : fix(ops): le script demande le jeton lui-même — la voie en deux temps échouait (+8 other commits)
- **Sortie** : PR #1419 | commits a2d53a7bc 0a0ebbd79 c67f82a31 fed9560b8 716c4085c e28197c57 647dc5b6a 01bd9a0c8 e4d4f650e

## 2026-09-09 — feat/tecdoc-rebuild-environment (auto)

- **Branche** : `feat/tecdoc-rebuild-environment`
- **Décision** : fix(ops): le préflight éprouvait la mauvaise permission — il aurait bloqué les jetons bien réglés (+10 other commits)
- **Sortie** : PR #1419 | commits 3cb6996f2 bb0a1cc46 a2d53a7bc 0a0ebbd79 c67f82a31 fed9560b8 716c4085c e28197c57 647dc5b6a 01bd9a0c8 e4d4f650e

## 2026-09-09 — feat/tecdoc-rebuild-environment (auto)

- **Branche** : `feat/tecdoc-rebuild-environment`
- **Décision** : fix(ops): le client HTTP ne s'annonçait pas — la requête n'atteignait jamais l'API (+12 other commits)
- **Sortie** : PR #1419 | commits 8564bded9 0e1b6456e 3cb6996f2 bb0a1cc46 a2d53a7bc 0a0ebbd79 c67f82a31 fed9560b8 716c4085c e28197c57 647dc5b6a 01bd9a0c8 e4d4f650e

## 2026-09-09 — feat/tecdoc-rebuild-environment (auto)

- **Branche** : `feat/tecdoc-rebuild-environment`
- **Décision** : feat(tecdoc): porte de capacite a deux modes, et un registre de preuve recalculable (+14 other commits)
- **Sortie** : PR #1419 | commits f73b300c0 d6f3e94a1 93bd601eb a3ec3a602 45e8c6402 fc222949f f1994b30d 08d28175b 5650961cf b4408e7b1 fb9bcd355 90358994c d348f3eec 098be7744 c1ee2d690

## 2026-09-11 — worktree-fix-dev-vite-hmr-single-port (auto)

- **Branche** : `worktree-fix-dev-vite-hmr-single-port`
- **Décision** : fix(dev): faire passer le HMR Vite par le port 3000 (redirection de port)
- **Sortie** : PR #1444 | commits f9e35866a

## 2026-09-11 — fix/cron-report-dead-channel (auto)

- **Branche** : `fix/cron-report-dead-channel`
- **Décision** : fix(ops): rendre visibles les échecs des crons — leur canal visait une table supprimée
- **Sortie** : PR #1448 | commits 54a543157

## 2026-09-11 — fix/cron-alert-only-to-state (auto)

- **Branche** : `fix/cron-alert-only-to-state`
- **Décision** : fix(ops): une alerte qui n'interrompt pas un tick cron n'est plus enregistrée « ok »
- **Sortie** : PR #1450 | commits 2d31f7a34

## 2026-09-11 — fix/dev-shutdown-grace-period (auto)

- **Branche** : `fix/dev-shutdown-grace-period`
- **Décision** : chore(registry): régénérer les projections après le formatage de la borne d'arrêt (+3 other commits)
- **Sortie** : PR #1452 | commits 45657eaab 33059d07a 4b750ec63 b61bb42df

## 2026-09-11 — fix/dev-shutdown-comment-bull (auto)

- **Branche** : `fix/dev-shutdown-comment-bull`
- **Décision** : docs(dev): borne d'arrêt DEV — c'est le close() de Bull qui attendait le crawl, pas @nestjs/bullmq
- **Sortie** : PR aucune | commits 5d395718b

## 2026-09-11 — fix/seo-measure-robots-markers

- **Branche** : `fix/seo-measure-robots-markers`
- **Décision** : audit des 7 leviers SEO — ingestion GSC rattrapable et certifiable, robots via source unique, garde des marqueurs R2, META conseils filtrées ; rapport `audit/seo-sept-leviers-2026-09-11.md`.
- **Sortie** : PR à ouvrir | 2 migrations NON appliquées | garde admin livrée séparément (#1460, en PROD par le tag `v2026.09.11-cwv-sanitizer-admin-guard`).

## 2026-09-16 — fix/cwv-trend-detector-vacancy-signal (auto)

- **Branche** : `fix/cwv-trend-detector-vacancy-signal`
- **Décision** : rendre observable la cécité de `detect_cwv_trend_divergence` — la garde tournait 7/7 `succeeded` avec 0 ligne de référence éligible, donc incapable d'alerter ; elle signale désormais ses clés aveugles et referme son alerte quand la couverture revient.
- **Sortie** : PR #1498 | commits f3beecf1c 3475070af e8344865b | migration NON appliquée (owner, chemin ledger) | test 48 assertions + 10/10 mutants tués

## 2026-09-16 — fix/cwv-trend-detector-vacancy-signal (auto)

- **Branche** : `fix/cwv-trend-detector-vacancy-signal`
- **Décision** : chore(registry): resync L1+L3 projections (+3 other commits)
- **Sortie** : PR #1498 | commits e8344865b 3475070af 2b464b8bc f3beecf1c

## 2026-09-17 — fix/cart-sellable-price (auto)

- **Branche** : `fix/cart-sellable-price`
- **Décision** : chore(ownership): glob pour le service de tarif — owner-directed override (+6 other commits)
- **Sortie** : PR #1499 | commits 72c208470 e475cdeca c282f3409 2c4496caf 639f0acd5 2c8601673 679a179cf

## 2026-09-17 — fix/cart-sellable-price (auto)

- **Branche** : `fix/cart-sellable-price`
- **Décision** : chore(registry): resync L1+L3 projections (+9 other commits)
- **Sortie** : PR #1499 | commits 48c29f041 c28cbe722 d1ed178a6 72c208470 e475cdeca c282f3409 2c4496caf 639f0acd5 2c8601673 679a179cf

## 2026-09-17 — fix/db-inventory-sql-lexer (auto)

- **Branche** : `fix/db-inventory-sql-lexer`
- **Décision** : chore(registry): régénérer les projections après correction des deux scanners (+4 other commits)
- **Sortie** : PR #1502 | commits dc63271ff 8b5bf6168 b17d65f64 2f5dcf4d5 fde67c138

## 2026-09-17 — fix/db-inventory-sql-lexer (auto)

- **Branche** : `fix/db-inventory-sql-lexer`
- **Décision** : chore(audit): resync deep-inventory + PR-8 projections (+7 other commits)
- **Sortie** : PR #1502 | commits 0823facd5 1ac6a228d ab9ef3527 dc63271ff 8b5bf6168 b17d65f64 2f5dcf4d5 fde67c138

## 2026-09-17 — fix/db-inventory-constant-resolution (auto)

- **Branche** : `fix/db-inventory-constant-resolution`
- **Décision** : chore(audit): resync des artefacts PR-8 après changement du canonical (+13 other commits)
- **Sortie** : PR #1506 | commits 04805e48b 13deb3836 c66b59106 6d710d7eb c5e2eab16 5e032b92f 0823facd5 1ac6a228d ab9ef3527 dc63271ff 8b5bf6168 b17d65f64 2f5dcf4d5 fde67c138

## 2026-09-17 — chore/secrets-detection-before-rotation

- **Branche** : `chore/secrets-detection-before-rotation`
- **Décision** : détecter un secret de paiement AVANT publication — moteur par empreinte (inerte sans données) + 2 règles de FORME sur les LIGNES AJOUTÉES, câblées en pre-commit (bloquant) et en CI. Scan d'ajout et non d'état : aucun inventaire des porteurs, donc rien à publier sur un dépôt public avant rotation.
- **Sortie** : PR #1511 | resync registry L1+L3 + ré-épinglage inventaire PR-8 (262 candidats inchangés, vérifié champ à champ)

## 2026-09-23 — fix/cart-items-client-errors-4xx (auto)

- **Branche** : `fix/cart-items-client-errors-4xx`
- **Décision** : fix(cart): répondre 4xx aux erreurs du client sur /api/cart/items
- **Sortie** : PR #1531 | commits 093a9ef9e

## 2026-09-23 — fix/cart-items-client-errors-4xx (auto)

- **Branche** : `fix/cart-items-client-errors-4xx`
- **Décision** : chore(registry): resync L1+L3 projections (+2 other commits)
- **Sortie** : PR #1531 | commits 160cb00fd 403523ded 093a9ef9e

## 2026-09-23 — fix/og-imgproxy-supabase-source (auto)

- **Branche** : `fix/og-imgproxy-supabase-source`
- **Décision** : fix(seo): og:image imgproxy — source sur l'origine Supabase autorisée
- **Sortie** : PR #1533 | commits 794de9716

## 2026-09-23 — revert/ga4-explicit-consent-1524 (auto)

- **Branche** : `revert/ga4-explicit-consent-1524`
- **Décision** : chore(registry): resync L1+L3 projections (+1 other commit)
- **Sortie** : PR #1535 | commits 4a0f90e2f bae442aec

## 2026-09-23 — fix/account-order-cancel (auto)

- **Branche** : `fix/account-order-cancel`
- **Décision** : fix(orders): réparer le bouton « Annuler la commande » de l'espace client
- **Sortie** : PR aucune | commits 57d984086

## 2026-09-24 — fix/account-order-cancel (auto)

- **Branche** : `fix/account-order-cancel`
- **Décision** : Merge remote-tracking branch 'origin/main' into fix/account-order-cancel (+3 other commits)
- **Sortie** : PR #1536 | commits 8d71e7fb0 2731f31ca 44a632308 57d984086

## 2026-09-24 — feat/seo-collector-prod-secrets (auto)

- **Branche** : `feat/seo-collector-prod-secrets`
- **Décision** : merge: origin/main (15c66177a, #1536) dans feat/seo-collector-prod-secrets (+5 other commits)
- **Sortie** : PR #1534 | commits bf8acdbf8 47d1dcbf9 3d82d3c38 47a655e37 c019558dc f52d20406

## 2026-09-24 — fix/ga4-skip-automated-browsers (auto)

- **Branche** : `fix/ga4-skip-automated-browsers`
- **Décision** : chore(registry): resync L1+L3 projections (+1 other commit)
- **Sortie** : PR #1538 | commits 2af384d09 ef2a1e977

## 2026-09-24 — fix/support-module-authz (auto)

- **Branche** : `fix/support-module-authz`
- **Décision** : chore(registry): resync L1+L3 projections (+1 other commit)
- **Sortie** : PR #1557 | commits a8ec8d4b7 3ee45fb2f

## 2026-09-24 — fix/auth-staff-session (auto)

- **Branche** : `fix/auth-staff-session`
- **Décision** : chore(registry): resync L1+L3 projections (+4 other commits)
- **Sortie** : PR aucune | commits b6814b55e f1e2df4cb 391c458c5 05dd8c95f f74215a56
