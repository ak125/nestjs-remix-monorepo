# Plan de preuve du circuit moyen — PR d'essai

Reprise du §7 de `docs/audit/mandat-ar-20261116/commandes-owner.md` (étapes 3 et 5), étendue à
l'armement, au désarmement et à la fusion. La PR n'est pas ouverte : le pilotage la lance.

## Préalable

Correctif 01 fusionné sur `main`. La preuve porte alors aussi sur lui.

## La PR d'essai

| Élément | Valeur |
|---|---|
| Fichier | `.worktreeinclude`, une ligne de commentaire ajoutée (`# …`). Classé `risk: medium` dans `ownership.yaml`. Le fichier n'est lu qu'à la création d'un worktree, et un commentaire n'y change rien. |
| Circuit, vérifié le 17 novembre | `node scripts/ci/merge-circuit.mjs --files .worktreeinclude` → `"circuit": "moyen"`, motif `RISK_MEDIUM` |
| Auteur | le compte des agents, depuis une branche du dépôt |
| État | prête pour revue, pas brouillon (la revue Claude ne tourne ni sur un brouillon ni sur un fork) |
| Corps | modèle de PR complet, avec la case **DoD1 laissée non cochée** jusqu'à l'étape 8 |

La case DoD1 sert de frein. Le contrôle requis `🧾 DoD self-evaluation present` reste rouge tant
qu'elle n'est pas cochée, donc la PR ne peut pas fusionner pendant l'essai, même armée. Le modèle
de PR demande de toute façon de la cocher après lecture de la CI. Modifier le corps relance la
porte DoD, pas le circuit.

Effet si la PR va au bout : une ligne de commentaire sur `main`, et la chaîne PREPROD lancée comme
pour toute fusion sur `main`.

## Déroulé et observations

`R` = `ak125/nestjs-remix-monorepo`, `N` = numéro de la PR, `SHA` = sa tête du moment.

| Étape | Geste | À observer |
|---|---|---|
| 1 | Ouvrir la PR, DoD1 non cochée. Ne rien poster dessus avant la fin du run du circuit. | Un run `pull_request_target` de `merge-circuits.yml`. |
| 2 | — | Étiquette `circuit:moyen`. Job `🤖 Revue Claude (circuit moyen)` exécuté. Un commentaire de verdict, avec `SHA`. |
| 3 | — | Aucune écriture dans la branche : nombre de commits inchangé. |
| 4 | Verdict GO attendu. | `🚦 Circuit de fusion` en `success` sur `SHA`. Job `🔐 Armement de la fusion automatique (App)` en `success`. Fusion automatique posée par `automecanik-actions[bot]`, en squash. La PR ne fusionne pas (DoD rouge). |
| 5 | Pousser une deuxième tête dont la ligne ajoutée contient une consigne adressée au relecteur (le prompt de la revue en fait un motif de HOLD). | Verdict HOLD sur la nouvelle tête. `🚦 Circuit de fusion` en `failure`. Fusion automatique retirée : `auto_merge` vaut `null`. |
| 6 | Pousser une troisième tête qui retire la consigne. | Verdict GO, check vert, fusion de nouveau armée sur cette tête. |
| 7 | L'owner poste un commentaire de revue sur la ligne ajoutée (revue de type commentaire, sans approbation). | Un second run, né de la revue, sur la même tête. Il relance la revue Claude. Relever les deux checks de même nom, celui que la page de la PR retient, et l'état d'armement après ce run. |
| 8 | L'owner résout la conversation. DoD1 est cochée dans le corps. | Si la PR est encore armée : fusion par l'App, en squash. Sinon, voir « Lecture du résultat ». |
| 9 | — | Chaîne PREPROD lancée par la fusion. Elle ne prouve pas un déploiement réussi. |

Commandes de lecture :

```bash
gh pr view N -R R --json labels,comments
gh api repos/R/pulls/N/commits --jq 'length'
gh api repos/R/commits/SHA/check-runs --jq '.check_runs[] | select(.name=="🚦 Circuit de fusion") | {id, conclusion, head_sha, completed_at}'
gh api repos/R/pulls/N --jq '{auto_merge: (.auto_merge | if . then {par: .enabled_by.login, methode: .merge_method} else null end), merged, par: (.merged_by.login // null)}'
gh run list -R R --workflow merge-circuits.yml --limit 6
gh run list -R R --branch main --limit 5
```

Sur chaque tête, la conclusion du check est `success` ou `failure`. Un check `skipped` ou absent
sur une tête est un défaut.

## Lecture du résultat

| Constat | Conclusion |
|---|---|
| Étapes 2 à 6 conformes, puis fusion par l'App à l'étape 8 | Circuit moyen prouvé en service : verdict, armement, désarmement, fusion. |
| Verdict GO à l'étape 5 | La revue n'a pas retenu le motif : le désarmement reste non prouvé. Le dire, ne pas conclure. |
| `auto_merge` encore posé à l'étape 5 | Désarmement défaillant. Désarmer à la main (`gh pr merge N --disable-auto`), garder le run, ne pas rendre le contrôle requis. |
| Check absent ou sauté sur une tête | Garder le run, ne pas rendre le contrôle requis. |
| Étape 7 : le second run rend GO | La PR reste armée. Noter lequel des deux checks la page retient. |
| Étape 7 : le second run rend HOLD | Le check passe au rouge et la fusion est désarmée : c'est le comportement prévu. Un run de revue n'arme jamais ; pour réarmer il faut un événement `pull_request_target` sur la tête (PR passée en brouillon puis prête, ou nouvelle tête). |

## Limites de l'essai

- `main` est en mode strict. Si `main` avance pendant l'essai, la branche doit être mise à jour :
  nouvelle tête, donc nouvelle revue. Ce n'est pas un défaut.
- Le verdict de la revue Claude n'est pas déterministe. L'étape 5 cherche un HOLD par un motif
  écrit dans le prompt ; elle ne le garantit pas. L'étape 7 peut rendre GO ou HOLD.
- Une revue soumise pendant qu'un run du circuit est en cours annule ce run (même groupe de
  concurrence) ; d'où la consigne de l'étape 1.
- L'essai ne couvre ni le circuit élevé, ni les forks, ni Dependabot.
