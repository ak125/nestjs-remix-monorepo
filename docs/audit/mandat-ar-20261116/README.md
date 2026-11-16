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
| AR-4 point 1. Dernière PR du vault | ak125/governance-vault#422 (ADR-138, AEC 1.3.0) ; signature et fusion : [`commandes-owner.md`](commandes-owner.md) §11 | PR ouverte, non signée |
| AR-4 point 2. `CLAUDE.md` | [`patches/05-claude-md.patch`](patches/05-claude-md.patch) ; application : §12 | patch, non appliqué |
| AR-4 point 3. Contradictions A, B, C12, D16, E19 | fichiers non réservés ; états dans [`contradictions.md`](contradictions.md) | corrigé dans la PR #2107 |
| AR-4 point 4. Textes d'agents | [`textes-agents-vault.md`](textes-agents-vault.md) | constat |
| AR-4 point 5. `pull_request_target` | [`commandes-owner.md`](commandes-owner.md) §13 | geste de l'owner |
| AR-5. Authentification de la revue Claude | [`patches/06a`, `06b`, `07a`, `07b`](patches/) ; [`commandes-owner.md`](commandes-owner.md) §4 et §14 | patches, non appliqués |

## Correctifs `.github/`

Le hook `scripts/claude-hooks/pretool-file-guard.sh` réserve `.github/**` à l'owner. L'agent a donc
livré quatre correctifs, que l'owner a appliqués sur cette branche le 2026-11-16 (commit
`4672ba04d`, décision 98 pour le modèle de la revue). Les fichiers de `patches/` restent comme
trace : ils sont identiques à ce qui a été appliqué.

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
