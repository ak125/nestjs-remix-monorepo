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

La feuille « Contrats de département et indicateurs AutoMecanik », onglet « Décisions du 15 nov. »,
n'a pas été trouvée. Seules les décisions 72 et 73, citées dans le mandat, sont reprises. Les
champs que cette feuille devait remplir, dont tous les `seuil_action`, portent
`pending_owner_decision` avec la raison. Le schéma les accepte, et
`validate-agent-operating-map.js --contracts` les compte (46 au 2026-11-16). Aucun numéro de
décision ni aucun seuil n'a été inventé.
