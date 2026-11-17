# Mandat BD, complément n° 4 — une fiche par incident

Décision 138 de l'owner (17 novembre 2026, citée à la ligne P41 du journal) : une issue par
incident dans le monorepo, pas de nouveau registre ; la fiche ne se ferme que lorsqu'elle dit ce
qui empêche le retour de l'incident, avec le lien.

La PR qui porte ce dossier ajoute la ligne P41 au journal et le script du contrôle. Le gabarit
d'issue, le workflow et le test du script sont dans un fichier `.patch` : tout `.github/` est
réservé à l'owner. Rien n'est poussé dans `.github/`, aucune issue n'est modifiée, aucun fichier
n'est déplacé ni supprimé.

| Fichier | Contenu |
|---|---|
| `patches/01-fiche-incident-gabarit-workflow-test.patch` | le gabarit, le workflow, le test et son étape dans `audit.yml` |
| `SHA256SUMS` | empreinte du patch, vérifiable par `sha256sum -c SHA256SUMS` depuis ce dossier |
| `commandes-owner.md` | le bloc PowerShell du poste et les lectures de vérification |

Base : `main` = `a9bd755d6f990e152679b61d1519d3e5c1d36e2a`, relue égale à `origin/main` à
16:33:06Z le 17 novembre 2026. Le mandat citait `fc470e41a` ; `main` a avancé d'un commit (#2104)
qui ajoute une ligne P40 au journal.

## 1. Relevé avant d'écrire

Relevé du 17 novembre 2026 sur `a9bd755d6` et par l'API GitHub (186 issues, 184 ouvertes).

### Les issues

Le point de départ comptait « 3 issues liées à un incident ». Une recherche par titre rend trois
**PR**, pas des issues. Les issues d'incident sont trois autres numéros.

| N° | Nature | État | Label | Auteur | Forme du corps |
|---|---|---|---|---|---|
| #264 | issue | ouverte (2 mai 2026) | `incident` | owner | « [INC-2026-013] … ». Rubriques : Contexte, Documents vault, 4 PRs à ouvrir, Règle fondamentale, Trace causale, Références. Aucune des trois rubriques de la règle. Aucun commentaire. |
| #1916 | issue | ouverte (29 oct. 2026) | `incident-sitemap-cron` | workflow | Trois lignes posées par la machine : événement, acteur, SHA. |
| #586 | issue | fermée à la main (18 mai 2026) | `incident-sitemap-cron` | workflow | Même forme. Deux commentaires. |
| #154 | PR | fusionnée (24 avr. 2026) | aucun | — | Trois incidents de base, chacun avec sa correction. |
| #487 | PR | fusionnée (13 mai 2026) | aucun | — | Summary, Root cause, Fix, Test plan, Rollback. |
| #494 | PR | fermée sans fusion | aucun | — | Suivi après incident, même forme de PR. |

Onze autres issues citent le mot « incident » dans leur corps sans en être une.

### Les deux comptes rendus en fichiers

| Fichier | Taille | Rubriques | Ce qui manque au regard de la règle |
|---|---|---|---|
| `.spec/incidents/2026-02-configservice-crash.md` | 64 lignes | Symptôme, Cause racine, Fix, Complication, Prévention | La rubrique Prévention existe, sans lien vers un test ou un contrôle. |
| `.spec/reports/incident-2026-04-14-payments-sev1.md` | 565 lignes | TL;DR, Timeline, Impact, Detection, Investigation, Root Cause (préliminaire), Remediation proposed | Cause marquée préliminaire ; la remédiation est proposée, pas liée à un contrôle. |

### Ce qui ferme ou rouvre une issue aujourd'hui

| Mécanisme | Chemin | Effet |
|---|---|---|
| Aucun workflow sur l'événement `issues` | `.github/workflows/` | Rien ne réagit à la fermeture d'une issue. Rien ne rouvre une issue. |
| Régénération du sitemap | `.github/workflows/sitemap-daily-regen.yml`, l. 63-80 | Ouvre une issue `incident-sitemap-cron` à chaque échec. Ne la ferme pas. |
| Sonde du parcours d'achat | `scripts/ops/purchase-path-probe.sh`, l. 86-88 | Ouvre une issue d'alerte sans label, assignée à l'owner, et la ferme seule au retour à la normale. |
| `stale.yml` | `.github/workflows/stale.yml` | Ne traite que les PR. |
| File du pilote | `scripts/ops/pilote-file.sh`, l. 58 | Liste toutes les issues ouvertes ; ne ferme ni n'étiquette rien. |
| Gabarits d'issue | `.github/ISSUE_TEMPLATE/` | Le dossier n'existe pas. |

### Ce qui est réutilisé

- le label `incident`, déjà présent ; aucun label n'est créé ;
- le modèle du contrôle du corps d'une PR : `scripts/ci/pr-dod-gate.mjs`, son test et
  `.github/workflows/pr-dod-gate.yml` (verdict dans un script testé, corps lu hors de tout `run:`,
  commentaire unique retrouvé par un marqueur) ;
- `scripts/ci/ci-test-wiring.mjs`, qui exige que chaque test de `scripts/ci/` soit lancé par un
  workflow de PR : le test du contrôle est lancé par une étape de `audit.yml`, à côté de celle de
  `pr-dod-gate` ;
- `OWNER_LOGIN: ak125`, écrit comme dans `merge-circuits.yml`.

## 2. Le gabarit

`.github/ISSUE_TEMPLATE/incident.yml` (dans le patch) est un formulaire GitHub. Il pose le label
`incident` et le titre « [Incident] ».

- En tête, le rappel : dépôt public, aucun secret, aucun détail qui aiderait une attaque, aucune
  donnée de client.
- Trois rubriques : « Ce qui s'est passé », « Pourquoi », « Ce qui l'empêche de revenir ».
- Une case « Aucun contrôle possible ».

À l'ouverture, seule la première rubrique est exigée par le formulaire : la cause et la parade ne
sont pas connues quand l'incident commence. Les trois sont exigées à la fermeture, par le
contrôle. C'est un choix de la session ; rendre les trois obligatoires dès l'ouverture tient en
deux lignes du gabarit.

## 3. Le contrôle

`scripts/ci/incident-issue-gate.mjs` (dans la PR) lit une issue par l'API et rend un verdict.
Le workflow `.github/workflows/incident-issue-gate.yml` (dans le patch) le lance quand une issue
au label `incident` est fermée, modifiée ou étiquetée, et sur lancement manuel.

| Cas | Verdict |
|---|---|
| Issue ouverte, PR, ou issue sans le label `incident` | hors périmètre, aucun acte |
| Fermée, une des trois rubriques absente ou vide | rouverte, commentaire qui nomme chaque manque |
| Fermée, troisième rubrique remplie sans lien admis | rouverte, commentaire qui cite les liens refusés et pourquoi |
| Fermée, troisième rubrique avec un lien admis | reste fermée, aucun commentaire |
| Case « Aucun contrôle possible » cochée, fermée par un autre que l'owner | rouverte : la décision revient à l'owner |
| Case cochée, raison écrite, fermée par l'owner | reste fermée |
| Panne de l'API | le job échoue, rien n'est rouvert |

Lien admis : une PR **fusionnée** de ce dépôt (`#123` ou son adresse), ou l'adresse d'un fichier
de ce dépôt présent sur `main` (test, règle, workflow). Une PR ouverte ou fermée sans fusion, une
issue, un commit, un run ou un lien vers un autre dépôt ne suffisent pas.

« Vide » couvre `_No response_` (ce que GitHub écrit pour un champ laissé vide), un commentaire
HTML seul et « à compléter », « todo », « tbd ».

Le commentaire de réouverture est unique : il est retrouvé par son marqueur et mis à jour, jamais
doublé. Il ne recopie rien du corps de l'issue.

### Limites

- Le contrôle vérifie qu'un lien admis est présent. Il ne juge pas si le test cité couvre la
  cause : cela reste une lecture humaine.
- Le mandat dit « un lien vers un test, un contrôle ou une PR ». Le contrôle n'admet une PR que
  fusionnée : une PR ouverte n'empêche encore rien. Choix de la session, réversible en une ligne.
- Retirer le label `incident` sort la fiche du contrôle. C'est la voie prévue pour une fausse
  alerte ou un doublon ; elle reste visible dans l'historique de l'issue.
- Le formulaire est public : toute personne ayant un compte GitHub peut ouvrir une fiche. Une
  fiche ouverte figure dans la liste que lit la routine du pilote (P24).
- Une issue ouverte sans le formulaire, mais au label `incident`, est contrôlée de la même façon :
  ses titres de rubriques doivent être ceux du gabarit.
- Les issues `incident-sitemap-cron` et les alertes de la sonde du parcours d'achat restent hors
  du contrôle (voir §5).
- Le workflow n'a jamais tourné sur GitHub : il n'existe pas encore sur `main`.

## 4. Essais

Faits le 17 novembre 2026, Node v24.21.0, sur une copie de `a9bd755d6` hors du dépôt.

| Essai | Résultat |
|---|---|
| Test du contrôle (`scripts/ci/incident-issue-gate.test.mjs`, dans le patch) | 60 cas, 60 verts |
| Mutations du script (8 : PR non fusionnée admise, owner non exigé, pas de réouverture, écriture à blanc, sortie du dépôt par le chemin, auto-citation, ligne très longue, `_No response_` compté) | chacune fait échouer au moins un cas |
| Mutation du gabarit (un titre renommé) | 1 cas échoue |
| Patch appliqué à blanc sur `main` seul (`git apply --index --check`) | accepté |
| Test lancé sans le script de la PR | échec (`ERR_MODULE_NOT_FOUND`) : la PR se fusionne avant le patch |
| `ci-test-wiring.test.mjs`, PR seule | 15/15 |
| `ci-test-wiring.test.mjs`, PR et patch | 15/15 |
| `ci-test-wiring.test.mjs`, test sans l'étape de `audit.yml` | 1 échec : l'étape du patch est nécessaire |
| Six fiches factices, API simulée, 16:31:29Z | voir ci-dessous |
| Lecture seule des issues réelles, à blanc, 16:31:40Z | #264 : hors périmètre (ouverte). Fiches fermées au label `incident` : 0. #586 relue après l'essai : inchangée. |

Les six fiches factices (numéros fictifs) :

| Fiche | Troisième rubrique | Fermée par | Verdict |
|---|---|---|---|
| 9001 | vide (`_No response_`) | agent | rouverte : « la rubrique « Ce qui l'empêche de revenir » est vide » |
| 9002 | cite une PR fusionnée | agent | reste fermée |
| 9003 | adresse d'un test présent sur `main` | agent | reste fermée |
| 9004 | case cochée, raison écrite | agent | rouverte : décision de l'owner attendue |
| 9005 | case cochée, raison écrite | owner | reste fermée |
| 9006 | cite une PR encore ouverte | agent | rouverte : aucun lien admis |

Actes sur l'API simulée : un commentaire puis une réouverture pour 9001, 9004 et 9006 ; aucun acte
pour les trois autres.

## 5. Ce que deviennent les éléments anciens — proposition, rien n'est fait

| Élément | Proposition |
|---|---|
| `.spec/incidents/2026-02-configservice-crash.md` | Reste où il est. Il précède la règle ; aucune fiche rétroactive n'est exigée. Si l'owner en veut une, la fiche renvoie au fichier sans le recopier. |
| `.spec/reports/incident-2026-04-14-payments-sev1.md` | Reste où il est, pour la même raison. Sa cause est marquée préliminaire : une fiche rétroactive resterait ouverte. Décision de l'owner, zone paiement. |
| #264 (INC-2026-013) | Première fiche sous la règle. Elle reste ouverte ; ses rubriques actuelles sont gardées et les trois de la règle s'ajoutent quand la cause et la parade sont établies. Fermée telle quelle, elle serait rouverte par le contrôle. |
| #1916 et #586 (`incident-sitemap-cron`) | Restent hors du contrôle : ce sont des alertes posées par un workflow à chaque échec, pas des fiches. Si un échec devient un incident, une fiche au label `incident` est ouverte et cite l'alerte. Le label n'est ni renommé ni retiré. |
| Alertes de la sonde du parcours d'achat | Même traitement : sans label, elles se ferment seules et ne sont pas des fiches. |
| PR #154, #487, #494 | Inchangées. Une PR fusionnée est ce qu'une fiche cite dans sa troisième rubrique. |
| Compte rendu INC-2026-017 (PR #345 du vault) | Hors périmètre : non lu, non copié. |

## 6. Suites, hors de cette PR

- `.spec/00-canon/repository-registry/automation-reality.yaml` est réservé à l'owner : aucune
  entrée n'y est ajoutée pour le nouveau workflow. `automation-registry-coverage.yml`, en
  avertissement seul, le signalera sur la PR du patch.
- Les projections d'inventaire (`audit/registry/`, `audit/runtime-entrypoints.json`) sont
  générées : elles se régénèrent dans une PR séparée après la fusion, comme pour #2135.
- Le numéro P41 est le premier libre sur `main`. Trois PR ouvertes écrivent aussi au journal :
  #2116 propose P32 et P33, #2138 et #2140 proposent chacune un P40, alors que `main` porte déjà
  un P40. Les numéros se règlent à la fusion.
