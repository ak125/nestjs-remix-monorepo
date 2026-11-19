# Mandat DO — projections générées : régénérées sur main, plus dans chaque PR

Département 21 (Plateforme et exploitation), 2026-11-19. Base : `origin/main`
`1c4bbf4b25fe8cba38ce3564fd211997afa1859f`. Branche :
`ci/mandat-do-generes-sur-main-20261119`.

Décisions de l'owner appliquées : 113 (le goulot est la sortie), 114 (pas
d'organisation GitHub ni de file de fusion ; leviers : alléger la charge par PR,
augmenter la capacité), 122.1 (aucune resynchronisation hors du train), 72.3 (trois
circuits). Complément n° 1 (19 nov., 14:25) : mesure rejouable, voir §9.

## 1. Constat

- Sur 7 jours (2026-11-12 → 2026-11-18), **77 des 120 commits de main** touchent au
  moins une des 17 projections générées. Chaque PR qui les porte entre en conflit
  avec toutes les autres dès que l'une d'elles fusionne.
- Le relevé d'origine du mandat : 55 resynchronisations sur 90 n'ont pas abouti à
  une fusion.
- Base mesurée (§9) : 1,82 mise à jour avec main par fusion.

## 2. Inventaire, fichier par fichier

Producteur commun : `npm run registry:regenerate`. La chaîne est
`audit:inventory` → `registry` → `audit:pr-9-modernization-inventory` →
`audit:cleanup-candidates`. Liste unique dans
`scripts/registry/generated-projections.js`.

**Déterminisme**, prouvé localement et en CI :
- **Local** : une régénération sur main ne produit aucun écart, et deux passes
  donnent les mêmes 17 empreintes sha256 (§7, essai A).
- **CI** : le run `registry-fresh` 44528390321 sur main est vert, étapes
  « Deep-inventory freshness » et « Freshness diff » comprises. Le résultat est
  donc identique d'une machine à l'autre.

| Fichier | Producteur | Entrées | Lecteurs principaux | Garde qui exige le fichier commité (avant DO) | Choix |
|---|---|---|---|---|---|
| `audit/cycle-map.json` | `build-deep-inventory.js` | sources, `.dependency-cruiser.cjs`, knip | `registry-fresh` | Deep-inventory freshness | (a) |
| `audit/db-usage-map.json` | `build-db-usage-map.js` | sources, migrations SQL | `build-db-registry.js`, `build-rpc-registry.js` | Deep-inventory freshness | (a) |
| `audit/dead-code-candidates.json` | `build-deep-inventory.js` | sources, knip | `check-orphan-files-ratchet.ts` (bloquant), `build-cleanup-candidates.ts` | freshness + ratchet G3 | (a) |
| `audit/duplicate-map.json` | `build-deep-inventory.js` | sources | `registry-fresh` | Deep-inventory freshness | (a) |
| `audit/dynamic-import-edges.json` | `build-deep-inventory.js` | sources | `validate-before-delete.sh` | Deep-inventory freshness | (a) |
| `audit/module-boundaries.json` | `build-deep-inventory.js` | sources | `registry-fresh` | Deep-inventory freshness | (a) |
| `audit/runtime-entrypoints.json` | `build-deep-inventory.js` | sources | `build-files-registry.js`, `build-runtime-registry.js` | Deep-inventory freshness | (a) |
| `audit/registry/files.json` | `build-files-registry.js` | arbre, inventaire, L2 | canonical, drift-dashboard, `@repo/registry` tests | Freshness diff | (a) |
| `audit/registry/runtime.json` | `build-runtime-registry.js` | inventaire | canonical, drift-dashboard | Freshness diff | (a) |
| `audit/registry/deps.json` | `build-deps-registry.js` | `package.json` ×N, lockfile | canonical, inventaire de modernisation, `check-family-pr-scope.sh` | Freshness diff, `dependency-registry-freshness` | (a) |
| `audit/registry/db.json` | `build-db-registry.js` | migrations, db-usage-map | canonical, `db-contract.test.ts` | Freshness diff | (a) |
| `audit/registry/rpc.json` | `build-rpc-registry.js` | migrations, db-usage-map | canonical | Freshness diff | (a) |
| `audit/registry/canonical.json` | `build-canonical-registry.js` | L1 ci-dessus + L2 `.spec/00-canon/repository-registry/*.yaml` (`meta.inputHashes`) | backend (image Docker), `admin.control-plane.tsx`, `merge-circuit`, `build-cleanup-candidates.ts`, drift-dashboard (constat `canonical_stale`) | I6, Freshness diff, ratchet de dérive | (a) |
| `.claude/knowledge/REPO_MAP.md` | `build-llm-repo-map.js` | canonical | agents (lecture du checkout), `check-repo-map-drift.py` | Freshness diff | (a) |
| `audit/cleanup/pr-8-controlled-cleanup-candidates.json` | `build-cleanup-candidates.ts` | canonical, dead-code | `build-cleanup-candidates-markdown.ts` | PR-8 inventory freshness | (a) |
| `audit/cleanup/pr-8-deletion-proof.md` | `build-cleanup-candidates.ts` | idem | lecture humaine | PR-8 inventory freshness | (a) |
| `audit/dependencies/dependency-modernization-inventory.json` | `build-dependency-modernization-inventory.ts` | deps.json, `family-overlay.yaml` | `check-family-pr-scope.sh` | `dependency-modernization-fresh` (bloquant) | (a), déjà régénéré sur main avant DO |

Les fichiers ci-dessous sont aussi générés, mais restent tels quels (choix c) :

| Fichier | Raison du choix (c) |
|---|---|
| `audit/registry/command-center-snapshot.json` | Hors chaîne registry : produit par `build-command-center-snapshot.js` et changé une fois en 7 jours. Ce n'est pas une source de conflits. |
| `.claude/canon-mirrors/*.md` | Miroirs verrouillés par empreinte (`agent-exit-contract-hash`, `canon-distribution`). Leur changement est un acte de gouvernance volontaire, pas un sous-produit. |
| `.claude/knowledge/modules/*.md` | Notices éditées au cas par cas, quelques changements par semaine, aucun conflit relevé. |
| `.dependency-cruiser.generated.cjs` | Configuration générée, dont des tests de déterminisme lisent des copies figées (fixtures). Elle change rarement. |

**Choix (b), « ne plus versionner » : écarté pour les 17 fichiers.** Plusieurs
lecteurs les lisent dans le checkout, sans les produire :
- le backend, dans l'image Docker ;
- la page `admin.control-plane.tsx` (« committed canonical.json ») ;
- les agents qui lisent `REPO_MAP.md` ;
- `merge-circuit.mjs` et `validate-before-delete.sh`.

Les retirer du dépôt casserait ces lecteurs, ou forcerait un build avant chaque
lecture.

## 3. Options écartées

| Option | Pourquoi non |
|---|---|
| Pilote de fusion `.gitattributes` (`merge=ours`) | Il masque le conflit sans rendre la projection juste : le fichier fusionné ne correspond plus à ses entrées. GitHub n'exécute pas de pilote personnalisé lors de la fusion d'une PR, donc la mesure resterait locale. |
| Écriture directe sur main par le robot | Elle est refusée par la protection (GH006 : `enforce_admins` et contrôles requis, run 28922013091). La contourner serait un passe-droit sur une garde. La PR du robot passe par les mêmes contrôles que les autres. |
| Désactiver une garde de fraîcheur | Cela perdrait la garantie. Ici, chaque garde est conservée : elle **calcule** au lieu de **comparer** (§5). L'essai C prouve qu'un défaut visible seulement dans les projections reste bloqué. |
| Organisation GitHub / file de fusion | Refusé par la décision 114. |

## 4. Mécanisme

1. **Liste unique et contrôles** : `scripts/registry/generated-projections.js`.
   - `list` donne la liste des projections.
   - `check --scope pr|staged|bot|worktree` vérifie un périmètre. Codes de sortie :
     0 = conforme, 1 = écart, 2 = usage incorrect ou base illisible. `--warn`
     ramène l'écart (1) à 0 mais ne masque jamais le code 2.
   - Portée `pr` : une branche peut **reprendre** la version de la base, jamais
     en diverger. C'est ce qui permet la transition des PR ouvertes.
2. **Scripts npm** :
   - `registry:regenerate` exécute la chaîne complète ;
   - `registry:regenerate:verify` valide les invariants, les schémas Zod, PR-8 et
     l'inventaire de modernisation ;
   - `registry:generated:check` et `registry:test:generated-projections` exposent
     le contrôle et ses tests.
3. **Écrivain unique sur main** : `registry-deps-self-heal.yml`, étendu par le patch
   01.
   - **Jeton** : celui de l'App, comme avant.
   - **Étapes** : régénération complète, puis validation, puis une seconde passe
     qui doit être identique (déterminisme).
   - **Portée** : la régénération ne doit écrire que des projections listées
     (`check --scope worktree`).
   - **Idempotence** : si rien ne change, aucun commit et aucune PR.
   - **Branche et concurrence** : branche `chore/registry-self-heal`, groupe de
     concurrence inchangé.
   - **Pas de boucle** : le workflow n'a pas de déclencheur `push`.
   - **Armement** : le workflow **n'arme plus** la fusion automatique.
     `merge-circuits.yml` est la seule autorité d'armement (P20). Il arme la PR si
     elle est en circuit faible, ce qui suppose l'extrait d'ownership.
4. **Contrôles des PR adaptés** (patch 01) : ils calculent depuis l'arbre de la PR,
   puis appliquent la même garde qu'avant.

   | Workflow | Changement |
   |---|---|
   | `registry-fresh.yml` | Une étape « Calculer les projections depuis l'arbre courant » est ajoutée et indexée avant I6. I6, PR-8 et le déterminisme valident alors l'état calculé. Les `git diff` deviennent une comparaison entre deux passes. `workflow_dispatch` garde la comparaison à l'état commité de main. Le résumé affiche ce que main régénérera. |
   | `contract-gate.yml` | Régénération avant `npm -w @repo/registry test`. Ajout de `check --scope pr --base HEAD^1 --warn` (avertissement pendant la transition). `fetch-depth: 2`, délai 8 → 12 min. |
   | `audit.yml` | Régénération avant « @repo/registry contract tests ». Les migrations SQL sont ajoutées aux déclencheurs. Délai 10 → 14 min. |
   | `orphan-files-ratchet.yml` | `audit:inventory` avant le ratchet. Les entrées de l'inventaire sont ajoutées aux déclencheurs. |
   | `contract-drift-ratchet.yml`, `contract-drift-observatory.yml` | Régénération avant `audit:drift-dashboard`. Les sources du registry sont ajoutées aux déclencheurs. |
   | `dependency-registry-freshness.yml` | Sur une PR, la comparaison devient une information : le builder doit réussir. Sur main, elle reste inchangée. |
   | `dependency-modernization-fresh.yml` (bloquant) | Sur une PR, deps.json et l'inventaire sont calculés, puis `--check` refait une seconde passe. Les manifestes sont ajoutés aux déclencheurs. |
   | `dependency-family-bump.yml` | La régénération est conservée pour prouver que les builders passent. La PR reprend ensuite la version de main des projections. |
   | `registry-build.yml` | Ajout du test du nouveau module. |

5. **Block-new** (`check-new-files.js`) et **DoD** (`pr-dod-gate.mjs`) ne changent
   pas, pour deux raisons :
   - Block-new ne lit que les fichiers ajoutés (`--diff-filter=A`), et une
     projection n'est jamais nouvelle ;
   - la DoD ne contient aucune logique registry.
6. **Hook `.husky/pre-commit`** : il avertit si un commit indexe une projection
   différente de `origin/main`. C'est un avertissement seul pendant la transition.
7. **`resync-pr.sh`** (patch 03, outil DEV hors dépôt) :
   - après la fusion de main, il **reprend** la version de main des projections
     (`git checkout origin/main -- $(list)`) ;
   - il ne régénère plus rien et ne commite plus de projection.

## 5. Cadence de régénération sur main : écart signalé

Le mandat demande une régénération « après chaque fusion ». **Le patch 01 la fait
la nuit (02:30 UTC) et sur déclenchement manuel.**

**Raison** : la protection impose une branche à jour. Chaque fusion du robot met
donc en retard (BEHIND) toutes les PR prêtes du train. Une régénération par fusion
ajouterait une fusion du robot par fusion humaine, soit jusqu'à 29 par jour en
pointe le 11-17 (§9), et ferait la course avec le train. Cela irait contre la
décision 114 (alléger la charge par PR).

**Coût** : main peut garder jusqu'à environ 24 h de retard sur ses projections.
- Les contrôles de PR ne sont pas touchés : ils calculent.
- Les lecteurs du checkout de main (image backend, agents, `validate-before-delete`)
  voient l'état de la veille.
- Marwane peut lancer le workflow à la main à tout moment.

**Variante conforme à la lettre** : le patch 02 s'applique après le 01. Il
déclenche le workflow sur `push` vers main, avec `paths-ignore` sur les 17
projections, de sorte que la fusion du robot ne relance rien. À choisir par
Marwane.

## 6. Circuits calculés (`scripts/ci/merge-circuit.mjs`)

| PR | Circuit | Motifs non faibles |
|---|---|---|
| Cette PR | **élevé** | `.husky/pre-commit` (CODEOWNERS_ZONE), `scripts/registry/generated-projections.{js,test.ts}` (RISK_HIGH), `package.json` (RISK_MEDIUM) |
| PR du robot, ownership actuel | **élevé** | 9 projections non classées (UNCLASSIFIED) : cycle-map, db-usage-map, dead-code-candidates, duplicate-map, dynamic-import-edges, registry runtime/deps/db/rpc |
| PR du robot, extrait `patches/ownership-snippet.yaml` appliqué (simulation sur copie jetable) | **faible** | aucun ; 17 fichiers sur 17 en RISK_LOW |

L'extrait a été vérifié sur une copie jetable : `npm run registry:validate` est vert
avec 318 entrées, et la position de l'extrait est indifférente (le glob le plus
long gagne). Le fichier `ownership.yaml` a été remis dans son état d'origine ;
**il n'est pas modifié par cette PR** (fichier réservé à l'owner).

## 7. Essais locaux (DEV, 2026-11-19)

Les branches d'essai sont restées locales et ont été supprimées après usage.
Aucune n'a été poussée.

**A — régénération sur main, puis nuit suivante sans changement (workflow simulé)**

```
registry:regenerate          rc=0  (37 s)
check --scope worktree       conforme (7 générés, 0 autre)   ← écarts dus aux 3 fichiers ajoutés par cette PR
registry:regenerate:verify   rc=0  (6 invariants PASS, Zod OK, inventaire déterministe)
déterminisme                 2 passes identiques (17 sha256)
check --scope bot            conforme (7 générés, 0 autre)   ← PR du robot simulée
--- nuit suivante ---
registry:regenerate          rc=0
check --scope worktree       conforme (0 généré, 0 autre)
git diff --quiet             status=identical → aucune PR
```

Le commit local qui simule la PR du robot a été fait avec `--no-verify`. Il n'a
jamais été poussé et a été supprimé avec la branche d'essai. Le hook, lui, est
couvert par le commit réel de cette branche, qui l'a passé.

**B — PR d'essai qui modifie une source** (une ligne dans
`cross-selling-seo.service.ts`, sans projection régénérée)

```
== Gardes ACTUELLES de registry-fresh (comparer au commité) ==
  ✓ I6 — canonical frais vs entrées
  ✓ PR-8 inventory freshness
  ✓ Deep-inventory determinism
  ✗ Deep-inventory freshness (7 artefacts)
  ✓ Validate rebuilt canonical invariants
  ✗ Freshness diff (6 projections registry)
  => ancien : ROUGE
== Gardes ADAPTÉES (calculer d'abord) ==
  ✓ Calculer les projections depuis l'arbre courant + indexer
  ✓ I6 … ✓ PR-8 … ✓ Determinism … ✓ Deep-inventory freshness … ✓ Validate … ✓ Freshness diff
  => nouveau : VERT
== Autres contrôles adaptés ==
  ✓ check --scope pr          ✓ registry:regenerate
  ✓ npm -w @repo/registry test (contract-gate, audit)
  ✓ audit:orphan-ratchet      ✓ audit:drift-dashboard      ✓ ratchet de dérive
  projections que main régénérera après fusion : 7 files changed, 140 insertions(+), 18 deletions(-)
```

**C — la garantie est conservée.** Une PR d'essai ajoute un fichier orphelin dans le
périmètre G3 (`backend/src/modules/rag-proxy/`), sans projection.

```
ratchet SANS calcul (inventaire de main) : rc=0 — ✓ aucun finding        ← garantie perdue
ratchet APRÈS calcul (patch DO)          : rc=1 — [UNDECLARED_NEW] backend/src/modules/rag-proxy/essai-orphelin-mandat-do.ts
```

Sans l'étape de calcul, ne plus porter les projections aurait **désactivé en
silence** le ratchet G3. Avec elle, l'orphelin est bloqué comme aujourd'hui. C'est
la même raison qui fait ajouter l'étape de calcul aux autres lecteurs (§4.4).

**Scripts de simulation** : ils restent hors du dépôt, dans le scratchpad de la
session. Les sorties sont reproduites ci-dessus.

## 8. Tests

| Commande | Résultat |
|---|---|
| `npm run registry:test:generated-projections` | 7/7, dont un test d'intégration CLI sur un dépôt git jetable |
| `npm run registry:test:check-new-files` | 4/4 |
| `node --test scripts/ci/merge-circuit.test.mjs` | 20/20 |
| `node scripts/registry/check-new-files.js --base origin/main` | 11 nouveaux fichiers, 11 conformes |
| `node scripts/registry/generated-projections.js check --scope pr --base origin/main` | conforme : 0 généré, 13 autres |
| `git apply --check` patches 01 puis 02, `patch --dry-run` patch 03 | s'appliquent sur main `1c4bbf4b2` |
| YAML des 11 workflows patchés (`yaml.safe_load`) | valide ; `actionlint` absent du DEV, non exécuté |

## 9. Mesure avant/après (complément n° 1)

**Script** : `mesure-fusions.mjs`. Il est en lecture seule (`gh api graphql`,
aucune écriture) et compte les jours en Europe/Paris. Il produit par jour :
- le délai prête → fusionnée, en médiane et 90e centile. « Prête » est la dernière
  sortie de brouillon, sinon la première approbation, sinon la création ;
- en complément, le délai création → fusion. Sur ce dépôt, la sortie de brouillon
  et l'approbation précèdent la fusion de quelques minutes ;
- le nombre de PR ouvertes, non brouillon, prêtes depuis plus de 24 h ;
- le nombre de mises à jour avec main par fusion (commits de fusion et poussées
  forcées).

**Base de 7 jours** (2026-11-12 → 2026-11-18) : `mesure-avant-20261112-20261118.md`
et `.json`.
- Fenêtre : 132 fusions.
- Prête → fusionnée : médiane 0,2 h, 90e centile 11 h.
- Création → fusion : médiane 6,2 h, 90e centile 24,7 h.
- PR prêtes en attente depuis plus de 24 h : 10 à 13 par jour.
- **1,82 mise à jour avec main par fusion.**

**Commande à rejouer 7 jours après la fusion** (J = jour de fusion) :

```
node docs/audit/mandat-DO-20261119/mesure-fusions.mjs --since <J+1> --until <J+7> \
  --json docs/audit/mandat-DO-20261119/mesure-apres-<J+1>-<J+7>.json \
  > docs/audit/mandat-DO-20261119/mesure-apres-<J+1>-<J+7>.md
```

Mesure complémentaire, sans script :

```
git log --since=<J+1> --until=<J+8> --no-merges --format=%H origin/main -- $(node scripts/registry/generated-projections.js list) | wc -l
```

Avant le mandat, ce compte était de 77 commits sur 120. L'attendu après est
d'environ une PR du robot par nuit utile.

La décision 114 reste en vigueur ; la question ne se rouvre que sur cette mesure.

## 10. Transition des 72 PR ouvertes

- Aucune resynchronisation de maintenance n'est faite (décision 122.1).
- Quand une PR passe dans le train, sa mise à jour (patch 03 de `resync-pr.sh`)
  reprend la version de main des 17 projections. Le diff de la PR n'en contient
  alors plus aucune, et la portée `pr` l'accepte, puisque le fichier est identique
  à la base.
- Les conflits sur les projections disparaissent : une branche qui reprend la
  version de main ne peut pas entrer en conflit avec main sur ces fichiers.
- Une PR qui n'est pas encore passée par le train garde ses projections, avec un
  simple avertissement. Rien ne la bloque tant que l'étape 4 ci-dessous n'est pas
  faite.

## 11. Ordre d'application (gestes de Marwane)

1. Relire puis fusionner cette PR (circuit élevé).
2. Appliquer `patches/01-workflows-generes-sur-main.patch`, plus la variante 02 si
   elle est choisie, depuis son PC. Le jeton DEV ne pousse pas `.github/workflows/`.
3. Appliquer `patches/ownership-snippet.yaml`, par exemple avec
   `resync-pr.sh <N> --ownership …` ou à la main. Ce fichier lui est réservé.
4. Installer le patch 03 de `resync-pr.sh` et retirer le cron DEV (`patches/04`).
5. Après une semaine sans avertissement inattendu, passer en blocage : retirer
   `--warn` du hook et de l'étape de `contract-gate`. **Ajouter ou retirer un
   contrôle requis reste son geste**, hors de ce mandat.

## 12. Risques et retours arrière

| Risque | Mesure | Retour arrière |
|---|---|---|
| Main en retard d'au plus 24 h sur ses projections | Les contrôles de PR calculent, et le workflow peut être lancé à la main. La variante 02 supprime ce retard, au prix de mises en retard (BEHIND) pendant le train. | Patch 02 |
| Chaque fusion du robot lance la chaîne PREPROD (`ci.yml` sur `main`) | Une PR au plus par nuit, aucune quand rien ne change | — |
| Fusion du robot en circuit élevé tant que l'extrait n'est pas appliqué | La PR attend l'owner : l'échec est sans danger, rien n'est fusionné | Appliquer l'extrait |
| Temps CI ajouté par PR (environ 40 s de régénération par workflow concerné) | Délais relevés (8 → 12, 10 → 14 min). Le coût est compensé par la disparition des resynchronisations. | Annuler le patch 01 |
| Équivalence de `npm ci --ignore-scripts` (workflow du robot) non prouvée en CI | Le seul script de cycle de vie est `prepare: husky`. La garde de portée et la double passe rendraient visible un écart. | `npm ci` simple |
| Deux écrivains sur `chore/registry-self-heal` si le cron DEV n'est pas retiré | `patches/04` | Recharger la crontab sauvegardée |
| Un nouveau lecteur oublié lirait les projections de main au lieu de celles de la PR | Liste des lecteurs au §2. L'essai C montre le mode d'échec. | Ajouter `registry:regenerate` dans ce lecteur |

**Retour arrière global** :
- annuler le patch 01, ce qui rétablit le workflow à 4 fichiers déclenché par
  `push` ;
- réinstaller l'ancien `resync-pr.sh`, ce qui rétablit la régénération dans la
  branche ;
- recharger la crontab.

Le module et les scripts npm de cette PR sont inertes sans les patches.

## 13. État en 5 niveaux

| Élément | Implémenté | Intégré (main) | Vérifié | Opérationnel |
|---|---|---|---|---|
| Module `generated-projections.js`, tests, scripts npm, hook (avertissement) | oui, cette PR | non : PR en brouillon | tests locaux 7/7 ; CI à lire sur la PR | non |
| Patch 01 (workflows) et variante 02 | oui, fichiers de patch | non : geste de Marwane | `git apply --check`, YAML valide, essais A, B et C simulés localement | non |
| Patch 03 `resync-pr.sh` | oui, fichier de patch | non installé | `bash -n`, `patch --dry-run` ; pas exécuté sur une PR réelle | non |
| Extrait d'ownership | oui | non : owner | copie jetable : `registry:validate` vert, circuit faible | non |
| Retrait du cron DEV | procédure écrite | non | — | non |
| Mesure rejouable et base de 7 jours | oui | non : PR en brouillon | exécutée le 2026-11-19 (environ 23 s) | oui (lecture seule) |

**Bloqué** : rien côté agent. Les étapes 1 à 5 du §11 sont des gestes de Marwane.

**Inconnues** :
- le comportement réel en CI des workflows patchés (temps, cache npm) ;
- l'équivalence de `--ignore-scripts` ;
- les lecteurs non relevés par une recherche de noms de fichiers (par exemple une
  lecture par motif de chemin).
