# Mandat BC — étape 7, suite : le contrôle de coût Supabase (patch 05)

Suite de l'étape 7 (`etape-7.md`, PR #2120), séparée le 17 novembre 2026 à la demande du
pilotage (complément BC-6). Le patch 05 lit le secret `SUPABASE_ACCESS_TOKEN`, qui n'existe
pas dans le monorepo : le poser est un geste de l'owner. Cette PR l'attend seule ; les
patches 04 et 06 sortent avec #2120 sans elle. Le contrôle est gardé (décision 129, D14).

## Ce que fait le patch

Un fichier nouveau, `.github/workflows/supabase-cost-surface-drift.yml`, repris du workflow
`vault-supabase-cost-check.yml` de l'archive. Chaque lundi à 08:00 UTC, ou sur lancement
manuel, il relève le plan de l'organisation Supabase, la liste de ses projets et leurs
add-ons, en calcule une empreinte et la compare à celle du relevé précédent. Un écart ouvre
une issue : P1 pour un changement de plan ou un add-on ajouté, P2 pour un projet ajouté ou
retiré ou un add-on retiré. Il ne lit que l'API de gestion de Supabase, n'écrit rien chez
Supabase et ne tourne sur aucune PR.

| Patch | Cible | sha256 |
|---|---|---|
| `patches/05-supabase-cost-surface-drift-workflow.patch` | monorepo, nouveau `.github/workflows/supabase-cost-surface-drift.yml` | `5144d2f824b23cb1740765f1e196896d4460f1e99480383f37ae517ffedc829e` |

Ce sont les octets relus dans #2120 : le fichier a été déplacé, pas modifié.

## Le jeton

Le secret attendu est un **jeton d'accès personnel Supabase** (API de gestion), créé sur
`https://supabase.com/dashboard/account/tokens`. Ce n'est ni `SUPABASE_ANON_KEY` ni
`SUPABASE_SERVICE_ROLE_KEY`, qui sont des clés d'un projet et non des jetons de cette API.

Portée minimale, en lecture seule, pour l'organisation concernée
(documentation Supabase, « Personal Access Tokens », tableau des permissions, lue le
17 nov. 2026 : `https://supabase.com/docs/guides/platform/personal-access-tokens`) :

| Permission | Accès | Route lue par le workflow |
|---|---|---|
| Organization Settings | Read | `GET /v1/organizations/{slug}` |
| Organization Projects | Read | `GET /v1/organizations/{slug}/projects` |
| Add-ons | Read | `GET /v1/projects/{ref}/billing/addons` |

Trois points à connaître avant de le créer :

- **Les jetons à portée limitée sont en alpha publique**, ouverts peu à peu aux comptes.
  Si l'écran de création ne propose pas de choisir des permissions, le compte n'y a pas
  encore accès. Un jeton classique porte alors tous les droits du compte, écriture comprise,
  sur toutes ses organisations. Le poser dans un dépôt public est un choix de l'owner, pas
  un détail : dans ce cas, mieux vaut demander l'accès à Supabase ou attendre.
- **Sans la permission Add-ons**, la route des add-ons répond 403. Le workflow l'accepte et
  note « aucun add-on » : il passerait au vert en ne surveillant plus que le plan et le
  nombre de projets. Les trois permissions sont donc à cocher ensemble.
- **Un jeton neuf.** La notice de l'archive (`ledger/knowledge/supabase-management-token.md`)
  note une rotation en attente depuis le 18 mai 2026 : le jeton d'alors a transité en clair
  dans un chat. Ne pas le réutiliser, et révoquer l'ancien.

Les commentaires du workflow nomment la portée « organizations:read + projects:read »,
comme la notice de l'archive. Les noms du tableau ci-dessus sont ceux de l'écran actuel de
Supabase ; le patch n'a pas été retouché pour autant.

La valeur se pose au clavier, jamais dans une commande ni dans un fichier :
`gh secret set SUPABASE_ACCESS_TOKEN --repo ak125/nestjs-remix-monorepo`, puis coller.

## Sans le secret

La première étape du job écrit une erreur (« SUPABASE_ACCESS_TOKEN secret missing ») et
sort en code 1. Le run du lundi est rouge, sans relevé ni issue. Rien n'est masqué : un
contrôle absent ne passe pas pour un contrôle vert. C'est pourquoi le patch n'est pas
poussé tant que le secret n'existe pas : le bloc ci-dessous s'arrête avant toute écriture.

## Écart au plan, assumé

**Recherche du relevé précédent réécrite.** Le workflow du vault lisait les 100 derniers
artefacts du dépôt. Le monorepo en produit 5546 ; les 100 derniers couvrent 6 heures. La
copie telle quelle n'aurait jamais retrouvé le relevé de la semaine précédente : chaque run
aurait été une « base », sans comparaison. La recherche passe par les runs du workflow
lui-même. L'étape n'a plus de `continue-on-error` : une API en échec arrête le run au lieu
de le faire passer pour un premier relevé.

## Preuves

- `git apply --check` du patch sur un export de `origin/main` (`fc470e41a`) : code 0. YAML
  relu par un parseur.
- Recherche du relevé précédent : jouée sur le DEV contre les runs réels du workflow du
  vault. À partir du run 43828729889, elle retrouve le run 42582980292 (9 nov. 08:01 UTC)
  et son artefact ; l'empreinte recalculée commence par `e383bd7eab50`, celle du journal du
  run. Sans relevé : avertissement et rc=0. API en échec : rc=1.
- Dernier run du contrôle dans le vault : 43828729889 (16 nov. 08:07 UTC), « No drift
  (hash match: e383bd7eab50…) », plan pro, 5 projets, 4 add-ons.

## Limites

- **Aucun run dans le monorepo.** Le workflow n'a jamais tourné ici ; l'appel réel à
  Supabase avec le nouveau jeton n'est pas prouvé. La preuve de fin est le run lancé par le
  bloc depuis `main` après la fusion.
- Le premier run sera une base, sans comparaison. La continuité avec le vault se lit sur
  son empreinte : `e383bd7eab50…` si rien n'a changé.
- Les labels `ops`, `cost-surface-drift`, `P1` et `P2` n'existent pas dans le monorepo
  (relevé du 17 nov.) ; le bloc les crée.
- Tant que le vault n'est pas archivé, son workflow tourne aussi le lundi. Sans dommage ;
  une dérive ouvrirait une issue dans chaque dépôt.
- L'identifiant de l'organisation Supabase reste en clair dans le workflow, comme dans le
  vault, qui est public. Les artefacts d'un dépôt public sont téléchargeables : le relevé
  publié est la version expurgée, la même que dans le vault.

## État

| État | Constat |
|---|---|
| Implémenté | oui : patch 05, inchangé |
| Intégré | non : PR en brouillon, patch non poussé |
| Vérifié | logique jouée à blanc contre les runs du vault ; aucun run dans le monorepo |
| Opérationnel | non |
| Bloqué | par la pose du secret `SUPABASE_ACCESS_TOKEN`, geste de Marwane |

## Geste

Marwane pose d'abord le secret (commande ci-dessus). Ensuite, un seul bloc, Windows
PowerShell 32 bits, à lancer depuis le poste. Il n'a pas été exécuté par l'agent : le DEV
n'a pas de PowerShell. `<hote DEV>` est à remplacer par l'adresse du DEV, qui ne s'écrit
pas dans ce dépôt public.

Le bloc s'arrête si le secret manque. Sinon il crée les quatre labels, vérifie l'empreinte
du patch, le pousse, régénère les projections sur le DEV, sort la PR du brouillon, attend
les checks, demande l'accord et enregistre l'approbation. La fusion est faite par l'App
(circuit élevé, P20) : le bloc l'attend, puis lance le contrôle une première fois depuis
`main`. Il est rejouable.

BLOC_ICI
