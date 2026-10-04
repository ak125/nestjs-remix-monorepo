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

## 2026-09-24 — fix/auth-staff-session (auto)

- **Branche** : `fix/auth-staff-session`
- **Décision** : chore(registry): resync L1+L3 projections (+4 other commits)
- **Sortie** : PR aucune | commits b6814b55e f1e2df4cb 391c458c5 05dd8c95f f74215a56

## 2026-09-24 — fix/auth-staff-session (auto)

- **Branche** : `fix/auth-staff-session`
- **Décision** : chore(registry): resync L1+L3 projections (+7 other commits)
- **Sortie** : PR #1561 | commits 796872024 1ba0da783 e015619ab b6814b55e f1e2df4cb 391c458c5 05dd8c95f f74215a56

## 2026-09-29 — ci/deploy-prod-require-preprod-smokes (auto)

- **Branche** : `ci/deploy-prod-require-preprod-smokes`
- **Décision** : chore(registry): resync L1+L3 projections (+2 fichiers scripts/ci) (+1 other commit)
- **Sortie** : PR #1598 | commits ef976d67e e6bfe2ddf

## 2026-09-29 — Fermeture DEFINER authenticated + extensions ops

- **Branche** : `fix/db-definer-authenticated-lockdown`
- **Décision** : les 72 RPC SECURITY DEFINER exécutables par authenticated seul sont révoquées par migration forward répétée en transaction annulée (0 restante), et les extensions ops passent par une PR séparée ; application par workflow après fusion owner.
- **Sortie** : PRs #1606 #1604 | commits 627496f3a a167474a0 | fichiers `backend/supabase/migrations/20260929_definer_rpc_authenticated_lockdown.sql`


## 2026-09-29 — fix/db-definer-authenticated-lockdown (auto)

- **Branche** : `fix/db-definer-authenticated-lockdown`
- **Décision** : docs(log): consigner la fermeture DEFINER authenticated (+2 other commits)
- **Sortie** : PR #1606 | commits fed13193f a167474a0 627496f3a

## 2026-09-29 — fix/db-drop-exact-duplicate-indexes (auto)

- **Branche** : `fix/db-drop-exact-duplicate-indexes`
- **Décision** : fix(db): retirer 7 index strictement dupliqués que le planificateur n'utilise pas
- **Sortie** : PR #1619 | commits 69b17b6d4

## 2026-09-30 — fix/db-pieces-price-duplicate-indexes (auto)

- **Branche** : `fix/db-pieces-price-duplicate-indexes`
- **Décision** : chore(registry): régénérer les projections pour la migration des doublons pieces_price (+1 other commit)
- **Sortie** : PR #1623 | commits f27dbb22e 3745a40da

## 2026-09-30 — fix/db-pieces-price-duplicate-indexes (auto)

- **Branche** : `fix/db-pieces-price-duplicate-indexes`
- **Décision** : chore(registry): couvrir la migration des doublons pieces_price dans ownership.yaml (+3 other commits)
- **Sortie** : PR #1623 | commits 723c42a30 af3b4c2cd f27dbb22e 3745a40da

## 2026-09-29 — fix/r6-buying-guide-rag-write-gate (auto)

- **Branche** : `fix/r6-buying-guide-rag-write-gate`
- **Décision** : chore(audit): baseline served-content-write-sinks 61 → 60 (fermeture R6) (+3 other commits)
- **Sortie** : PR #1615 | commits 729e5b178 fd26693a0 70208ce18 76de4e601

## 2026-09-30 — fix/deploy-prod-evidence-commit-scoped (auto)

- **Branche** : `fix/deploy-prod-evidence-commit-scoped`
- **Décision** : chore(registry): resync L1+L3 projections (+1 other commit)
- **Sortie** : PR #1625 | commits 7cfcb5a9f cabcecf98

## 2026-09-29 — fix/ci-r2-timing-real-product-page (auto)

- **Branche** : `fix/ci-r2-timing-real-product-page`
- **Décision** : chore(registry): resync L1+L3 projections (+1 other commit)
- **Sortie** : PR #1605 | commits f19027cf3 a89786344
## 2026-09-30 — perf/db-auto-type-codes-int-expr-indexes (auto)

- **Branche** : `perf/db-auto-type-codes-int-expr-indexes`
- **Décision** : docs(db): heure réelle de la mesure dans l'en-tête de la migration (15:10Z, pas 15:30Z) (+2 other commits)
- **Sortie** : PR #1628 | commits 47c12cda9 d8949a046 2def4654a

## 2026-09-30 — perf/db-auto-type-codes-int-expr-indexes (auto)

- **Branche** : `perf/db-auto-type-codes-int-expr-indexes`
- **Décision** : Merge origin/main into perf/db-auto-type-codes-int-expr-indexes (+4 other commits)
- **Sortie** : PR #1628 | commits ae753efc0 7f2063c85 47c12cda9 d8949a046 2def4654a

## 2026-09-30 — perf/db-auto-type-codes-int-expr-indexes (auto)

- **Branche** : `perf/db-auto-type-codes-int-expr-indexes`
- **Décision** : Merge origin/main into perf/db-auto-type-codes-int-expr-indexes (+6 other commits)
- **Sortie** : PR #1628 | commits 8f8b95fc4 eff332dc2 ae753efc0 7f2063c85 47c12cda9 d8949a046 2def4654a

## 2026-09-30 — chore/skills-procedures-2026-09-30 (auto)

- **Branche** : `chore/skills-procedures-2026-09-30`
- **Décision** : docs(skills): aligner skills et procédures agent sur l'état réel du dépôt
- **Sortie** : PR aucune | commits f307cf3a8

## 2026-09-30 — fix/db-drop-duplicate-unique-keys (auto)

- **Branche** : `fix/db-drop-duplicate-unique-keys`
- **Décision** : chore(registry): régénérer les projections pour 20260930_drop_duplicate_unique_keys (+2 other commits)
- **Sortie** : PR #1641 | commits 733c545cc 213f60109 d40297c3c

## 2026-09-30 — fix/db-pin-mark-order-paid-atomic-search-path (auto)

- **Branche** : `fix/db-pin-mark-order-paid-atomic-search-path`
- **Décision** : fix(db): épingler le search_path de mark_order_paid_atomic (public, pg_temp)
- **Sortie** : PR #1643 | commits fd1009783

## 2026-10-01 — fix/db-pin-mark-order-paid-atomic-search-path (auto)

- **Branche** : `fix/db-pin-mark-order-paid-atomic-search-path`
- **Décision** : chore(registry): régénérer les projections pour 20260930_pin_mark_order_paid_atomic_search_path (+4 other commits)
- **Sortie** : PR #1643 | commits e427eab4d b2ce1a3d0 c2af88e77 f54f272f1 fd1009783

## 2026-10-01 — fix/db-pin-order-functions-search-path (auto)

- **Branche** : `fix/db-pin-order-functions-search-path`
- **Décision** : Merge remote-tracking branch 'origin/main' into fix/db-pin-order-functions-search-path (+5 other commits)
- **Sortie** : PR #1648 | commits 21f3973c5 43ebaabad 4b299c317 f79054304 442b371ce 0c0c9571a

## 2026-10-01 — fix/db-drop-pieces-price-unused-indexes (auto)

- **Branche** : `fix/db-drop-pieces-price-unused-indexes`
- **Décision** : chore(ownership): glob de 20261001_drop_pieces_price_unused_indexes (owner-directed override) (+4 other commits)
- **Sortie** : PR #1649 | commits 4d1ba50e1 db3e2e2cc 6732ed805 7a575a5d9 a8683258e

## 2026-10-01 — fix/db-drop-pieces-price-unused-indexes (auto)

- **Branche** : `fix/db-drop-pieces-price-unused-indexes`
- **Décision** : Merge remote-tracking branch 'origin/main' into fix/db-drop-pieces-price-unused-indexes (+7 other commits)
- **Sortie** : PR #1649 | commits 09cf27fe9 a5e4e4b64 cb1f5605c 4d1ba50e1 db3e2e2cc 6732ed805 7a575a5d9 a8683258e

## 2026-10-01 — fix/db-drop-pieces-price-unused-indexes (auto)

- **Branche** : `fix/db-drop-pieces-price-unused-indexes`
- **Décision** : Merge remote-tracking branch 'origin/main' into fix/db-drop-pieces-price-unused-indexes (+9 other commits)
- **Sortie** : PR #1649 | commits 4cbd9fdd2 17668ff66 09cf27fe9 a5e4e4b64 cb1f5605c 4d1ba50e1 db3e2e2cc 6732ed805 7a575a5d9 a8683258e

## 2026-10-01 — fix/db-drop-pieces-price-unused-indexes (auto)

- **Branche** : `fix/db-drop-pieces-price-unused-indexes`
- **Décision** : Merge remote-tracking branch 'origin/main' into fix/db-drop-pieces-price-unused-indexes (+11 other commits)
- **Sortie** : PR #1649 | commits b6c5f011f a9350f73a 4cbd9fdd2 17668ff66 09cf27fe9 a5e4e4b64 cb1f5605c 4d1ba50e1 db3e2e2cc 6732ed805 7a575a5d9 a8683258e

## 2026-10-01 — fix/db-cron-job-run-details-retention (auto)

- **Branche** : `fix/db-cron-job-run-details-retention`
- **Décision** : docs(db): chiffrer le coût mesuré de la rétention de cron.job_run_details (+2 other commits)
- **Sortie** : PR #1651 | commits 40fa3aeca 9767f3443 27a22c3d4

## 2026-10-01 — fix/db-cron-job-run-details-retention (auto)

- **Branche** : `fix/db-cron-job-run-details-retention`
- **Décision** : Merge remote-tracking branch 'origin/main' into fix/db-cron-job-run-details-retention (+4 other commits)
- **Sortie** : PR #1651 | commits 96283800a 6da7bd003 40fa3aeca 9767f3443 27a22c3d4

## 2026-10-01 — fix/automation-validator-zod4-issues (auto)

- **Branche** : `fix/automation-validator-zod4-issues`
- **Décision** : fix(registry): le validateur d'automation-reality nomme le champ invalide (zod 4)
- **Sortie** : PR aucune | commits d200b3d35

## 2026-10-03 — fix/auto-modele-empty-alias (auto)

- **Branche** : `fix/auto-modele-empty-alias`
- **Décision** : chore(registry): resync des projections L1 pour la migration 20261003 (+1 other commit)
- **Sortie** : PR aucune | commits 2a7f0f274 45b759f06

## 2026-10-04 — fix/blog-legacy-advice-alias (auto)

- **Branche** : `fix/blog-legacy-advice-alias`
- **Décision** : chore(registry): resync L1+L3 projections (+1 other commit)
- **Sortie** : PR aucune | commits e05399bab 1d2ea06f6

## 2026-10-04 — fix/blog-legacy-advice-alias (auto)

- **Branche** : `fix/blog-legacy-advice-alias`
- **Décision** : chore(audit): régénérer l'inventaire PR-8 après la fusion de main (+9 other commits)
- **Sortie** : PR #1719 | commits 3e02d26b8 28ebb7d11 2d482e5c3 3adb701ac 4912b4a9d 2b2caf1da 3c7046cec 2c9b69834 e05399bab 1d2ea06f6

## 2026-10-04 — worktree-departments-operational (auto)

- **Branche** : `worktree-departments-operational`
- **Décision** : chore(audit): régénérer inventaire et candidats PR-8 sur le canonical resynchronisé (+6 other commits)
- **Sortie** : PR aucune | commits f5f50adc1 69bac0de6 bd48d22e0 2391c7d75 afdd7320c e7763f2b2 b42fe3882

## 2026-10-04 — worktree-departments-operational (auto)

- **Branche** : `worktree-departments-operational`
- **Décision** : chore(audit): régénérer inventaire et candidats PR-8 sur le canonical resynchronisé (+10 other commits)
- **Sortie** : PR #1721 | commits 685164ee0 e3010c147 547227d5c 3dfa64d3a f5f50adc1 69bac0de6 bd48d22e0 2391c7d75 afdd7320c e7763f2b2 b42fe3882

## 2026-10-04 — worktree-departments-operational (auto)

- **Branche** : `worktree-departments-operational`
- **Décision** : chore(audit): régénérer inventaire et candidats PR-8 sur le canonical resynchronisé (+14 other commits)
- **Sortie** : PR #1721 | commits 592d8da1b 46c8776bf cb77845c5 1ff490d6c 685164ee0 e3010c147 547227d5c 3dfa64d3a f5f50adc1 69bac0de6 bd48d22e0 2391c7d75 afdd7320c e7763f2b2 b42fe3882

## 2026-10-04 — feat/sales-payments-kept-kpi (auto)

- **Branche** : `feat/sales-payments-kept-kpi`
- **Décision** : chore(audit): régénérer inventaire et candidats PR-8 (nouveau service KPI) (+2 other commits)
- **Sortie** : PR aucune | commits a120f3169 f56ca82a4 c0f0d2923

## 2026-10-04 — feat/sales-payments-kept-kpi (auto)

- **Branche** : `feat/sales-payments-kept-kpi`
- **Décision** : chore(audit): régénérer inventaire et candidats PR-8 sur le canonical resynchronisé (+6 other commits)
- **Sortie** : PR #1725 | commits 3fb5dead7 d480db38b 4d20847ec 7cfe405a0 a120f3169 f56ca82a4 c0f0d2923

## 2026-10-04 — feat/sales-payments-kept-kpi (auto)

- **Branche** : `feat/sales-payments-kept-kpi`
- **Décision** : chore(audit): régénérer les candidats PR-8 sur le canonical reconstruit sans dist (+9 other commits)
- **Sortie** : PR #1725 | commits aae2c6506 880195243 b0df83906 3fb5dead7 d480db38b 4d20847ec 7cfe405a0 a120f3169 f56ca82a4 c0f0d2923

## 2026-10-04 — fix/return-page-order-event-ord-id (auto)

- **Branche** : `fix/return-page-order-event-ord-id`
- **Décision** : chore(audit): resync module-boundaries + PR-8 cleanup snapshot (+2 other commits)
- **Sortie** : PR aucune | commits 04f9278dd a89c7426f 975975127
