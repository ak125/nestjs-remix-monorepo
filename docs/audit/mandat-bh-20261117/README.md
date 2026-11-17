# Mandat BH — circuits de fusion : correctifs prêts à pousser

Décision 127 de l'owner (17 novembre 2026), suite de la décision 120. Ce dossier contient des
correctifs de workflow en fichiers `.patch`, leur sha256, le plan de preuve du circuit moyen et la
commande qui rend `🚦 Circuit de fusion` requis. Rien n'est poussé dans `.github/`, rien n'est
fusionné, rien n'est armé, la protection de `main` n'est pas modifiée.

Base des correctifs : `main` = `aa922af2a4c17ded1b312d528d8de4de5b6ccdff` (17 novembre, après #2122).
Les trois fichiers visés sont identiques à ceux de `abcfc30c3`, tête citée par le mandat.

| Fichier | Contenu |
|---|---|
| `patches/01-…` à `03-…` | les correctifs, à appliquer dans l'ordre |
| `SHA256SUMS` | empreintes, vérifiables par `sha256sum -c SHA256SUMS` depuis ce dossier |
| `commandes-owner.md` | blocs PowerShell du poste : pousser les correctifs, rendre le contrôle requis, revenir en arrière |
| `plan-preuve-circuit-moyen.md` | la PR d'essai du circuit moyen et ce qu'il faut y observer (reprise du §7 d'AR) |

## 1. Les correctifs

| Correctif | sha256 | Fichiers touchés | Effet |
|---|---|---|---|
| `01-job-jamais-saute-desarmement-verifie.patch` | `bbbc06c1701f91ac4f1305551f019f990150d22d5db71853ae36e65bf23589e5` | `.github/workflows/merge-circuits.yml`, `scripts/ci/merge-circuit.test.mjs` | Le job `🚦 Circuit de fusion` tourne toujours, sauf run annulé. Si le circuit n'a pas pu être calculé, il échoue au lieu d'être sauté, et la fusion automatique est désarmée. Le désarmement est relu ; s'il n'est pas constaté, il est confié à l'App, et le job échoue s'il reste une fusion armée. |
| `02-circuit-eleve-fusion-par-app.patch` | `2e434d554917e8f8d2be7ead5da5604b454c52b269ea43f2f10c5f30f934df36` | les deux mêmes | Circuit élevé : une fois la revue approuvante de l'owner enregistrée sur la tête exacte, la PR devient armable par l'App (squash, tête épinglée). Sans cette revue, rien n'est armé. Une nouvelle tête fait échouer le check et désarme. |
| `03-relais-armement-apres-revue.patch` | `fb49263c70a0753ba28d9976c56104f8c07dc58d8ce0fd8fd32dc10f49f063e3` | `.github/workflows/merge-circuits-relais.yml` (nouveau), les deux mêmes | Un relais, exécuté sur `main` quand un run né d'une revue se termine, relit la PR, le circuit et la revue de l'owner, puis confie l'armement ou le désarmement à l'App. |

Le correctif 02 suppose 01 ; le correctif 03 suppose 01 et 02. Un quatrième correctif, de
durcissement, est remis à l'owner hors du dépôt ; son empreinte figure dans le rapport de session.

Le cas du job sauté est couvert par les tests du workflow : `scripts/ci/merge-circuit.test.mjs`
extrait les étapes shell de `merge-circuits.yml` et les rejoue avec un `gh` factice. Ce fichier est
déjà lancé par le job requis `🛡️ ADR-010 Governance` (`ci.yml`, étape « 🚦 Classeur des circuits de
fusion (tests) »), après `npm ci`. Lancés contre le workflow actuel de `main`, les tests du
correctif 01 échouent (8 échecs) ; après le correctif, ils passent.

## 2. Circuit élevé : la contrainte de l'environnement et les options

L'approbation de l'owner arrive par un événement de revue. Le run porte alors la référence de la
PR, et l'environnement `app-actions`, restreint à `main`, lui refuse la clé de l'App. Cette
restriction est conservée. Trois façons d'obtenir la fusion par l'App après l'approbation :

| Option | Ce qui se passe après l'approbation | Coût |
|---|---|---|
| **B — correctif 02 seul** | Le check passe au vert. L'armement suit au prochain événement `pull_request_target` sur la même tête : PR passée en brouillon puis prête (ne relance pas `ci.yml`), ou fermée puis rouverte (relance la CI). | Un geste de plus de l'owner sur chaque PR du circuit élevé. |
| **A — correctifs 02 et 03 (recommandée)** | Le relais part à la fin du run de revue, sur `main`, avec le code de `main`. Il ne reprend du run déclencheur que le SHA de tête et relit tout le reste. Aucun geste de plus. | Un workflow nouveau qui entre dans l'environnement de l'App. L'acceptation de `workflow_run` par la politique 15133 reste à constater en service (aucun workflow du dépôt n'utilise cet événement). Un run du relais par run du circuit ; hors revue son job est sauté, sur une revue il coûte environ une minute (`npm ci`). La projection `audit/runtime-entrypoints.json` est à régénérer après la fusion (`npm run audit:inventory`, sur un checkout Linux ; la garde de fraîcheur n'est qu'un avertissement). |
| **C — armer tôt, s'appuyer sur le seul contrôle requis** | L'App arme dès l'ouverture ; la fusion attend le check vert. | Possible seulement une fois le contrôle requis, et tout repose alors sur lui seul. Non livrée. |

Écartées : élargir l'environnement `app-actions` aux références de PR ; donner au job du circuit un
droit d'écriture sur le contenu. Les deux affaiblissent une protection.

GATE-3 et son exception (`actions/checkout` sur `base.sha`) sont inchangés. Le relais n'extrait que
`main` et n'exécute aucun code de la PR.

## 3. Ordre recommandé

1. Correctif 01, seul, dans une première PR poussée du poste.
2. Preuve du circuit moyen sur la PR d'essai (`plan-preuve-circuit-moyen.md`).
3. Contrôle requis, sur un nouveau oui de l'owner (`commandes-owner.md`, §3).
4. Correctifs 02 et 03.

Le contrôle requis est le verrou ; le désarmement est une seconde barrière. Ouvrir la fusion par
l'App au circuit élevé (étape 4) avant d'avoir le verrou (étape 3) inverserait cet ordre.

## 4. Vérifications faites

Application à blanc sur `aa922af2a` par index temporaire (`git apply --cached --check
--whitespace=error-all`, puis arbre écrit et extrait hors du worktree) ; rien n'est écrit dans
`.github/` du worktree. Les tests tournent sur l'arbre extrait, avec les dépendances du checkout
partagé lues par `NODE_PATH`, sans installation.

| Chaîne appliquée | Arbre obtenu | `merge-circuit.test.mjs` | YAML | actionlint 1.7.12 | GATE-3 | Test de GATE-3 |
|---|---|---|---|---|---|---|
| 01 | `c46be785` | 14/14 | valide | 1 constat, déjà présent sur `main` | passe | 17/17 |
| 01, 02 | `43ef2638` | 15/15 | valide | idem | passe | 17/17 |
| 01, 02, 03 | `670f6c8e` | 20/20 | 2 fichiers valides | idem | passe | 17/17 |

Le constat actionlint existe sur `main` sans les correctifs (`steps.review.outputs.conclusion`,
job de la revue Claude) ; il n'est pas traité ici.

## 5. Ce qui ne se prouve qu'en service

- Le job `🚦 Circuit de fusion` en `failure`, et non `skipped`, sur un run réel dont le calcul
  échoue. Cas de référence avant correctif : run `43880344398` (job sauté). Aucun moyen propre de
  provoquer ce cas à la demande n'a été trouvé.
- Le désarmement réel par le jeton du run, puis par l'App : aucun désarmement n'a encore été
  observé sur ce dépôt.
- Circuit moyen : verdict, armement, fusion par l'App (plan de preuve).
- Correctif 03 : déclenchement de `workflow_run` sous la politique 15133, valeur de
  `workflow_run.head_sha` pour un run né d'une revue, entrée du relais dans `app-actions`.
- Lequel de deux checks de même nom posés sur la même tête la protection retient (run
  `pull_request_target` et run de revue).
- Les blocs PowerShell : écrits pour Windows PowerShell 5.1, non exécutés sur le DEV.

## 6. Comportements signalés, non modifiés

- En circuit moyen, tout événement de revue relance la revue Claude sur la même tête. Le verdict
  peut changer d'un run à l'autre ; un HOLD désarme et met le check au rouge. Un run de revue
  n'arme jamais.
- Une revue soumise pendant qu'un run du circuit est en cours annule ce run (même groupe de
  concurrence). L'armement attend alors le prochain événement `pull_request_target`.
- Les PR ouvertes par un workflow avec le jeton par défaut n'ont aucun run du circuit (constat
  AR §16). Sans effet tant que le contrôle n'est pas requis ; voir `commandes-owner.md`, §3.

## 7. Chevauchements

- **#2113 (mandat BC)** : aucun fichier commun. Son `etape-6.md` prévoit le check vert après
  approbation, puis une fusion par l'owner : avec 02 et 03 servis, c'est l'App qui fusionnerait une
  PR du circuit élevé approuvée. À relire avant de servir 02.
- **#2122 (mandat BD)** : P20 du journal déclare activé le seul circuit faible. À ajuster par PR
  quand les circuits moyen et élevé seront prouvés ; non modifié ici.
- **Mandat BB** : aucun.
- Le patch du contrôle requis que BD dit avoir préparé « hors dépôt » n'est pas dans le dépôt ; la
  commande de `commandes-owner.md` reprend celle du §6 d'AR.

## 8. État

| État | Ce qui s'y trouve |
|---|---|
| Préparé | Correctifs 01 à 03, blocs du poste, plan de preuve, commande du contrôle requis et son retour arrière |
| Testé à blanc | Application sur `aa922af2a`, tests du workflow, test de GATE-3, YAML, actionlint |
| Intégré | Rien : aucun correctif de workflow n'est sur `main` |
| Activé | Rien |
| Prouvé en service | Rien |
