# Correctifs préparés, non appliqués (mandat CJ, 2026-11-18)

Ces correctifs ne sont **pas appliqués** dans cette PR. Les fichiers `.github/**`, scripts compris,
sont réservés à l'owner (garde de fichiers de l'agent, ADR-130 D3.4) : la modification directe de
`.github/scripts/morning-health-digest.sh` a été refusée par la garde. **Leur application revient
à Marwane.**

La PR contient la partie hors `.github/**` : `scripts/ops/morning-health-digest.test.sh`,
39 vérifications, faux `gh` et faux `curl`, sans réseau. Le test vise le script du dépôt : il
n'est vert qu'une fois 01 appliqué (8/39 sur le script actuel, 39/39 sur le script corrigé).

## Cause constatée

Le 18 nov., le rapport écrivait « gestes : 0 ; mail du jour : non envoyé : liste des gestes
illisible », sans cause. La lecture `gh pr list --state open --limit 100 --json
…,files,statusCheckRollup` finit en **HTTP 504 de l'API GraphQL** : `statusCheckRollup` développe
jusqu'à 55 contrôles par PR, la requête dépasse le délai de GitHub (≈ 11 s pour 61 PR ouvertes).
Le script jetait le message d'erreur (`2>/dev/null`) et passait à une liste vide.

## 01 — lecture des gestes fiable, cause écrite

`01-gestes-lecture-fiable.patch`

SHA-256 : `5a9b52c00d1039be5601011b707b84f11fc822780ac0119b6992500757e0df35`

`.github/scripts/morning-health-digest.sh` seulement :

- **lecture allégée** : pages de 50 PR ouvertes (300 au plus) avec l'état global des contrôles
  seul, puis le détail des contrôles PR par PR, pour les seules PR dont l'état n'est pas vert.
  La forme des données lues ne change pas pour la suite du script ;
- **nouvel essai borné** : `timeout` de 60 s par appel, 3 essais au plus sur une erreur passagère
  (HTTP 5xx, délai, réseau, réponse illisible), pause de 5 s puis 10 s ; une erreur définitive
  (HTTP 4xx, erreur GraphQL) n'est pas répétée. Après un échec définitif sur les contrôles d'une
  PR, les suivantes ne sont pas tentées : le passage reste borné ;
- **« aucun geste » distinct de « lecture en échec »** : chaque source illisible garde une cause
  courte et publique (`liste des PR : HTTP 504 GitHub après 3 essais`, `labels : …`,
  `issues au label attend-marwane : HTTP 403 GitHub`, `délai de 60 s dépassé`,
  `erreur GraphQL GitHub`, `erreur réseau`, `réponse illisible`), jamais le message brut. Elle est
  écrite dans l'en-tête des gestes, la ligne « Mail du jour », le signal concerné, le mail partiel
  et le journal du job (`::warning::Gestes de Marwane : N au moins, lecture en échec — …`).
  Lecture réussie : ligne de journal `Gestes de Marwane : N (…) ; PR ouvertes lues : x/y` ;
- **contrôles illisibles** : la PR est listée « contrôles illisibles » et le signal « PR ouvertes
  en échec » passe « indisponible » avec la cause (un compte « au moins », jamais un vert) ;
- **label absent** : « Label X inexistant », sans lecture d'issues ni échec ; comparaison exacte
  (`grep -F`), « (label inexistant) » dans le mail ;
- **inchangé** : le mail du jour ne part que s'il y a des gestes (liste partielle comprise, avec
  « au moins ») ; urgences, portes horaires, issue unique et commentaires de changement de couleur.

## 02 — test en CI

`02-ci-test-gestes.patch`

SHA-256 : `d9e5acef6623c8e025affb31ab35b20c07b2df5daca4f0a0a98f2c62d014ddf9`

- `.github/workflows/ci.yml` : étape `bash scripts/ops/morning-health-digest.test.sh` dans le job
  « 🛡️ ADR-010 Governance », après le test des seuils du registre (mandat BZ).

**À appliquer avec 01, jamais seul** : sur le script actuel le test échoue (8/39), c'est voulu.
`.github/workflows/morning-health-digest.yml` ne change pas.

## Appliquer, vérifier, revenir en arrière

```bash
git apply docs/plans/2026-11-18-mandat-cj-patches/01-gestes-lecture-fiable.patch
git apply docs/plans/2026-11-18-mandat-cj-patches/02-ci-test-gestes.patch
bash scripts/ops/morning-health-digest.test.sh        # 39/39 attendu
REPO=ak125/nestjs-remix-monorepo GH_TOKEN=$(gh auth token) THRESHOLD_ISSUES_MODE=off \
  bash .github/scripts/morning-health-digest.sh       # lecture seule : ligne « Gestes de Marwane : … »
```

Après fusion : un `workflow_dispatch` de « 🌅 Morning health digest » donne, dans l'issue du
rapport, la liste des gestes ou la cause de l'échec, et dans le journal du job la ligne
« Gestes de Marwane ». Retrait : `git apply -R` des deux correctifs.

Vérifié dans le mandat : `git apply --check` des deux correctifs sur `47fc7e4c9` ; `bash -n` ; YAML
de `ci.yml` corrigé relu par `yaml.safe_load` ; test 39/39 sur le script corrigé et 8/39 sur
l'actuel ; script corrigé exécuté en lecture seule contre le vrai dépôt (61/61 PR lues, 7 gestes),
script actuel dans les mêmes conditions (« Liste des PR ouvertes illisible », sans cause).
Non vérifié : `shellcheck` et `actionlint` absents de l'hôte DEV ; exécution dans GitHub Actions
(jeton `GITHUB_TOKEN` du job) ; envoi réel du mail.

Conflit possible : tout autre correctif préparé sur `morning-health-digest.sh` (mandat BZ-3 en
cours). Le correctif BZ-01 est déjà dans `main` et ne gêne pas.
