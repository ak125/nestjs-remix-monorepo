# Diagnostic — couverture des causes et réponses non interprétées

Neuvième lot, 28 septembre 2026. **VALIDATED_FOR_SCOPE_ONLY** ; audit initial **PARTIAL_COVERAGE**.
Autorisation : vérifier le rapport, corriger le code, continuer les corrections et améliorations. Cible : worktree DEV existant, compte deploy.

## Scan

Reprise du candidat `123e4025248ba61bf64dde2a85435bb384d4597d`. Les 51 empreintes code/tests concordent au démarrage. Les règles déjà lues sont vérifiées identiques ; la cartographie et le contexte récent sont consultés. Les lectures du présent lot et les exclusions figurent dans coverage-manifest.json.

Périmètre : jointure des causes actives, couverture des références du snapshot, traitement des réponses API et restitution des limites. Une mission déléguée en lecture seule, limitée à six fichiers, trace le questionnaire ; aucun accès DB ni sous-délégation.

## Analyse

**Couverture des références.** Le snapshot du lot 6 contient 13 systèmes, 62 symptômes, 58 causes, 162 liens et 21 règles. Le contrôle reproductible ne trouve aucun lien orphelin, aucune association entre systèmes différents, aucun doublon d'identifiant ou de paire symptôme/cause, ni symptôme/cause sans lien. Chaque référence de système se résout. Cela décrit le snapshot des références actives, pas l'état actuel de la base vivante ni sa calibration mécanique.

La climatisation possède quatre symptômes et cinq causes, mais aucune règle de sécurité. Les quatre refus connus restent justifiés par la couverture absente ; ce lot n'invente pas de règles pour les supprimer.

**Défaut de jointure confirmé.** Le service charge les liens actifs, filtre les causes par activité et système, puis utilisait `filter(causeMap.has(...))`. Une cause absente de la réponse était silencieusement retirée. Si d'autres causes subsistaient, la chaîne pouvait produire un succès avec un ensemble incomplet d'hypothèses.

Le rejeu HTTP avant correction le démontre en retirant de la réponse simulée la cause critique `courroie_distribution_usee`, liée au symptôme `bruit_claquement_moteur`. Trois variantes — ligne manquante, inactive, mauvais système — donnent chacune `success: true`, un dossier, et une tentative de sauvegarde simulée. Ces anomalies sont injectées pour tester le code ; elles ne sont pas observées dans le snapshot intact.

**Questionnaire non raccordé au calcul.** Les types DB déclarent __diag_context_questions et le RPC get_context_questions. Le contenu des options, le format de dcq_weight_modifier et la définition SQL du RPC ne sont pas établis par cette lecture. Le wizard actuel n'affiche pas ces questions et n'envoie pas answers. L'API accepte néanmoins un dictionnaire de réponses, que l'orchestrateur transmet à la sauvegarde sans l'utiliser pour les hypothèses ou le risque. Le context_score du classement mesure les preuves des liens, pas les réponses utilisateur. Aucun mapping ou poids ne peut être déduit de ces seuls types.

## Correction proposée puis appliquée

L'autorisation explicite couvre les changements suivants, dans trois fichiers de production et deux fichiers de tests :

1. Chaque lien actif doit retrouver sa cause valide. Si une seule cause manque, le service lève l'erreur de couverture ; l'orchestrateur utilise son refus d'indisponibilité existant. Il ne retourne pas un diagnostic partiel et ne tente pas de l'enregistrer.
2. Quand answers contient au moins une entrée, le dossier inclut : « Réponses complémentaires non interprétées : elles ne modifient ni les hypothèses ni le niveau de risque de cette analyse. » Un avertissement technique constant est journalisé, sans contenu des réponses. Les réponses restent transmises à la sauvegarde selon le contrat existant.
3. La restitution du diagnostic présente ce bloc comme « Limites et informations manquantes ». Elle ne promet plus que chaque élément listé permettrait automatiquement d'affiner le calcul.

Ce lot corrige l'absence de transparence sur les réponses ; il ne met pas en service un questionnaire ni une pondération mécanique. Les scores, seuils, décisions de sécurité, données et configurations restent inchangés.

## Validation

| Preuve | Résultat |
|---|---|
| Tests backend avant correction | 4 échecs / 81 succès sur 85 |
| Tests frontend ciblés avant correction | 2 échecs / 2 succès |
| Régression backend | **362 tests / 16 suites réussis** |
| Régression frontend fraîche | **84 tests / 8 fichiers réussis** |
| Types complets backend et frontend | Réussis |
| Lint des cinq fichiers | Réussi, zéro avertissement |
| Snapshot intact | 316 références acceptées ; 58 dossiers HTTP réussis conformes au schéma actuel ; quatre refus climatisation |
| Comparaison du rejeu intact avant/après | Mêmes succès/refus, risques, alertes, modes catalogue et hypothèses critiques comparées |
| Trois injections de défaut de cause | Toutes refusées après correction, aucun dossier et aucune tentative de sauvegarde |
| Réponse complémentaire via HTTP | Limite visible, dossier conforme, alerte critique et catalogue fermé conservés |

Sept cas backend sont ajoutés : perte partielle ou totale de causes, jointure complète réordonnée avec score nul et urgence critique, deux réponses fournies, deux cas sans réponse. Deux cas frontend existants sont renforcés pour vérifier la visibilité de la limite et de l'alerte ensemble. Les suites passent sans modification des tests pour masquer un défaut produit.

Le test initial des seuls liens (2 échecs / 79 succès) et le test rouge combiné sont conservés séparément. La preuve HTTP comprend 62 analyses du snapshot, trois injections de défaut et une analyse avec réponse complémentaire. Le serveur Nest écoute uniquement sur 127.0.0.1, port éphémère, et est fermé dans finally. Les filtres PostgREST sont reproduits sur le snapshot ; les sauvegardes sont neutralisées. Aucune requête ni écriture vers une base vivante.

## Limites et points ouverts

Ce lot ne prouve pas une intégration DB vivante, une contrainte SQL, une lecture transactionnelle cohérente entre plusieurs requêtes, la persistance effective, le cookie véhicule, la couche d'intention optionnelle, le démarrage de l'application entière, la CI ou un déploiement. Les composants React sont testés sous jsdom ; aucune nouvelle preuve navigateur n'est revendiquée.

La collecte des questions, la validation question/option et l'effet des réponses restent à construire à partir d'un contrat source vérifié. Le champ signal_input.context n'est pas exploité par les moteurs examinés ; ce lot porte sur answers et ne prétend pas avoir traité tous les champs inutilisés. La couverture de sécurité climatisation, la calibration mécanique, les identités/OEM, DTC, feedback après réparation et reprise de session serveur restent ouverts.

L'absence d'orphelins est établie pour le snapshot uniquement. La protection runtime rejette désormais une cause référencée mais absente ; elle ne constitue pas un audit permanent de la base.

## Verdict et livraison

Les deux défauts reproduits sont corrigés sur le périmètre testé : une couverture partielle ne devient plus un succès, et les réponses acceptées sans effet calculé sont signalées dans le résultat. L'audit global reste partiel.

Travail non commité dans `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`, branche `codex/diagnostic-integrity-20260926`, base `4a2871dc4d19067c3ae077d6a79021b49cc60237`. Patch cumulé neuf lots et patch `coverage-only.patch`, à bases exclusives, vérifiés avec un index temporaire ; index réel conservé. Détails dans patch-verification.json. Aucun commit, push, PR, migration, modification de service ou déploiement.

Prochaine action : établir la définition source et le format des options/modificateurs de questions avant leur raccordement ; poursuivre séparément l'audit des autres entrées acceptées sans effet et de la reprise serveur.
