# Lecteurs du Vault `ak125/governance-vault` et plan de déplacement

Relevé du 2026-11-16, en lecture seule. Aucune écriture hors de ce fichier, aucun `gh` mutant.

Bases lues :
- Vault : clone DEV `/opt/automecanik/governance-vault`, HEAD = origin/main `501982d3be2c`. Dépôt **public**, non archivé.
- Monorepo : worktree `mandat-ar-governance-20261116`, HEAD = origin/main `8c2f87f9c3`. Dépôt public.
- WIKI : `origin/main` local `ebcb529167ee`, identique à `gh api …/commits/main`. Dépôt public.
- RAW : `origin/main` local `37aac3a3ab3f`, identique à l'API. Dépôt **privé**.

Rappel : un dépôt archivé reste lisible (raw.githubusercontent, `gh api`, `actions/checkout`, `git fetch`).
Il n'accepte plus de push, de PR ni de fusion, et ses workflows ne tournent plus. Conséquence générale :
tout lecteur continue de fonctionner, mais **le canon lu est gelé à jamais**.

## 1. Tableau des lecteurs

Types : **CI-B** = contrôle CI ; « requis » seulement là où la protection de branche le prouve.
**CI-W** = CI non bloquante. **script**, **hook**, **runtime**, **skill**, **cron**, **doc**.

| # | Lecteur | Dépôt | Chemin:ligne | Type | Ce qu'il lit | Impact si vault archivé |
|---|---|---|---|---|---|---|
| A1 | `agent-exit-contract-hash` | wiki | `.github/workflows/agent-exit-contract-hash.yml:33-37` → `_scripts/check-aec-hash.sh:13,22-29` | CI (PR, push, cron 03:30, `canon-updated`). **Absent** des checks requis du ruleset `main` du wiki | `99-meta/canon-hashes.json` → `canons.aec.distribution_sha256`, par `gh api repos/ak125/governance-vault/contents/…` (repli curl raw). Token : `secrets.VAULT_READ_TOKEN \|\| secrets.GITHUB_TOKEN` | Reste vert (lecture OK). L'AEC ne peut plus évoluer. Le commentaire « Vault is private » (l.22) est faux : le vault est public |
| A2 | copie AEC wiki | wiki | `_meta/agent-exit-contract.md` | copie | sha `5e64cac8…` = `distribution_sha256` | aucun |
| A3 | `agent-exit-contract-hash` | raw | `.github/workflows/agent-exit-contract-hash.yml:32-36` → `_scripts/check-aec-hash.sh:13,22-27` | CI (mêmes déclencheurs). Statut requis **non lisible** (dépôt privé, API ruleset 403) | idem A1, même secret `VAULT_READ_TOKEN \|\| GITHUB_TOKEN` | idem A1. L'échec du 2026-11-16 03:40Z (run 43799574785) est un échec du checkout de RAW lui-même (« repository not found »), sans lien avec le vault |
| A4 | copie AEC raw | raw | `agent-exit-contract.md` | copie | sha `5e64cac8…` conforme | aucun |
| A5 | `jcs-parity` | raw | `.github/workflows/jcs-parity.yml:62-65` → `_scripts/check-jcs-parity.py:59-61` | CI-W (non requis, déclaré l.16) ; cron 03:45 + `canon-updated` | `99-meta/jcs-parity-vector.json` (raw URL / `gh api`), même token | Lecture OK. Plus aucun vecteur ne pourra être publié ; le publisher reste dans le vault |
| M1 | `agent-exit-contract-hash` | mono | `.github/workflows/agent-exit-contract-hash.yml:39-46` → `scripts/ci/check-aec-hash.sh:21,32-33` | CI (PR, push, cron 03:30, `canon-updated`). Statut requis non lisible (protection classique, 403) ; ruleset sans check requis | `canon-hashes.json` par curl raw sans token, pour 3 copies | Reste vert ; AEC gelé |
| M2 | `marketing-voice-hash` | mono | `.github/workflows/marketing-voice-hash.yml` → `scripts/ci/check-marketing-voice-hash.sh:20` | CI | `canons.marketing_voice` (curl raw) | idem, Marketing Voice gelé |
| M3 | `canon-sync` | mono | `.github/workflows/canon-sync.yml:49-84` → `scripts/ci/sync-canon-from-vault.sh:20-27,55-57` | CI d'écriture (cron 03:00, `canon-updated`) : ouvre la PR `canon-sync/auto` | manifeste + `canon_path` brut de chaque canon (curl raw, sans token) | Tourne à vide chaque jour (dernier run vert le 2026-11-16 03:05Z) ; devient inutile |
| M4 | miroirs déclarés | mono | `.claude/canon-mirrors/agent-exit-contract.md`, `workspaces/seo-batch/.claude/canon-mirrors/agent-exit-contract.md`, `workspaces/marketing/.claude/canon-mirrors/agent-exit-contract.md` (sha `5e64cac8…`) ; `.claude/canon-mirrors/marketing-voice.md` + `workspaces/marketing/…/marketing-voice.md` (sha `c5a7bfd0…`) | copies hash-lockées | source `ledger/rules/rules-agent-exit-contract.md` v1.2.0 ; `ledger/rules/rules-marketing-voice.md` v1.0.1 | aucun (conformes) |
| M5 | miroir **non déclaré** | mono | `.claude/canon-mirrors/exploration-budget.md:1-3` | copie manuelle | `ledger/policies/exploration-budget.md` @ vault `f6e81c0d`, sync manuelle du 2026-05-24 ; absente de `canon-hashes.json`, donc aucun contrôle | déjà hors distribution ; reste figée |
| M6 | miroir **périmé, non déclaré** | mono | `workspaces/wiki/.claude/canon-mirrors/agent-exit-contract.md` (sha `65d51c02…`, AEC **v1.0.0**, dernier commit `ea18679fd8` du 2026-05-04) | copie | AEC ancienne, contredit la v1.2.0 (règle 1) | aucun contrôle ne la voit ni ne la verra |
| M7 | husky pre-commit | mono | `.husky/pre-commit:30-51` | hook local bloquant | **exécute** `$GOVERNANCE_VAULT_PATH/_scripts/sync_canon_mirrors.py --check` du clone DEV quand un miroir est indexé ; avertissement seul si absent | Fonctionne (clone lisible). Après déplacement, il comparerait encore au vault gelé : à repointer |
| M8 | `vault-canon-exists` | mono | `.github/workflows/vault-canon-exists.yml:56-67,129` | CI-W (`continue-on-error: true`) | `actions/checkout` sparse de `ak125/governance-vault@main`, `ledger/decisions/adr`, sans token | Lecture OK ; toute ADR créée hors du vault (décision 72) sera signalée « manquante » |
| M9 | porte de fusion ADR-124 | mono | `scripts/ci/merge-perimeter-gate.mjs:24-25,228-229` ; tests seuls dans `.github/workflows/audit.yml:158` | script de fusion automatique, lancé hors CI (verrou `/home/deploy/resync/merge-perimeter.lock`) | `ledger/policies/merge-perimeter.v1.json` (`status: active`) sur le commit `main` du vault, par `gh api` | Continue d'autoriser selon une politique **qu'on ne pourra plus modifier ni désactiver** par le vault. Seul frein restant : le fichier de pause DEV `merge-perimeter.pause` (l.26) |
| M10 | évaluateur OPA R2 | mono | `backend/src/modules/seo/r2/services/r2-opa-evaluator.service.ts:75-77`, branché dans `r2-v2.module.ts` | runtime (défaut) | `/opt/automecanik/governance-vault/dist/policies/r2-content-write.wasm` (versionné dans le vault, présent sur DEV) | Latent : `@open-policy-agent/opa-wasm` n'est dans aucun `package.json`, d'où un deny-all quel que soit le vault. Aucune variable `R2_OPA_BUNDLE_PATH` dans les compose ni les workflows |
| M11 | `check-verdict-expirations.sh` | mono | `scripts/governance/check-verdict-expirations.sh:25` | script, **non branché** (`governance-checks.yml:11`) | clone DEV `VAULT_PATH` | aucun aujourd'hui |
| M12 | simulation d'attaque | mono | `tools/security/attack-simulations/simulate-escalation-hijack.sh:35,136` | script manuel | chemins vault v1 (`05-agents/`, `02-decisions/`) **déjà inexistants** | déjà cassé, indépendamment de l'archive |
| M13 | jeton GitHub App DEV | mono | `scripts/ops/gh-app-token/automecanik-gh-app-token:17` | script ops (timer `automecanik-gh-app-token-refresh`) | dans la portée : `governance-vault` | lecture seule possible ; à retirer après archivage |
| S1 | skill `governance-vault-ops` | mono | `.claude/skills/governance-vault-ops/SKILL.md:12,53-55,70-108` | skill | clone `$GOVERNANCE_VAULT_PATH` (lecture `git -C`) ; prépare des PR vault ; `sync_canon_mirrors.py --check` (l.108) | Préparation de PR impossible : la moitié du skill devient caduque |
| S2 | skills de référence | mono | `.claude/skills/vehicle-ops/SKILL.md:323,392` ; `.claude/skills/runtime-truth-audit/checks/massdoc-typeid-invariant.md:14` ; `workspaces/wiki/.claude/skills/wiki-proposal-writer/SKILL.md:22` ; `.claude/skills/README.md` | skill (citation d'ADR) | ADR-032, ADR-085, ADR-031/032/033 | aucun (liens lisibles) |
| S3 | règles de workspaces | mono | `workspaces/seo-batch/.claude/rules/seo-batch.md:9` (renvoie vers `/opt/automecanik/governance-vault/ledger/knowledge/`) ; `workspaces/marketing/.claude/rules/marketing-batch.md:7-12,68` ; `workspaces/wiki/.claude/rules/wiki-batch.md:9-11` | règle agent | renvoi de lecture vers le clone / ADR | aucun ; « source unique = vault » devient faux après déplacement |
| D1 | `vault-sync.sh` | DEV | crontab `*/5 * * * * /home/deploy/bin/vault-sync.sh` | cron | met le clone DEV à niveau d'`origin/main` (ff ; `reset --hard` si `main` est seulement en retard) ; état via `cron_report vault-sync` | Continue sans effet utile ; à arrêter une fois les lecteurs locaux repointés |
| D2 | `knowledge-jobs` | DEV | `/home/deploy/.local/lib/knowledge-jobs/collection/sources.json:7,15` (timer quotidien `knowledge-jobs.timer`) | timer systemd utilisateur | dépôt `ak125/governance-vault` + racine `/opt/automecanik/governance-vault` | Lecture OK ; source figée |
| D3 | `cron-sync-canon-mirrors.sh` | vault | `_scripts/cron-sync-canon-mirrors.sh:12,128,143` → `_scripts/sync_canon_mirrors.py` | script d'écriture (worktree du monorepo, PR signée) | manifeste + canons ; écrit les miroirs du monorepo | **Aucune ligne de crontab** ne le lance (relevé `crontab -l`) : manuel seulement |
| V1 | `canon-publish` | vault | `.github/workflows/canon-publish.yml:58-105` | workflow d'écriture inter-dépôts | `repository_dispatch` `canon-updated` vers wiki, raw et monorepo (matrice l.68-71) avec un jeton de **GitHub App** (pas un PAT) : secrets `CANON_APP_ID`, `CANON_APP_PRIVATE_KEY` ; `client_payload[canon]=aec` codé en dur (l.104) | Ne tourne plus. Les consommateurs ne reçoivent plus que leurs crons. Dernier run : push du 2026-11-08 21:49Z, vert |
| V2 | autres workflows vault | vault | `vault-governance.yml`, `vault-self-review-marker.yml` (`GITHUB_TOKEN`), `vault-supabase-cost-check.yml` (`SUPABASE_ACCESS_TOKEN`), `opa-policy-build.yml`, `vault-weekly-lint.yml` | CI interne | — aucun `dispatches` ni écriture inter-dépôts | s'arrêtent ; le contrôle de coût Supabase et le build OPA sont à reloger s'ils servent encore |

### Comptage `governance-vault|governance_vault|GOVERNANCE_VAULT` dans le monorepo
Fichiers suivis, `git grep` sur HEAD hors lockfiles : **113 fichiers**.

| Catégorie | Fichiers | Occurrences | Dont lecteurs exécutables |
|---|---|---|---|
| workflows `.github/workflows` | 8 | 15 | M1, M3, M8 (+ M2) ; les 4 autres sont des commentaires |
| scripts `scripts/**` | 19 | 27 | check-aec-hash, check-marketing-voice-hash, sync-canon-from-vault, merge-perimeter-gate, check-verdict-expirations, gh-app-token ; le reste = messages ou commentaires |
| skills `.claude/skills/**` (+ workspace wiki) | 5 | 17 | governance-vault-ops |
| hooks `scripts/claude-hooks`, `.claude/hooks` | 0 | 0 | — (mais `.husky/pre-commit` : 12 occurrences, M7) |
| CLAUDE.md / AGENTS.md (racine, `agents/*`, workspaces) | 10 | 15 | consignes |
| `.claude/rules` (dont workspaces) | 3 | 7 | consignes (S3) |
| `.claude/knowledge` | 3 | 4 | liens |
| docs/ + audit/ | 16 | 42 | liens |
| code backend/packages (commentaires, migrations SQL ; 1 valeur par défaut runtime M10) | 32 | 37 | M10 |
| `.spec/` | 5 | 8 | références |
| canon-mirrors (en-têtes) | 4 | 4 | — |
| autres (`.husky/pre-commit`, `tools/security/…`, `.squawk.toml`, `policies/README.md`, `log.md`, fixture) | 6+2 | 24 | M7, M12 |

### Liens Markdown simples (non exécutés)
Occurrences de `governance-vault` dans les `*.md` : monorepo **50 fichiers / 98**, wiki **11 / 18**,
raw **5 / 6**, soit **66 fichiers / 122 occurrences**. Les 10 fichiers les plus concernés :
1. mono `docs/plans/2026-05-18-soft-404-r2-strategy.md` (12)
2. mono `.claude/skills/governance-vault-ops/SKILL.md` (9)
3. mono `docs/specs/2026-04-25-fleet-advisor-claude-4-7-design.md` (5)
4. mono `docs/plans/2026-05-23-ai-additive-layer-phase-0-and-1.md` (5)
5. wiki `_meta/schema-version-clarification.md` (4)
6. wiki `CLAUDE.md` (4)
7. mono `workspaces/marketing/.claude/rules/marketing-batch.md` (4)
8. mono `docs/specs/2026-05-18-soft-404-r2-strategy-design.md` (4)
9. mono `workspaces/marketing/AGENTS.md` (3)
10. mono `CLAUDE.md` (3), à égalité avec `.claude/skills/README.md` (3)

L'archive reste lisible, donc ces liens restent valides. Seule évolution utile : épingler les liens
`blob/main` sur un tag d'archive si l'on veut une citation stable.

## 2. Plan de déplacement (ordonné ; non exécuté)

Préalable de gouvernance : les décisions 72 et 73 doivent être actées par une **dernière PR du vault**,
signée et fusionnée par l'owner. Cette PR amende l'AEC §« Distribution canonique » (version 1.3.0)
et nomme la nouvelle source. Sans elle, une source AEC dans le monorepo serait une source de vérité
concurrente : CLAUDE.md, invariant 2 et §Gouvernance, l'interdisent.
L'emplacement ci-dessous est une **proposition** ; `.spec/00-canon/**` est réservé à l'owner (ownership.yaml).

### Étape 1 — AEC : nouvelle source et manifeste dans le monorepo (dépendances inchangées)
- **Quoi** : copier `ledger/rules/rules-agent-exit-contract.md` (frontmatter compris) et
  `ledger/rules/rules-marketing-voice.md` vers une source monorepo, par exemple
  `.spec/00-canon/canon-distribution/rules-agent-exit-contract.md` et `…/rules-marketing-voice.md`.
  Porter `_scripts/compute-canon-hashes.py` (registre `CANONS` l.85-122, transformation `FRONTMATTER_RE`)
  et `_scripts/sync_canon_mirrors.py` en un seul générateur, par exemple
  `scripts/canon/compute-canon-hashes.py` avec `--write` et `--check`. Il produit
  `.spec/00-canon/canon-distribution/canon-hashes.json`, sur le même schéma que `99-meta/canon-hashes.json`.
- **Contrainte** : le corps distribué reste **identique à l'octet près**.
  `distribution_sha256` reste `5e64cac8…` (aec) et `c5a7bfd0…` (marketing_voice), ce qui ne cause
  aucune dérive chez les consommateurs pendant la transition.
- **Consommateurs** : aucun repointage à ce stade ; les contrôles vault restent actifs, ce qui donne
  une double vérification.
- **Preuve de fin** : `--check` vert en CI ; `jq .canons.aec.distribution_sha256` identique dans les
  deux manifestes ; `sha256sum` des 5 copies déclarées = valeur du manifeste.

### Étape 2 — AEC : contrôles du monorepo rendus locaux, canon-sync retiré
- **Quoi** : remplacer le contenu de `scripts/ci/check-aec-hash.sh` et de
  `check-marketing-voice-hash.sh` par l'appel au `--check` local, sans réseau. Les workflows
  `agent-exit-contract-hash.yml` et `marketing-voice-hash.yml` déclenchent alors sur la source et le
  manifeste, sans `schedule` ni `repository_dispatch`. Supprimer `canon-sync.yml` et
  `scripts/ci/sync-canon-from-vault.sh` : la projection devient un `--write` exécuté dans la PR même
  qui modifie la source.
- **Repointer** : `.husky/pre-commit:30-51` vers le générateur local (fin de la dépendance au clone
  DEV) ; `governance-vault-ops/SKILL.md:38-40,108`.
- **Miroirs hors manifeste (décision owner)** : `workspaces/wiki/.claude/canon-mirrors/agent-exit-contract.md`
  (v1.0.0, périmé, M6) est à déclarer comme consommateur ou à supprimer.
  `.claude/canon-mirrors/exploration-budget.md` (M5) est à déclarer ou à reloger avec sa politique.
- **Preuve de fin** : un PR de test qui modifie un octet d'un miroir est rouge au pre-commit et en CI ;
  le run vert suivant porte sur le commit de fusion ; `gh run list -w canon-sync` ne montre plus de
  run planifié.

### Étape 3 — AEC : publication vers WIKI et RAW depuis le monorepo
- **Quoi** : nouveau workflow monorepo `canon-publish.yml`, porté de
  `governance-vault/.github/workflows/canon-publish.yml:58-105`. Sur un push `main` qui touche la
  source ou le manifeste, il lance `--check` puis le `repository_dispatch` `canon-updated` vers
  `ak125/automecanik-wiki` et `ak125/automecanik-raw` seulement (le monorepo n'en a plus besoin).
  `client_payload[canon]` doit être tiré du diff, pas fixé à `aec`.
- **Secrets (owner)** : créer `CANON_APP_ID` et `CANON_APP_PRIVATE_KEY` dans le monorepo (mêmes noms) ;
  vérifier que la GitHub App est installée sur wiki et raw avec la permission `Contents`.
- **Preuve de fin** : un `workflow_dispatch` du nouveau workflow produit un run `repository_dispatch`
  dans wiki et raw (`gh run list -R ak125/automecanik-wiki -w agent-exit-contract-hash -e repository_dispatch`).

### Étape 4 — AEC : WIKI et RAW vérifient contre le monorepo
- **WIKI** (PR ordinaire) : `_scripts/check-aec-hash.sh:13,24` lit
  `https://raw.githubusercontent.com/ak125/nestjs-remix-monorepo/main/<manifeste>`, ou passe par
  `gh api repos/ak125/nestjs-remix-monorepo/contents/<manifeste>`. Le monorepo est public : retirer le
  repli `VAULT_READ_TOKEN` du workflow l.36, `GITHUB_TOKEN` ou curl sans jeton suffit. Corriger le
  commentaire l.22 (« Vault is private »).
- **RAW** (PR ordinaire) : mêmes changements dans `_scripts/check-aec-hash.sh:13,23` et
  `.github/workflows/agent-exit-contract-hash.yml:35`. Le dépôt privé lit un dépôt public, donc pas de
  jeton supplémentaire.
- **Option** : épingler le manifeste lu sur un SHA ou un tag du monorepo plutôt que sur `main`.
  Sur `main`, une PR monorepo non fusionnée ne peut pas faire dériver wiki ou raw, mais une fusion les
  fait passer au rouge jusqu'à la PR de copie : c'est le comportement actuel, à conserver ou non
  (décision owner).
- **Preuve de fin** : run vert de `agent-exit-contract-hash` sur wiki et raw après fusion ; test
  négatif sur une branche (copie altérée = rouge) ; les journaux montrent l'URL du monorepo.
- **Décision owner** : rendre ce check requis sur `main` du wiki (aujourd'hui absent du ruleset).

### Étape 5 — Sort des pièces vault de la chaîne AEC
- `canon-publish.yml` (vault) : retirer la matrice de dispatch dans la PR vault préalable, ou le
  laisser mourir avec l'archive. Après l'archivage, plus aucun déclencheur.
- `99-meta/canon-hashes.json` : figé à `updated 2026-11-07`, avec un `$comment` « superseded by
  <chemin monorepo> » ajouté dans la PR vault préalable.
- `_scripts/compute-canon-hashes.py`, `sync_canon_mirrors.py`, `cron-sync-canon-mirrors.sh`,
  `test_canon_hashes.py`, `test_cron_sync_canon_mirrors.py` : portés à l'étape 1, puis archivés tels quels.
- **Preuve de fin** : `rg -n "governance-vault" .github scripts/ci .husky` dans le monorepo et
  `git grep governance-vault -- .github _scripts` dans wiki et raw ne renvoient plus de lecteur de
  l'AEC (seulement des liens).

### Étape 6 — Politique de fusion ADR-124 (lecteur actif, priorité haute)
- **Quoi** : `ledger/policies/merge-perimeter.v1.json` vers le monorepo. La propriété à garder (l.8-9
  du script) : une PR ne peut pas s'autoriser elle-même. La lire donc sur le commit de **base**
  `main` du monorepo, jamais sur la tête de PR, et ajouter son chemin à `deny_paths`, à une entrée
  owner-only d'`ownership.yaml` et aux CODEOWNERS.
- **Repointer** : `scripts/ci/merge-perimeter-gate.mjs:24-25,228-229` et ses tests.
- **À faire avant l'archive** : sinon la politique `active` devient immuable, et le fichier de pause
  DEV reste le seul frein.
- **Preuve de fin** : `--dry-run` sur une PR documentaire admise et sur une PR qui modifie la
  politique refusée ; tests `node --test scripts/ci/merge-perimeter-gate.test.mjs` verts.

### Étape 7 — Autres artefacts vivants du vault
- **Vecteur JCS** (`99-meta/jcs-parity-vector.json`, lu par `raw/_scripts/check-jcs-parity.py:59-61`)
  et son publisher : à reloger dans le monorepo avec la future entrée `source-score-weights`
  (commentée dans `CANONS` l.117-122), puis repointer RAW. Sinon le geler explicitement (check non requis).
- **Bundles OPA** (`dist/policies/*.wasm|*.tar.gz`, sources Rego, `opa-policy-build.yml`) : à reloger
  dans `policies/` du monorepo (existant), puis changer le défaut de `r2-opa-evaluator.service.ts:77`.
  Aujourd'hui latent (deny-all sans `opa-wasm`).
- **`vault-supabase-cost-check.yml`** (`SUPABASE_ACCESS_TOKEN`) : reloger s'il reste utile.
- **`vault-canon-exists.yml`** : chercher l'ADR dans le nouveau registre de décisions du monorepo
  **et** dans l'archive, sinon faux « manquant ».
- **Preuve de fin** : chaque lecteur repointé a un run vert qui montre la nouvelle source.

### Étape 8 — Machine DEV et agents
- `governance-vault-ops` : réécrire en « archive en lecture seule » (vérifier une ADR historique,
  citer un SHA) ; retirer la préparation de PR vault. Mettre à jour CLAUDE.md §Gouvernance,
  `.claude/knowledge/README.md:35,129`, `workspaces/*/.claude/rules/*-batch.md`, les
  `workspaces/*/AGENTS.md` et le CLAUDE.md du wiki (l.115-119).
- Scripts : `check-verdict-expirations.sh` (non branché) à repointer ou retirer ;
  `simulate-escalation-hijack.sh` est déjà cassé (chemins v1).
- DEV : une fois plus aucun lecteur local, l'owner arrête la ligne de crontab `vault-sync.sh` et
  retire `github-vault`/`vps-vault` de `knowledge-jobs/collection/sources.json` (ou les marque
  archive) ; retirer `governance-vault` de la portée de `automecanik-gh-app-token:17`.
- **Preuve de fin** : `rg -n "/opt/automecanik/governance-vault" scripts .husky backend/src tools`
  vide (hors archive citée) ; le hook SessionStart ne signale plus `vault-sync` muet.

### Étape 9 — Archivage (owner)
- Prérequis : étapes 1 à 7 fusionnées et prouvées sur leurs runs. La PR vault finale (AEC 1.3.0,
  manifeste annoté, dispatch retiré) est fusionnée.
- Acte : archivage du dépôt par l'owner. Après lui, vérifier que wiki, raw et monorepo restent verts
  sur leur prochain cron (03:30Z) sans lire le vault.
