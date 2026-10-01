# Vérification approfondie et corrections — diagnostic AutoMecanik

Date : 27 septembre 2026 (Europe/Paris). Base auditée : `4a2871dc4d19067c3ae077d6a79021b49cc60237`.
Candidat : branche `codex/diagnostic-integrity-20260926`, worktree DEV `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`.
Document d’entrée : texte fourni par Marwane, audit du 26 septembre 2026, constats A01 à D07.

## Verdict

Le diagnostic du rapport est fondé : les moteurs existent, mais les deux parcours métier complets ne sont pas raccordés. Les défauts de sécurité, de calcul et de transmission décrits ne sont pas de simples problèmes de présentation. Plusieurs ont été reproduits sur les vrais services et composants, puis corrigés dans le candidat DEV.

Ce lot rend le parcours actuel plus prudent et plus cohérent. Il ne rend pas disponibles un entretien autonome sans symptôme, un questionnaire mécanique adaptatif, une correspondance complète entre identités du graphe et causes du diagnostic, ou une session rejouable avec tous ses contextes.

La version effectivement déployée n’a pas été identifiée ni testée. Les corrections du worktree ne sont donc pas des corrections déjà livrées aux visiteurs.

## Ce qui améliore le rapport initial

1. Les reproductions transcrites sont remplacées, pour les défauts corrigés, par des tests qui exécutent les classes et composants du dépôt. Les accès externes sont simulés aux frontières.
2. Trois prolongements ont été vérifiés : le blocage catalogue jusque dans les liens d’entretien, les erreurs de lecture des causes qui pouvaient laisser des données partielles, et les états d’erreur du calendrier.
3. Le mapping complet du fichier `gamme-map.constants.ts` a été comparé à une lecture fraîche de `pieces_gamme` : 56 associations, 50 identifiants distincts, aucune différence d’alias après correction de 479 vers 71.
4. Les deux fonctions SQL d’entretien restent distinguées. Le calendrier utilise la fonction « smart » ; la correction de l’extraction des mois dans l’autre fonction ne personnalise pas ce calendrier.
5. Les mentions « P0 calcul » du texte initial ne constituent pas une preuve d’incident de production. D01/D02 sont des défauts de sûreté prioritaires du candidat. A04 relève de l’exactitude du score ; A06 doit être corrigé et validé avant de réutiliser la RPC concernée.

## Corrections effectives dans le candidat

### Sécurité et disponibilité

- `blocks_catalog` bloque désormais les suggestions, même lorsque `requires_immediate_action` est faux. Le résultat expose `allowed_output_mode: none` et aucune gamme.
- La couche d’actions retire alors les actions `piece` et `entretien_pack`. Les panneaux catalogue et entretien appliquent le même contrat d’affichage.
- Signaux inconnus, absence d’hypothèses ou absence de règles de sécurité ne produisent plus un résultat réussi avec un risque faible déduit du vide.
- Les erreurs de lecture du système, des symptômes, des liens, des causes et des règles sont distinguées des résultats valides. Une contribution de symptôme sans couverture ne disparaît plus silencieusement dans la moyenne.
- Une erreur remontée par un enrichissement facultatif ou par la sauvegarde ne supprime pas une alerte critique déjà déterminée. La réponse précise les informations indisponibles ou l’absence de lien de reprise.
- Les modes de signal non implémentés et les intentions préventives n’empruntent plus silencieusement le pipeline de symptômes : ils renvoient un refus explicite.

Cette prudence n’est pas une certification de couverture médicale ou mécanique des règles. Le chemin `breakdown` n’a toujours pas de précontrôle métier distinct, et un signal partiellement reconnu conduit à une insuffisance explicite.

### Calculs et conservation des entrées

- Le bonus lié à l’entretien mesure `compteur actuel − compteur au dernier entretien`, avec contrôle de cohérence. L’axe demeure une heuristique globale : il n’est pas encore relié à l’opération pertinente pour chaque cause.
- La fusion fait une moyenne arithmétique des contributions des symptômes uniques, arrondie une fois. L’ordre et les doublons ne modifient plus le résultat. Les indices sont dédupliqués et ordonnés ; une obligation de vérification présente dans une contribution est conservée.
- Le schéma accepte un historique par `operation_slug`, date et/ou kilométrage. Doublons d’opération, dates impossibles ou futures, nombres non finis, valeurs négatives et compteurs incohérents sont refusés.
- Le moteur d’entretien ne considère que l’historique de l’opération évaluée. Un entretien global ne remet plus automatiquement toutes les opérations à jour.
- Les échéances kilométriques et temporelles sont séparées. Les dates sont évaluées au jour UTC, avec addition de mois calendaires et ajustement aux fins de mois. Les seuils sont inclusifs.
- Une échéance connue dépassée suffit à signaler le retard ; une donnée manquante sur un autre axe interdit de conclure « ok » lorsque rien ne prouve le retard. Aucun historique n’est assimilé à une intervention effectuée à zéro.
- Le tri conserve la priorité `critical = 0`. Une fourchette d’intervalle n’est plus renommée artificiellement en prochaine échéance : le kilométrage estimé est ancré sur l’intervention de l’opération, ou l’historique manquant est signalé.
- Le formulaire transmet le dernier entretien même sans profil d’usage et conserve les zéros à l’envoi et à la restauration du brouillon.

**Limite visible à connaître :** le formulaire n’offre pas encore la saisie de `maintenance_records`. Les clients API peuvent fournir cet historique, mais l’assistant actuel affichera davantage d’états inconnus plutôt que des statuts « ok » déduits d’un entretien global. Il s’agit d’une correction de prudence, pas de la livraison du parcours préventif.

### Navigation, correspondances et graphe

- Les liens disposant d’un alias de gamme et d’un identifiant utilisent le format canonique `/pieces/alias-ID.html`.
- Le résultat principal ne crée pas de lien si l’identité de gamme est inexploitable.
- L’ancienne page KG et les lignes du calendrier conservent les libellés sans inventer un alias à partir d’un identifiant ou d’un alias d’opération. Les CTA généraux utilisent la section catalogue existante `/#catalogue`.
- Le liquide de frein pointe vers la famille 71. La famille 479 est bien le kit d’embrayage dans la lecture SQL de cette mission.
- Le shadow KG refuse les identités non UUID avant RPC et conserve l’événement `kg_error`. Une entrée correctement mappée peut toujours atteindre la RPC. Aucun mapping sémantique n’a été inventé.
- L’inversion du premier résultat est maintenant une divergence, même lorsque l’ensemble des causes reste identique.
- Le calendrier distingue un échec réseau/HTTP d’une réponse valide vide. Il ne transforme plus une panne de chargement en faux message de population ou en absence d’entretien nécessaire.

## État des 28 constats

« Corrigé » désigne le défaut ciblé dans le candidat, pas son déploiement. « Partiel » précise ce qui reste nécessaire. « Ouvert » désigne un besoin confirmé non implémenté par ce lot.

| ID | État | Résultat et limite |
|---|---|---|
| A01 | Partiel | Intention préventive non supportée signalée explicitement ; parcours autonome toujours absent. |
| A02 | Partiel | Historique par opération validé et consommé par le moteur ; saisie UI, nature/source de l’intervention et reprise restent à faire. |
| A03 | Corrigé | Dernier entretien transmis sans profil ; zéros conservés. |
| A04 | Partiel | Distance depuis entretien corrigée ; pertinence de l’entretien pour chaque cause toujours non résolue. |
| A05 | Ouvert | RPC smart active ignore toujours historique, profil et famille moteur. Aucun changement de base. |
| A06 | Partiel | Défaut SQL confirmé ; candidat corrigeant les deux extractions et référence de retour arrière préparés, non appliqués. Validation intégrale de la RPC et politique des dates limites restantes. |
| A07 | Corrigé | Dates et compteurs validés ; axes temporel/kilométrique et inconnus traités dans le moteur lié aux symptômes. |
| A08 | Corrigé | Priorité critique et faux prochain kilométrage corrigés ; contrat texte conservé, sans nouvelle API d’échéance structurée. |
| A09 | Ouvert | Complétude véhicule ne démontre toujours pas l’applicabilité d’une cause ni la compatibilité d’une pièce. |
| A10 | Partiel | Erreurs et réponses vides distinguées ; formulaire et calendrier réellement personnalisés restent à livrer après correction de la source. |
| B01 | Ouvert | Aucun choix adaptatif de prochaine question dans l’assistant. |
| B02 | Ouvert | Réponses et contexte de manifestation ne pilotent pas encore le score. |
| B03 | Ouvert | Résultat d’une vérification mécanique non réinjecté dans les hypothèses. |
| B04 | Partiel | Modes non supportés refusés explicitement ; raccordement DTC/voyant/texte toujours absent. |
| B05 | Ouvert | Paramètre DTC du hub non intégré au parcours principal. |
| B06 | Corrigé | Moyenne stable sous permutation et déduplication des symptômes. |
| C01 | Partiel | Appels avec identifiants incompatibles empêchés ; vraie correspondance observable/véhicule/faute à établir. |
| C02 | Corrigé | Premier résultat inversé reconnu comme divergence. |
| C03 | Ouvert | Appel MCP toujours privé de plusieurs contextes et de l’historique effectif. |
| C04 | Ouvert | Couche d’intention correctement qualifiée comme orientation vers une action ; pas de raisonnement mécanique ajouté. |
| C05 | Ouvert | Sources multiples et questions non consommées ; propriétaires/adaptateurs à documenter avant unification. |
| D01 | Corrigé | Blocage explicite respecté par moteur, actions et panneaux de résultats. |
| D02 | Corrigé | Chemins testés sans couverture/en erreur ne produisent plus de réussite rassurante. |
| D03 | Corrigé | Générateurs de liens pièces identifiés corrigés ou retirés quand l’identité n’est pas disponible ; navigation navigateur réelle à valider. |
| D04 | Corrigé | Famille liquide de frein corrigée et 56 associations du fichier vérifiées contre 50 familles. |
| D05 | Ouvert | Dossier/version/reprise complets non ajoutés ; contrôle d’accès à valider avant extension de persistance. |
| D06 | Ouvert | Clics et événements d’orientation restent distincts d’une réparation validée. |
| D07 | Partiel | Tests de vrais services/composants ajoutés ; API déployée, parcours navigateur et deux promesses métier complètes non validés. |

Bilan : 9 constats corrigés sur leur défaut ciblé, 8 partiels, 11 ouverts. Ce comptage ne pondère pas la taille des travaux : les parcours complets restent des sujets majeurs.

## Preuves et validations

Les sources de calcul et d’orchestration sont exécutées dans les tests, avec I/O simulées ; les tests frontend utilisent les vrais composants et, pour le calendrier, le vrai loader. Les fonctions PostgreSQL ont été lues dans leur état actif en transaction READ ONLY.

| Couche | Résultat | Portée |
|---|---|---|
| Baseline backend | 8 suites, 80 tests verts | État initial du module sur la base choisie. |
| Backend après corrections | 10 suites, 135 tests verts | Module diagnostic et shadow, puis 11 tests d’actions verts après le dernier correctif de destination générique. Soit 136 cas distincts couverts par les exécutions réutilisables. |
| Frontend après corrections | 3 fichiers, 18 tests verts | Puis fichier calendrier/navigation élargi : 6/6 verts ; les deux autres fichiers inchangés restent à 5 et 10. Soit 21 cas distincts. |
| Typage backend | Succès | `tsc --noEmit --incremental false` sur le projet complet. Dernière modification ultérieure : destination littérale et test d’action, validés par ts-jest et ESLint. |
| Typage frontend | Succès | Génération React Router puis typage complet, recontrôlé après le dernier changement du calendrier. |
| ESLint | Succès ciblé backend et frontend | Dix fichiers frontend contrôlés ; pas de lint exhaustif du dépôt. |
| SQL | 3 définitions actives, 50 familles, 4 cas de durée lus/vérifiés | Aucune migration exécutée. |
| Navigateur, API live, CI, PREPROD, PROD | Non exécutés | Aucune équivalence avec les tests unitaires/rendus. |

Les tests ont observé les régressions avant correction : 31 échecs dans un premier groupe de 53 cas (intégrité, actions et shadow), 9 cas du moteur d’entretien, 3 cas de soumission formulaire, 10 cas de liens des résultats, 3 cas de navigation ancienne, 6 erreurs de lecture, puis les cas additionnels de calendrier et de destination générique. Les jeux ont été affinés pendant l’implémentation ; ces comptes rouges ne sont pas un second total de couverture.

Une première invocation Jest utilisait par erreur une option de filtrage non reconnue par Jest 29 ; l’exécution large a été interrompue et n’est pas comptée comme validation. Les commandes réutilisables utilisent bien `--testPathPattern` au singulier. Les avertissements Vite existants (`vite-tsconfig-paths`, `envFile`) ne sont pas masqués et n’ont pas bloqué les contrôles.

### SQL : portée exacte du candidat séparé

`fix-elapsed-months.candidate.sql` n’est pas placé dans les migrations automatiques. Il conserve signature, propriétés et corps de la fonction active, en remplaçant exactement deux extractions par `12 × années + mois`. Un contrôle d’empreinte bloque son application si la définition a dérivé. `restore-elapsed-months.reference.sql` conserve la définition lue.

Les quatre exemples SQL donnent respectivement 30, 12, 6 et 24 mois au lieu de 6, 0, 6 et 0. Cela prouve la correction de la perte des années, pas la recette complète de la RPC. Pour les statuts aux fins de mois, il reste nécessaire de décider et tester la comparaison directe de la date d’échéance ; la convention `AGE` et un anniversaire ajusté en fin de mois ne sont pas interchangeables. Le moteur TypeScript corrigé compare déjà les dates d’échéance.

Source de la sémantique de `EXTRACT` et `AGE` : [documentation PostgreSQL 17](https://www.postgresql.org/docs/17/functions-datetime.html). Les résultats bruts de cette mission sont dans `sql-evidence.json`.

## Manifest de couverture et verdict de livraison

- **Cible :** worktree DEV créé depuis la révision auditée. L’arbre Windows et le checkout principal DEV préexistants n’ont pas reçu les corrections. Le checkout principal a avancé pendant le travail vers `38ce54f019ea43799a2c54172f406a172c4a1318` (deux changements de profil utilisateur et registres) : aucun fichier corrigé ici, aucune dépendance ni configuration de validation n’est concerné. Le candidat reste ancré sur la révision auditée ; cette avance n’est pas présentée comme un rebasage.
- **Inventaire :** `coverage-manifest.json` liste les fichiers du périmètre et les fichiers livrés avec leurs empreintes. Inventorier un module ne signifie pas avoir lu ou testé toutes ses lignes.
- **Analyse :** 28 constats retracés ; inspection ciblée des contrats, orchestration, calculs, actions, résultats, navigation, SQL et persistance. Aucune déclaration d’audit exhaustif de tout le monorepo.
- **Correction proposée :** code du worktree et patch récupérable ; SQL séparé à promouvoir seulement après validation intégrale.
- **Validation :** classes et composants réels sous tests, compilations, lint ciblé, lecture SQL. Pas de session client avec les dépendances réelles.
- **Inconnues :** règles constructeur/applicabilité, correspondances KG, droits de reprise, activation des chemins en production, exactitude fonctionnelle de toutes les autres destinations d’action.
- **Exclusions :** aucune modification d’infrastructure, dépendance, variable d’environnement, base active, migration appliquée, déploiement, push ou fusion.
- **Verdict :** candidat DEV vérifié pour le lot de corrections ciblées ; les deux parcours complets et une mise en production restent non validés.

## Suite concrète recommandée

1. **Fermer le parcours entretien sur l’existant.** Définir un historique d’intervention par opération (réalisée/contrôlée/inconnue, date, compteur, source), le saisir dans l’assistant, résoudre l’applicabilité et alimenter un calcul unique. Un entretien global ne peut pas valider chaque opération. Le calendrier smart ne doit pas être présenté comme personnalisé tant que son historique est ignoré.
2. **Relier les faits de panne au calcul.** Réutiliser les questions et vérifications existantes après validation. Modéliser présent, absent, inconnu et non testé ; rendre observable l’effet de chaque fait sur une cause et sur la sécurité. Ne pas ajouter un formulaire dont les réponses seraient ignorées.
3. **Résoudre les identités KG avant comparaison utile.** Correspondances explicites entre slugs déterministes, UUID d’observables/faute et identité véhicule ; preuve sur une collection de cas avant toute promotion du graphe au résultat principal.
4. **Préparer la reprise avec son contrôle d’accès.** Conserver entrées structurées, versions de règles, révision et résultats de contrôle ; distinguer nouvelle analyse et mise à jour d’une analyse existante.
5. **Recette réelle du candidat.** API puis navigateur : erreurs de dépendances, mobile, absence de profil, valeurs zéro, entretien propre à chaque opération, alerte bloquante, liens et reprise. CI/PREPROD doivent porter la même révision ; PROD demeure une intervention manuelle de Marwane.

Ces étapes sont des travaux ouverts, pas des résultats de cette mission.
