# Fermetures proposées par le triage de la file (ADR-128 D6)

Commandes `gh issue close` des 166 lignes marquées « fermer » dans
`docs/plans/2026-11-15-adr128-triage-file.md`, au commit `f6a6814ae9e8801ca0907dba3b77dd89ca6d5bf3`.
**Non exécutées** : chaque fermeture est une décision de l'owner, à prendre avec son compte.
Rien dans ce dépôt ne lance ces commandes.

- Chaque commande laisse un commentaire de fermeture qui cite la ligne du plan et sa preuve.
- Raison : `completed` quand une PR fusionnée ou l'état servi règle l'objet de l'issue ;
  `--duplicate-of 1113` pour #1037 et #1063 ; `not planned` pour les instantanés remplacés et
  les rapports sans reste à faire.
- Le relevé date du 2026-11-15T12:10:47Z. `gh issue close` sur une issue déjà fermée échoue sans
  rien modifier.
- Retour arrière : `gh issue reopen <n> --repo ak125/nestjs-remix-monorepo`.

## Décompte

| Famille | Fermetures | forte | moyenne | faible |
|---|---|---|---|---|
| digest du matin | 131 | 131 | 0 | 0 |
| bilan hebdomadaire des PR | 25 | 0 | 25 | 0 |
| autre | 10 | 5 | 4 | 1 |
| **Total** | **166** | **136** | **29** | **1** |

La confiance est celle du classement par département. Pour les bilans hebdomadaires, elle porte
sur le département (23 ou 02), pas sur la fermeture : chaque bilan est remplacé par #1975.

## Confiance forte

### digest du matin (131)

```bash
# #587 — ligne 87 — confiance forte — Morning health digest — 2026-05-18
gh issue close 587 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 87 (commit f6a6814ae). Preuve : instantané du 2026-05-18 remplacé par #2036.'
# #619 — ligne 90 — confiance forte — Morning health digest — 2026-05-19
gh issue close 619 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 90 (commit f6a6814ae). Preuve : instantané du 2026-05-19 remplacé par #2036.'
# #651 — ligne 92 — confiance forte — Morning health digest — 2026-05-20
gh issue close 651 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 92 (commit f6a6814ae). Preuve : instantané du 2026-05-20 remplacé par #2036.'
# #666 — ligne 93 — confiance forte — Morning health digest — 2026-05-21
gh issue close 666 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 93 (commit f6a6814ae). Preuve : instantané du 2026-05-21 remplacé par #2036.'
# #688 — ligne 94 — confiance forte — Morning health digest — 2026-05-22
gh issue close 688 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 94 (commit f6a6814ae). Preuve : instantané du 2026-05-22 remplacé par #2036.'
# #742 — ligne 95 — confiance forte — Morning health digest — 2026-05-25
gh issue close 742 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 95 (commit f6a6814ae). Preuve : instantané du 2026-05-25 remplacé par #2036.'
# #760 — ligne 99 — confiance forte — Morning health digest — 2026-05-26
gh issue close 760 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 99 (commit f6a6814ae). Preuve : instantané du 2026-05-26 remplacé par #2036.'
# #767 — ligne 100 — confiance forte — Morning health digest — 2026-05-27
gh issue close 767 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 100 (commit f6a6814ae). Preuve : instantané du 2026-05-27 remplacé par #2036.'
# #777 — ligne 101 — confiance forte — Morning health digest — 2026-05-28
gh issue close 777 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 101 (commit f6a6814ae). Preuve : instantané du 2026-05-28 remplacé par #2036.'
# #790 — ligne 103 — confiance forte — Morning health digest — 2026-05-29
gh issue close 790 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 103 (commit f6a6814ae). Preuve : instantané du 2026-05-29 remplacé par #2036.'
# #807 — ligne 104 — confiance forte — Morning health digest — 2026-06-01
gh issue close 807 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 104 (commit f6a6814ae). Preuve : instantané du 2026-06-01 remplacé par #2036.'
# #818 — ligne 106 — confiance forte — Morning health digest — 2026-06-02
gh issue close 818 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 106 (commit f6a6814ae). Preuve : instantané du 2026-06-02 remplacé par #2036.'
# #829 — ligne 107 — confiance forte — Morning health digest — 2026-06-03
gh issue close 829 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 107 (commit f6a6814ae). Preuve : instantané du 2026-06-03 remplacé par #2036.'
# #843 — ligne 108 — confiance forte — Morning health digest — 2026-06-04
gh issue close 843 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 108 (commit f6a6814ae). Preuve : instantané du 2026-06-04 remplacé par #2036.'
# #859 — ligne 109 — confiance forte — Morning health digest — 2026-06-05
gh issue close 859 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 109 (commit f6a6814ae). Preuve : instantané du 2026-06-05 remplacé par #2036.'
# #894 — ligne 110 — confiance forte — Morning health digest — 2026-06-08
gh issue close 894 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 110 (commit f6a6814ae). Preuve : instantané du 2026-06-08 remplacé par #2036.'
# #912 — ligne 112 — confiance forte — Morning health digest — 2026-06-09
gh issue close 912 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 112 (commit f6a6814ae). Preuve : instantané du 2026-06-09 remplacé par #2036.'
# #914 — ligne 113 — confiance forte — Morning health digest — 2026-06-10
gh issue close 914 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 113 (commit f6a6814ae). Preuve : instantané du 2026-06-10 remplacé par #2036.'
# #933 — ligne 114 — confiance forte — Morning health digest — 2026-06-11
gh issue close 933 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 114 (commit f6a6814ae). Preuve : instantané du 2026-06-11 remplacé par #2036.'
# #944 — ligne 115 — confiance forte — Morning health digest — 2026-06-12
gh issue close 944 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 115 (commit f6a6814ae). Preuve : instantané du 2026-06-12 remplacé par #2036.'
# #985 — ligne 116 — confiance forte — Morning health digest — 2026-06-15
gh issue close 985 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 116 (commit f6a6814ae). Preuve : instantané du 2026-06-15 remplacé par #2036.'
# #999 — ligne 118 — confiance forte — Morning health digest — 2026-06-16
gh issue close 999 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 118 (commit f6a6814ae). Preuve : instantané du 2026-06-16 remplacé par #2036.'
# #1011 — ligne 119 — confiance forte — Morning health digest — 2026-06-17
gh issue close 1011 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 119 (commit f6a6814ae). Preuve : instantané du 2026-06-17 remplacé par #2036.'
# #1023 — ligne 120 — confiance forte — Morning health digest — 2026-06-18
gh issue close 1023 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 120 (commit f6a6814ae). Preuve : instantané du 2026-06-18 remplacé par #2036.'
# #1027 — ligne 121 — confiance forte — Morning health digest — 2026-06-19
gh issue close 1027 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 121 (commit f6a6814ae). Preuve : instantané du 2026-06-19 remplacé par #2036.'
# #1095 — ligne 124 — confiance forte — Morning health digest — 2026-06-22
gh issue close 1095 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 124 (commit f6a6814ae). Preuve : instantané du 2026-06-22 remplacé par #2036.'
# #1112 — ligne 126 — confiance forte — Morning health digest — 2026-06-23
gh issue close 1112 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 126 (commit f6a6814ae). Preuve : instantané du 2026-06-23 remplacé par #2036.'
# #1127 — ligne 128 — confiance forte — Morning health digest — 2026-06-24
gh issue close 1127 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 128 (commit f6a6814ae). Preuve : instantané du 2026-06-24 remplacé par #2036.'
# #1137 — ligne 129 — confiance forte — Morning health digest — 2026-06-25
gh issue close 1137 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 129 (commit f6a6814ae). Preuve : instantané du 2026-06-25 remplacé par #2036.'
# #1155 — ligne 130 — confiance forte — Morning health digest — 2026-06-26
gh issue close 1155 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 130 (commit f6a6814ae). Preuve : instantané du 2026-06-26 remplacé par #2036.'
# #1191 — ligne 131 — confiance forte — Morning health digest — 2026-06-29
gh issue close 1191 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 131 (commit f6a6814ae). Preuve : instantané du 2026-06-29 remplacé par #2036.'
# #1193 — ligne 133 — confiance forte — Morning health digest — 2026-06-30
gh issue close 1193 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 133 (commit f6a6814ae). Preuve : instantané du 2026-06-30 remplacé par #2036.'
# #1194 — ligne 134 — confiance forte — Morning health digest — 2026-07-01
gh issue close 1194 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 134 (commit f6a6814ae). Preuve : instantané du 2026-07-01 remplacé par #2036.'
# #1204 — ligne 135 — confiance forte — Morning health digest — 2026-07-02
gh issue close 1204 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 135 (commit f6a6814ae). Preuve : instantané du 2026-07-02 remplacé par #2036.'
# #1210 — ligne 136 — confiance forte — Morning health digest — 2026-07-03
gh issue close 1210 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 136 (commit f6a6814ae). Preuve : instantané du 2026-07-03 remplacé par #2036.'
# #1235 — ligne 137 — confiance forte — Morning health digest — 2026-07-06
gh issue close 1235 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 137 (commit f6a6814ae). Preuve : instantané du 2026-07-06 remplacé par #2036.'
# #1239 — ligne 139 — confiance forte — Morning health digest — 2026-07-07
gh issue close 1239 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 139 (commit f6a6814ae). Preuve : instantané du 2026-07-07 remplacé par #2036.'
# #1241 — ligne 140 — confiance forte — Morning health digest — 2026-07-08
gh issue close 1241 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 140 (commit f6a6814ae). Preuve : instantané du 2026-07-08 remplacé par #2036.'
# #1245 — ligne 141 — confiance forte — Morning health digest — 2026-07-09
gh issue close 1245 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 141 (commit f6a6814ae). Preuve : instantané du 2026-07-09 remplacé par #2036.'
# #1246 — ligne 142 — confiance forte — Morning health digest — 2026-07-10
gh issue close 1246 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 142 (commit f6a6814ae). Preuve : instantané du 2026-07-10 remplacé par #2036.'
# #1247 — ligne 143 — confiance forte — Morning health digest — 2026-07-13
gh issue close 1247 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 143 (commit f6a6814ae). Preuve : instantané du 2026-07-13 remplacé par #2036.'
# #1262 — ligne 145 — confiance forte — Morning health digest — 2026-07-14
gh issue close 1262 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 145 (commit f6a6814ae). Preuve : instantané du 2026-07-14 remplacé par #2036.'
# #1279 — ligne 146 — confiance forte — Morning health digest — 2026-07-15
gh issue close 1279 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 146 (commit f6a6814ae). Preuve : instantané du 2026-07-15 remplacé par #2036.'
# #1287 — ligne 147 — confiance forte — Morning health digest — 2026-07-16
gh issue close 1287 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 147 (commit f6a6814ae). Preuve : instantané du 2026-07-16 remplacé par #2036.'
# #1291 — ligne 148 — confiance forte — Morning health digest — 2026-07-17
gh issue close 1291 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 148 (commit f6a6814ae). Preuve : instantané du 2026-07-17 remplacé par #2036.'
# #1310 — ligne 149 — confiance forte — Morning health digest — 2026-07-20
gh issue close 1310 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 149 (commit f6a6814ae). Preuve : instantané du 2026-07-20 remplacé par #2036.'
# #1312 — ligne 151 — confiance forte — Morning health digest — 2026-07-21
gh issue close 1312 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 151 (commit f6a6814ae). Preuve : instantané du 2026-07-21 remplacé par #2036.'
# #1313 — ligne 152 — confiance forte — Morning health digest — 2026-07-22
gh issue close 1313 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 152 (commit f6a6814ae). Preuve : instantané du 2026-07-22 remplacé par #2036.'
# #1314 — ligne 153 — confiance forte — Morning health digest — 2026-07-23
gh issue close 1314 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 153 (commit f6a6814ae). Preuve : instantané du 2026-07-23 remplacé par #2036.'
# #1315 — ligne 154 — confiance forte — Morning health digest — 2026-07-24
gh issue close 1315 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 154 (commit f6a6814ae). Preuve : instantané du 2026-07-24 remplacé par #2036.'
# #1320 — ligne 155 — confiance forte — Morning health digest — 2026-07-27
gh issue close 1320 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 155 (commit f6a6814ae). Preuve : instantané du 2026-07-27 remplacé par #2036.'
# #1322 — ligne 157 — confiance forte — Morning health digest — 2026-07-28
gh issue close 1322 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 157 (commit f6a6814ae). Preuve : instantané du 2026-07-28 remplacé par #2036.'
# #1323 — ligne 158 — confiance forte — Morning health digest — 2026-07-29
gh issue close 1323 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 158 (commit f6a6814ae). Preuve : instantané du 2026-07-29 remplacé par #2036.'
# #1325 — ligne 159 — confiance forte — Morning health digest — 2026-07-30
gh issue close 1325 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 159 (commit f6a6814ae). Preuve : instantané du 2026-07-30 remplacé par #2036.'
# #1326 — ligne 160 — confiance forte — Morning health digest — 2026-07-31
gh issue close 1326 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 160 (commit f6a6814ae). Preuve : instantané du 2026-07-31 remplacé par #2036.'
# #1330 — ligne 161 — confiance forte — Morning health digest — 2026-08-03
gh issue close 1330 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 161 (commit f6a6814ae). Preuve : instantané du 2026-08-03 remplacé par #2036.'
# #1333 — ligne 163 — confiance forte — Morning health digest — 2026-08-04
gh issue close 1333 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 163 (commit f6a6814ae). Preuve : instantané du 2026-08-04 remplacé par #2036.'
# #1334 — ligne 164 — confiance forte — Morning health digest — 2026-08-05
gh issue close 1334 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 164 (commit f6a6814ae). Preuve : instantané du 2026-08-05 remplacé par #2036.'
# #1336 — ligne 165 — confiance forte — Morning health digest — 2026-08-06
gh issue close 1336 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 165 (commit f6a6814ae). Preuve : instantané du 2026-08-06 remplacé par #2036.'
# #1337 — ligne 166 — confiance forte — Morning health digest — 2026-08-07
gh issue close 1337 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 166 (commit f6a6814ae). Preuve : instantané du 2026-08-07 remplacé par #2036.'
# #1340 — ligne 167 — confiance forte — Morning health digest — 2026-08-10
gh issue close 1340 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 167 (commit f6a6814ae). Preuve : instantané du 2026-08-10 remplacé par #2036.'
# #1343 — ligne 169 — confiance forte — Morning health digest — 2026-08-11
gh issue close 1343 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 169 (commit f6a6814ae). Preuve : instantané du 2026-08-11 remplacé par #2036.'
# #1345 — ligne 170 — confiance forte — Morning health digest — 2026-08-12
gh issue close 1345 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 170 (commit f6a6814ae). Preuve : instantané du 2026-08-12 remplacé par #2036.'
# #1346 — ligne 171 — confiance forte — Morning health digest — 2026-08-13
gh issue close 1346 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 171 (commit f6a6814ae). Preuve : instantané du 2026-08-13 remplacé par #2036.'
# #1351 — ligne 172 — confiance forte — Morning health digest — 2026-08-14
gh issue close 1351 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 172 (commit f6a6814ae). Preuve : instantané du 2026-08-14 remplacé par #2036.'
# #1356 — ligne 173 — confiance forte — Morning health digest — 2026-08-17
gh issue close 1356 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 173 (commit f6a6814ae). Preuve : instantané du 2026-08-17 remplacé par #2036.'
# #1359 — ligne 175 — confiance forte — Morning health digest — 2026-08-18
gh issue close 1359 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 175 (commit f6a6814ae). Preuve : instantané du 2026-08-18 remplacé par #2036.'
# #1360 — ligne 176 — confiance forte — Morning health digest — 2026-08-19
gh issue close 1360 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 176 (commit f6a6814ae). Preuve : instantané du 2026-08-19 remplacé par #2036.'
# #1361 — ligne 177 — confiance forte — Morning health digest — 2026-08-20
gh issue close 1361 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 177 (commit f6a6814ae). Preuve : instantané du 2026-08-20 remplacé par #2036.'
# #1362 — ligne 178 — confiance forte — Morning health digest — 2026-08-21
gh issue close 1362 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 178 (commit f6a6814ae). Preuve : instantané du 2026-08-21 remplacé par #2036.'
# #1363 — ligne 179 — confiance forte — Morning health digest — 2026-08-24
gh issue close 1363 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 179 (commit f6a6814ae). Preuve : instantané du 2026-08-24 remplacé par #2036.'
# #1365 — ligne 181 — confiance forte — Morning health digest — 2026-08-25
gh issue close 1365 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 181 (commit f6a6814ae). Preuve : instantané du 2026-08-25 remplacé par #2036.'
# #1366 — ligne 182 — confiance forte — Morning health digest — 2026-08-26
gh issue close 1366 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 182 (commit f6a6814ae). Preuve : instantané du 2026-08-26 remplacé par #2036.'
# #1367 — ligne 183 — confiance forte — Morning health digest — 2026-08-27
gh issue close 1367 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 183 (commit f6a6814ae). Preuve : instantané du 2026-08-27 remplacé par #2036.'
# #1368 — ligne 184 — confiance forte — Morning health digest — 2026-08-28
gh issue close 1368 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 184 (commit f6a6814ae). Preuve : instantané du 2026-08-28 remplacé par #2036.'
# #1369 — ligne 185 — confiance forte — Morning health digest — 2026-08-31
gh issue close 1369 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 185 (commit f6a6814ae). Preuve : instantané du 2026-08-31 remplacé par #2036.'
# #1372 — ligne 187 — confiance forte — Morning health digest — 2026-09-01
gh issue close 1372 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 187 (commit f6a6814ae). Preuve : instantané du 2026-09-01 remplacé par #2036.'
# #1381 — ligne 188 — confiance forte — Morning health digest — 2026-09-02
gh issue close 1381 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 188 (commit f6a6814ae). Preuve : instantané du 2026-09-02 remplacé par #2036.'
# #1386 — ligne 189 — confiance forte — Morning health digest — 2026-09-03
gh issue close 1386 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 189 (commit f6a6814ae). Preuve : instantané du 2026-09-03 remplacé par #2036.'
# #1394 — ligne 190 — confiance forte — Morning health digest — 2026-09-04
gh issue close 1394 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 190 (commit f6a6814ae). Preuve : instantané du 2026-09-04 remplacé par #2036.'
# #1402 — ligne 191 — confiance forte — Morning health digest — 2026-09-07
gh issue close 1402 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 191 (commit f6a6814ae). Preuve : instantané du 2026-09-07 remplacé par #2036.'
# #1415 — ligne 193 — confiance forte — Morning health digest — 2026-09-08
gh issue close 1415 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 193 (commit f6a6814ae). Preuve : instantané du 2026-09-08 remplacé par #2036.'
# #1420 — ligne 194 — confiance forte — Morning health digest — 2026-09-09
gh issue close 1420 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 194 (commit f6a6814ae). Preuve : instantané du 2026-09-09 remplacé par #2036.'
# #1435 — ligne 195 — confiance forte — Morning health digest — 2026-09-10
gh issue close 1435 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 195 (commit f6a6814ae). Preuve : instantané du 2026-09-10 remplacé par #2036.'
# #1449 — ligne 196 — confiance forte — Morning health digest — 2026-09-11
gh issue close 1449 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 196 (commit f6a6814ae). Preuve : instantané du 2026-09-11 remplacé par #2036.'
# #1487 — ligne 197 — confiance forte — Morning health digest — 2026-09-14
gh issue close 1487 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 197 (commit f6a6814ae). Preuve : instantané du 2026-09-14 remplacé par #2036.'
# #1489 — ligne 199 — confiance forte — Morning health digest — 2026-09-15
gh issue close 1489 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 199 (commit f6a6814ae). Preuve : instantané du 2026-09-15 remplacé par #2036.'
# #1490 — ligne 200 — confiance forte — Morning health digest — 2026-09-16
gh issue close 1490 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 200 (commit f6a6814ae). Preuve : instantané du 2026-09-16 remplacé par #2036.'
# #1501 — ligne 201 — confiance forte — Morning health digest — 2026-09-17
gh issue close 1501 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 201 (commit f6a6814ae). Preuve : instantané du 2026-09-17 remplacé par #2036.'
# #1517 — ligne 202 — confiance forte — Morning health digest — 2026-09-18
gh issue close 1517 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 202 (commit f6a6814ae). Preuve : instantané du 2026-09-18 remplacé par #2036.'
# #1525 — ligne 203 — confiance forte — Morning health digest — 2026-09-21
gh issue close 1525 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 203 (commit f6a6814ae). Preuve : instantané du 2026-09-21 remplacé par #2036.'
# #1527 — ligne 205 — confiance forte — Morning health digest — 2026-09-22
gh issue close 1527 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 205 (commit f6a6814ae). Preuve : instantané du 2026-09-22 remplacé par #2036.'
# #1528 — ligne 206 — confiance forte — Morning health digest — 2026-09-23
gh issue close 1528 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 206 (commit f6a6814ae). Preuve : instantané du 2026-09-23 remplacé par #2036.'
# #1558 — ligne 207 — confiance forte — Morning health digest — 2026-09-24
gh issue close 1558 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 207 (commit f6a6814ae). Preuve : instantané du 2026-09-24 remplacé par #2036.'
# #1579 — ligne 208 — confiance forte — Morning health digest — 2026-09-25
gh issue close 1579 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 208 (commit f6a6814ae). Preuve : instantané du 2026-09-25 remplacé par #2036.'
# #1583 — ligne 209 — confiance forte — Morning health digest — 2026-09-28
gh issue close 1583 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 209 (commit f6a6814ae). Preuve : instantané du 2026-09-28 remplacé par #2036.'
# #1594 — ligne 211 — confiance forte — Morning health digest — 2026-09-29
gh issue close 1594 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 211 (commit f6a6814ae). Preuve : instantané du 2026-09-29 remplacé par #2036.'
# #1621 — ligne 212 — confiance forte — Morning health digest — 2026-09-30
gh issue close 1621 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 212 (commit f6a6814ae). Preuve : instantané du 2026-09-30 remplacé par #2036.'
# #1653 — ligne 213 — confiance forte — Morning health digest — 2026-10-01
gh issue close 1653 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 213 (commit f6a6814ae). Preuve : instantané du 2026-10-01 remplacé par #2036.'
# #1693 — ligne 214 — confiance forte — Morning health digest — 2026-10-02
gh issue close 1693 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 214 (commit f6a6814ae). Preuve : instantané du 2026-10-02 remplacé par #2036.'
# #1734 — ligne 215 — confiance forte — Morning health digest — 2026-10-05
gh issue close 1734 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 215 (commit f6a6814ae). Preuve : instantané du 2026-10-05 remplacé par #2036.'
# #1739 — ligne 217 — confiance forte — Morning health digest — 2026-10-06
gh issue close 1739 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 217 (commit f6a6814ae). Preuve : instantané du 2026-10-06 remplacé par #2036.'
# #1740 — ligne 218 — confiance forte — Morning health digest — 2026-10-07
gh issue close 1740 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 218 (commit f6a6814ae). Preuve : instantané du 2026-10-07 remplacé par #2036.'
# #1744 — ligne 219 — confiance forte — Morning health digest — 2026-10-08
gh issue close 1744 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 219 (commit f6a6814ae). Preuve : instantané du 2026-10-08 remplacé par #2036.'
# #1746 — ligne 220 — confiance forte — Morning health digest — 2026-10-09
gh issue close 1746 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 220 (commit f6a6814ae). Preuve : instantané du 2026-10-09 remplacé par #2036.'
# #1765 — ligne 221 — confiance forte — Morning health digest — 2026-10-12
gh issue close 1765 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 221 (commit f6a6814ae). Preuve : instantané du 2026-10-12 remplacé par #2036.'
# #1772 — ligne 223 — confiance forte — Morning health digest — 2026-10-13
gh issue close 1772 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 223 (commit f6a6814ae). Preuve : instantané du 2026-10-13 remplacé par #2036.'
# #1781 — ligne 224 — confiance forte — Morning health digest — 2026-10-14
gh issue close 1781 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 224 (commit f6a6814ae). Preuve : instantané du 2026-10-14 remplacé par #2036.'
# #1799 — ligne 225 — confiance forte — Morning health digest — 2026-10-15
gh issue close 1799 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 225 (commit f6a6814ae). Preuve : instantané du 2026-10-15 remplacé par #2036.'
# #1810 — ligne 226 — confiance forte — Morning health digest — 2026-10-16
gh issue close 1810 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 226 (commit f6a6814ae). Preuve : instantané du 2026-10-16 remplacé par #2036.'
# #1836 — ligne 227 — confiance forte — Morning health digest — 2026-10-19
gh issue close 1836 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 227 (commit f6a6814ae). Preuve : instantané du 2026-10-19 remplacé par #2036.'
# #1851 — ligne 229 — confiance forte — Morning health digest — 2026-10-20
gh issue close 1851 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 229 (commit f6a6814ae). Preuve : instantané du 2026-10-20 remplacé par #2036.'
# #1853 — ligne 230 — confiance forte — Morning health digest — 2026-10-21
gh issue close 1853 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 230 (commit f6a6814ae). Preuve : instantané du 2026-10-21 remplacé par #2036.'
# #1864 — ligne 231 — confiance forte — Morning health digest — 2026-10-22
gh issue close 1864 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 231 (commit f6a6814ae). Preuve : instantané du 2026-10-22 remplacé par #2036.'
# #1872 — ligne 232 — confiance forte — Morning health digest — 2026-10-23
gh issue close 1872 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 232 (commit f6a6814ae). Preuve : instantané du 2026-10-23 remplacé par #2036.'
# #1890 — ligne 233 — confiance forte — Morning health digest — 2026-10-26
gh issue close 1890 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 233 (commit f6a6814ae). Preuve : instantané du 2026-10-26 remplacé par #2036.'
# #1903 — ligne 235 — confiance forte — Morning health digest — 2026-10-27
gh issue close 1903 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 235 (commit f6a6814ae). Preuve : instantané du 2026-10-27 remplacé par #2036.'
# #1907 — ligne 236 — confiance forte — Morning health digest — 2026-10-28
gh issue close 1907 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 236 (commit f6a6814ae). Preuve : instantané du 2026-10-28 remplacé par #2036.'
# #1917 — ligne 238 — confiance forte — Morning health digest — 2026-10-29
gh issue close 1917 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 238 (commit f6a6814ae). Preuve : instantané du 2026-10-29 remplacé par #2036.'
# #1923 — ligne 239 — confiance forte — Morning health digest — 2026-10-30
gh issue close 1923 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 239 (commit f6a6814ae). Preuve : instantané du 2026-10-30 remplacé par #2036.'
# #1951 — ligne 241 — confiance forte — Morning health digest — 2026-11-02
gh issue close 1951 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 241 (commit f6a6814ae). Preuve : instantané du 2026-11-02 remplacé par #2036.'
# #1953 — ligne 243 — confiance forte — Morning health digest — 2026-11-03
gh issue close 1953 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 243 (commit f6a6814ae). Preuve : instantané du 2026-11-03 remplacé par #2036.'
# #1955 — ligne 244 — confiance forte — Morning health digest — 2026-11-04
gh issue close 1955 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 244 (commit f6a6814ae). Preuve : instantané du 2026-11-04 remplacé par #2036.'
# #1959 — ligne 245 — confiance forte — Morning health digest — 2026-11-05
gh issue close 1959 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 245 (commit f6a6814ae). Preuve : instantané du 2026-11-05 remplacé par #2036.'
# #1962 — ligne 246 — confiance forte — Morning health digest — 2026-11-06
gh issue close 1962 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 246 (commit f6a6814ae). Preuve : instantané du 2026-11-06 remplacé par #2036.'
# #1971 — ligne 247 — confiance forte — Morning health digest — 2026-11-09
gh issue close 1971 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 247 (commit f6a6814ae). Preuve : instantané du 2026-11-09 remplacé par #2036.'
# #1985 — ligne 249 — confiance forte — Morning health digest — 2026-11-10
gh issue close 1985 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 249 (commit f6a6814ae). Preuve : instantané du 2026-11-10 remplacé par #2036 ; trois digests le 2026-11-10 (#1985, #2001, #2002).'
# #2001 — ligne 250 — confiance forte — Morning health digest — 2026-11-10
gh issue close 2001 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 250 (commit f6a6814ae). Preuve : instantané du 2026-11-10 remplacé par #2036 ; trois digests le 2026-11-10 (#1985, #2001, #2002).'
# #2002 — ligne 251 — confiance forte — Morning health digest — 2026-11-10
gh issue close 2002 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 251 (commit f6a6814ae). Preuve : instantané du 2026-11-10 remplacé par #2036 ; trois digests le 2026-11-10 (#1985, #2001, #2002).'
# #2005 — ligne 252 — confiance forte — Morning health digest — 2026-11-11
gh issue close 2005 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 252 (commit f6a6814ae). Preuve : instantané du 2026-11-11 remplacé par #2036.'
# #2034 — ligne 253 — confiance forte — Morning health digest — 2026-11-12
gh issue close 2034 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 253 (commit f6a6814ae). Preuve : instantané du 2026-11-12 remplacé par #2036.'
```

### autre (5)

```bash
# #203 — ligne 75 — confiance forte — Soak report PR #190 alias TS — verdict YELLOW (J+1)
gh issue close 203 --repo ak125/nestjs-remix-monorepo --reason completed --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 75 (commit f6a6814ae). Preuve : PR #190 fusionnée le 2026-04-27 (852dda55e8) ; fenêtre de soak J+1 du 2026-04-28 close depuis.'
# #439 — ligne 85 — confiance forte — ADR-024 promotion blocked at J+14 — données de mesure indisponibles (tooling…
gh issue close 439 --repo ak125/nestjs-remix-monorepo --reason completed --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 85 (commit f6a6814ae). Preuve : ADR-024 porte `status: accepted` dans le vault (copie DEV, commit 156b143 du 2026-11-15) : le blocage de promotion n’a plus d’objet.'
# #744 — ligne 97 — confiance forte — fix(edge): Caddy >Cache-Control replace mode (PROD duplicate header)
gh issue close 744 --repo ak125/nestjs-remix-monorepo --reason completed --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 97 (commit f6a6814ae). Preuve : corrigé par #1272 (Cache-Control à propriétaire unique, `header ?Cache-Control` dans @public_cached) ; un seul Cache-Control sur la page d’accueil PROD au relevé.'
# #745 — ligne 98 — confiance forte — fix(seo): sitemap-$.tsx flat-routes naming + ___xtr_msg REDIRECT_RULE cleanup
gh issue close 745 --repo ak125/nestjs-remix-monorepo --reason completed --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 98 (commit f6a6814ae). Preuve : route supprimée par #1074 (sitemaps servis par SitemapStaticMiddleware) ; /sitemap-racine.xml répond 200 application/xml en DEV et en PROD au relevé ; partie « règle en base » non vérifiée (base hors périmètre).'
# #1916 — ligne 237 — confiance forte — Sitemap regen failed - 2026-10-29
gh issue close 1916 --repo ak125/nestjs-remix-monorepo --reason completed --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 237 (commit f6a6814ae). Preuve : sitemap-daily-regen en succès chaque jour du 2026-11-11 au 2026-11-15 ; producteur unique depuis #2027.'
```

## Confiance moyenne ou faible (à relire une par une)

### bilan hebdomadaire des PR (25)

```bash
# #588 — ligne 88 — confiance moyenne — Weekly PR hygiene W21 — 2026-05-18 (🔀 Rebase cascade (oldest stack first))
gh issue close 588 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 88 (commit f6a6814ae). Preuve : instantané W21 remplacé par #1975.'
# #743 — ligne 96 — confiance moyenne — Weekly PR hygiene W22 — 2026-05-25 (🔀 Rebase cascade (oldest stack first))
gh issue close 743 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 96 (commit f6a6814ae). Preuve : instantané W22 remplacé par #1975.'
# #808 — ligne 105 — confiance moyenne — Weekly PR hygiene W23 — 2026-06-01 (🧪 PR-8b-2 cleanup (≤ 5 files))
gh issue close 808 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 105 (commit f6a6814ae). Preuve : instantané W23 remplacé par #1975.'
# #895 — ligne 111 — confiance moyenne — Weekly PR hygiene W24 — 2026-06-08 (🔀 Rebase cascade (oldest stack first))
gh issue close 895 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 111 (commit f6a6814ae). Preuve : instantané W24 remplacé par #1975.'
# #986 — ligne 117 — confiance moyenne — Weekly PR hygiene W25 — 2026-06-15 (🔀 Rebase cascade (oldest stack first))
gh issue close 986 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 117 (commit f6a6814ae). Preuve : instantané W25 remplacé par #1975.'
# #1099 — ligne 125 — confiance moyenne — Weekly PR hygiene W26 — 2026-06-22 (🔀 Rebase cascade (oldest stack first))
gh issue close 1099 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 125 (commit f6a6814ae). Preuve : instantané W26 remplacé par #1975.'
# #1192 — ligne 132 — confiance moyenne — Weekly PR hygiene W27 — 2026-06-29 (📦 PR-9b first batch upgrade (scope ≤ 3 pa…
gh issue close 1192 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 132 (commit f6a6814ae). Preuve : instantané W27 remplacé par #1975.'
# #1236 — ligne 138 — confiance moyenne — Weekly PR hygiene W28 — 2026-07-06 (📦 PR-9b first batch upgrade (scope ≤ 3 pa…
gh issue close 1236 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 138 (commit f6a6814ae). Preuve : instantané W28 remplacé par #1975.'
# #1248 — ligne 144 — confiance moyenne — Weekly PR hygiene W29 — 2026-07-13 (🔀 Rebase cascade (oldest stack first))
gh issue close 1248 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 144 (commit f6a6814ae). Preuve : instantané W29 remplacé par #1975.'
# #1311 — ligne 150 — confiance moyenne — Weekly PR hygiene W30 — 2026-07-20 (📦 PR-9b first batch upgrade (scope ≤ 3 pa…
gh issue close 1311 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 150 (commit f6a6814ae). Preuve : instantané W30 remplacé par #1975.'
# #1321 — ligne 156 — confiance moyenne — Weekly PR hygiene W31 — 2026-07-27 (🧹 Hygiene week — batch-close stale PRs)
gh issue close 1321 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 156 (commit f6a6814ae). Preuve : instantané W31 remplacé par #1975.'
# #1331 — ligne 162 — confiance moyenne — Weekly PR hygiene W32 — 2026-08-03 (📦 PR-9b first batch upgrade (scope ≤ 3 pa…
gh issue close 1331 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 162 (commit f6a6814ae). Preuve : instantané W32 remplacé par #1975.'
# #1341 — ligne 168 — confiance moyenne — Weekly PR hygiene W33 — 2026-08-10 (🧹 Hygiene week — batch-close stale PRs)
gh issue close 1341 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 168 (commit f6a6814ae). Preuve : instantané W33 remplacé par #1975.'
# #1357 — ligne 174 — confiance moyenne — Weekly PR hygiene W34 — 2026-08-17 (📦 PR-9b first batch upgrade (scope ≤ 3 pa…
gh issue close 1357 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 174 (commit f6a6814ae). Preuve : instantané W34 remplacé par #1975.'
# #1364 — ligne 180 — confiance moyenne — Weekly PR hygiene W35 — 2026-08-24 (🧹 Hygiene week — batch-close stale PRs)
gh issue close 1364 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 180 (commit f6a6814ae). Preuve : instantané W35 remplacé par #1975.'
# #1370 — ligne 186 — confiance moyenne — Weekly PR hygiene W36 — 2026-08-31 (🧹 Hygiene week — batch-close stale PRs)
gh issue close 1370 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 186 (commit f6a6814ae). Preuve : instantané W36 remplacé par #1975.'
# #1403 — ligne 192 — confiance moyenne — Weekly PR hygiene W37 — 2026-09-07 (📦 PR-9b first batch upgrade (scope ≤ 3 pa…
gh issue close 1403 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 192 (commit f6a6814ae). Preuve : instantané W37 remplacé par #1975.'
# #1488 — ligne 198 — confiance moyenne — Weekly PR hygiene W38 — 2026-09-14 (📦 PR-9b first batch upgrade (scope ≤ 3 pa…
gh issue close 1488 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 198 (commit f6a6814ae). Preuve : instantané W38 remplacé par #1975.'
# #1526 — ligne 204 — confiance moyenne — Weekly PR hygiene W39 — 2026-09-21 (📦 PR-9b first batch upgrade (scope ≤ 3 pa…
gh issue close 1526 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 204 (commit f6a6814ae). Preuve : instantané W39 remplacé par #1975.'
# #1585 — ligne 210 — confiance moyenne — Weekly PR hygiene W40 — 2026-09-28 (📦 PR-9b first batch upgrade (scope ≤ 3 pa…
gh issue close 1585 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 210 (commit f6a6814ae). Preuve : instantané W40 remplacé par #1975.'
# #1736 — ligne 216 — confiance moyenne — Weekly PR hygiene W41 — 2026-10-05 (📦 PR-9b first batch upgrade (scope ≤ 3 pa…
gh issue close 1736 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 216 (commit f6a6814ae). Preuve : instantané W41 remplacé par #1975.'
# #1766 — ligne 222 — confiance moyenne — Weekly PR hygiene W42 — 2026-10-12 (📦 PR-9b first batch upgrade (scope ≤ 3 pa…
gh issue close 1766 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 222 (commit f6a6814ae). Preuve : instantané W42 remplacé par #1975.'
# #1843 — ligne 228 — confiance moyenne — Weekly PR hygiene W43 — 2026-10-19 (📦 PR-9b first batch upgrade (scope ≤ 3 pa…
gh issue close 1843 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 228 (commit f6a6814ae). Preuve : instantané W43 remplacé par #1975.'
# #1894 — ligne 234 — confiance moyenne — Weekly PR hygiene W44 — 2026-10-26 (📦 PR-9b first batch upgrade (scope ≤ 3 pa…
gh issue close 1894 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 234 (commit f6a6814ae). Preuve : instantané W44 remplacé par #1975.'
# #1952 — ligne 242 — confiance moyenne — Weekly PR hygiene W45 — 2026-11-02 (📦 PR-9b first batch upgrade (scope ≤ 3 pa…
gh issue close 1952 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 242 (commit f6a6814ae). Preuve : instantané W45 remplacé par #1975.'
```

### autre (5)

```bash
# #582 — ligne 86 — confiance faible — Closure 2026-05-17 — 4 PRs sitemap/auth/PR-9a MERGED + 13 stales closed (T+0…
gh issue close 582 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 86 (commit f6a6814ae). Preuve : rapport daté sans reste à faire : les 4 PR citées sont fusionnées depuis le 2026-05-17.'
# #650 — ligne 91 — confiance moyenne — Closure 2026-05-17 — T+48h SLO digest (verdict: HOLD)
gh issue close 650 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 91 (commit f6a6814ae). Preuve : instantané du 2026-05-19 ; seul digest de cette série ; déploiements main revus depuis par le digest #2036.'
# #1037 — ligne 122 — confiance moyenne — PR-2 prereqs monitor — Gate 1 bloqué (vault hors scope session)
gh issue close 1037 --repo ak125/nestjs-remix-monorepo --duplicate-of 1113 --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 122 (commit f6a6814ae). Preuve : doublon de #1113 (même routine, même blocage d’accès au vault), rapport du 2026-06-20 ; #1113 étant elle-même proposée à la fermeture, aucune cible ne reste ouverte.'
# #1063 — ligne 123 — confiance moyenne — PR-2 daily monitor: GATE 1 bloquée — governance-vault hors scope session
gh issue close 1063 --repo ak125/nestjs-remix-monorepo --duplicate-of 1113 --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 123 (commit f6a6814ae). Preuve : doublon de #1113 (même routine, même blocage d’accès au vault), rapport du 2026-06-21 ; #1113 étant elle-même proposée à la fermeture, aucune cible ne reste ouverte.'
# #1113 — ligne 127 — confiance moyenne — PR-2 monitor BLOCKED — governance-vault not in session scope (GATE 1 unverifi…
gh issue close 1113 --repo ak125/nestjs-remix-monorepo --reason "not planned" --comment 'Fermeture décidée par l’owner sur le triage ADR-128 D6 (PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne 127 (commit f6a6814ae). Preuve : ADR-058 porte `status: accepted` dans le vault (copie DEV, commit 156b143) ; la routine n’a rien publié depuis le 2026-06-23.'
```
