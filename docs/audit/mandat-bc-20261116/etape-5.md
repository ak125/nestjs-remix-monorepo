# Mandat BC — étape 5 : sort des pièces du vault de la chaîne AEC

Étape 5 du plan de sortie (`docs/audit/mandat-ar-20261116/inventaire-vault-et-plan.md`).
Cette étape n'écrit rien : le vault ne reçoit plus de PR. Elle dit ce que deviennent ses pièces
et rejoue le comptage qui sert de preuve de fin. Relevé du 17 novembre 2026 : monorepo
`abcfc30c3`, wiki `13869631b`, raw `b097ca48a`, vault `b2e712791bee`.

## Sort des pièces

| Pièce du vault | Sort | Remplacée par |
|---|---|---|
| `.github/workflows/canon-publish.yml` | reste tel quel, s'éteint à l'archivage | étape 3, #2126 |
| `99-meta/canon-hashes.json` | figé à sa valeur du 16 nov. | manifeste du monorepo, #2112, fusionnée |
| `_scripts/compute-canon-hashes.py` et ses tests | archivés tels quels | `scripts/canon/compute-canon-hashes.py`, #2112 |
| `_scripts/sync_canon_mirrors.py`, `cron-sync-canon-mirrors.sh` et leurs tests | archivés tels quels | contrôle local de l'étape 2, #2125 |

Écart au plan : le manifeste du vault ne porte pas le commentaire « superseded by » que le plan
prévoyait d'y ajouter. Son empreinte de l'AEC est égale à celle du monorepo
(`ed479960…785931f`) et plus rien ne le lit après l'étape 4. L'ajouter demanderait une PR
signée dans le vault : non proposé.

## Comptage rejoué

`git grep governance-vault` sur `.github`, `scripts/ci`, `.husky` (monorepo) et sur `.github`,
`_scripts` (wiki, raw). « Après » = `main` plus les PR du mandat et leurs patches, fusion simulée
sans toucher aux branches.

| Dépôt | Sur `main` | Après | Ce qui reste après |
|---|---|---|---|
| monorepo | 34 lignes, 13 fichiers | 20 lignes | commentaires et liens ; la garde husky qui refuse une copie du vault |
| wiki | 6 lignes, 4 fichiers | 3 lignes | 2 liens vers ADR-059, 1 commentaire d'historique du script |
| raw | 8 lignes, 5 fichiers | 6 lignes | commentaires d'historique ; un test qui exige l'absence du mot |

Lecteurs de l'AEC encore sur `main`, et la PR qui retire chacun :

| Lecteur | Retiré par |
|---|---|
| monorepo : `scripts/ci/check-aec-hash.sh`, `check-marketing-voice-hash.sh`, `sync-canon-from-vault.sh`, `canon-sync.yml`, les deux workflows de contrôle | étape 2, #2125 et patch 08 |
| wiki : `_scripts/check-aec-hash.sh` et son workflow | étape 4, wiki #140 et patch 10 |
| raw : `_scripts/check-aec-hash.sh` et son workflow | étape 4, raw #82 et patch 11 |

Hors AEC, relevés par le même comptage et traités ailleurs : `merge-perimeter-gate.mjs`
(étape 6, #2113), `vault-canon-exists.yml`, `.husky/pre-commit:28,32` et le service OPA de R2
(étape 7, #2120), `jcs-parity` de raw (étape 7, raw #81).

Après toutes ces PR, aucun workflow ni script des trois dépôts ne lit `VAULT_READ_TOKEN` : il
ne reste que dans des documents d'audit et dans les lignes retirées des patches.

## Ce qui lit encore le vault après les étapes 1 à 8

| Lecteur | Nature | Sort |
|---|---|---|
| `scripts/governance/check-verdict-expirations.sh:25` | script branché nulle part | question D10 (étape 8) |
| `tools/security/attack-simulations/simulate-escalation-hijack.sh:35,136` | script manuel, déjà en erreur | question D11 (étape 8) |
| tâche planifiée du DEV, toutes les 5 minutes : `vault-sync.sh` | hors dépôt, tient à jour le clone local | à retirer par l'owner à l'archivage, étape 9 |
| skill `governance-vault-ops` et lecture d'une ADR par `git -C` | lecture d'archive, voulue | reste |

## État

| État | Constat |
|---|---|
| Implémenté | sans objet : aucune écriture |
| Intégré | non : la preuve dépend de #2125, wiki #140 et raw #82, en brouillon |
| Vérifié | comptage rejoué sur `main` et sur la fusion simulée |
| Opérationnel | non : sur `main`, trois scripts du monorepo, un du wiki et un de raw lisent encore le vault |
| Bloqué | par les fusions des étapes 2 et 4 (gestes de l'owner) |

Preuve de fin du plan : « les greps ne renvoient plus de lecteur de l'AEC, seulement des
liens ». Vraie sur la fusion simulée, pas encore sur `main`. À rejouer par l'agent après les
fusions.
