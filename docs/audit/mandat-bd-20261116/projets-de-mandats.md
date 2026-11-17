# Mandat BD — projets de mandats (décision 120)

Décision 120 de l'owner (2026-11-17) : les douze réponses du `README.md` §5 sont retenues. Quatre
d'entre elles demandent du code, donc un mandat séparé. Ce fichier en donne le projet ; le
pilotage les transmet. Rien n'est codé ici.

Relevé sur `main` `03ffd4f1e`, le 2026-11-17. Chemins relatifs à la racine du monorepo.

## M1 — `Dockerfile.worker` : installer avec `--ignore-scripts`, ou retirer le fichier (Q4, P9)

Réponse retenue : « Oui, ou retirer ce fichier si l'image n'est plus construite. »

Constat. `Dockerfile.worker` installe par `npm ci`, sans le drapeau (étape `installer`). Son seul
appelant dans le dépôt est `docker-compose.worker.yml`. Aucun workflow, script ni autre fichier
compose ne cite ce compose. Rien dans le dépôt ne dit si l'image est encore construite ou servie.

- **Résultat.** Soit l'image worker installe ses dépendances avec `--ignore-scripts`, comme
  l'image applicative, et se construit ; soit `Dockerfile.worker` et `docker-compose.worker.yml`
  sont retirés, avec la preuve que rien ne les construit.
- **Périmètre.** `Dockerfile.worker`, `docker-compose.worker.yml`, la ligne « Application » de P9.
  Première étape en lecture seule : dire si un conteneur worker tourne sur DEV, PREPROD ou PROD,
  et depuis quelle image.
- **Hors périmètre.** `Dockerfile` de l'image applicative, code du worker, files d'attente,
  déploiement PROD (acte de l'owner), contrôle CI des `postinstall` prévu par ADR-030 (autre
  mandat s'il est voulu).
- **Preuves.** Liste datée des conteneurs par environnement. Si le fichier est gardé : build de
  l'image vert, démarrage du worker, traitement d'un job de test sur DEV, et relevé des paquets
  dont le `postinstall` était nécessaire (le `Dockerfile` applicatif dit n'en avoir aucun). Si le
  fichier est retiré : `rg` sans appelant restant.
- **Circuit attendu.** À calculer par `scripts/ci/merge-circuit.mjs`.

## M2 — Message du hook d'agent sur le module `rm/` (Q11)

Réponse retenue : « Permis : le code servi l'importe ; corriger le message du hook par un mandat
séparé. »

Constat. `backend/src/app.module.ts` importe `RmModule` (« réactivé » le 2026-02-02) et `ci.yml`
l'autorise explicitement. À l'inverse, la garde 5 de `scripts/claude-hooks/pretool-file-guard.sh`
refuse toute édition de `backend/src/modules/rm/` avec le message « banni de production », et
`.claude/rules/backend.md` écrit « DEV uniquement ».

- **Résultat.** Les textes disent tous la même chose que le code servi : le module `rm/` est
  permis en PROD. L'owner tranche le sort de la garde 5 : la retirer, ou la garder comme
  protection d'un module sensible avec un message exact.
- **Périmètre.** `scripts/claude-hooks/pretool-file-guard.sh` (garde 5 et son message), son test
  s'il existe, `.claude/rules/backend.md` (une ligne), la ligne correspondante de
  `docs/audit/mandat-bd-20261116/contradictions.md` §F.
- **Hors périmètre.** Code du module `rm/`, `app.module.ts`, `ci.yml`, ADR-004 du vault (archive).
- **Preuves.** Avant et après : sortie du hook sur un chemin de `backend/src/modules/rm/` ;
  `rg` des mentions « banni » et « DEV uniquement » restantes ; validation
  `scripts/agents/validate-agents-md.sh` verte.
- **Circuit attendu.** Élevé : `.claude/rules/` est en zone CODEOWNERS.

## M3 — Allocateur de `type_id` : appelant et contrainte en base (Q12, P7)

Réponse retenue : « Tout import de véhicules ; poser la contrainte en base par un mandat de
migration séparé. »

Constat. La migration `20260615_massdoc_type_id_allocator.sql` crée la séquence
`tecdoc_map.type_id_seq` et la fonction `tecdoc_map.allocate_massdoc_type_id`. Aucun fichier de
`backend/src`, `scripts` ou `packages` n'appelle cette fonction. L'état de la base n'a pas été lu.

Deux mandats, dans cet ordre.

**M3a — lecture seule, puis appelant.**

- **Résultat.** Liste de tous les chemins qui créent un `type_id` (imports de véhicules, scripts,
  SQL manuel), puis chacun passe par l'allocateur.
- **Périmètre.** Lecture de la base (valeur de la séquence, `max(type_id)`, doublons, trous,
  `type_id` égaux à un KTYPNR) ; code des imports de véhicules ; check
  `massdoc-typeid-invariant` du skill `runtime-truth-audit`, déjà écrit pour cet invariant.
- **Hors périmètre.** Toute réécriture d'un `type_id` existant, toute URL (P37), les tables
  `pieces_*`.
- **Preuves.** Requêtes et résultats datés ; test de l'import qui prouve l'appel à
  l'allocateur ; un import à blanc sur DEV.

**M3b — migration.**

- **Résultat.** La base refuse un `type_id` créé hors de l'allocateur ou réutilisé.
- **Périmètre.** Une migration, écrite d'après les constats de M3a (contrainte ou trigger, à
  choisir sur preuve), avec son plan de retour.
- **Hors périmètre.** Application en PROD, qui reste un acte manuel de l'owner
  (`apply-supabase-migrations.yml`).
- **Preuves.** Squawk vert (P6) ; test en base de travail : insertion hors allocateur refusée,
  import normal accepté ; durée et verrous mesurés.
- **Circuit attendu.** Élevé : `backend/supabase/migrations/` est en zone CODEOWNERS, et une
  migration relève des zones STOP (P39) : accord nominatif de l'owner.

## M4 — Règle ast-grep des routes de test étendue au backend (Q3, P8)

Réponse retenue : « Les retirer, par un mandat de code séparé (zone commande et paiement), et
étendre la règle ast-grep des routes de test au backend. »

La première moitié est faite : #2117 (mandat BF) a retiré les routes de test et de compatibilité
des commandes et la route de test du paiement. Reste la règle.

Constat. `.ast-grep/rules/no-test-routes-without-env-guard.yml` ne couvre que
`frontend/app/routes/__test*.ts`. Dans `backend/src`, trente routes ont encore un segment `test`
dans leur chemin, dans seize contrôleurs de treize modules ; aucune dans `payments/`. Leurs
gardes n'ont pas été lues une à une ; la liste n'est pas publiée ici.

- **Résultat.** Une route de test ne peut plus entrer dans le backend sans garde d'environnement :
  la règle échoue en pre-commit et en CI. Les routes existantes sont triées une à une : retirée,
  gardée sous garde d'environnement, ou renommée si ce n'est pas une route de test.
- **Périmètre.** Première étape en lecture seule : tableau des routes (contrôleur, gardes,
  appelants), remis à l'owner hors du dépôt public. Puis la règle ast-grep, ses cas rouge et
  vert, et la ligne « Application » de P8. Le retrait ou la garde des routes existantes se fait
  par lots, dans ce mandat ou dans un mandat de code par zone, selon ce que dit le tableau.
- **Hors périmètre.** Les routes déjà retirées par #2117 ; le module `payments/`, objet de #2121
  (mandat BG), à ne pas doubler. Logique métier des contrôleurs.
- **Preuves.** Cas rouge et vert de la règle ; `npm run audit:ast` vert sur `main` après tri ;
  pour chaque route retirée, `rg` sans appelant et réponse 404 relevée sur DEV ; pour chaque
  route gardée, test du refus hors environnement de développement.
- **Circuit attendu.** À calculer par lot ; toute zone CODEOWNERS touchée donne le circuit élevé.

## Signalé, sans projet de mandat demandé

- **Circuit élevé, « puis fusion par l'App » (Q2, P20).** Le workflow des circuits n'arme jamais
  l'auto-fusion d'une PR du circuit élevé. Rendre la règle vraie demande une modification de
  `.github/workflows/merge-circuits.yml`, fichier réservé à l'owner. Le détail est dans le
  rapport de session.
- **`CLAUDE.md`, §Gouvernance.** La phrase « Tant que l'owner ne les a pas activés, la porte
  ADR-124 s'applique » est dépassée par la décision 120. `CLAUDE.md` est en zone CODEOWNERS et
  hors du périmètre de cette PR.
