---
name: governance-vault-ops
description: Use when preparing a change to the governance-vault (ADR, rule, policy, incident, MOC, `_scripts/`), checking whether a vault document is normative, verifying vault signatures or branch protection, or touching `.claude/canon-mirrors/`. Triggers — "open vault PR", "amend ADR-X", "verify ADR-X", "audit vault signatures", "vault branch protection", "canon mirror drift".
type: discipline
status: stable
owners: ['@ak125']
domain: D15
runtime_class: privileged
llm_safe: false
last_verified: '2026-10-01'
license: Internal - Automecanik
compatibility: Claude Code on the DEV machine. Reads the vault runtime clone ($GOVERNANCE_VAULT_PATH, default /opt/automecanik/governance-vault) without ever writing to it; works in a linked worktree under the session scratchpad. Needs SSH commit signing with a key registered on GitHub, an authenticated gh, Python 3.11 with PyYAML for the vault gates.
tags: [governance, vault, adr-101, adr-102, ssh-signing, ledger, audit]
metadata:
  version: "2.0"
  spec: agentskills.io/specification v1
  adr_references: "ADR-015, ADR-061, ADR-101, ADR-102"
---

# Skill: governance-vault-ops

Le vault `ak125/governance-vault` est un registre de décisions. Un agent y **prépare** des PR
signées ; un humain les **fusionne**. Tout ce qui suit découle de deux ADR acceptés :
ADR-101 (le vault décide) et ADR-102 (canal unique = PR, G4 v3.1.0). En cas de doute, lire ces
ADR sur `origin/main` du vault : ils priment sur ce skill.

---

## Ce qui fait foi (ADR-101)

- **Normatif** : les ADR `status: accepted` sans `superseded_by` actif, et les règles
  `ledger/rules/rules-*.md`. Un ADR `proposed`, `deprecated` ou `superseded` est du contexte.
- **Monorepo `.spec/00-canon/**`** : un fichier lu par du code, un générateur ou un check CI est un
  **contrat** (fait foi dans son domaine) ; sinon c'est de la **prose de référence**, sans autorité,
  même avec « Status: CANON » en en-tête.
- **Une divergence décision ↔ code est un constat** : la signaler, puis la résoudre par une PR de
  code ou par un ADR qui amende. Ne jamais l'arbitrer en silence.
- **Synchronisation : vault → monorepo seulement.** `.claude/canon-mirrors/` est généré par
  `_scripts/sync_canon_mirrors.py` (ADR-061 §3) ; le pre-commit husky refuse une édition à la main.
  Il n'existe plus de synchronisation monorepo → vault (`sync-canon.sh` et `gov` sont supprimés).

---

## Règles dures

1. **Aucune écriture directe sur `main`** (G4.1). Toute modification passe par une PR aux commits
   signés (G3), sous les 7 checks requis.
2. **Un agent prépare, un humain fusionne** (G4.2). L'agent ne lance jamais `gh pr merge` sur le
   vault, même pour une PR qu'il a ouverte et même sur un « go » général. Il donne à l'owner le
   numéro, le SHA de tête (40 caractères) et la commande de fusion.
3. **La CI ne produit aucun contenu du vault** (G4.3), vérifié par `_scripts/check-ci-read-only.py`.
   Les fichiers `.github/` sont réservés à l'owner.
4. **Jamais d'écriture dans le clone runtime.** Le clone de `$GOVERNANCE_VAULT_PATH` est réaligné sur
   `origin/main` toutes les 5 minutes par un cron et doit rester sur `main` : le lire avec `git -C`,
   ne jamais y faire `cd`, `checkout` ni commit. Jamais d'écriture dans `app/.local/governance-vault/`
   (déprécié).
5. **Signatures vérifiées par GitHub.** `required_signatures` est actif : chaque commit de la PR doit
   être signé par une clé enregistrée comme *Signing Key* (K001/K002, `99-meta/key-registry.md` du vault), avec
   l'e-mail committer vérifié du compte. Un commit non vérifié rend la PR non fusionnable.
6. **Squash seul, tête épinglée.** Le merge rebase est désactivé au niveau du dépôt (il recrée les
   commits sans signature). Jamais `gh pr update-branch` : le commit de merge qu'il crée n'est pas
   signé par une clé du registre et G3 échoue. Une PR en retard se met à jour par un
   `git merge origin/main` signé dans le worktree.

---

## Workflow — préparer une PR vault

```bash
V="${GOVERNANCE_VAULT_PATH:-/opt/automecanik/governance-vault}"
WT="<scratchpad>/wt-vault-<sujet>"
git -C "$V" fetch -q origin
git -C "$V" worktree add "$WT" -b <type>/<sujet>-<AAAAMMJJ> origin/main
bash "$WT/_scripts/preflight-write.sh"     # exit 0 = GO (accepte un worktree)
```

Puis, dans le worktree :

1. **Écrire** depuis `_templates/` (`adr-template.md`, `rule-template.md`, `incident-template.md`…).
   Incident : `_scripts/new-incident.sh <severity> <slug>`.
2. **Nouvel ADR** : numéro = max des ADR de `main` **et** des PR ouvertes (`gh pr list --limit 100`),
   plus un. L'index de `ops/moc/MOC-Decisions.md` est généré : `python3 _scripts/sync_moc_decisions.py --write`,
   jamais d'édition entre ses marqueurs.
3. **Gates locaux** (mêmes contrôles que la CI) :
   - `bash _scripts/ci-vault-gate.sh pr` → `VERT` (sort 2 sans PyYAML : ce n'est pas un vert) ;
   - `python3 -m pytest -q -p no:cacheprovider _scripts` si `_scripts/` change ;
   - hooks `.githooks/` (`core.hooksPath`) : pre-commit G2 + wikilinks, pre-push G3.
4. **Commit signé** (`git commit -S`), contrôlé par `git log --show-signature -1` → `Good "git" signature`.
5. **Push** de la branche, puis `gh pr create --base main`. Corps de PR : pourquoi, quoi, preuves
   (sorties de commandes), étapes après fusion.
6. **Attendre la CI**, puis remettre à l'owner : numéro, SHA de tête, et
   `gh pr merge <N> --repo ak125/governance-vault --squash --match-head-commit <sha40>`.

Une PR empilée (base ≠ `main`) n'a aucune CI : les workflows ne se déclenchent que sur une PR vers
`main`.

---

## Vérifications ponctuelles

| Question | Commande (dans un worktree ou via `git -C`) |
|---|---|
| Un ADR est-il normatif ? | frontmatter `status` + `superseded_by` sur `origin/main` ; index `ops/moc/MOC-Decisions.md` |
| Protection de `main` et méthodes de merge conformes ? | `_scripts/setup-branch-protection.sh --check` (lecture seule ; sortie 1 = écart) |
| Signatures de l'historique | `_scripts/audit-signatures.sh` (`--report` écrit un rapport, à committer par PR) |
| Signature d'un commit de `main` (squash signé par GitHub) | `gh api repos/ak125/governance-vault/commits/<sha> --jq .commit.verification` |
| Orphelins / liens cassés | `_scripts/check-orphans.sh .` ; `_scripts/check-broken-links.sh` |
| Miroirs canon à jour ? | `python3 "$V/_scripts/sync_canon_mirrors.py" --check --monorepo <checkout monorepo>` |

Un `git verify-commit` local échoue sur un commit squash de `main` : la clé de GitHub n'est pas dans
`allowed_signers`. La preuve est `verification.verified` dans l'API.

---

## Playbooks

### Signature absente ou non vérifiée

- `git config --get commit.gpgsign` = `true`, `gpg.format` = `ssh`, `user.signingkey` pointe sur la clé.
- `user.email` = l'e-mail vérifié du compte qui porte la *Signing Key* (sinon `verified: false`).
- Corriger en réécrivant les commits de la branche avec signature, jamais en contournant le hook
  (`--no-verify`) ni la protection.

### Check requis rouge

Lire le log du job (`gh run view --log-failed`), corriger la cause dans la PR. Ne jamais proposer de
retirer un check requis ou d'en assouplir un pour faire passer une PR.

### Agent qui écrit hors de son mandat (ADR-102 D4)

Il n'existe plus de kill-switch (`AI_VAULT_WRITE` est retiré). Fermer ses PR ouvertes, puis faire
révoquer par l'owner sa clé de signature (« Procédure de Révocation » de `99-meta/key-registry.md`) et le jeton
GitHub de la machine qui l'exécute.

---

## Termes retirés (ADR-102)

« Airlock » désigne désormais le **RPC gate** seul (ADR-003, ADR-010 §1–3). Le canal de bundles
(`agent-submissions`, `airlock.sh`, `gov airlock`, `evidence-pack.sh`) est retiré : dans un texte
historique, « bundle » se lit « PR sur le dépôt cible ». Les evidence-packs se créent à la main sous
`ledger/compliance/evidence-pack/`.
