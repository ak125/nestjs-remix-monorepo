# Relevé CI — ak125/nestjs-remix-monorepo (lecture seule, 2026-11-16)

Source lue : worktree `/opt/automecanik/app/.claude/worktrees/mandat-ar-governance-20261116`,
HEAD `8c2f87f9c3a2bddf7b7dd2e614c5b15f6f079230` (= origin/main). Aucune écriture, aucun `gh` mutant.
Extraction workflows : parseur YAML (`python3 -I wfscan.py .github/workflows`), puis lecture ciblée.

## 0. Ce qui n'a pas pu être lu

| Lecture | Résultat |
|---|---|
| `gh api repos/ak125/nestjs-remix-monorepo/branches/main/protection` | `403 Resource not accessible by integration` (identité `gh` DEV = jeton d'App) |
| ⇒ required reviews, code owner reviews, enforce_admins, strict (up-to-date), restrictions de push | **inconnus** (seul le sous-ensemble public de `branches/main` est lisible) |
| Recherche Codex `codex in:comments` | rate limit secondaire (403) ; les deux autres recherches ont répondu |
| Classes de risque de `ownership.yaml` (comptage) | non mesuré (classifieur d'outil indisponible) ; présence du champ `risk` établie par le code de la porte |
| Sémantique des `|| true` hors `ci.yml` | comptés, non analysés ligne à ligne |

## 1. Inventaire des 76 workflows

Runner : tout est `ubuntu-latest` (GitHub-hosted) **sauf** les 7 jobs self-hosted `[self-hosted, Linux, X64]`
(hôte PROD) listés en §4, plus le job `session` de `scripts/ops/mandat-remise.yml` (`runs-on: [agents]`, inactif, hors `.github/workflows/`).

### 1a. Workflows PR bloquants (exit non nul, pas de continue-on-error au job)

| Workflow (fichier) | Déclencheurs | Jobs → nom affiché du check |
|---|---|---|
| `ci.yml` « 🚀 Deploy » | push main/dev, pull_request (sans filtre de chemin) | `⬣ ESLint`, `ʦ TypeScript`, `🧪 Backend Tests`, `🧪 Frontend Tests`, `🔒 Security Audit`, `🔒 Core Build Only`, `🛡️ Import Firewall`, `🛡️ RPC Safety Gate`, `🛡️ ADR-010 Governance`, `🔐 Secrets Detection`, `🗄️ Migration Safety` ; push main seulement : `🐳 build / 🐳 Build`, `🔍 Docker Image Scan`, `🧪 Deploy PREPROD`, `🎭 E2E Smoke Tests`, `🔦 Lighthouse Performance Audit`, `🔔 Notify on Failure` |
| `codeql.yml` | push main, PR→main, schedule lun 06:00 | `🔬 CodeQL Scan (javascript-typescript)` (+ check `CodeQL` de l'App code scanning) |
| `validator-dev-safety-observe.yml` | pull_request (tous) | `🔒 DEV Safety (Blocking)` bloquant ; `🔍 DEV Safety (Observe)` = continue-on-error |
| `pr-dod-gate.yml` | PR→main (opened…ready_for_review, labeled…), pull_request_review | `🧾 DoD self-evaluation present` (Phase 2 : échoue sur les 8 items du corps ; DoD2 advisory via `DOD_ADVISORY_ITEMS: DoD2`) |
| `audit.yml` | PR (15 filtres de chemin) | `🛡️ Deterministic gates` (≈ 25 étapes BLOCKING ; seule `madge` en continue-on-error) |
| `contract-gate.yml` | PR→main | `🛡️ Contract Gate` |
| `registry-new-file-gate.yml` | PR→main | `Block-new (owner + domain required)` |
| `perf-gates.yml` | PR→main | `🔍 CWV Performance Check` |
| `dependency-graph-validate.yml` | PR→main | `🕸️ No new deep PR-stacks` (1 étape en coe) |
| `preprod-vocabulary-guard.yml` | PR→main, push main | `Block forbidden DEV/PREPROD/PROD formulations in .md` |
| `seo-shadow-flag-guard.yml` | PR→main, push main | `Refuser SEO_CHAIN_R*_MODE=on dans la config` |
| Gardes à filtre de chemin (PR, souvent aussi push main) | pull_request[paths] | `agents-md-validation` (`Validate AGENTS.md / CLAUDE.md`), `automation-registry-validate`, `automation-registry-no-auto-bump`, `canon-registries-validate`, `commerce-runtime-canon-gate`, `contract-drift-ratchet`, `cron-schedulemodule-guard`, `dependency-modernization-fresh`, `esm-package-smoke`, `governance-capture-tests`, `governance-checks` (4 jobs), `impeccable-ratchet`, `monorepo-invariants`, `orphan-files-ratchet`, `rag-permissions-audit` (3 jobs), `replay-projection-regression`, `served-content-write-ratchet`, `seo-matrix-check`, `seo-url-immutability` (label `r-seo-09-override` = échappatoire), `spec-canon-*` (4), `spec-validation`, `tecdoc-api-surface-guard`, `tecdoc-failclosed-guard` (2), `wiki-generators-tests`, `wiki-readiness-check` (2), `wiki-validate` (2), `agent-exit-contract-hash` / `marketing-voice-hash` (`verify (...)` matriciel) |
| `pr-2e-readiness-gate.yml` | PR→main, conditionné au label `r2-v2-pr-2e` | `🚦 Gate check (snapshots ≥ auto_types)` (skipped sinon) |

### 1b. Advisory / warn-only (ne bloque pas)

| Workflow | Mécanisme |
|---|---|
| `contract-drift-observatory.yml`, `dependency-registry-freshness.yml`, `registry-build.yml`, `registry-fresh.yml`, `skills-canon-gate.yml`, `vault-canon-exists.yml` | `continue-on-error: true` au niveau job |
| `automation-registry-coverage.yml` | « warn-only Phase 1 », 2 étapes coe + 3 `|| true` |
| `validator-dev-safety-observe.yml` job Observe ; `audit.yml` étape madge | continue-on-error |
| `automation-registry-freshness.yml` | schedule, « daily warn-only » |
| `ci.yml` | 20 `|| true` : tous sur des `grep` de filtrage ou du diagnostic docker post-échec (l. 441–1455) ; n'altèrent pas le verdict des jobs |

### 1c. Hors PR (schedule / dispatch / main), non gates de fusion

- PROD/PREPROD : `release-prod.yml` (tag v*, dispatch), `prod-smoke-tests.yml` (schedule 6 h, self-hosted, 7 étapes coe), `deploy-monitoring-scripts.yml` (push main `scripts/monitoring`, self-hosted), `visual-gate.yml` (dispatch, self-hosted), `build.yml` (workflow_call depuis ci.yml).
- Auto-PR / auto-commit : `canon-sync.yml`, `registry-deps-self-heal.yml`, `diag-canon-slugs-export.yml`, `wiki-exports-diagnostic-generate.yml`, `wiki-exports-seo-generate.yml`, `sitemap-daily-regen.yml` (OIDC).
- Pilotage / rapports : `pilote-file.yml` (schedule 06–19 h, ADR-128), `morning-health-digest.yml`, `weekly-pr-hygiene.yml`, `closure-t48h-slo-digest.yml` (garde de date 2026-05-19), `stale.yml` (étiquette + ferme les PR, exempt : pinned,security,epic,wip,blocked-upstream,dependencies).
- Contrôles périodiques : `secrets-history-audit.yml` (gitleaks + trufflehog, coe 1 étape chacun), `migration-ledger-freshness.yml`, `wiki-canon-shape-check.yml`.
- Manuels : `apply-supabase-migrations.yml`, `dependency-family-bump.yml` (« No auto-merge »), `rag-proposals-validate.yml`, `deploy-docs.yml` (branche `docs`, seul `environment:` GitHub du dépôt).
- Dependabot (pull_request_target, sur toute PR mais skipped hors dependabot) : `dependabot-auto-merge.yml` (check `auto-merge`), `dependabot-claude-review.yml` (check `review`).

## 2. Fusion automatique existante

Réglage dépôt : `gh api repos/ak125/nestjs-remix-monorepo --jq '{allow_auto_merge,...}'` →
`{"allow_auto_merge":true,"allow_merge_commit":true,"allow_rebase_merge":true,"allow_squash_merge":true,"delete_branch_on_merge":true,"visibility":"public"}`

| Mécanisme | Fichier | Condition | Commande / identité |
|---|---|---|---|
| Dependabot déterministe | `.github/workflows/dependabot-auto-merge.yml` l.11–37 | `user.login == 'dependabot[bot]'` ET (`semver-patch` OU `semver-minor`+`direct:development` OU écosystème `github_actions` OU `semver-minor` d'un groupe `tiptap-/storybook-/vite-ecosystem`) | `gh pr merge --auto --squash "$PR_URL"`, `GH_TOKEN: secrets.GITHUB_TOKEN` (permissions contents/pull-requests write) |
| Dependabot revue IA | `dependabot-claude-review.yml` | dependabot, même dépôt, `vars.CLAUDE_REVIEW_ENABLED == 'true'`, hors `dependabot/submodules/`, sans label `dependabot-hold` ; skip si couvert par la règle déterministe | `anthropics/claude-code-action@v1`, modèle `claude-haiku-4-5`, secret `ANTHROPIC_API_KEY` ; GO → `gh pr review --approve` + `gh pr merge --auto --squash` (sauf major prod = commentaire) ; HOLD → label `dependabot-hold` ; `vars.CLAUDE_REVIEW_DRY_RUN` |
| Self-heal registre | `registry-deps-self-heal.yml` l.173–235 | push main / schedule 02:30 | App `SELF_HEAL_APP_ID` + `SELF_HEAL_APP_PRIVATE_KEY`, repli `SELF_HEAL_TOKEN` ; `gh pr merge "$PR_NUMBER" --auto --squash` ; label `dependencies` |
| Canon-sync | `canon-sync.yml` | dispatch `canon-updated`, schedule 03:00 | ouvre PR `canon-sync/auto` (peter-evans, labels `canon-sync`,`automated`), **pas** d'auto-merge (corps : « ensure CI green, and merge ») |
| Porte de périmètre ADR-123/124 | `scripts/ci/merge-perimeter-gate.mjs` (testé dans `audit.yml`, non lancé par un workflow) | politique lue sur le vault `ledger/policies/merge-perimeter.v1.json` ; classification par chemin via `ownership.yaml` (`risk` ≤ `max_risk`, `sourceConfidence`) ; deny paths/diff/branche/titre ; enregistrement DoD2 tête+base ; contexts requis lus sur `branches/main` | `gh pr merge <n> --squash --match-head-commit <head>` sous verrou `/home/deploy/resync/merge-perimeter.lock`, pause `…/merge-perimeter.pause` (exécution hôte DEV) |
| Routine mandat-remise | `scripts/ops/mandat-remise.yml` | **inactive** (hors `.github/workflows/`) ; label `mandat-prêt` | « jamais de fusion » (commit 8c2f87f9c) ; App `MANDAT_APP_PRIVATE_KEY`, remplacée par `ACTIONS_APP_PRIVATE_KEY` (environnement `app-actions`, AR-6, `commandes-owner.md` §15) |
| pilote-file | `pilote-file.yml` | schedule | « ne fusionne et ne relabellise rien » (ADR-128 D6) |

Observé (40 dernières PR fusionnées) : `gh pr list --state merged --limit 40` → 38 fusionnées par
`app/automecanik-agents`, 2 par `ak125` (#2082, #2071) ; **aucune** `autoMergeRequest` ; revues présentes
seulement sur #2066, #2038 (`ak125`) et #2047 (`github-advanced-security`). Les fusions se font donc sans
revue approuvée enregistrée.

Labels lus dans les workflows : `dependabot-hold` (**absent** de `gh label list`), `r2-v2-pr-2e` (absent),
`dod-skip-justified` (`scripts/ci/pr-dod-gate.mjs` l.61, absent), `r-seo-09-override` (présent),
`mandat-prêt` (présent), `needs-human` (présent, arrêt pilote), `dependencies`, `canon-sync`, `automated`,
`incident-sitemap-cron`, labels d'exemption de `stale.yml`. Labels du dépôt liés au pilotage :
`statut:*` (5), `niveau:L0..L4`, `dept:01..24`, `attend-marwane`, `release-gate`. **Aucun label de circuit.**

## 3. Revue Codex

- `grep -rniE "codex|chatgpt-codex|openai" .github .husky scripts/ops` → aucune occurrence dans `.github/` ni `.husky/` ; seules occurrences = outillage Hermes (`scripts/ops/hermes-*`), sans lien CI.
- `gh api search/issues -q 'repo:… is:pr commenter:chatgpt-codex-connector[bot]'` → `0` ; `reviewed-by:chatgpt-codex-connector[bot]` → `0`.
- Commentaires de #2086, #2084, #2082, #2075, #2066 : `github-actions[bot]` (+ `automecanik-agents[bot]` sur #2066), aucun commentaire de revue en ligne.
- Seule revue automatisée existante : Claude Haiku sur Dependabot (§2). **Aucun déclencheur ni lecture de revue Codex.**

## 4. Chaînes PREPROD et PROD

| Chaîne | Workflow / job | Runner | Gates |
|---|---|---|---|
| Fusion main → image | `ci.yml` job `build` → `build.yml` (`🐳 build / 🐳 Build`, `if: ref == main`) | ubuntu-latest | aucun `needs` ; `🔍 Docker Image Scan` (trivy) après |
| main → PREPROD | `ci.yml` job `deploy` « 🧪 Deploy PREPROD » (`push` main) | self-hosted Linux X64 (hôte PROD) | `needs: [build, lint, typecheck, test, test-frontend, core-build, import-firewall, rpc-gate-check, governance-check, gitleaks, migration-safety]` (pas `security`) ; preflight env Zod ; contrôle réseau/clé ; `/health` revision |
| PREPROD validation | `🎭 E2E Smoke Tests` (needs deploy) → `🔦 Lighthouse Performance Audit` | self-hosted | séquentiels |
| tag v* → PROD | `release-prod.yml` job `🚀 Deploy to PROD` (push tags `v*`, dispatch) | self-hosted Linux X64 | `🔖 Release ref gate` ; preuve PREPROD (`scripts/ci/prod-preprod-evidence.mjs` : 3 jobs verts sur le run ci.yml du commit) ; provenance image ; rollback auto après point de non-retour. **Aucun `environment:` GitHub** (pas d'approbateur requis côté Actions) |
| Hors chaîne | `deploy-monitoring-scripts.yml` (push main `scripts/monitoring`) | self-hosted | modifie l'hôte PROD sans gate PR spécifique |

Rulesets : `gh api repos/…/rulesets` → `[]` ; `gh api repos/…/rules/branches/main` → `[]`. Aucun ruleset
de tags : la création de tag `v*` n'est pas réservée côté serveur (le blocage agent = hook local
`pretool-bash-guard.sh`, cf. `.claude/rules/deployment.md`).

## 5. Protection de main (lisible)

`gh api repos/ak125/nestjs-remix-monorepo/branches/main --jq '{protected, protection}'` →
`protected: true`, `required_status_checks.enforcement_level: "everyone"`, **14 contexts** (tous `app_id 15368` = GitHub Actions) :

```
🔒 DEV Safety (Blocking)          🔬 CodeQL Scan (javascript-typescript)
⬣ ESLint                          ʦ TypeScript
🧪 Backend Tests                  🧪 Frontend Tests
🔒 Security Audit                 🔒 Core Build Only
🛡️ Import Firewall                🛡️ RPC Safety Gate
🛡️ ADR-010 Governance             🔐 Secrets Detection
🗄️ Migration Safety               🧾 DoD self-evaluation present
```

Non lisible (403) : required_pull_request_reviews, require_code_owner_reviews, enforce_admins, strict.
Indice indirect, sans valeur de preuve : 38/40 fusions récentes sans revue approuvée ⇒ soit aucune revue
requise, soit contournement par l'identité fusionnante. `CODEOWNERS` (`.github/CODEOWNERS`, 16 chemins, tous
`@ak125`) n'a d'effet bloquant que si `require_code_owner_reviews` est actif : inconnu.

## 6. Hooks locaux (`.husky/`)

- `pre-commit` : canon-mirrors (ADR-061), `governance-vault/` interdit, validate-agents-md, lint-staged,
  headers s-maxage, vocabulaire preprod, fraîcheur knowledge, overlay registre, snapshot Command Center,
  ast-grep (severity error), impeccable (block par défaut, `IMPECCABLE_HOOK=skip`), role-purity, secrets de paiement.
- `pre-push` : refuse push direct/création/suppression de `main` et `dev`, `rag/knowledge/`, registry block-new
  (`SKIP_REGISTRY_GATE=1`). Contournable par `--no-verify` : défense locale, pas une garde serveur.
- `commit-msg` : `commitlint`.
- `.github/scripts/` : 3 scripts de digest (`closure-t48h-slo-digest.sh`, `morning-health-digest.sh`, `weekly-pr-hygiene.sh`), aucun gate.

## 7. Ce qui bloque déjà vs ce qui manque (constat)

Bloque déjà une PR vers main : 14 checks requis (§5), tous déclenchés sur **toute** PR (ci.yml, codeql, DEV Safety,
DoD sans filtre de chemin). Les ~40 gardes à filtre de chemin (§1a) échouent visiblement mais **ne sont pas requises**.
Hooks husky = local uniquement.

Manque pour trois circuits :
1. Aucun label, check ou statut « circuit » (faible/moyen/élevé) ; aucun calcul de risque **en CI**. Une
   classification par chemin existe (`ownership.yaml` champ `risk` + `sourceConfidence`, lue par
   `merge-perimeter-gate.mjs`) mais n'est exploitée que par la porte ADR-124 hors workflow.
2. Auto-fusion « CI verte » : `allow_auto_merge: true` déjà ; seules sources actives = Dependabot et self-heal.
   Aucune auto-fusion pour les PR agents ; la porte ADR-124 fusionne directement (`--match-head-commit`), pas via `--auto`.
3. Revue Codex : rien (ni workflow, ni App visible, ni trace sur PR) ; aucun check lisible pour la conditionner.
4. Approbation humaine : non vérifiable (403) ; aucun `environment:` protégé sur `release-prod.yml` ; aucun ruleset de tags.
5. Gardes path-filtered non requises : un check requis à filtre de chemin resterait « Expected » (bloquant à tort) sur
   les PR hors périmètre — à traiter avant de les rendre requises (constat GitHub, pas une recommandation).
6. Labels référencés mais inexistants : `dependabot-hold`, `dod-skip-justified`, `r2-v2-pr-2e`.
7. Le check `review` et `auto-merge` (pull_request_target) apparaissent `skipped` sur chaque PR non Dependabot.

## 8. Noms de check exacts (preuve sur commits réels)

`gh api repos/…/commits/7008b1c1cd825ae280361156cd7c875e4b967b17/check-runs` (tête de #2082, fusionnée par `ak125`
le 2026-11-15T23:42:25Z, sans revue ni auto-merge) — 37 check-runs, extrait des **toujours présents sur PR, success** :

```
⬣ ESLint | ʦ TypeScript | 🧪 Backend Tests | 🧪 Frontend Tests | 🔒 Security Audit | 🔒 Core Build Only
🛡️ Import Firewall | 🛡️ RPC Safety Gate | 🛡️ ADR-010 Governance | 🔐 Secrets Detection | 🗄️ Migration Safety
🔬 CodeQL Scan (javascript-typescript) | CodeQL | 🔒 DEV Safety (Blocking) | 🔍 DEV Safety (Observe)
🧾 DoD self-evaluation present | 🛡️ Contract Gate | Block-new (owner + domain required) | 🔍 CWV Performance Check
🕸️ No new deep PR-stacks | Block forbidden DEV/PREPROD/PROD formulations in .md | Refuser SEO_CHAIN_R*_MODE=on dans la config
```
Présents sur #2082 par filtre de chemin : `🛡️ Deterministic gates`, `Coverage check (warn-only Phase 1)`,
`validate-top-priorities.sh (ADR-081)`, `validate-exploration-probe.sh (ADR-081 G10)`,
`check-cart-conversion-r-role.sh (R-role invariant)`, `check-role-purity.ts (…)`, `Verify ADR canon references have vault backing`.
Skipped sur PR : `🐳 build / 🐳 Build`, `🧪 Deploy PREPROD`, `🎭 E2E Smoke Tests`, `🔦 Lighthouse Performance Audit`,
`🔍 Docker Image Scan`, `🔔 Notify on Failure`, `auto-merge`, `review`, `🚦 Gate check (snapshots ≥ auto_types)`.

`gh api repos/…/commits/8c2f87f9c3a2bddf7b7dd2e614c5b15f6f079230/check-runs` (HEAD main) : 51 check-runs, tous
`success` sauf `🔔 Notify on Failure` skipped ; inclut `🧪 Deploy PREPROD`, `🎭 E2E Smoke Tests`,
`🔦 Lighthouse Performance Audit`, `🐳 build / 🐳 Build` et des runs schedule rattachés au SHA (pilote, digest, wiki…).

Candidats stables (sans filtre de chemin, déclenchés sur toute PR→main, non advisory), en plus des 14 requis :
`🛡️ Contract Gate`, `Block-new (owner + domain required)`, `🔍 CWV Performance Check`, `🕸️ No new deep PR-stacks`,
`Block forbidden DEV/PREPROD/PROD formulations in .md`, `Refuser SEO_CHAIN_R*_MODE=on dans la config`.
À exclure comme requis : `🔍 DEV Safety (Observe)` (coe), checks path-filtered, `CodeQL` (App code scanning, nom générique),
checks push-main-only (`🧪 Deploy PREPROD`…), `auto-merge`/`review` (pull_request_target Dependabot).
