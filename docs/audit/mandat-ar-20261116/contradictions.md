# Contradictions connues à corriger (mandat AR, point 7)

Relevé du 2026-11-16 sur `origin/main` `8c2f87f9c3a2`, en lecture seule. Chaque ligne cite le fichier
et la ligne, la règle contredite et l'état dans cette PR. Les états possibles : **corrigé dans le
candidat** (modifié dans cette PR), **correctif proposé** (patch déposé, à appliquer par l'owner),
**à corriger** (hors de cette PR, aucun changement).

Le mandat annonce 24 contradictions. Ce relevé en compte 23 lignes. Les conflits d'ADR (ligne 20)
renvoient au tableau de [`tri-adr.md`](tri-adr.md), qui en détaille 19. Aucune contradiction n'a été
ajoutée pour atteindre le nombre annoncé.

## A. Relecture humaine contre auto-review (ADR-119, CLAUDE.md invariant 4)

ADR-119 : aucune relecture humaine n'est une condition de promotion WIKI ; la fiche est validée par
son décideur sur preuve, auto-review de sens comprise.

| # | Où | Ce qui est écrit | Contredit | État |
|---|---|---|---|---|
| 1 | `workspaces/wiki/.claude/rules/wiki-batch.md:22` | promotion des propositions « manuelle reviewer humain » | ADR-119 ; CLAUDE.md invariant 4 | à corriger (règle de workspace, hors périmètre d'écriture de ce mandat) |
| 2 | `.spec/00-canon/ai-registry/agent-operating-map.yaml:77` (handoff `raw-to-wiki`) | `gate: "human_review_required (no CI enforcement)"` | ADR-119 | à corriger ; le schéma accepte la valeur, seule la décision de l'owner fixe la nouvelle |
| 3 | `agent-operating-map.yaml:805` (handoff `wiki-to-seo-readiness`) | `gate: human_review_required` | ADR-119 ; le verdict READY est calculé (ADR-033) | à corriger |
| 4 | `agent-operating-map.yaml:856` (handoff `content-to-seo-supply`) | `gate: human_review_required` | ADR-119 pour un contenu issu du WIKI | à corriger |
| 5 | `agent-operating-map.yaml:844` (handoff `diagnostic-to-catalog-part`) | `gate: human_review_required` | pas forcément une contradiction : le passage d'un diagnostic à une pièce touche la compatibilité ; **à trancher par l'owner** | à trancher |

## B. Contrôle qui passe à vide (ADR-125, CLAUDE.md invariant 3)

| # | Où | Ce qui est écrit | Contredit | État |
|---|---|---|---|---|
| 6 | `scripts/wiki/wiki-readiness-check.py:274-281` (C4) | lit `wiki/gammes/` ; absent ou vide, renvoie PASS (« N/A ») | ADR-125 §Mise en œuvre (vault, l.213) : le chemin est au singulier, C4 passe à vide ; CLAUDE.md invariant 3 (pas de succès qui masque une absence) | à corriger (PR monorepo prévue par ADR-125) |
| 7 | `scripts/wiki/wiki-readiness-check.py:39` et contrôle C5 | cite le même chemin `wiki/gammes/` | ADR-125, même ligne | à corriger, même PR que la ligne 6 |

## C. Le vault présenté comme source, contre la décision 72

| # | Où | Ce qui est écrit | État |
|---|---|---|---|
| 8 | `.spec/00-canon/ai-registry/agent-operating-map.schema.json:5` | « Hard-fail enforcement requires a vault ADR » | **corrigé dans le candidat** : les contrats sont bloquants en CI (décision 72) |
| 9 | `.github/workflows/skills-canon-gate.yml:125` | « Hard-fail enforcement = vault ADR required » | **correctif proposé** : `patches/03-skills-canon-gate-fixture.patch` |
| 10 | `.github/CODEOWNERS:7` | en-tête « ADR-015 (vault single source of truth) » | **correctif proposé** : `patches/01-codeowners.patch` |
| 11 | `CLAUDE.md:5` et `CLAUDE.md:102-104` (§Gouvernance) | « gouvernance canonique dans le dépôt séparé ak125/governance-vault » ; « aucune nouvelle ADR, rule, policy… dans ce monorepo » ; « changement vault = PR signée, fusion humaine » | à corriger par l'owner (`/CLAUDE.md` est en zone CODEOWNERS) ; texte proposé dans [`commandes-owner.md`](commandes-owner.md) §6 |
| 12 | `.claude/rules/deployment.md:5-7` et étape 1 du workflow nominal | vocabulaire « décidé au vault » ; fusion selon T6 de `rules-technical` (vault) et ADR-123/124 | à corriger après adoption des circuits (`.claude/rules/` en zone CODEOWNERS) |
| 13 | `scripts/ci/merge-perimeter-gate.mjs` | lit `ledger/policies/merge-perimeter.v1.json` sur `main` du vault | à déplacer **avant** l'archivage (plan, étape 1 de [`inventaire-vault-et-plan.md`](inventaire-vault-et-plan.md)) ; décision 73 |
| 14 | `.github/workflows/vault-canon-exists.yml:56-67,129` | cherche chaque ADR citée dans le vault | à repointer vers le registre de décisions du monorepo ; sinon toute nouvelle décision est signalée « manquante » |
| 15 | `.husky/pre-commit:30-51` | exécute `_scripts/sync_canon_mirrors.py --check` du clone du vault | à repointer (plan, étape AEC) |

## D. Miroirs du contrat AEC et des politiques

| # | Où | Ce qui est écrit | État |
|---|---|---|---|
| 16 | `workspaces/wiki/.claude/canon-mirrors/agent-exit-contract.md` | AEC **v1.0.0**, non déclaré dans le manifeste ; la version en vigueur est la v1.2.0 | à supprimer ou à déclarer ; aucun contrôle ne le voit |
| 17 | `.claude/canon-mirrors/exploration-budget.md:1-3` | copie manuelle du 2026-05-24, absente de `canon-hashes.json` | à déclarer ou à rapatrier comme source |
| 18 | dépôt WIKI, `.github/workflows/agent-exit-contract-hash.yml` → `_scripts/check-aec-hash.sh:22` | commentaire « Vault is private » | faux : le vault est public ; à corriger par PR WIKI |

## E. Règles et ADR du vault

| # | Où | Constat | État |
|---|---|---|---|
| 19 | `ledger/rules/rules-ai-cos.md` (vault) | règle sans objet depuis ADR-129, citée seulement par le README de `workspaces/marketing` | à retirer de la liste des règles reprises |
| 20 | ADR 013, 015, 020, 023, 048, 049, 053, 060, 061, 081, 101, 102, 120, 121, 123, 124, 125, 126, 127 | en conflit avec la décision 72 ou 73 (lieu de la source, forme des changements de règle, fusion) | détail ligne par ligne dans [`tri-adr.md`](tri-adr.md) ; tranché par l'owner, jamais par l'agent |
| 21 | ADR-031, ADR-119, ADR-125 | trois textes successifs pour une seule règle RAW → WIKI → consommateurs | condensé en un principe dans `.claude/governance/journal-des-principes.md` (principe P10) |

## F. Fusion par un agent (ADR-102, ADR-121) contre les trois circuits (décision 72)

| # | Où | Constat | État |
|---|---|---|---|
| 22 | ADR-102 « un agent ne fusionne jamais », ADR-121 D4, ADR-123 (périmètre au vault) | la décision 72 confie la fusion des circuits faible et moyen à GitHub (auto-fusion armée par un workflow, jamais par l'agent) | proposé : `patches/04-merge-circuits-workflow.patch` ; l'agent ne fusionne toujours pas ; la porte ADR-124 reste en place jusqu'à décision de l'owner |
| 23 | `.github/workflows/dependabot-auto-merge.yml` | arme `gh pr merge --auto --squash` avec `GITHUB_TOKEN` : la fusion ne déclenche pas `ci.yml` sur `main` (chaîne PREPROD) | à aligner sur le jeton d'App du workflow des circuits ; voir [`releve-ci.md`](releve-ci.md) |
