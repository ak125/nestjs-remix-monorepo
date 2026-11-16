# Mandat AR — système de gouvernance (décisions 72 et 73)

Relevé et candidat du 2026-11-16, base `origin/main` `8c2f87f9c3a2bddf7b7dd2e614c5b15f6f079230`.
Le rapport complet (session, empreinte du diff, tests, limites) est dans le corps de la PR.

## Index

| Point du mandat | Livrable | Nature |
|---|---|---|
| 1. Relevé de la CI | [`releve-ci.md`](releve-ci.md) | constat |
| 2. Schéma et contrats des 24 départements | `.spec/00-canon/ai-registry/agent-operating-map.schema.json`, `agent-operating-map.yaml` (champ `contract`), `scripts/governance/validate-agent-operating-map.js --contracts` | code, dans cette PR |
| 3. CODEOWNERS et trois circuits | [`patches/`](patches/), `scripts/ci/merge-circuit.mjs` et ses tests, [`commandes-owner.md`](commandes-owner.md) | classeur dans cette PR ; `.github/` en correctifs à appliquer par l'owner |
| 4. Journal des principes | `.claude/governance/journal-des-principes.md` | document, dans cette PR |
| 5. Tri des ADR | [`tri-adr.md`](tri-adr.md) | constat |
| 6. Lecteurs du Vault et plan de déplacement | [`inventaire-vault-et-plan.md`](inventaire-vault-et-plan.md) | constat et plan |
| 7. Contradictions | [`contradictions.md`](contradictions.md) | constat, une ligne corrigée |

## Pourquoi les correctifs `.github/` ne sont pas appliqués

Le hook `scripts/claude-hooks/pretool-file-guard.sh` réserve `.github/**` à l'owner. Les quatre
correctifs passent `git apply --check` sur la base. Ils s'appliquent par la commande du §2 de
[`commandes-owner.md`](commandes-owner.md).

## Champs de contrat en attente

Le complément au mandat AR (décisions de l'owner des 15 et 16 nov. 2026) a rempli les 24 contrats.
Chaque champ cite ses décisions par numéro, sans en recopier le texte ni aucun montant. Les règles
communes (rapport, fiche de fiabilité, seuil franchi, donnée absente, sources) sont dans
`department_contract_common`.

`validate-agent-operating-map.js --contracts` au 2026-11-16 :

- 16 champs en `pending_owner_decision`, dans 14 départements (46 avant le complément). Ce sont
  surtout des `seuil_action` que les décisions ne fixent pas, le N du département 15 (décision 27),
  et trois sources non désignées (08, 11, 18).
- 19 KPI décidés sans producteur (forme `definition` + `producer_pending`). Ils n'entrent pas au
  rapport tant qu'ils n'ont ni producteur ni fiche de fiabilité (décision 8).
- `kpi_primary` n'a pas changé. Les décisions 45, 49 et 40 remplacent `brand_trust`,
  `compat_and_displayed_availability` et `staff_coverage`, mais l'identifiant du nouveau KPI n'a pas
  été transmis : le contrat le dit, et rien n'a été inventé.
