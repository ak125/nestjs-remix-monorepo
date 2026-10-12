# Command Center — spécification proposée du lot L1

Date : 2026-10-10 ; révision documentaire 4, effets des responsabilités humaines sur les rapports et compteurs. Statut : **spécification approuvée par Marwane le 2026-10-10**, réponse « valide » à la demande de validation pour préparer le plan L1. Base : `c2dfa0699c9d08e549a107b53a37a4657646811a`. Mandat au moment de cette approbation : préparation du plan. Le 2026-10-10, après présentation du plan et choix de stratégie, Marwane demande « continue corrections et amelioration » ; cette instruction autorise le lot local L1 décrit dans le plan. Cette approbation porte sur les choix de la spécification, pas sur une validation applicative ni une publication.

La version approuvée avant cette annotation avait pour SHA-256 `e5952f14824ccd1915676fcf015982ad14ed85950e478e0466fdd66ae0295494`. Les mentions de non-approbation dans les bilans datés plus bas décrivent leur état historique. Les exigences restent celles de la révision 4. Suite proposée : [plan d'implémentation L1](../docs/superpowers/plans/2026-10-10-command-center-l1.md), dont l'exécution locale est désormais autorisée ; publication et mise en service restent distinctes.

Source de cadrage : [carte et constats L0](./automecanik-departments-map.md#l0-du-2026-10-10--cadrage-command-center). Gouvernance et décisions d'autorité restent dans governance-vault, suivant les références du dépôt. Aucun fichier owner-only ou généré n'a été modifié pour cette proposition.

## Problème et résultat visible

Le Command Center projette vingt départements pour vingt-quatre responsabilités. Quatre responsabilités ne sont pas représentées ; People/Staff et People/Formation/Doc sont rapprochés sans correspondance fonctionnelle complète. Un rôle `*-lead` est affichable, mais ne nomme pas un responsable humain. Le schéma oblige chaque département à posséder un domaine logiciel : il ne permet pas de représenter honnêtement une responsabilité purement humaine.

L1 doit permettre à un opérateur d'ouvrir la vue Départements, retrouver exactement les 24 responsabilités, distinguer rôle opérateur et responsable réellement nommé, voir le mode prévu, puis consulter la fiche narrative existante. Une responsabilité sans logiciel doit apparaître sans domaine fictif ni indicateur vert inventé. L'utilisateur retrouve Staff dans People avec la documentation et la formation comme sous-périmètres explicitement décrits. Les actions, quatre producteurs KPI, rapports et digest existants restent les raccordements utilisés.

L1 ne promet pas un fonctionnement de bout en bout des 24 départements. Les statuts déclarés, la certification structurelle, les mesures, les permissions et les preuves d'exécution restent des concepts séparés.

## Options examinées

| Option | Avantage | Limite / décision |
|---|---|---|
| Garder vingt départements machine et compléter seulement la prose | Pas de migration de contrat | Laisse quatre responsabilités invisibles dans le cockpit ; utile pour L0, insuffisant pour L1 |
| Étendre le contrat département existant et ses projections | Une source machine, identités stables, visibilité cohérente | Demande approbation owner et compatibilité des lecteurs stricts ; **option recommandée** |
| Créer un catalogue parallèle des vingt-quatre responsabilités | Sépare facilement humain et logiciel | Duplique autorité et synchronisation ; écart au mandat, option rejetée |

## Modèle proposé dans la source existante

La SoT machine reste `agent-operating-map.yaml`, bloc `departments`. La SoT narrative reste `audit/automecanik-departments-map.md`. Le générateur reste `build-command-center-snapshot.js`. Les propriétaires de fichiers figurent dans canonical.json ; ce sont des owners de code, pas automatiquement les responsables métiers.

Proposition minimale de champs dans le **contrat existant**, à faire approuver selon la procédure owner-only avant édition :

| Champ | Sémantique proposée | Invariant |
|---|---|---|
| `id` | Identifiant stable existant | Les 20 valeurs actuelles sont conservées ; aucune inférence depuis un libellé |
| `business_number` | Numéro de responsabilité de cette carte | Entier unique 1–24, jamais un domaine D1–D16 |
| `lead` | Rôle opérateur | Reste un rôle ; ne se transforme pas en nom de personne |
| `accountable_owner` | Identifiant d'une personne approuvée ou `null` | Initialement `null` tant qu'aucune nomination vérifiable n'est fournie ; aucun e-mail ou secret dans la projection |
| `operating_mode` | `human`, `software` ou `hybrid` | Décrit l'organisation de la responsabilité, pas son activation ni son succès |
| `profile_ref` | Référence vers une ancre de sa fiche dans la carte existante | Référence locale résoluble, pas une copie intégrale de la fiche ni une commande |
| `repo_domains` | Domaines techniques effectivement rattachés | Tableau vide permis pour `human` ; logiciel/hybride exige au moins un domaine vérifié ; pas de domaine fictif pour Juridique |
| `state`, `capabilities`, `priority`, `kpi_primary` | Champs existants | Statuts autorisés conservés ; pas de capacité ni de KPI créé uniquement pour remplir une carte |

Les quatre enregistrements initiaux proposés sont définis ci-dessous. Ce sont des responsabilités à piloter humainement en L1, sans leur attribuer automatiquement des capacités logicielles existant ailleurs. `dormant` signale l'absence de procédure exercée vérifiée ; il ne signifie pas que l'activité humaine n'existe pas. Le mode hybride envisagé pour Risk/Produit dans la carte fonctionnelle reste une cible ultérieure, à établir par rattachement prouvé et approuvé.

| Numéro | ID / rôle `lead` proposé | Mode initial | `repo_domains` | `capabilities` | `state` | Owner | `priority` / `kpi_primary` | Ancre de `profile_ref` |
|---|---|---|---|---|---|---|---|---|
| 1 | `direction` / `direction-lead` | `human` | `[]` | `[]` | `dormant` | `null` | Non renseignés | `#department-direction` |
| 18 | `legal` / `legal-lead` | `human` | `[]` | `[]` | `dormant` | `null` | Non renseignés | `#department-legal` |
| 19 | `risk-audit` / `risk-audit-lead` | `human` | `[]` | `[]` | `dormant` | `null` | Non renseignés | `#department-risk-audit` |
| 20 | `product` / `product-lead` | `human` | `[]` | `[]` | `dormant` | `null` | Non renseignés | `#department-product` |

Le libellé de chaque ligne est celui de sa responsabilité numérotée dans la carte L0. `profile_ref` est le chemin `audit/automecanik-departments-map.md` suivi de l'ancre indiquée. Les 24 ancres documentaires existent désormais dans la carte L0 ; leur projection machine reste une exigence du lot futur. Les absences de priorité/KPI sont autorisées par la source et projetées en `null` ; un KPI économique n'est pas inventé pour une responsabilité humaine. Le regroupement de présentation existant sera étendu explicitement : Direction/Juridique/Risk dans `AI-Governance`, Produit dans `Business`, sans modifier les familles des vingt autres départements ni utiliser le défaut `Operations` par accident.

Pour les vingt lignes existantes, les valeurs exactes héritées sont celles du YAML **au SHA B**, par `id` : `lead`, priorité/KPI présents, capacités, état et domaines sont conservés, sauf le delta People explicite ci-dessous. `business_number` provient de la correspondance unique L0 ; `accountable_owner=null` tant qu'aucune nomination n'est fournie ; `operating_mode=hybrid` est la proposition organisationnelle initiale pour ces vingt responsabilités combinant outils existants et rôle opérateur humain. `profile_ref` suit le même chemin et le format `#department-<id>`. Cette dérivation et les quatre lignes ci-dessus déterminent les 24 enregistrements proposés sans recopier le YAML dans un catalogue concurrent. Toute nouvelle modification de ces valeurs exige un delta justifié, pas un choix implicite pendant l'implémentation.

Le contenu narratif par responsabilité comprend déjà finalité, entrées/sorties, dépendances, procédure, KPI et recette L0. Les ancres stables sont présentes dans la carte ; en L1, leur donner un rattachement machine explicite et compléter droits, incidents et dernière preuve par références aux mécanismes existants, ou « non vérifié ». Ne pas dupliquer les preuves d'exécution : réutiliser les références d'`automation reality`/`runtime_evidence` du registry quand elles existent. Un timestamp de génération ne devient jamais la date de dernière exécution.

### People : une responsabilité, deux périmètres à expliciter

Conserver `people` et ses consommateurs par ID. Libellé proposé : « People, Formation & Doc ». La fiche #24 explicite Staff/habilitations et Formation/Documentation sans en faire deux départements. **Delta contractuel borné : `repo_domains=[D8]`, `capabilities=[staff]`, `lead=people-lead`, `state=partial`, priorité P1 et KPI `staff_coverage` conservés.** Le filtre du registry à B sur `backend/src/modules/staff/staff.module.ts` confirme D8 ; les anciens D11+D13 ne sont pas repris sans référence à une autre capacité réellement rattachée.

Formation/Documentation reste une procédure humaine référencée dans la fiche, adossée aux sources .claude/knowledge et REPO_MAP ; aucune capacité logicielle supplémentaire n'est déclarée par L1 pour remplir ce périmètre. La capacité déclarée `staff` garde son ID, son owner `people` et sa preuve de source existante. Ne pas confondre une habilitation décrite avec un droit runtime accordé. Les autres modifications éventuelles de libellés n'altèrent pas les IDs.

### États initiaux

Ne pas reclasser automatiquement les vingt départements existants en `live`. Corriger les commentaires historiquement faux, notamment supplier « not merged », tout en gardant séparés code intégré et activation non vérifiée. Pour les quatre nouvelles entrées, proposer `dormant` tant qu'aucune procédure exercée n'est prouvée. Leurs rapports restent `SANS_PRODUCTEUR` si aucun KPI existant ne leur correspond ; ne pas utiliser une valeur zéro. Responsable non nommé doit rester visible comme manque et ne pas être déduit du propriétaire GitHub.

## Contrats, génération et compatibilité

Les objets des schémas actuels sont fermés (`additionalProperties: false` / Zod `.strict()`), mais leurs identifiants départementaux sont des chaînes et leurs listes ne sont pas limitées à vingt éléments. **Passer de 20 à 24 entrées est accepté par les schémas v1 examinés.** C'est l'ajout de champs départementaux qui exige un traitement de compatibilité, pas la cardinalité. Un test local en mémoire a confirmé ces deux propriétés ; il ne prouve pas le comportement du collecteur Hermes réel.

**Choix proposé : v2 limitée au snapshot/API enrichi ; digest v1 conservé.** La nouvelle représentation `command-center.v2` ajoute les métadonnées départementales décrites ci-dessus dans le même module. Les schémas AJV et Zod expriment les mêmes obligations ; le générateur et les lecteurs concernés évoluent ensemble. Les objets KPI/actions restent réutilisés. Les artefacts générés sont reconstruits par les scripts existants, jamais modifiés manuellement.

Sur la route admin existante, `contract_version=2` demande cette représentation enrichie ; absence de paramètre = projection de forme v1 ; valeur inconnue = refus explicite avant calcul de KPI, sans altérer les contrôles d'accès. Ce paramètre est une proposition à approuver, pas une interface déjà présente. L'adaptateur v1 retire seulement les nouveaux champs et restaure sa version littérale : **il conserve les 24 départements**, ainsi que leurs rapports, capacités, handoffs et compteurs cohérents. Aucun filtre d'identifiants historiques ni seconde carte n'est maintenu. Les deux représentations sont projetées à partir du même résultat interne mis en cache. La clé existante doit distinguer la version interne enrichie et le mode, afin de ne pas réutiliser une ancienne entrée v1 ; il n'est pas nécessaire de créer deux caches de calcul par version HTTP. La négociation ne doit pas multiplier les analyses. La mutualisation des requêtes concurrentes en cours reste un sujet L2, sans promesse de correction dans L1.

Le digest actuel ne projette pas l'objet `departments` enrichi : il contient notamment `department_reports` et les actions owner-GO. Ces rapports acceptent déjà les nouveaux identifiants sans nouveaux champs. **Conserver `command-center-digest.v1`, sans nouveau paramètre de version sur cette route**, et lui transmettre les mêmes 24 rapports en mode full, sans calcul supplémentaire. Les métadonnées de responsabilité sont consultables dans le cockpit enrichi et ses fiches ; leur diffusion dans le digest n'est pas requise par L1. Une demande future d'enrichissement de ce digest ferait l'objet de son propre examen de contrat.

La génération/lecture/API/UI doit être qualifiée comme un ensemble compatible. L'inventaire local ci-dessous identifie les lecteurs trouvés ; le plan devra en contrôler le delta et distinguer les consommateurs externes encore inconnus avant toute édition. Pour la compatibilité v1, tester l'ensemble de la réponse : références des capacités/handoffs, rapports, actions, compteurs et certification restent cohérents avec les 24 départements. Une validation AJV/Zod seule ne prouve pas ces invariants de relation.

Les formats locaux ne garantissent pas que le consommateur Hermes externe accepte réellement les 24 identifiants. Cette recette appartient à L3 sous mandat de lecture : **L1 peut être qualifié sur le contrat local et l'UI sans annoncer Hermes validé**. Si une hypothèse fermée est découverte chez un consommateur réel, la documenter puis proposer une adaptation ciblée dans son mandat ; ne pas réintroduire silencieusement une limite à vingt ni migrer tout le digest par précaution. Aucun changement au collecteur Hermes n'est autorisé par cette spécification applicative.

L'approbation owner-only reste nécessaire ; si la procédure impose une décision vault préalable, suivre cette procédure. La négociation admin permet de servir la forme historique tout en ajoutant des champs à la vue enrichie. Elle reste une décision proposée : l'inventaire local ne prouve pas qu'aucun client externe n'existe, et ne remplace pas l'accord de gouvernance.

### Lecteurs et producteurs locaux identifiés à B

| Surface et source | Comportement observé | Conséquence pour L1 |
|---|---|---|
| Générateur `scripts/governance/build-command-center-snapshot.js:48`, `:239` | Émet un fichier déterministe `command-center.v1` ; projection explicite des champs | Ajouter les champs dans cette projection et versionner la représentation enrichie ; jamais éditer le JSON à la main |
| Schémas et exports `packages/registry/src/command-center/snapshot.ts:188`, `:360`, `:383` ; `packages/registry/src/index.ts:175` | Définitions strictes snapshot/API/digest, exports de types et schémas | Préserver les exports v1 explicitement, ajouter les types/parsers v2 au même module ; digest reste v1 |
| Lecteur `backend/src/modules/admin/services/command-center-reader.service.ts:77`, `:93`, `:153` | Parse JSON avec assertion TypeScript ; cache commun par mode ; enveloppe dégradée codée v1 | Validation effective avant utilisation ; cache interne versionné ; enveloppes dégradées adaptées à la version demandée |
| Contrôleur admin `backend/src/modules/admin/controllers/command-center.controller.ts:112` | Retourne le lecteur sous les guards existantes et AdminResponseInterceptor | Négocier la forme sans changer identité/permissions ; projection v1 ou v2 à partir du résultat commun |
| Contrôleur interne `backend/src/modules/admin/controllers/internal-command-center.controller.ts:32` ; reader `:460` | Appelle le même lecteur et projette rapports/actions vers digest v1 | Réutiliser ce chemin, ses restrictions et son calcul ; tester 24 rapports sans ajouter de négociation à cette route |
| Loader `frontend/app/routes/admin.command-center.tsx:127`, `:157` | Lit API admin, dépaquette `body.data`, affirme le type, puis demande le statut orchestration | Demander v2, parser après dépaquetage ; en cas de contrat invalide ne pas déclencher la demande orchestration ; adapter l'enveloppe dégradée locale |
| UI `ModuleGrid`, `GlobalHealthBar`, `DepartmentReports`, `OwnerActionQueue` et sous-vues du fichier de route | Consomment le type partagé ; les imports TypeScript ne valident pas des données reçues | Un seul contrôle à la frontière du loader ; composants adaptés au type enrichi, sans répliquer les formules métier |
| Planners `command-center-orchestrator/regen-artifact.planner.ts:43` et `pr-proposition.planner.ts:30` | Référencent le chemin du snapshot et son générateur ; pas une seconde source de départements | Conserver chemins et identifiants d'action ; vérifier leur description/format sans exécuter preview, apply, push ou PR |
| Tests `scripts/governance/__tests__/build-command-center-snapshot.test.ts` ; `backend/tests/unit/command-center-*.test.ts` | Assertions explicites de version et tests reader/controller/digest/rapports existants | Mettre à jour seulement les attentes du contrat enrichi ; garder les fixtures v1 et assertions métier existantes |
| CI `.github/workflows/skills-canon-gate.yml:132`–`:169` | Tests, déterminisme et fraîcheur/AJV déclarés `continue-on-error: true` ; génération ×2 avant le `--check` | Exiger les résultats individuels et contrôler la fraîcheur du fichier committé avant toute régénération ; le seul état global CI ne suffit pas |

Cet inventaire couvre les références trouvées dans les sources locales ciblées, les exports et workflows de génération. Aucun usage de `contract_version` n'a été trouvé dans le périmètre Command Center actuel. Les autres usages de ce nom dans le dépôt ne sont pas des conventions Command Center. Collecteur Hermes et consommateurs externes : non inspectés dans cette révision, aucune absence affirmée.

### Frontières et comportement attendu en cas d'incompatibilité

1. **Artefact** : valider la version et la forme du snapshot avant lecture des listes, calcul de score, KPI ou mise en cache. Un fichier absent, JSON invalide, contrat invalide ou version non prise en charge donne une réponse dégradée explicite ; distinguer ces causes dans le mécanisme existant sans exposer le contenu brut. Ne pas laisser une assertion TypeScript servir de validation.
2. **Cache** : ne pas interpréter une entrée v1 sous le type enrichi. Une entrée invalide est un miss ; ne pas supprimer globalement Redis. Conserver les TTL nominal/dégradé et les restrictions par mode. Les versions HTTP d'un même résultat ne relancent pas les producteurs ; la recette vérifie le nombre d'appels pour les accès successifs avec cache chaud.
3. **API admin** : absence de paramètre ou valeur `1` → forme v1 ; valeur `2` → forme v2 ; autre valeur, valeur vide ou paramètre répété → HTTP 400 après les guards existantes, avant accès aux sources. Un mode disabled conserve son refus 404. Chaque forme, y compris dégradée/light, doit passer son propre schéma.
4. **Frontend** : dépaqueter la réponse de l'intercepteur puis valider le contrat v2 avant de l'utiliser. Une réponse HTTP 200 de version/forme inattendue devient une indisponibilité explicite ; aucun retry automatique vers v1 et aucun appel de statut orchestration sur ce chemin d'erreur. Les erreurs d'authentification restent traitées par le mécanisme existant.
5. **Digest** : garder sa forme v1 et les plafonds existants ; light et dégradé restent sans rapports/actions. Une réponse v2 du cockpit ne doit pas propager ses nouveaux champs dans ce digest fermé.

La migration prévue est un lot cohérent : source approuvée, schémas, générateur, snapshot produit, backend et frontend compatibles. Un ancien backend face au nouvel artefact, ou le nouvel UI face à un ancien backend, est une situation de recette explicite, pas une compatibilité supposée. La réponse dégradée doit empêcher des cartes vertes ou des lectures métier sur un artefact rejeté. Le déploiement et l'exercice en environnement servi restent hors autorisation L0.

## Expérience opérateur attendue

Dans la vue migrée : 24 cartes/entrées, tri stable par numéro métier, ID stable distinct et domaine affiché séparément. « Responsable non nommé » est explicite ; le rôle n'est pas affiché comme une personne. Mode humain : « aucun domaine logiciel rattaché » est un état normal. Le score de cartographie reste structurel ; il n'est pas un taux de santé de l'activité humaine. Le calcul actuel sans capacité est conservé : base 30, certification `UNKNOWN`, motif `no_capabilities`. Dans la vue v2, une responsabilité `human` sans capacité affiche « Aucune capacité logicielle rattachée ; activité humaine non évaluée » à la place de la jauge. Ce choix de présentation ne crée aucun statut ni formule métier ; les valeurs techniques restent disponibles dans le contrat et dans la projection v1.

Chaque fiche est accessible par un lien sûr et utilisable vers la documentation existante ; pas de chemin YAML affiché comme s'il s'agissait d'un lien web fonctionnel. Le `profile_ref` doit se limiter au chemin de la carte et à une ancre existante `department-<id>` ; aucun texte de preuve ne devient une URL ou une commande exécutable. La solution de rendu/lien doit réutiliser le mécanisme documentaire existant identifié dans le plan. Si aucun n'existe pour une ancre locale, utiliser un lien de source du dépôt sur le SHA publié autorisé, sans inventer une route documentaire. Préserver accès clavier, libellés accessibles, affichage mobile, liste vide et source indisponible. Aucun bouton d'exécution ajouté par L1.

Les décisions et conversions métier restent au backend/générateur ; le frontend affiche le contrat et ses états sans réimplémenter les mappings. Light/disabled/full conservent leurs restrictions ; l'affichage de métadonnées ne doit pas déclencher un producteur auparavant désactivé.

### Rapports des responsabilités humaines et compteurs

Écart C14 : `department-report.rules.ts` demande actuellement de déclarer un KPI dès qu'aucun KPI primaire ni action n'est présent. L1 doit transmettre le mode au constructeur de rapports interne et distinguer une responsabilité `human` sans KPI. Pour les quatre entrées initiales, son rapport doit indiquer « Responsabilité humaine sans KPI déclaré ; procédure et preuve d'activité à qualifier », puis demander de renseigner ou vérifier dans la fiche le responsable, la procédure et la preuve attendue. Cette demande n'impose ni KPI ni producteur logiciel ; le rapport ne prétend pas avoir vérifié la complétude de la fiche. Une nomination seule ne prouve aucune activité.

La branche conserve `NON_MESURE`, `SANS_PRODUCTEUR`, des valeurs nulles, `INCONNUE`, une cause probable nulle, `IMPROVE` et `owner_go_required: true` pour cette qualification humaine. Une action existante garde sa priorité et sa propre règle owner-GO ; un KPI déclaré garde son traitement actuel. Aucune décision automatique `PAUSE` ou `CREATE`, nouvelle action de réparation ou permission n'est déduite de ce mode. Le champ `risk` existant décrit le risque d'agir ; son défaut `FAIBLE` ne certifie pas un faible risque juridique, commercial ou opérationnel. Le digest v1 conserve la même forme, avec le texte adapté du rapport.

Exemple de recette : ouvrir Juridique → voir « Responsable non nommé », le mode humain et l'absence de domaine/capacité, sans jauge d'efficacité → consulter son rapport non mesuré et sa demande de qualification humaine → ouvrir la fiche `department-legal`. Aucun bouton d'exécution ni obligation de créer un KPI ne doit apparaître du seul fait de cette entrée.

À données B inchangées, l'ajout des quatre entrées porte le total à 24 et les entrées `dormant` de 1 à 5 ; `by_priority` reste P0=8, P1=7, P2=2, P3=3, soit 20 priorisés et quatre sans priorité. Ne pas fabriquer une priorité pour égaliser ces sommes. Les 41 capacités, 22 certifications structurelles, quatre capacités sans preuve et dix handoffs dont neuf incomplets restent inchangés. À fraîcheur et validation identiques, cet ajout seul ne doit changer ni le statut global ni les actions de certification. Il ne garantit pas que la file complète, alimentée par des données métier variables, restera identique en runtime.

## Critères d'acceptation du lot futur

| Cas | Résultat requis | Niveau de preuve |
|---|---|---|
| Identité | Exactement 24 numéros uniques et 24 IDs uniques ; les 20 IDs actuels conservés | Test du contrat et générateur |
| Références | Domaines/capacités/profiles résolubles ; aucun domaine inventé ; pas d'orphelin | Validateur ciblé, fixtures de référence invalide |
| People | Une ligne `people`, Staff et Doc explicitement rattachés ; aucun 25e département | Test mapping + vérification de fiche et consommateur |
| Responsables | 24 valeurs initiales `null` si aucune nomination disponible ; UI dit « non nommé » | Contrat, rendu et recette navigateur |
| Modes | Juridique/Direction humains sans faux domaine ; mode logiciel/hybride sans domaine rejeté | Cas positifs et négatifs AJV/Zod |
| Génération | Même entrée → mêmes octets, sans horloge ni ordre instable ; `--check` réussi | Tests générateur et contrôle d'artefact |
| Frontières de contrat | JSON valide mais mauvaise forme, champ manquant et version inconnue → dégradation contrôlée ; aucun KPI sur artefact rejeté, aucun appel orchestration sur réponse API rejetée | Tests reader et loader sur leurs véritables points d'entrée |
| Cache | Ancienne entrée v1 jamais consommée comme v2 ; résultat commun réutilisé pour les accès HTTP v1/v2/digest successifs | Cache en mémoire isolé, assertions de version et nombre d'appels ; pas de promesse sur les misses concurrents L2 |
| Versions admin | v2 enrichie parsée ; v1 de même forme accepte 24 IDs sans nouveaux champs ; version inconnue refusée avant accès source | Fixtures lecteurs stricts ancien/nouveau et absence d'appel source |
| Rapports/digest | Aucun nouveau KPI ; valeurs manquantes restent non mesurées ; 24 rapports full sous digest v1 inchangé ; light reste vide | Unitaires reader/DTO/digest et fixture de compatibilité |
| Responsabilité humaine sans KPI | Rapport de qualification humaine sans demande de KPI/producteur ; action existante prioritaire ; KPI déclaré traité comme avant ; aucun PAUSE/CREATE automatique | Tests du constructeur réel sur les quatre entrées, une action existante et un KPI déclaré ; vérifier la projection digest et le texte visible |
| Compteurs et actions structurelles | 24 au total, cinq dormant, 20 priorisés et quatre sans priorité ; capacités/handoffs préservés ; statut global et actions de certification inchangés à autres entrées égales | Comparaison générateur/reader avant-après sur fixture B, incluant alertes, fraîcheur et validation identiques |
| Cohérence des projections | Départements, capacités, handoffs, rapports, actions et compteurs restent cohérents dans chaque représentation ; aucune référence orpheline | Tests relationnels en plus des parsers AJV/Zod |
| Capacités | Fixture du YAML/snapshot B : les 20 IDs existants conservent leurs listes déclarées et résolues ; les 41 capacités projetées gardent ID/owner/preuves/certification, notamment staff → people ; quatre nouvelles listes vides | Comparaison avant/après des champs métier, sans figer les numéros de ligne des preuves ; tout delta hors People/domaines explicité et approuvé |
| Handoffs | Dix relations actuelles préservées, états planned/defined non promus automatiquement | Test snapshot + refus doublon/orphelin |
| Modes runtime | Disabled refuse, light n'ajoute pas de lecture métier, full réutilise les producteurs existants | Tests des branches de lecteur, compteurs de mocks significatifs |
| Permissions | Aucun effet, nouvelle permission ou fuite dans les deux versions ; garde actuelle préservée | Contrôleurs en environnement isolé, données factices |
| UI | 24 responsabilités discernables ; vide, refus et dégradation ; clavier et mobile ; ancre ouvrable ; pas de jauge assimilant absence de logiciel à efficacité humaine | Navigateur réel sur application isolée |
| Validation CI du candidat | Résultats individuels des tests/déterminisme/fraîcheur/AJV réussis ; `--check` sur copie propre avant régénération ; état global vert seul insuffisant | Contrôles locaux ciblés puis résultats CI du SHA autorisé, sans changement implicite du workflow |
| Hermes (qualification L3) | Digest v1 et 24 identifiants réellement consommés, destination et identité vérifiées, refus correctement restitué | Hors recette locale L1 ; L3/mandat transport, sans assimiler un mock à cette preuve |

Baseline locale disponible au SHA B : self-tests validateur et `--check` exit 0 ; 25 tests des suites `scripts/governance/__tests__/build-command-center-snapshot.test.ts` et `tests/registry/llm-repo-map.test.ts` réussis. Cette baseline démontre le comportement actuel à 20, pas les exigences futures à 24. Le plan écrira les tests manquants et constatera leur échec attendu avant le code, sans affaiblir les assertions existantes.

Les tests backend/UI ciblés seront choisis dans les scripts réellement présents après revue du plan. Aucun alias npm n'est inventé ici. Les suites d'intégration attendront une preuve d'isolation DB, Redis, queues, stockage, réseau, ports, volumes et identifiants. Les scripts et dépendances existants seront réutilisés sans installation opportuniste. Aucun test de recette ne contacte une banque, un fournisseur, un client ou une messagerie réels.

## Périmètre des modifications à proposer

Fichiers source attendus : operating-map et son schéma (owner-only), schéma snapshot partagé, module `packages/registry/src/command-center`, générateur existant, lecteur/contrôleurs concernés, constructeur `department-report.rules.ts` et transmission interne du mode, route et composants Command Center, tests associés, carte narrative existante. Les points de lecture/écriture sont identifiés ci-dessus ; leur diff exact et l'ordre d'implémentation appartiennent au plan, à approuver ensuite. Lockfile, package manager, CI, politiques, secrets et configuration d'activation restent hors lot ; une nécessité nouvelle est explicitée avant d'étendre le périmètre.

Hors L1 : formules KPI, agrégations/index/migrations, optimisation des requêtes, droits internes renforcés, disponibilité fournisseur, prix/stock, commandes/paiements, publication SEO, RAW/WIKI, exécution de plans et écritures Hermes. C06–C10 restent des constats à traiter par L2/L3/L6 sous leurs mandats, pas des corrections implicites du présent lot.

Retour arrière attendu : conserver les lecteurs et projection v1 ; annuler ensemble le code et ses artefacts générés si nécessaire. Revenir au consommateur v1 seul ne rétablit ni l'ancienne source à vingt ni la compatibilité d'un ancien backend avec un snapshot v2. Aucune opération irréversible ni migration de données n'est prévue. Si ce retour n'est pas possible dans l'environnement réel, interrompre la mise en service et revoir le plan ; aucune commande de rollback arbitraire ne provient des preuves textuelles.

## Revue indépendante et suite

Candidat L0 à remettre à Claude : base B plus exactement les deux fichiers documentaires de ce lot, identifiés par leurs empreintes SHA-256 à la restitution. Ils sont laissés non committés pour cette étape documentaire ; aucune branche distante ni PR n'est créée. L'auto-revue Codex est consignée ci-dessous ; la revue Claude n'est pas déclarée exécutée. Un diff qui change après remise exige une nouvelle empreinte et une revue du delta.

Consigne de revue indépendante : vérifier C01–C14 contre B ; contrôler que les corrections déjà intégrées sont reconnues ; challenger la compatibilité admin v1/v2 et le maintien du digest v1, l'absence de domaine fictif, le responsable non nommé, les rapports humains et People ; distinguer chaque preuve structurelle de runtime ; vérifier que les critères L1 sont testables sans activer les autres lots. Livrable attendu : constats référencés par fichier/ligne et gravité, objections au contrat, décision de recevabilité de la spécification. Arrêt : aucune édition, exécution applicative, sous-délégation ou publication. Hermes conserve le pilotage de cette revue dans le dossier existant.

Ordre de décision : **approbation explicite de cette spécification → préparation du plan → approbation du plan et de sa méthode → mission d'implémentation autorisée**. Une approbation de spécification ne remplace pas les accords owner-only ni STOP. La présente étape s'arrête avant le plan.

## Auto-revue Codex du 2026-10-10

Portée : les deux documents L0 sur base B ; un relecteur Codex distinct, sans historique hérité, en lecture seule et sans sous-délégation. Ceci ne remplace pas la revue Claude pilotée par Hermes. Le candidat initial avait pour empreintes `d88bec8f…` (carte) et `1199dc12…` (spécification) ; la révision 2 les a remplacées ; les révisions 3 et 4 précisent ensuite les frontières, consommateurs et rapports humains sans nouvelle revue indépendante.

| Constat sur la révision initiale | Décision et correction documentaire |
|---|---|
| P1 — Filtrage v1 à vingt et digest v2 non justifiés par les schémas | Retenus : supprimer ce filtrage, conserver le digest v1 avec 24 rapports ; limiter la proposition v2 aux objets réellement enrichis. L'inventaire des lecteurs externes reste requis. |
| P1 — Valeurs des quatre nouvelles entrées insuffisamment déterminées | Retenu : table initiale explicite, quatre responsabilités humaines sans domaines/capacités inventés ; héritage des vingt autres fixé à B, delta People explicite. Une copie complète des vingt lignes YAML dans la spec est écartée : la référence immuable et la dérivation donnent les mêmes valeurs sans seconde source. |
| P2 — Préservation des capacités insuffisamment testable | Retenu : fixture B, comparaison ID/owner/capacités/preuves/certification ; conservation de staff → people et des dix handoffs. |
| P2 — PASS employé pour le verdict tracking global | Retenu : carte corrigée vers CERTIFIED/NOT_CERTIFIED/UNKNOWN ; PASS reste réservé aux checks. |

**Validation de revue :** probe isolée exécutée avec les dépendances existantes, sans .env ni réseau, exit 0 : (1) snapshot v1 étendu en mémoire à 24 IDs accepté par AJV, (2) même objet accepté par Zod, (3) digest v1 avec 24 rapports accepté par Zod, (4) ajout du champ départemental `accountable_owner` rejeté par AJV et Zod. Les objets de probe servent uniquement à tester ces contraintes de forme ; ils ne constituent pas un snapshot métier valide ni une recette de relations/runtime. Contrôle documentaire après correction : références locales, 24 responsabilités, valeurs proposées et diff limité aux deux documents. Les 25 tests structurels L0 ne sont pas relancés : sources/dépendances/configuration inchangées.

**Manifest de cette revue :** deux documents candidats relus ; vérifications ciblées des schémas snapshot/Zod, schéma operating-map, lecteur/digest, générateur/validateur, producteur KPI, composant rapports et contrat tracking ; registry filtré pour le delta Staff. Exclusions : revue exhaustive des modules, intégration, permissions effectives, navigateur, CI et runtime/Hermes. Les corrections portent uniquement sur la proposition. Le relecteur a examiné la révision initiale ; le rédacteur a vérifié les corrections documentaires, sans prétendre à une seconde revue indépendante.

**Verdict après corrections documentaires : REVIEW_REQUIRED / PARTIAL_COVERAGE.** Les quatre remarques reçues ont une réponse explicite ; les choix de contrat, nominations humaines et droits owner-only restent à approuver. Le plan n'est pas commencé.

## Améliorations documentaires de la révision 3

- Inventaire local des lecteurs, producteurs, exports, UI, planners et contrôles CI ; distinction entre schéma strict disponible et parse réellement exécuté (C11).
- Préservation du digest v1, du calcul partagé et des chemins de génération ; clarification de la version du cache, des enveloppes dégradées et des incompatibilités entre backend, artefact et UI.
- Critères supplémentaires sur la forme invalide, le cache, l'absence de lecture métier après rejet, les contrôles CI warn-only (C12) et l'affichage des responsabilités humaines sans capacité (C13).
- Ajout des 24 ancres navigables dans la carte narrative, sans édition du YAML, des schémas ou du snapshot.

Validation : contrôles documentaires et preuve locale du score sans capacité à la restitution ; aucune nouvelle recette runtime. Baselines L0 et probe AJV/Zod de la révision 2 conservées sur sources inchangées. Revue indépendante Claude, consommateurs externes et validation de la spécification restent ouverts ; aucun plan d'implémentation n'a été produit.

Manifest du delta de révision 3 : **12 fichiers ouverts en lecture complète ou ciblée** : les deux documents candidats ; `command-center-reader.service.ts` ; `frontend/app/routes/admin.command-center.tsx` ; `build-command-center-snapshot.js` ; `command-center.controller.ts` ; `ModuleGrid.tsx` ; `packages/registry/README.md` ; `.github/workflows/skills-canon-gate.yml` ; `regen-artifact.planner.ts` ; `backend/package.json` ; `scripts/governance/__tests__/build-command-center-snapshot.test.ts`. Les autres références du tableau ont été localisées par recherche ciblée dans les sources, tests, exports et workflows, sans audit exhaustif de leur contenu. Corrections applicatives : aucune. Zones non scannées et inconnues runtime/externes : inchangées. Statut : PARTIAL_COVERAGE, proposition REVIEW_REQUIRED.

## Vérification ciblée de la révision 4

Probe locale du 2026-10-10, fonctions réelles importées via le runner existant, sans .env ni appel réseau : quatre rapports sans KPI/action reproduisent la demande actuelle de déclaration de KPI ; l'ajout en mémoire des quatre entrées conserve exactement les actions de certification de B. Assertions réussies, exit 0. Cette reproduction établit le besoin C14 ; elle ne valide pas sa correction future. Compteurs B vérifiés dans l'artefact ; effets attendus de l'ajout et stabilité du statut global établis par lecture du générateur/reader, sans exécution du reader. Les tests structurels précédents restent réutilisables sur les sources inchangées.

Manifest : les deux documents, `command-center-reader.service.ts`, `command-center-actions.service.ts`, `certification-action.rules.ts`, `department-report.rules.ts`, `score-action.ts`, `build-command-center-snapshot.js` et `audit/registry/command-center-snapshot.json`, soit **neuf fichiers lus intégralement ou par extraits ciblés**. Aucune modification applicative ; pas de nouvelle revue indépendante, CI, recette navigateur ou preuve runtime. Statut : **PARTIAL_COVERAGE / REVIEW_REQUIRED**. La spécification est le prochain objet de décision ; le plan et l'implémentation restent à autoriser selon l'ordre défini plus haut.
