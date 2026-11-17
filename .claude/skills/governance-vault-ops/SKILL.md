---
name: governance-vault-ops
description: Use when reading the governance-vault archive — what a historical ADR, rule or incident decided, whether its rule is still in force, citing it by path and SHA — or when asked to change the vault (answer — it is a read-only archive, a new principle goes to the monorepo journal by PR). Triggers — "verify ADR-X", "que disait ADR-X", "amend ADR-X", "open vault PR", "vault archive", "canon mirror drift".
type: discipline
status: stable
owners: ['@ak125']
domain: D15
runtime_class: privileged
llm_safe: false
last_verified: '2026-11-17'
license: Internal - Automecanik
compatibility: Claude Code on the DEV machine. Reads the vault clone ($GOVERNANCE_VAULT_PATH, default /opt/automecanik/governance-vault) with `git -C`, or the GitHub API through an authenticated gh, without ever writing to the vault.
tags: [governance, vault, archive, read-only, adr-138, audit]
metadata:
  version: "3.0"
  spec: agentskills.io/specification v1
  adr_references: "ADR-015, ADR-101, ADR-102, ADR-138"
---

# Skill: governance-vault-ops

Le vault `ak125/governance-vault` est une **archive en lecture seule** (décisions 72 et 73,
ADR-138). La gouvernance vit dans le monorepo : `.claude/governance/journal-des-principes.md` et
les contrats de département de `.spec/00-canon/ai-registry/agent-operating-map.yaml`. Ce skill sert
à **lire** l'archive : retrouver ce qu'une ADR a décidé, la citer par chemin et SHA, dire si sa
règle est encore en vigueur. En cas de doute, `CLAUDE.md` §Gouvernance prime sur ce skill.

---

## Ce qui fait foi

- **En vigueur = fusionné sur `main` du monorepo** : le journal des principes et les contrats de
  département, vérifiés par schéma en CI.
- **Une ADR, une règle ou une policy du vault explique une décision.** Elle n'est plus normative
  par elle-même, quel que soit son `status`. Sa règle n'est en vigueur que si un principe du
  journal ou un contrat la reprend ; chaque principe cite son ADR d'origine.
- **Un principe nouveau s'écrit au journal par PR** (circuit élevé). Pas de nouvelle ADR.
- **Monorepo `.spec/00-canon/**`** : un fichier lu par du code, un générateur ou un check CI est un
  **contrat** (fait foi dans son domaine) ; sinon c'est de la **prose de référence**, sans autorité,
  même avec « Status: CANON » en en-tête.
- **Un écart entre une règle et le code est un constat** : le signaler, puis le résoudre par une PR
  de code ou par une ligne du journal. Le code observé n'accorde pas une dérogation de sécurité.

---

## Règles dures

1. **Aucune écriture dans le vault.** Un agent n'y ouvre, ne fusionne et ne ferme aucune PR.
   Jusqu'à l'archivage, les PR qui restent sont signées, fusionnées ou fermées par l'owner. Une
   écriture exceptionnelle avant l'archivage exige son mandat nominatif ; la procédure (worktree,
   commits signés, checks requis) est dans le vault lui-même : `_scripts/preflight-write.sh` et
   `.githooks/`.
2. **Jamais d'écriture dans le clone.** Le clone de `$GOVERNANCE_VAULT_PATH` reste sur `main` : le
   lire avec `git -C`, ne jamais y faire `cd`, `checkout` ni commit. Jamais d'écriture dans
   `app/.local/governance-vault/`.
3. **Aucune copie du vault dans le monorepo.** Le pre-commit husky refuse tout fichier sous
   `governance-vault/`.
4. **Citer, ne pas recopier.** Une référence à l'archive donne le chemin et le SHA de `origin/main`
   du vault au moment de la lecture.
5. **Demande d'amender ou de créer une ADR** : répondre que le vault n'en reçoit plus. Proposer la
   ligne du journal (PR dans le monorepo) ou le champ de contrat (patch pour l'owner :
   `.spec/00-canon/**` lui est réservé).

---

## Lire l'archive

```bash
V="${GOVERNANCE_VAULT_PATH:-/opt/automecanik/governance-vault}"
git -C "$V" rev-parse origin/main                                   # SHA à citer
git -C "$V" ls-tree --name-only origin/main ledger/decisions/adr/ | grep 'ADR-031-'
git -C "$V" show origin/main:ledger/decisions/adr/<fichier>.md | sed -n '1,40p'
```

Sans clone local :

```bash
gh api repos/ak125/governance-vault/commits/main --jq .sha
gh api repos/ak125/governance-vault/contents/ledger/decisions/adr/<fichier>.md --jq .content | base64 -d
```

---

## Vérifications ponctuelles

| Question | Commande |
|---|---|
| La règle d'une ADR est-elle en vigueur ? | `rg -n 'ADR-0XX' .claude/governance/journal-des-principes.md` ; sinon chercher le contrat de département ; sinon elle ne l'est pas |
| Que disait une ADR ? | frontmatter (`status`, `superseded_by`) et corps sur `origin/main` du vault |
| Une ADR n'existe-t-elle qu'en PR jamais fusionnée ? | `gh pr list --repo ak125/governance-vault --state all --search 'ADR-0XX'` |
| PR du vault encore ouvertes | `gh pr list --repo ak125/governance-vault --state open --limit 100` |
| Signature d'un commit de `main` du vault | `gh api repos/ak125/governance-vault/commits/<sha> --jq .commit.verification` |
| Miroirs canon à jour ? | `python3 scripts/canon/compute-canon-hashes.py --check` (voir « Miroirs canon ») |

Un `git verify-commit` local échoue sur un commit squash de `main` : la clé de GitHub n'est pas dans
`allowed_signers`. La preuve est `verification.verified` dans l'API.

---

## Miroirs canon

Les canons distribués (AEC, voix de marque) ne se lisent plus dans le vault. Leur source, le
manifeste et le générateur sont dans le monorepo (journal des principes, P30) :
`.spec/00-canon/canon-distribution/` et `scripts/canon/compute-canon-hashes.py`. Contrôle, local et
sans réseau : `python3 scripts/canon/compute-canon-hashes.py --check` ; c'est celui du pre-commit
husky et de `canon-distribution.yml`. Une copie de `.claude/canon-mirrors/` ne s'édite jamais à la
main : on corrige sa source, puis `--write` régénère les copies dans la même PR.

---

## Termes retirés (ADR-102)

« Airlock » désigne le **RPC gate** seul (ADR-003, ADR-010 §1–3). Le canal de bundles
(`agent-submissions`, `airlock.sh`, `gov airlock`, `evidence-pack.sh`) est retiré : dans un texte
historique, « bundle » se lit « PR sur le dépôt cible ».
