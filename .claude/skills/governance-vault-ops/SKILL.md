---
name: governance-vault-ops
description: Use when operating the Obsidian governance-vault as an auditable ledger — sync canon mirrors, check orphans, audit signatures, propose ADR/rule edits, never write directly. Triggers — "sync vault canon", "audit vault signatures", "open vault PR", "verify ADR-X", or any task touching governance-vault/ or .claude/canon-mirrors/.
type: discipline
status: stable
owners: ['@ak125']
domain: D15
runtime_class: privileged
llm_safe: false
last_verified: '2026-07-05'
license: Internal - Automecanik
compatibility: Designed for Claude Code on the DEV VPS (single-write-point per ADR-015). Requires /opt/automecanik/governance-vault checkout, SSH signing configured, GOVERNANCE_VAULT_PATH env var. CI read-only enforced.
tags: [governance, vault, adr-015, ssh-signing, ledger, audit]
metadata:
  version: "1.0"
  spec: agentskills.io/specification v1
  adr_references: "ADR-015, ADR-058, ADR-061"
---

# Skill: governance-vault-ops

Objectif: opérer le vault Obsidian `governance-vault` comme un registre (ledger) auditable:
- **automatisé** (diff, sync, checks, audit)
- **non-autonome** (humain décide)
- **signé** (SSH signing obligatoire)
- **single write point** (Deploy VPS uniquement)
- **CI read-only** (jamais de push/commit CI)

---

## Contexte & chemins (par défaut)

- Vault repo (**SoT canonique**, write): `/opt/automecanik/governance-vault`
- Miroirs canon (monorepo, **read-only**, hash-lockés) : `/opt/automecanik/app/.claude/canon-mirrors`
- Scripts vault (sous `_scripts/` dans le repo vault) :
  - `_scripts/check-orphans.sh`
  - `_scripts/audit-signatures.sh`
  - `_scripts/cron-sync-canon-mirrors.sh` / `_scripts/sync_canon_mirrors.py` (sync **vault → miroirs monorepo**, cf. Règle 4)
  - `_scripts/sync-canon.sh` — **legacy** (`.spec/00-canon` → vault ; superseded, cf. Règle 4)
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

4) **VAULT = SOURCE OF TRUTH CANONIQUE** (sens du flux — cf. CLAUDE.md §Gouvernance, ADR-012/015)
- Le canon (ADR / rules / policies) est **écrit dans le vault** (`ak125/governance-vault`, single-write-point DEV). Toute mutation canon = **PR vault signée G3** — **jamais** écrite dans le monorepo.
- Le monorepo ne contient que des **miroirs read-only hash-lockés** (`.claude/canon-mirrors/`), synchronisés **vault → monorepo** (`_scripts/cron-sync-canon-mirrors.sh` / `sync_canon_mirrors.py`). Ne jamais les éditer à la main.
- Les docs legacy `.spec/00-canon/*` (`architecture.md`, `rules.md`, `governance-policy.md`…) = **sans autorité courante** (fermeture gouvernée) — SAUF `.spec/00-canon/repository-registry/**` (surface L2 du Repository Control Plane, ADR-058/062).
- ⚠️ **Legacy** : `_scripts/sync-canon.sh` (`.spec/00-canon` → vault) reflète un staging **superseded** par le modèle vault=SoT ci-dessus. Ne pas traiter `.spec/00-canon` comme source canon.

---

## Workflows (utilisation quotidienne)

### A) "Je n'y pense jamais" (commande unique)
> ⚠️ `gov`/`sync-canon.sh` = chemin **legacy** `.spec/00-canon → vault` (cf. Règle 4). La sync
> canon **courante** est `vault → miroirs monorepo` via `_scripts/cron-sync-canon-mirrors.sh`
> (automatisée). N'utiliser `gov` que pour le staging legacy, jamais pour « écrire du canon ».

Commande recommandée: `gov` (script).
- Fait un dry-run sync `.spec/00-canon` → vault (legacy)
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
   - `_scripts/check-orphans.sh .`
4) Commit signé + push

---

### C) Audit mensuel signatures
1) Générer rapport:
   - `_scripts/audit-signatures.sh --report`
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

### 4) Conflit / divergence `.spec/00-canon` (legacy) ↔ vault
- Le **vault** (SoT canonique) gagne — cf. Règle 4. Les docs `.spec/00-canon` legacy ne priment **jamais** sur le vault.
- Action:
  - exécuter `sync-canon.sh` en dry-run
  - inspecter diff
  - valider humainement
  - appliquer avec commit signé

---

## Checklists (avant push)

- [ ] `git log --show-signature -1` affiche `Good "git" signature`
- [ ] `_scripts/check-orphans.sh .` => "No orphans found"
- [ ] Aucune action CI n'a commité/poussé dans le vault
- [ ] Les changements de sync (legacy `.spec/00-canon` → vault) sont confirmés humainement

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
