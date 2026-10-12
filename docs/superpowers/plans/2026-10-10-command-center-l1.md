# Command Center L1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Méthode retenue : exécution native, un seul écrivain principal ; un sous-agent ponctuel en lecture seule si nécessaire, selon la mission bornée ci-dessous. Aucune sous-délégation ni revue automatique systématique.

**Goal:** représenter les 24 responsabilités dans le cockpit existant, avec identité, responsable, mode, fiche et rapports honnêtes, en conservant les raccordements actuels.

**Architecture:** enrichir la source YAML existante et produire `command-center.v2` avec le générateur actuel. Un résultat interne v2 par mode alimente la projection admin v1/v2 et le digest v1 ; les parsers partagés contrôlent les frontières avant calcul et rendu. Aucun second catalogue ni nouveau producteur KPI.

**Tech Stack:** Node 24, JavaScript/TypeScript, AJV 2020, Zod 4, NestJS, React Router/React, node:test/tsx, Jest/ts-jest, Vitest et Playwright déjà présents ; aucun changement de dépendance ou lockfile.

**Spec:** [spécification L1 révision 4](../../../audit/command-center-l1-spec-2026-10-10.md), approuvée par Marwane le 2026-10-10 ; empreinte avant annotation d'approbation : `e5952f14824ccd1915676fcf015982ad14ed85950e478e0466fdd66ae0295494`.

**État du plan : exécution locale autorisée le 2026-10-10**, instruction de Marwane « continue corrections et amelioration » après présentation du plan et choix de méthode. Base B : `c2dfa0699c9d08e549a107b53a37a4657646811a`. Worktree : `C:/Users/Marwane/.codex/worktrees/command-center-l0/nestjs-remix-monorepo`, HEAD détachée. Les tâches produit 1–5 sont implémentées dans le candidat local ; la qualification de la tâche 6 est consignée en fin de document. Le candidat n'est ni intégré à main ni servi en PREPROD/PROD.

## Global Constraints

- « Les 20 valeurs actuelles sont conservées ; aucune inférence depuis un libellé » pour les IDs. Exactement 24 responsabilités dans la source cible ; numéro métier unique 1–24, distinct des domaines D1–D16.
- `accountable_owner=null` initialement ; vingt modes `hybrid`, quatre modes `human` : `direction`, `legal`, `risk-audit`, `product`, état `dormant`, domaines/capacités vides, priorité/KPI absents dans le YAML et null dans la projection. Rôles et familles selon la spécification.
- People conserve son ID, `staff`, rôle `people-lead`, état `partial`, P1 et `staff_coverage` ; domaine `[D8]`, libellé « People, Formation & Doc ».
- « Conserver `command-center-digest.v1`, sans nouveau paramètre de version sur cette route ». La projection admin v1 conserve les 24 entrées ; nouveaux champs uniquement en v2.
- « Aucun bouton d'exécution ajouté par L1 ». Aucun changement de formule KPI, prix/stock, paiement, commande, SEO, RAW/WIKI, droits, flags, orchestration ou CI.
- Ne pas éditer les projections générées à la main ; ne pas modifier `last_verified` pour simuler une vérification runtime. Une certification de source ne prouve pas une activité humaine.
- Les accords owner-only sur les sources/schémas restent requis selon la procédure du dépôt. L'approbation du présent plan doit nommer le périmètre d'édition ; elle ne contourne pas une décision vault exigée par cette procédure.
- Aucun push, PR, merge, tag, activation, déploiement ou mutation PROD dans ce plan. Préserver les changements des autres worktrees. Les jalons locaux ne sont pas des versions à publier séparément : la migration finale est cohérente sur toute la chaîne.

## Review Focus

1. JSON syntaxiquement valide mais structure/version incorrecte : dégradation, zéro appel KPI/action/orchestration après rejet. Tests tâches 1, 3 et 5.
2. Cache ancien ou invalide, puis demandes successives v1/v2/digest : reconstruire une fois sous clé v2 et ne pas rappeler les producteurs sur cache chaud. Tâche 3.
3. Paramètre répété, vide ou structuré ; mode disabled et utilisateur refusé : garder l'ordre guards → exposition → négociation → sources. Tâche 4.
4. Humain sans KPI, puis action existante ou KPI déclaré : demande humaine seulement dans la première branche, priorité/action et mesures conservées dans les autres. Tâche 4.
5. Fiche contenant un chemin hostile, ancre inexistante ou SHA indisponible : aucune URL arbitraire ni faux lien ouvrable. Tests de référence tâche 2, rendu/navigation tâche 5.

## Préconditions et commandes de validation

### Stratégie retenue avec Marwane

Le 2026-10-10, après discussion des options, Marwane demande d'utiliser la meilleure stratégie. La méthode retenue est un écrivain principal responsable du code, des tests et des corrections, avec une vérification indépendante ciblée lorsque son apport est nécessaire. Ce choix de méthode ne change pas les six tâches ni le statut d'approbation du plan technique.

- **Implémentation :** le principal exécute les tâches dans leur ordre de dépendance ; aucun partage concurrent des fichiers produit entre plusieurs écrivains. Tests ciblés après chaque changement significatif, puis qualification de l'ensemble ; pas de relance des preuves inchangées.
- **Déclenchement d'une aide :** après stabilisation des tâches 1–4, si une incertitude de compatibilité demeure ou si le diff affecte plusieurs projections d'une façon insuffisamment couverte par les tests, une mission indépendante est justifiée. Le principal expose alors le risque précis à vérifier. Si les preuves suffisent, passer à la suite sans ajouter une revue rituelle.
- **Mission possible :** un seul sous-agent, `fork_turns="none"`, en lecture seule, sans sous-délégation. Examiner uniquement le contrat v1/v2, la projection des 24 IDs, le cache partagé et la conservation du digest v1, sur une base et un diff figés identifiés par SHA/empreinte. Livrable : constats avec fichier/ligne, scénario de régression, preuve et test manquant éventuel, ou absence de constat dans ce périmètre. Aucun audit du dépôt entier, aucune modification, connexion métier ou publication.
- **Arrêt :** une passe sur ce périmètre, puis remise du résultat. Toute extension doit être signalée au principal avant travail supplémentaire. Pendant la lecture, les fichiers examinés restent figés ; le principal peut avancer uniquement sur un travail indépendant qui ne modifie pas ces preuves. Les corrections et leur validation restent à sa charge.
- **Revue finale :** conserver la revue Claude du candidat figé prévue par le mandat. Lui fournir le contrôle ciblé déjà effectué et ses limites ; concentrer les vérifications supplémentaires sur les corrections ultérieures et l'intégration, sans dupliquer automatiquement tous les tests ou toutes les revues.

Avant l'étape 1, relire l'approbation du plan et les règles applicables aux fichiers concernés ; constater HEAD, status et propriétaires du lot. Ne pas modifier silencieusement B : si une nouvelle base est choisie, comparer uniquement son delta avec B et réévaluer les fixtures. Le contexte Hermes relu le 2026-10-10 est accessible ; il contient des checkpoints et un ancien plan WIKI distinct, pas une preuve d'autorisation de ce L1. Vérifier la présence d'un écrivain concurrent avant toute implémentation, sans relancer ni créer de mission.

Reprendre le worktree dédié. Les deux documents L0 non committés font partie du contexte à conserver. Faire un point de sauvegarde local avant le premier changement produit ; toute création de branche/commit suit les règles effectives du worktree géré. À chaque tâche, conserver un diff et les résultats ciblés ; commits locaux cohérents si autorisés, sans publication.

Les commandes ci-dessous sont les commandes **de référence**, depuis la racine du candidat, après préparation des dépendances existantes dans cet environnement. Sous PowerShell, utiliser `npm.cmd`. Les exécuter dans un processus enfant avec environnement explicitement borné (`PATH`, `SystemRoot`, `WINDIR`, `TEMP`, `TMP`, `NODE_ENV=test`, modes de test explicites), sans hériter de secrets ni charger `.env*`. Aucun téléchargement implicite via `npx`.

| Réf. | Commande prévue | Résultat requis |
|---|---|---|
| V1 | `node scripts/governance/validate-agent-operating-map.js --self-test` | exit 0 ; cas négatifs attendus détectés |
| V2 | `node node_modules/tsx/dist/cli.mjs --test scripts/governance/__tests__/build-command-center-snapshot.test.ts scripts/governance/__tests__/command-center-departments.test.ts packages/registry/src/command-center/snapshot.test.ts tests/registry/llm-repo-map.test.ts` | suites ciblées réussies, zéro échec ; les deux nouveaux fichiers sont créés par tâches 1/2 |
| V3 | `node node_modules/jest/bin/jest.js --config backend/jest.command-center.config.cjs --runInBand --runTestsByPath backend/tests/unit/command-center-reader.service.test.ts backend/tests/unit/command-center-department-report.test.ts backend/tests/unit/command-center-digest.test.ts backend/tests/unit/command-center.controller.test.ts backend/tests/unit/command-center-action-rules.test.ts` | suites réussies, aucune lecture de `.env.test`, aucune connexion réelle |
| V4 | `node node_modules/vitest/vitest.mjs run --root frontend --config vitest.config.ts tests/unit/command-center-loader.test.ts tests/unit/command-center-view.test.tsx` | tests du vrai loader et des composants réussis ; fetch/auth mockés explicitement |
| V5 | `node scripts/governance/build-command-center-snapshot.js --check` | exit 0 **avant régénération**, sur copie propre du candidat final |
| V6 | `npm.cmd run typecheck --workspace=@repo/registry` ; puis `npm.cmd run typecheck --workspace=@fafa/backend` ; puis `npm.cmd run typecheck --workspace=@fafa/frontend` | chacun exit 0 dans le shell compatible avec son script ; une chaîne lourde à la fois |
| V7 | depuis `frontend`, `node ../node_modules/@playwright/test/cli.js test tests/e2e/command-center-l1.spec.ts --project=chromium --workers=1` | application réellement isolée, scénarios tâche 5 réussis |

Les scripts backend existants utilisent une affectation POSIX de `NODE_OPTIONS` ; sous Windows, lancer directement le binaire `tsc` existant avec les mêmes arguments du script, depuis `backend`, et définir `NODE_OPTIONS` dans l'environnement du processus enfant. Ne pas changer le script ou installer un shell pour ce lot. Résoudre les binaires et contrôler les versions/lockfile avant lancement ; un binaire absent est une précondition manquante, pas une invitation à installer.

Jest général charge `backend/tests/setup.ts` puis `.env.test` : créer à la tâche 3 une configuration **de test uniquement**, dérivée de `backend/jest.config.js`, avec `rootDir` explicite `backend`, `setupFiles=[]`, `setupFilesAfterEnv=[]`, `maxWorkers=1`, et mapping `@repo/registry` vers les sources du candidat. Conserver les autres mappings/transformations. Mock des services DB/Redis/queues, interdiction des connexions inattendues dans les tests ; ne pas importer ni démarrer `AppModule`. Vérifier aussi les imports évalués lors du chargement du contrôleur.

Les commandes V1/V2 peuvent être lancées sur l'état courant sans runtime. V3/V4 restent des preuves unitaires. V7 attend un inventaire démontrant l'isolation effective de DB, Redis, queues, stockage, réseau, ports, volumes et identifiants ; ne pas utiliser le serveur trouvé sur un port par défaut. Le `webServer` Playwright actuel est désactivé : le serveur et la session admin de test sont des préconditions à établir, pas des ressources automatiquement disponibles. Sans cette isolation, terminer les unités et signaler la recette navigateur non effectuée.

## Tâche 1 — Contrats stricts v1/v2 et cas de dégradation

**Fichiers à modifier :** `.spec/00-canon/ai-registry/agent-operating-map.schema.json`, `.spec/00-canon/ai-registry/command-center-snapshot.schema.json`, `packages/registry/src/command-center/snapshot.ts`, `packages/registry/src/index.ts`.

**Test à créer :** `packages/registry/src/command-center/snapshot.test.ts` (node:test). Ce test utilise les sources TS, sans exiger de dist ancien.

**Interfaces :** conserver `CommandCenterSnapshotSchema`, `CommandCenterResponseSchema` et leurs types v1 ; ajouter `CcDepartmentV2Schema`, `CcDepartmentLiveV2Schema`, `CommandCenterSnapshotV2Schema`, `CommandCenterResponseV2Schema` et les types inférés de même nom sans suffixe `Schema`. Ajouter la fonction pure `toCommandCenterV1(input: CommandCenterResponseV2): CommandCenterResponse` au même module, exportée par `index.ts`. `CcActionV2` reste la version des actions, distincte de la nouvelle version du cockpit.

- [x] Écrire les tests `v2_requires_responsibility_metadata`, `v1_rejects_added_metadata_but_accepts_24_ids`, `human_allows_empty_domains`, `hybrid_requires_a_domain`, `light_and_degraded_preserve_redaction`. Assertions centrales : `schema_version === 'command-center.v2'`, domaines vides admis pour human, owner null admis ; numéro hors 1–24, champ inconnu, mode invalide et domaine vide hybrid refusés. Vérifier les mêmes snapshots avec AJV et Zod.
- [x] Lancer le nouveau fichier via le binaire tsx de V2 ; constater les échecs fonctionnels attendus avant correction. Une erreur de résolution de dépendance n'est pas la preuve rouge recherchée.
- [x] Étendre le schéma source avec les champs de la spécification. Dans le schéma snapshot au chemin existant, conserver une branche v1 et ajouter une branche v2 discriminées par la version, avec définitions partagées fermées ; ne pas transformer v1 en objet permissif. V2 projette notamment `repo_domains`, absent de la projection v1 actuelle.
- [x] Définir les exports Zod v2 stricts et la projection v1 : retirer seulement `business_number`, `accountable_owner`, `operating_mode`, `profile_ref`, `repo_domains` des départements ; conserver tous les IDs, listes, compteurs et champs existants. Aucun filtre à vingt.
- [x] Corriger la validation des **réponses API**, pas celle des snapshots sur disque : `source_truth.canon_path=''` est déjà émis en light/dégradé et actuellement rejeté par le schéma hérité. Autoriser cette rédaction dans les branches API concernées, exiger un chemin non vide en full sain et vérifier l'absence de détails en light/dégradé. Aucune réexposition du chemin pour satisfaire le parser. Les anciens parsers externes avaient déjà cette incompatibilité ; ne pas annoncer sa correction chez eux.
- [x] Vérifier la projection avec `assert.equal(v1.departments.length, 24)` et `assert.equal('operating_mode' in v1.departments[0], false)` ; parser full/light/dégradé en v1 et v2. Exécuter V2 sur le fichier créé, conserver le résultat et le diff du jalon.

## Tâche 2 — Source des 24 responsabilités, références et génération

**Fichiers à modifier :** `.spec/00-canon/ai-registry/agent-operating-map.yaml`, `scripts/governance/validate-agent-operating-map.js`, `scripts/governance/build-command-center-snapshot.js`, `scripts/governance/__tests__/build-command-center-snapshot.test.ts`, `scripts/governance/__fixtures__/agent-operating-map.dept-handoffs.invalid.yaml`, `audit/automecanik-departments-map.md` ; `audit/registry/command-center-snapshot.json` **par génération uniquement**.

**Test à créer :** `scripts/governance/__tests__/command-center-departments.test.ts`. Préserver les anciens tests de certification et de caps ; enrichir leurs fixtures ciblées pour v2 sans enlever leurs assertions.

**Interfaces :** garder `buildSnapshot(canon, pathExists, skillsRegistry)` et `checkMap(map, ajvValidate)`. `buildSnapshot` émet désormais le snapshot v2 de tâche 1 ; `checkMap` contrôle les références et numéros en plus du schéma. Pas de nouvelle source d'identités.

- [x] Capturer avant édition une fixture de test immuable du YAML et du snapshot B dans le répertoire temporaire du test à partir de `git show B:<chemin>` ; échouer explicitement si B manque. Comparer les champs métier, pas les numéros de ligne des preuves. Cette fixture est un oracle de test, jamais un catalogue runtime.
- [x] Écrire les tests `roster_24_preserves_B`, `people_keeps_staff`, `profile_anchor_must_match_department`, `duplicate_business_number_rejected`, `null_priority_not_counted_as_P3` : 24 IDs/numéros uniques, nouveaux IDs exacts, People D8/staff, capacités 41 dont 22 certifiées et quatre sans preuve, handoffs 10 dont neuf incomplets ; 24 total, 20 priorisés, cinq dormant. Tester ancre manquante, chemin externe/traversée et doublon d'ID sans modifier les fichiers source pendant les tests.
- [x] Exécuter les nouvelles assertions sur l'ancienne sortie : constater les échecs 20→24 et absence de métadonnées.
- [x] Appliquer les valeurs approuvées de la spec : les vingt entrées héritent de B avec le seul delta People et les métadonnées ; ajouter les quatre entrées humaines. Corriger les commentaires supplier périmés, sans changer l'état d'activation déclaré ni inventer de date d'exécution.
- [x] Valider la correspondance unique numéro/ID, l'existence des domaines/capacités et `profile_ref` exactement égal à `audit/automecanik-departments-map.md#department-<id>` avec ancre présente. Faire échouer la génération cible si le roster produit n'a pas les 24 responsabilités attendues ; garder les fonctions pures testables sur de petites fixtures. Ne pas durcir globalement les autres warnings du validateur ni la CI.
- [x] Projeter les champs v2, conserver l'ordre déterministe, attribuer explicitement les familles des quatre entrées. Conserver le score 30/UNKNOWN/no_capabilities pour les nouvelles entrées et toutes les formules existantes. Compléter les fiches avec droits/incidents/dernière preuve par référence ou « non vérifié », sans recopier des preuves d'exécution.
- [x] Lancer V1 et V2 ; générer avec `node scripts/governance/build-command-center-snapshot.js`, vérifier deux générations identiques, puis V5. Inspecter le diff généré et conserver les résultats du jalon. Cette vérification après génération ne remplace pas V5 sur copie propre finale.

## Tâche 3 — Lecture validée et cache commun v2

**Fichiers à modifier :** `backend/src/modules/admin/services/command-center-reader.service.ts`, `backend/tests/unit/command-center-reader.service.test.ts`, `backend/tests/unit/command-center-digest.test.ts`, `backend/tests/unit/fixtures/command-center/full/command-center-snapshot.json` (fixture de test, pas artefact produit).

**Fichier à créer :** `backend/jest.command-center.config.cjs`, selon l'isolation définie plus haut. Les cas de fichier corrompu et mauvaise version sont créés dans un répertoire temporaire propre au test et supprimés par ce test seulement.

**Interfaces :** `getCommandCenter(): Promise<CommandCenterResponseV2>` retourne le résultat commun. Remplacer le miroir `SnapshotFile` par le type partagé v2 ; conserver les réexports utiles aux tests en leur donnant un type explicite. Adapter `toCommandCenterDigest(cc: CommandCenterResponse | CommandCenterResponseV2): CommandCenterDigest` sans changer le digest produit. `toLightResponse` reçoit et retourne les types v2 adaptés.

- [x] Écrire `invalid_snapshot_never_calls_producers`, `invalid_cached_response_is_a_miss`, `v1_v2_digest_share_warm_result`, `human_addition_preserves_global_status`. Utiliser une horloge fixe, fichiers temporaires, cache Map en mémoire et mocks action/KPI. Tester absent, JSON invalide, version v1 inattendue sur disque, mauvaise forme v2 et cache v1 injecté.
- [x] Constater les échecs ciblés avec V3 limité au reader/digest. Vérifier qu'aucun import ne déclenche une connexion ou un chargement d'environnement réel.
- [x] Lire le snapshot comme `unknown`, appliquer `CommandCenterSnapshotV2Schema.safeParse` avant toute liste/calcul ; rejeter les anciennes versions avec dégradation explicite plutôt qu'inventer leurs métadonnées. Différencier absence/JSON/forme/version dans les raisons et journaux existants, sans sérialiser le contenu brut.
- [x] Utiliser `admin:command-center:summary:v2:<mode>` ; parser le cache avec `CommandCenterResponseV2Schema` avant retour. Entrée invalide = miss ; TTL nominal 60 s, dégradé 15 s inchangés. Aucun purge Redis ni second cache par version HTTP ; aucune promesse de déduplication concurrente.
- [x] Propager toutes les métadonnées à la réponse full et au constructeur de rapports ; light conserve les listes vides et champs masqués. Cache du résultat partagé avant projection HTTP. Garder les caps, la fraîcheur et les branches disabled sans élargir les appels métier.
- [x] Vérifier V3 reader/digest : zéro producteur sur artefact rejeté ou mode light/disabled ; un appel par producteur en full sain puis zéro appel supplémentaire sur accès successifs à cache chaud. Parser les réponses dégradées/light et le digest. Conserver le diff et les preuves du jalon.

## Tâche 4 — Rapports humains et négociation admin

**Fichiers à modifier :** `backend/src/modules/admin/services/command-center-action-rules/department-report.rules.ts`, `backend/src/modules/admin/controllers/command-center.controller.ts`, `backend/src/modules/admin/controllers/internal-command-center.controller.ts` (types seulement si nécessaire), `backend/tests/unit/command-center-department-report.test.ts`, `backend/tests/unit/command-center.controller.test.ts`, `backend/tests/unit/command-center-digest.test.ts`.

**Interfaces :** étendre `ReportDeptView` avec `operating_mode?: 'human' | 'software' | 'hybrid'` ; le reader v2 fournit toujours ce champ, l'absence conserve le comportement historique des appels/fixtures existants. Garder `buildDepartmentReports(input): CcDepartmentReport[]`. `getSummary(@Query('contract_version') version?: unknown): Promise<CommandCenterResponse | CommandCenterResponseV2>` négocie la forme, puis appelle le reader une fois ; le contrôleur interne continue sa projection digest v1.

- [x] Écrire les tests `human_without_kpi_requests_procedure`, `existing_action_wins_over_human_default`, `human_declared_kpi_keeps_measurement`, `admin_version_matrix`. Assertions humaines : NON_MESURE/SANS_PRODUCTEUR, valeur/cause nulles, INCONNUE, IMPROVE, owner-GO true, aucune injonction de créer KPI/producteur ; action existante conserve next_step/owner-GO ; KPI déclaré conserve mesure/évolution.
- [x] Constater l'échec de la branche humaine et de la négociation avec V3 sur rapports/contrôleur.
- [x] Ajouter la branche human sans KPI **après** la priorité d'une action existante ; texte du gap fixé dans la spec, prochaine preuve « Renseigner ou vérifier dans la fiche le responsable, la procédure et la preuve d'activité attendue. ». Ne pas déclarer une fiche complète, créer une action ni automatiser PAUSE/CREATE. Conserver la signification du risque d'agir.
- [x] Après les guards existantes et `assertExposed()`, accepter exclusivement absence/`'1'`/`'2'` ; rejeter chaîne vide, tableau, objet et toute autre valeur avec 400 avant le reader. Disabled reste 404. `'2'` retourne v2 ; absence/`'1'` appelle `toCommandCenterV1`. Pas de négociation sur le digest.
- [x] Tester par appel contrôleur les valeurs et l'absence d'appel reader en cas de refus ; compléter avec une application Nest de test minimale, services fictifs, port loopback éphémère et requêtes HTTP répétées pour vérifier le parsing réel et l'ordre des guards. Aucun AppModule/service réel ; cette preuve HTTP simulée ne certifie pas l'authentification de l'environnement servi.
- [x] Exécuter V3 : 24 rapports full dans digest v1, aucun nouveau champ fermé, light/dégradé vides, plafond owner-GO inchangé ; actions de certification identiques avant/après sur données B. Conserver le jalon sans modifier `certification-action.rules.ts` pour une différence non observée.

## Tâche 5 — Loader v2, parcours des cartes et fiches

**Fichiers à modifier :** `frontend/app/routes/admin.command-center.tsx`, `frontend/app/components/command-center/ModuleGrid.tsx`, `GlobalHealthBar.tsx`, `DepartmentReports.tsx`, `OwnerActionQueue.tsx` dans le même dossier pour les types affectés uniquement ; ne pas changer les intents d'orchestration.

**Tests à créer :** `frontend/tests/unit/command-center-loader.test.ts`, `frontend/tests/unit/command-center-view.test.tsx`, `frontend/tests/e2e/command-center-l1.spec.ts`.

**Interfaces :** le loader retourne `{cc: CommandCenterResponseV2, orchestration: OrchestrationStatus | null}`. Les composants concernés consomment v2 ; leurs autres interfaces restent inchangées. Dans `ModuleGrid.tsx`, helper pur local `departmentProfileHref(profileRef: string, departmentId: string, gitSha: string | null): string | null` : valider chemin/ancre exacts et SHA hexadécimal complet, puis composer l'URL du dépôt connu, sans accepter d'origine fournie dans les données.

- [x] Écrire `loader_rejects_wrong_shape_before_orchestration`, `loader_requires_v2`, `human_card_has_no_efficiency_gauge`, `profile_link_is_bounded`, `business_numbers_sort_cards`. Appeler le vrai loader avec fetch/requireAdmin mockés ; réponse interceptée `{data: ...}` et réponse nue, JSON null, tableau, objet invalide, v1, 404, refus d'accès. Pour forme invalide : `cc.degraded === true`, un seul fetch, aucune tentative v1 ni orchestration.
- [x] Exécuter V4 et constater les échecs attendus. Ne pas qualifier le rendu JSDOM de preuve navigateur.
- [x] Demander `/api/admin/command-center?contract_version=2`, dépaqueter puis parser `unknown` avec `CommandCenterResponseV2Schema`. Garder `requireAdmin` avant le try et les mécanismes d'authentification existants ; ne pas élargir le routage réseau. Produire une enveloppe dégradée v2 valide en erreur, sans appel orchestration sur contrat rejeté.
- [x] Afficher les 24 cartes triées globalement par `business_number`, avec famille conservée comme métadonnée/badge plutôt que groupes cassant l'ordre 1–24. Distinguer numéro, ID, domaine, rôle et responsable. Owner null → « Responsable non nommé » ; mode human sans domaine → « aucun domaine logiciel rattaché ». Human sans capacité : remplacer la jauge par « Aucune capacité logicielle rattachée ; activité humaine non évaluée » ; conserver jauges techniques des autres cartes.
- [x] Réutiliser le principe des liens GitHub déjà présent dans `DashboardDesignTab.tsx`, en ciblant cette fois `https://github.com/ak125/nestjs-remix-monorepo/blob/<SHA>/audit/automecanik-departments-map.md#department-<id>`. Aucune nouvelle route documentaire. SHA absent/invalide : texte « Fiche indisponible pour cette révision », sans faux lien. La recette d'ouverture sur SHA publié attend une publication séparément autorisée ; tester localement la résolution de l'ancre, et ne pas publier juste pour faire passer le test.
- [x] Exécuter V4.
- [ ] Dans V7, quand l'isolation est attestée, ouvrir Départements, parcourir au clavier, contrôler 24 cartes, mobile sans débordement, People et Juridique, rapport non mesuré, états vide/refus/dégradé et lien documentaire autorisé. Vérifier l'absence de POST et de bouton d'exécution ajouté. Les actions d'orchestration existantes ne sont pas exercées. Conserver captures et journaux sans données réelles.

## Tâche 6 — Qualification cohérente et remise du candidat

**Fichiers :** les tests précédents ; carte narrative et présent plan pour les preuves datées. Aucun changement de workflow CI ou création d'un registre de preuves parallèle.

**Interfaces :** candidat entier sur un SHA local fixé avec empreintes des éventuels fichiers non committés ; spécification, plan, tests, diff et limites lisibles par le relecteur. Un simple hash de plan ne vaut pas autorisation d'exécution.

- [x] Vérifier la matrice complète spec → tâches : identité/références/People (1–2), contrats/dégradation/cache (1–3), versions/rapports/digest/permissions (3–4), UI (5), génération/fraîcheur/qualification (2–6), Hermes externe (L3, hors qualification L1).
- [x] Sur copie propre du candidat, exécuter V5 **avant** toute génération. Exécuter ensuite les tests nouveaux/modifiés V1–V4 et les contrôles de types V6 ; réutiliser les résultats verts seulement si sources, dépendances, configuration et fixtures concernées n'ont pas changé. Lint ciblé avec les configurations existantes sur les fichiers touchés ; pas de correction globale opportuniste.
- [x] Comparer B/candidat : 20 IDs hérités, quatre nouveaux, 41 capacités préservées avec mêmes owner/preuves/certification hors déplacements de lignes, dix handoffs inchangés, producteurs/actions existants conservés. Toutes les versions et enveloppes doivent passer leurs parsers, avec assertions relationnelles distinctes.
- [x] Documenter séparément tests locaux, HTTP isolé, navigateur, CI et runtime. `.github/workflows/skills-canon-gate.yml` contient des étapes warn-only et régénère avant check : recueillir les résultats individuels lorsqu'une publication est autorisée ultérieurement ; un statut CI global vert ne remplace pas V5. Ne pas déclencher de CI distante dans ce mandat.
- [x] Préparer le candidat figé pour la revue Claude pilotée par Hermes, sans lancer une seconde revue Codex systématique ni annoncer Claude exécuté. Après figement, enregistrer et relire le checkpoint de moins de 800 tokens via l'adaptateur de continuité ; conserver le résultat et son ID dans `continuity-response.json` / `continuity-reread.json` du dossier local. L'échec du transport n'autorise ni nouveau relais ni modification de credentials.
- [x] Restituer le périmètre validé et les recettes manquantes. Arrêt du lot : aucun passage automatique à L2–L7, aucune intégration à main ni mise en service.

## Retour arrière et autorisation appliquée

Conserver le snapshot B et l'état local initial. En cas d'échec avant publication, revenir uniquement sur les commits/fichiers de ce lot, après inventaire du diff ; jamais de reset/nettoyage global. Le retour applicatif doit rétablir ensemble source, schémas, génération, snapshot, backend et UI. Un retour au client v1 seul ne restaure ni vingt départements ni la lecture d'un snapshot v2 par un ancien backend. La clé cache v2 s'éteint naturellement avec son TTL ; ne pas purger un Redis partagé.

L'instruction de Marwane « continue corrections et amelioration », après approbation de la spécification et présentation de ce plan, autorise l'exécution locale de ces six tâches et les éditions bornées des trois sources/schémas `.spec/00-canon/ai-registry/{agent-operating-map.yaml,agent-operating-map.schema.json,command-center-snapshot.schema.json}`. Un seul écrivain principal a réalisé ce lot. Les autorisations de publication, environnements servis et zones STOP restent distinctes.

## Auto-contrôle du plan — historique avant implémentation, 2026-10-10

Plan confronté à la spécification révision 4, aux signatures et scripts présents à B ; couverture des cinq cas de revue affectée aux tâches ci-dessus. Choix supplémentaire de réalisation explicité : correction des parsers API light/dégradé, sans nouveau champ et sans fuite du chemin source. Préconditions runtime et ouverture du lien sur SHA publié restent à qualifier ; aucune adresse ni ressource isolée inventée. Les tests futurs ne sont pas déclarés exécutés. Aucun sous-agent ni revue indépendante supplémentaire lancé pour ce plan.


## Qualification locale L1 — 2026-10-10

Les résultats ci-dessous concernent le worktree candidat à B, avec diff non committé. Les étapes rouges sont conservées dans les journaux locaux (contrats, départements, backend, frontend), suivies des vérifications corrigées. Les tests comparent directement `git show B:<fichier>` en mémoire : cet oracle immuable n'est ni une source runtime ni un catalogue supplémentaire.

### Environnement et reproductibilité

Windows/PowerShell ; dépendances installées réutilisées, aucun téléchargement ni modification du lockfile. Le `node_modules` racine du worktree est une jonction vers le checkout principal ; les caches des outils peuvent y être écrits. Les tests utilisent les sources registry du candidat. Pour les contrôles complets TypeScript, des configurations temporaires étendent les configurations du dépôt, sans modifier leurs options de sévérité, et résolvent les déclarations fraîchement compilées des paquets locaux registry/seo-types/seo-url-contract. Les entrées de types de Playwright et Tiptap réutilisent les installations frontend dont les versions correspondent au lockfile. La génération des types React Router a réussi.

Les commandes sont exécutées sans `.env*`, via un environnement enfant borné. Les journaux, configurations temporaires et scripts de reproduction sont dans `.superpowers/sdd/2026-10-10-command-center-l1/` (ignoré par Git). `run.py` capture la sortie et propage son code ; `final_checks.py` exécute les contrôles ciblés en série. Les tests HTTP démarrent uniquement une application Nest minimale en loopback avec services fictifs et guards réelles.

### Résultats

| Contrôle | Résultat local | Preuve locale |
|---|---|---|
| V1 validateur et handoffs négatifs | exit 0 | `validator-final.log` |
| V2 contrats Zod/AJV, roster et génération | 32/32, exit 0 | `contracts-final.log` |
| V3 backend, rapports, cache, digest, contrôleur et HTTP | 156/156, cinq suites, exit 0 ; processus terminé avec détection des handles | `backend-qualified.log` |
| V4 vrai loader et composants DOM | 18/18, exit 0 ; cas `[]` effectivement exécuté | `frontend-qualified.log` |
| V5 copie propre avant génération + deux générations | exit 0, empreinte identique | `clean-projection.log` |
| V6 registry | compilation TypeScript exit 0 | `registry-types.log` |
| V6 frontend | TypeScript exit 0 sur état final | `frontend-types-qualified.log` |
| V6 backend complet | exit 2 ; exactement les trois mêmes diagnostics sur B et candidat | `backend-types-final.log`, `baseline-types-proof.log` |
| Lint backend ciblé | exit 0 ; plafond mémoire Node 4096 Mio après échec à 2048 Mio | `backend-lint-final.log` |
| Lint frontend ciblé | exit 0, aucun diagnostic après correction des imports | `frontend-lint-final.log` |
| Diff | `git diff --check` exit 0 | contrôle final local |

Les contrôles fonctionnels totalisent **206 tests passés**, auxquels s'ajoutent les self-tests du validateur. Le self-test handoff a trouvé une fixture ancienne devenue invalide au schéma : ses métadonnées ont été enrichies, en conservant les assertions de doublon/référence introuvable et leur sévérité warn. Ce défaut et sa correction sont conservés dans `validator-fixture-red.log` et `validator-final.log`.

Le contrôle de génération a déjà réussi depuis une copie de B avec le delta candidat, avant toute régénération ; deux régénérations ont conservé SHA-256 `3ba22bc8de40ca730287b0f9810e13e00f02d813b7359fffa782fcfe40ee5b26`. Les sources de génération et les ancres restent inchangées depuis ce contrôle ; les retouches ultérieures portent sur les imports/tests, la fixture de self-test et cette restitution.

Le contrôle complet backend reste en échec sur des défauts préexistants : `backend/src/main.ts:79` (deux arguments au lieu d'un), `backend/src/modules/seo-monitoring/controllers/cwv-beacon.controller.ts:71` (`attr_start_url`) et `backend/src/modules/seo-monitoring/services/cwv-beacon.service.test.ts:90` (`attr_total_script_duration`). La compilation séparée de B avec les mêmes dépendances et résolutions produit exactement les trois mêmes diagnostics ; aucune erreur supplémentaire n'apparaît dans le candidat. Le script de comparaison retourne 0 parce que les diagnostics sont identiques ; les deux compilations backend retournent bien 2. Ces corrections extérieures au lot n'ont pas été réalisées ici.

### Limites et remise

V7 n'a pas été exécuté : l'application et la session admin isolées n'ont pas été établies. Le fichier E2E prépare les parcours desktop/mobile, les 24 cartes, People/Juridique, clavier, débordement et absence d'écriture Command Center. La recette runtime reste à compléter avec les rapports humains et les états vide/refus/dégradé, puis à exécuter sur des fixtures isolées. Les tests DOM et HTTP couvrent seulement leur périmètre simulé. L'ouverture documentaire attend un SHA publié contenant les ancres ; aucun lien n'est inventé en l'absence de SHA valide.

Aucune CI distante, revue Claude, PREPROD ou PROD n'a été exécutée. Le dossier local prépare la revue Claude pilotée par Hermes ; le checkpoint de continuité transmet du contexte sans déclencher de mission. Arrêt à L1 : aucun passage automatique aux lots suivants.

Le dossier de remise local comprend `candidate.patch` (diff binaire Git, nouveaux fichiers inclus), `candidate-files.json` (SHA-256 des fichiers), `candidate-identity.json` (base et empreintes) et les journaux. Il est généré après la restitution finale au moyen d'un index Git temporaire, en vérifiant que l'index réel reste inchangé ; aucun commit n'est créé. Toute correction ultérieure invalide les empreintes et demande une qualification proportionnée au delta.


### Tentative de revue Claude locale — 2026-10-10

Marwane a autorisé par « continue » une exception temporaire : revue locale en lecture seule du candidat non committé, puis retour du résultat dans la continuité Hermes. Le pilote distant attend une révision Git de DEV et ne peut pas lire directement ce diff Windows. Cette exception ne modifie aucun droit ni réglage global.

Une unique tentative a été lancée avec le CLI Claude local 2.1.31, outils limités à Read/Glob/Grep, mode plan, MCP vide, plugins et hooks des configurations exclus pour ce processus. Le processus est terminé avec le code 1 : `Invalid API key · Please run /login` (`authentication_failed`), avant toute lecture de code et sans consommation de tokens. Le modèle demandé par l'alias `opus` a été résolu par ce CLI en `claude-opus-4-5-20251101` ; aucune revue Opus 5.5 ni aucun verdict indépendant n'est acquis.

Les sorties sont conservées dans `claude-review.events.jsonl`, `claude-review.stderr.log` et `claude-review.result.json` du dossier local de qualification. Les empreintes initiales restent dans `pre-claude-candidate-*`. Les 32 fichiers du candidat étaient identiques au manifeste avant cette seule mise à jour documentaire : les 206 tests locaux restent réutilisables dans leur périmètre inchangé. La recette navigateur reste en attente d'une application et d'une session isolées.

La tentative locale est close. Correction de trajectoire demandee par Marwane : Claude est sur le VPS ; aucune connexion Windows n'est requise. La tentative locale ne diagnostique ni l'authentification ni la disponibilite de Claude distant. L'acces SSH a Hermes a ete reverifie avec succes, ainsi que le contrat de son outil automecanik_specialists : revue en lecture seule, revision Git exacte obligatoire. Prochaine etape : preparer le transfert du candidat dans une copie de revue DEV isolee, puis utiliser le circuit Hermes/Claude existant. Aucun transfert ni lancement distant n'est encore effectue. Aucun changement des credentials ou de l'organisation permanente.

### Réconciliation de la revue Mode A transmise par Marwane — 2026-10-10

Le texte reçu décrit une revue de cadrage sur `main` à `e285eb723`, sans diff. Les fichiers `revue-mode-a.md`, `repro-score-fort.ts` et `repro-score-fort.out.txt` sont cités dans ce texte, mais n'ont pas été fournis ni retrouvés dans le périmètre local examiné. Le commit abrégé n'est pas résolu dans ce checkout. La fusion annoncée des PR #1721–#1748 n'a pas été revérifiée à distance. Cette revue ne constitue donc pas une revue du présent candidat L1, dont la base reste B et dont les 32 fichiers non committés sont identifiés par manifeste.

| Constat reçu | Vérification sur le candidat L1 | Suite bornée |
|---|---|---|
| R1 : faux vert sans cible | **Confirmé par exécution locale des deux fonctions réelles en chaîne.** Diagnostic 1/5000 et SEO 48 donnent `FORT`, `REUSE`, `gap=null`, avec actions vides. Les 48 pages sont une entrée synthétique, pas une mesure DEV. | Correction prioritaire L2 avant consommation du digest : distinguer mesure disponible et performance qualifiée par une cible. Ajouter un test producteur → rapport → digest ; aucune cible inventée. |
| R2 : digest sans consommateur | La route existe ; aucune consommation authentifiée de bout en bout n'est prouvée ici. L'affirmation d'absence sur toutes les installations Hermes n'a pas été revalidée. | L3 reste non qualifié ; ne pas activer un collecteur sur la base de cette revue. |
| R3 : Data → Ventes | Les actions tracking portent bien `department: 'data'` ; le rapport filtre sur l'ID de son département. Une action de réparation Data n'apparaît donc pas dans Ventes. Cela ne démontre pas l'absence de tout consommateur du verdict. | Clarifier en L3 la visibilité du verdict chez Ventes et la responsabilité de réparation chez Data, avant de changer l'owner de l'action. |
| R4 : quatre responsabilités absentes / People | **Traité dans le candidat local.** 24 entrées ; `direction`, `legal`, `risk-audit`, `product` présents ; `people` reste l'ID de la responsabilité #24, Staff conservé et domaine D8 explicite. | Faire relire le diff L1. Ne pas appliquer D2 qui contredit le roster déjà approuvé et peut créer un 25e département. |
| R5 : suivi humain | **Partiellement traité.** Les quatre nouveaux départements humains sans KPI demandent responsable/procédure/preuve. Finance et Logistique restent hybrides avec leurs KPI hérités et demandent encore un producteur ; aucun dépôt de rapport humain n'a été construit. | Garder cette limite visible. Le mode déclaré seul ne fournit pas un parcours de suivi humain ; traiter ce parcours dans son lot autorisé. |
| R6 : aucun producteur | L'encadré courant de la carte reconnaît quatre producteurs. Les états antérieurs sont conservés comme historiques datés. | Ne pas réécrire les preuves historiques comme si elles étaient actuelles. |
| R7 : patchs owner / supplier | Les patchs owner-01 à 03 ne sont pas disponibles pour une comparaison exacte. Le commentaire supplier « not merged » a été corrigé ; état, capacités et preuves hérités restent conservés, activation non vérifiée. | Ne pas déclarer les trois patchs appliqués. Examiner leurs deltas lorsqu'ils sont identifiés ; aucun changement de flag. |
| R8 : plafond | Le service borne à 1000 et invalide une lecture lorsque `count !== rows.length`. La restitution générique d'indisponibilité reste une limite connue ; aucun jeu DB >1000 exercé ici. | Qualification L2 de la cause « plafond atteint », sans relever le plafond ni accepter un calcul partiel. |
| R9 : cadence | Cache nominal 60 s, dégradé 15 s ; pas de cadence de collecteur nouvellement définie. | Décision L3 après coût et comportement observés ; pas de polling activé ici. |

Preuve nouvelle : `.superpowers/sdd/2026-10-10-command-center-l1/review-mode-a-repro.ts` et `.log`, exit 0, sans base, réseau applicatif ni modification des sources. Un premier lancement a échoué sur un chemin relatif du script de preuve ; le chemin a été corrigé avant la reproduction. Les 206 tests L1 précédents restent acquis, mais ne couvrent pas R1 et ne prouvent pas un pilotage économique fiable. Aucun correctif KPI n'est réalisé sous le périmètre L1, qui l'exclut explicitement.

**Remise VPS : limite vérifiée.** Le backend Hermes installé résout la révision exclusivement dans sa source configurée `/opt/automecanik/app`, puis crée un worktree isolé. Il n'accepte pas de chemin de copie de revue dans le contrat actuel. Une simple copie sous `/home/deploy` ne suffira donc pas pour cette admission. Aucun objet Git, ref, fichier ou configuration de cette source distante n'a été modifié pour contourner cette limite ; le transfert et la revue du candidat restent à réaliser par une méthode admise.

### Revue Claude sur VPS et corrections L1 — 2026-10-11

Ce jalon actualise les états historiques de remise ci-dessus. Le candidat applicatif relu est `cd149e40862fffaa70080d18c8a95a4c89acac5a`, base B inchangée, arbre `c553b53001552d18dc3c6467b33d52f35c9b5c48`. Il a été créé dans un worktree DEV dédié avec les hooks natifs Linux réussis, puis récupéré localement par bundle. L'échec initial Windows provenait du lancement d'un wrapper shell ESLint par Node ; aucun hook n'a été désactivé. La branche, le HEAD, l'index, les refs et les fichiers suivis du checkout principal DEV sont restés identiques pendant la préparation.

Hermes a exécuté la mission `fd2a3916-c7e5-4324-9633-d1dd29be41d4`, avec `claude-opus-5-5` effectivement observé. Le sandbox a reçu l'enveloppe `2e1cb96d425e87464cdb149815283f925d7a44ef` : son parent est le candidat applicatif ; ses seuls ajouts sont des entrées de revue sous `.superpowers/sdd/l1-review-inputs/`. Cette enveloppe n'appartient pas au candidat à intégrer. Claude a contrôlé les empreintes et les 32 blocs de diff, sans modifier de fichier ni exécuter de test. Le verdict est une revue statique limitée, pas une autorisation de publication. Résultat natif et évaluation lisible : `hermes-result.json` et `claude-review-assessment.json` dans le dossier local de qualification.

| Remarque Claude | Vérification et traitement du delta |
|---|---|
| P2-1 : oracle Git indisponible en clone superficiel | Reproduit dans un clone `--depth 1` du candidat : un test backend échoue sur `git show B` (28 autres réussissent). Remplacement des trois lectures Git par la fixture `tests/registry/fixtures/command-center-l1-baseline.json`. Elle contient le snapshot B intégral et les trois blocs YAML comparés, avec révision, empreintes des sources et empreinte sémantique testée. Aucun changement de CI ni retrait d'assertion. |
| P2-2 : familles dégradées par les responsabilités humaines | Confirmé pour AI-Governance. Application de la présentation prévue dans la spec : certification explicitement limitée au périmètre logiciel ; les responsabilités `human` sans capacité sont comptées séparément comme non évaluées. Les 24 entrées et les valeurs techniques du contrat sont conservées. Une famille entièrement humaine n'a aucun badge CERTIFIED ; un département logiciel/hybride UNKNOWN ou BROKEN reste visible, ainsi qu'un humain avec capacité logicielle. Aucun nouveau statut ou calcul métier backend. |
| P3-b : documentation People/D8 | Commentaire YAML corrigé : D8 signifie Read Model / Serving. La fiche liée #24 porte le rattachement L1 approuvé avec une note datée ; le constat historique D11+D13 à B est conservé comme historique. |
| P3-a : producteurs hors contrat et diagnostic de cache | Hypothèse de durcissement retenue pour la qualification des producteurs L2 ; pas de reproduction de sortie réelle invalide, pas de nouveau fallback ou de changement de cache dans ce delta. La validation disque/cache et les limites de la revue restent explicites. |
| P3-c : causes dégradées en codes bruts | Limite ergonomique conservée pour L2 ; aucun changement implicite des codes contractuels ou de la redaction light. |
| P3-d : génération stricte et diagnostic vide sur mauvais total | Le refus d'une source autre que 24 profils valides est expressément prévu par la spec et le plan approuvés ; il n'est pas retiré au motif que le validateur général reste warn-only. Le détail d'erreur `[]` lorsque seul le compte est faux reste une amélioration de diagnostic ouverte. |

**Validation du delta :** `review-ui-red.log` constate 5 nouveaux cas en échec avant correction ; `review-ui-green.log` : 13 tests DOM réussis, exit 0. `review-shallow-red.log` reproduit l'échec Git ; après correction dans le même clone, `review-shallow-green.log` : 29 tests backend réussis, exit 0 ; `review-shallow-contracts.log` : 33 tests contrat/génération réussis, exit 0, dont le contrôle d'empreinte. Aucun `.env` applicatif chargé, producteurs mockés, aucune base ni requête réseau applicative. Les résultats antérieurs sont réutilisés uniquement pour les périmètres inchangés : le cumul L1 est désormais 212 tests, dont 75 rejoués sur ce delta et 137 réutilisés. Il ne s'agit pas d'un run intégral de CI.

Le contrôle de types frontend, le lint frontend final et le contrôle de fraîcheur du snapshot passent (exit 0, `review-frontend-types.log`, `review-frontend-lint-final.log`, `review-generation-check.log`). Un avertissement d'ordre d'imports du nouveau test DOM a été corrigé avant le lint final. Les trois diagnostics backend préexistants documentés plus haut restent une limite du typecheck global ; aucune source backend de production n'a changé dans ce delta.

Le lint supplémentaire du fichier `backend/tests/unit/command-center-reader.service.test.ts` retourne 1 : le projet TypeScript configuré par ESLint n'inclut pas ce fichier de test (`review-backend-test-lint.log`). Ce contrôle n'est pas annoncé vert et la configuration n'a pas été élargie pour le faire passer ; la suite Jest isolée de 29 cas et le formatage du fichier sont vérifiés séparément.

Le commit du delta sous Windows a été refusé par le ratchet design : `toRepoRelative` ne reconnaît comme absolus que les chemins commençant par `/`, puis compare des clés `C:/…` à la référence relative. Les sept fichiers signalés sont hors delta et déjà présents dans `audit/impeccable/baseline.json`. La qualification du commit se poursuit par les mêmes hooks natifs sous Linux dans un nouveau worktree DEV, avec comparaison de l'arbre avant/après ; aucun changement de baseline, de hook ou de variable de contournement. Les reçus et journaux de cette opération sont conservés dans `vps-correction-receipt.json` et `linux-correction-hooks.log` du dossier local.

**Couverture de correction :** `scope_requested` = remarques de la revue L1 ; `scope_actually_scanned` = trois tests historiques, fixture, bandeau et test DOM, commentaire source, fiche People, présent plan (9 fichiers du delta, lectures ciblées des règles, de la spec, des configs CI/Jest et du lecteur pour arbitrage). `files_read_count` = 9 dans ce noyau. `corrections_applied` = P2-1, P2-2 et P3-b, dans le mandat L1 approuvé. `excluded_paths` / `unscanned_zones` = autres modules, producteurs DB réels, collecteur Hermes, runtime servi. `remaining_unknowns` = CI réelle, navigateur isolé, liens sur SHA publié, conformité des producteurs réels. `final_status` = VALIDATED_FOR_SCOPE_ONLY pour les tests ciblés ; PARTIAL_COVERAGE pour la recette applicative.

R1 (vert sans cible) demeure un défaut préexistant non corrigé en L1 et bloque toute consommation du digest par Hermes. Pas de passage automatique à L2, ni push, PR, fusion, activation, PREPROD ou PROD. La revue originale reste attachée à son SHA ; les tests du delta qualifient les corrections sans prétendre qu'elles ont reçu une seconde revue Claude.
