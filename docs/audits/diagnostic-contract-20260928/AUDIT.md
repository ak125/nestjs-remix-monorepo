# Diagnostic — cohérence des familles de causes, 28 septembre 2026

Huitième lot : **VALIDATED_FOR_SCOPE_ONLY**. Audit initial : **PARTIAL_COVERAGE**.
Autorisation : vérifier le rapport, corriger le code, continuer les corrections et améliorations. Cible : worktree DEV existant, compte deploy ; aucune intervention DB ou service.

## Scan

Reprise du candidat du lot 7 `30aeb354507c57f54edc3b13142abb88ec6c66bc`. Les 51 empreintes code/tests concordent au début du lot. Les règles du dépôt, le registre filtré, la carte du dépôt et le contexte récent sont revérifiés. Le manifeste énumère les lectures et leurs limites.

Périmètre : schémas de références et de sortie, classement, assemblage et consommateurs des familles de causes. Une vérification déléguée, courte et en lecture seule, examine six fichiers consommateurs ; aucune sous-délégation, aucun accès DB. Le snapshot immuable du lot 6 est réutilisé.

## Analyse

La formulation précédente « 40 familles sur 58 » était imprécise : il s'agit de **40 causes sur 58**, réparties dans **sept familles supplémentaires**. Le snapshot contient : wear 23, mechanical 11, electrical 2, hydraulic 1, corrosion 1, blockage 1, leak 1. Les 18 autres causes utilisent component_fault 9, maintenance_related 7 et wear_related 2. La quatrième ancienne valeur, contextual_factor, reste supportée pour compatibilité.

Le schéma EvidencePack ne connaissait que les quatre catégories du MVP. Le validateur de références acceptait toute chaîne non vide ; le classement la transmettait et l'orchestrateur utilisait `as any`. L'incompatibilité passait donc les contrôles de compilation et le contrôleur annonçait un succès.

Le rejeu du vrai contrôleur Nest sur le snapshot produit 58 réponses réussies sur 62 symptômes. Avant correction, **18 seulement satisfont EvidencePackSchema ; 40 échouent exclusivement sur candidate_hypotheses[*].cause_type**. Ce nombre de réponses n'est pas la même mesure que le nombre de causes, même si les deux valent ici 40.

La provenance des sept catégories a été établie dans la migration 20260321 lors du lot 7. Les consommateurs examinés n'ont aucune décision fondée sur la liste de quatre catégories : le risque utilise urgence/règles/score, le catalogue les identifiants et scores, l'entretien les opérations, le RAG les libellés. Le frontend conserve cause_type comme chaîne et ne l'utilise pas pour une décision. Rien dans ce périmètre ne justifie de convertir les catégories en *_related.

## Correction proposée puis appliquée

L'autorisation explicite couvre cette correction. Quatre fichiers de production et un fichier de tests sont modifiés :

1. L'enum existant CauseTypeEnum conserve ses quatre valeurs et ajoute les sept valeurs exactes déjà produites. Aucune catégorie n'est renommée ni fusionnée.
2. Le schéma de référence réutilise ce même enum. Une catégorie inconnue est refusée par la voie d'indisponibilité existante, avant l'évaluation du risque et la sauvegarde.
3. Le classement expose le type CauseType et valide aussi la catégorie en appel direct : un appel contournant le service de données ne peut pas réintroduire une valeur arbitraire.
4. L'assemblage n'a plus besoin du cast `any` sur cause_type.
5. Le test positif existant est étendu aux onze catégories ; des cas négatifs couvrent les valeurs inconnues, mal formées et l'appel direct.

Les poids, seuils, alertes, règles de sécurité, identifiants, données et interface sont inchangés. Une future nouvelle catégorie nécessitera une extension explicite du contrat : aucun repli silencieux vers une catégorie générique n'est ajouté.

## Validation

| Preuve | Résultat |
|---|---|
| Suite ciblée avant correction | 13 échecs / 65 succès sur 78 tests |
| Suite ciblée après correction | 78/78 réussis |
| Régression backend | **355 tests / 16 suites réussis** |
| Types backend complets | Réussis |
| Lint des cinq fichiers, zéro avertissement exigé | Réussi |
| Rejeu HTTP avant → après | **18 → 58 sorties réussies conformes au schéma**, zéro échec de schéma après correction |
| Références du snapshot | 316/316 acceptées |
| Résultats métier comparés avant/après | Identiques pour succès/refus, statut HTTP, risque, alerte, mode catalogue et identifiants des hypothèses critiques |
| Cinq cibles critiques | Alertes et catalogue fermé conservés |

Il y a **20 cas supplémentaires nets** : un test existant devient onze cas et dix cas négatifs sont ajoutés. Une erreur initiale dans la valeur de score attendue du test a été corrigée avant la preuve rouge retenue (75, et non 77 : le bonus de contexte vaut 7 avec un seul argument). Le journal initial est conservé séparément ; ces quatre échecs de montage ne sont pas comptés comme défauts produit.

Chaque catégorie est conservée à l'identique dans le dossier retourné et celui remis à la sauvegarde simulée. Les tests vérifient aussi que le score de cette fixture reste 75 et que les extensions de sortie urgency_timeline et scoring_breakdown sont conservées. La validation du schéma est une assertion ; le dossier n'est pas remplacé par une projection qui supprimerait ses champs supplémentaires.

Les **84 tests frontend du lot 7 sont une preuve antérieure réutilisée**, pas une nouvelle exécution. Aucun fichier frontend, dépendance ou configuration pertinente n'a changé. Le présent lot ne revendique aucune nouvelle preuve navigateur.

## Limites et points ouverts

Le serveur HTTP est lancé sur un port éphémère de 127.0.0.1 et fermé dans finally. Le contrôleur, le service de données et les moteurs principaux sont réels ; PostgREST est simulé avec les filtres du snapshot. Les enrichissements et la sauvegarde sont neutralisés. Zéro requête vers une base vivante, zéro écriture DB. Le rejeu ne valide pas le démarrage de l'application entière, le cookie véhicule, la couche d'intention optionnelle, la persistance, la CI ni PREPROD/PROD.

Les quatre refus de climatisation persistent : clim_pas_de_froid, bruit_compresseur_clim, odeur_clim, chauffage_defaillant. Aucune règle de sécurité n'est inventée pour les rendre verts.

Le dossier complet est vérifié **contre le schéma actuel** dans ces tests et ce rejeu. Ce schéma reste volontairement permissif pour ui_block_inputs et maintenance_recommendations ; cela ne certifie pas la justesse mécanique de leur contenu. Aucun validateur global de sortie n'est ajouté au runtime dans ce lot ; les catégories sont contrôlées aux frontières références et classement. Restent ouverts : calibration métier, couverture climatisation, liens orphelins, questions/réponses, DTC, mappings d'identité/OEM, feedback après réparation et reprise de session serveur.

## Verdict et livraison

L'écart de familles de causes du périmètre testé est corrigé : onze catégories supportées par un contrat commun, valeurs conservées, inconnues refusées, 58 dossiers HTTP réussis conformes au schéma actuel. Cela ne clôt pas les 28 constats initiaux.

Travail non commité dans `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`, branche `codex/diagnostic-integrity-20260926`, base `4a2871dc4d19067c3ae077d6a79021b49cc60237`. Patch cumulé huit lots et patch `contract-only.patch`, à bases exclusives, vérifiés avec un index temporaire. Détails des arbres, SHA et contrôles dans patch-verification.json. Aucun commit, push, PR, migration ou déploiement.

Prochaine action utile : vérifier les liens orphelins et la couverture des références, puis l'effet réel des réponses au questionnaire. Une règle métier absente doit rester signalée tant qu'elle n'est pas étayée par une source validée.
