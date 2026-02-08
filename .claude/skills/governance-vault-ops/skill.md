# Skill: governance-vault-ops

Objectif: opérer le vault Obsidian `governance-vault` comme un registre (ledger) auditable:
- **automatisé** (diff, sync, checks, audit)
- **non-autonome** (humain décide)
- **signé** (SSH signing obligatoire)
- **single write point** (Deploy VPS uniquement)
- **CI read-only** (jamais de push/commit CI)

---

## Contexte & chemins (par défaut)

- Vault repo: `/opt/automecanik/governance-vault`
- Canon (monorepo): `/opt/automecanik/app/.spec/00-canon`
- Scripts vault:
  - `./scripts/sync-canon.sh`
  - `./scripts/check-orphans.sh`
  - `./scripts/audit-signatures.sh`
- Les commits doivent afficher: `Good "git" signature ...`

> Si ces chemins diffèrent, les fournir à l'utilisateur et/ou les rendre configurables via variables d'environnement.

---

## Règles (hard blocks)

1) **CI READ-ONLY**
- Interdit: GitHub Actions qui commit/push dans le vault.
- Interdit: tokens write pour le vault en CI.
- Autorisé: CI en lecture (tests, lint, audits) sans push.

2) **SIGNED COMMITS ONLY**
- Tous les commits doivent être signés (SSH signing).
- Si un commit non signé est détecté: STOP, corriger, ne pas "contourner".

3) **SINGLE WRITE POINT**
- Un seul poste autorisé pour écrire/push: Deploy VPS.
- Interdit: push depuis laptop/PC/devbox non autorisé.

4) **CANON IS SOURCE OF TRUTH**
- Les docs canon vivent dans `.spec/00-canon/` du monorepo.
- Le vault est un miroir enrichi + ledger opérationnel.
- Sync: canon → vault uniquement.

---

## Workflows (utilisation quotidienne)

### A) "Je n'y pense jamais" (commande unique)
Commande recommandée: `gov` (script).
- Fait un dry-run sync canon → vault
- Montre les changements
- Demande confirmation
- Si OK: sync + commit signé + check-orphans + push

Usage:
- `gov` (par défaut)
- `gov --no-push` (commit sans push)
- `gov --dry-run` (forcer l'affichage uniquement)
- `gov --message "..."` (message de commit custom)

---

### B) Ajouter un incident / décision / règle "vault" (manuel + safe)
1) Créer un fichier depuis template (incidents/decisions/rules)
2) Remplir le contenu
3) Exécuter:
   - `./scripts/check-orphans.sh .`
4) Commit signé + push

---

### C) Audit mensuel signatures
1) Générer rapport:
   - `./scripts/audit-signatures.sh --report`
2) Commit signé + push du rapport

---

## Gestion des erreurs (playbooks)

### 1) "Good signature" absent dans `git log --show-signature -1`
- Cause probable: signature non configurée, ou commit non signé.
- Action:
  - vérifier `git config --get commit.gpgsign` (doit être `true`)
  - vérifier `git config --get gpg.format` (doit être `ssh`)
  - vérifier `git config --get user.signingkey` (doit pointer sur `.pub`)
  - refaire un commit vide signé test: `git commit --allow-empty -S -m "test: signed commit"`

### 2) Push bloqué par hook pre-push (unsigned commit)
- C'est normal et souhaité.
- Action:
  - annuler le commit non signé (`git reset --hard HEAD~1`) si c'est un test
  - ou refaire un commit signé (pas de contournement)

### 3) Orphans détectés (check-orphans)
- Action:
  - ajouter les liens manquants dans les MOCs
  - ou marquer correctement "deprecated/archived" selon conventions
  - relancer `check-orphans.sh` jusqu'à zéro

### 4) Conflit / divergence canon ↔ vault
- Le canon gagne.
- Action:
  - exécuter `sync-canon.sh` en dry-run
  - inspecter diff
  - valider humainement
  - appliquer avec commit signé

---

## Checklists (avant push)

- [ ] `git log --show-signature -1` affiche `Good "git" signature`
- [ ] `./scripts/check-orphans.sh .` => "No orphans found"
- [ ] Aucune action CI n'a commité/poussé dans le vault
- [ ] Les changements canon→vault sont confirmés humainement

---

## Sorties attendues (validation)

- Signature: `Good "git" signature for vault-signing@...`
- Orphans: `✅ No orphans found`
- Sync dry-run: liste claire des fichiers qui changent
- Sync commit: commit signé + push réussi

---

## Gouvernance de la commande `gov`

- `gov` doit être idempotent et safe:
  - default = dry-run + confirmation
  - stop si repo dirty non géré, si hooks manquants, si orphans, ou si signature absente
- `gov` doit produire des messages clairs et courts:
  - ce qu'il va faire
  - ce qu'il a détecté
  - ce qui est bloquant
