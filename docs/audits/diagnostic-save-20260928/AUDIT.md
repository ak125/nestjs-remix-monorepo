# Confirmation de sauvegarde diagnostic — lot 12

## Scan

Périmètre : réponse d’insertion de session, propagation du lien de reprise et message utilisateur lorsque la confirmation manque. Worktree DEV existant, branche `codex/diagnostic-integrity-20260926`, base `4a2871dc4d19067c3ae077d6a79021b49cc60237`. Les 53 empreintes code/tests du lot 11 et six règles ont été vérifiées avant intervention. Aucun travail sur la base partagée ou l’infrastructure.

## Analyse

`DiagnosticEngineDataService.saveSession` renvoyait `data?.id || null` : une chaîne non UUID, un nombre ou un objet pouvait ainsi devenir l’identifiant d’une analyse réussie. Pourtant, les lecteurs de session backend et frontend exigent un UUID. La reproduction avec `not-a-uuid` renvoyait cet identifiant au lieu de retirer le lien.

L’orchestrateur annonçait « Analyse non sauvegardée » dès qu’il ne recevait pas d’identifiant. Une réponse perdue après insertion ne prouve pas l’absence d’une ligne. Un test simule explicitement une insertion suivie de la perte de son accusé de réception ; il vérifie le message, la préservation de l’alerte critique et l’absence de seconde insertion.

## Correction autorisée

L’autorisation utilisateur de vérifier le rapport et corriger le code, puis de continuer, couvre ce lot en DEV. Deux fichiers de production changent : validation Zod de l’UUID retourné par le service de données, et message « Sauvegarde non confirmée — le lien de reprise est indisponible. » dans l’orchestrateur. Une réponse invalide est journalisée sans son contenu. Une erreur de stockage prime toujours sur un identifiant retourné. Les UUID valides, y compris en majuscules, sont conservés.

L’analyse et l’alerte critique restent disponibles lorsque la confirmation manque. Aucune relance automatique de l’insertion n’est ajoutée, pour éviter de créer une seconde session après une réponse perdue. Aucun schéma de base, règle métier, calcul de risque, route ou composant frontend n’est modifié.

## Validation

- Avant correction : **10 échecs / 100 succès** dans la suite ciblée ; les échecs montrent les identifiants invalides publiés et l’affirmation incorrecte de non-sauvegarde.
- Après correction : **401 tests réussis / 17 suites**, dont 12 nouveaux cas. Ils traversent l’orchestrateur, les moteurs et le service de données réels ; seule la frontière PostgREST est simulée.
- Vérification complète des types backend et lint des trois fichiers modifiés : succès. Les erreurs applicatives imprimées dans la suite sont celles des injections de panne attendues ; aucun test n’échoue.
- Les 50 fichiers de code/tests hors delta sont contrôlés par empreinte. Les 96 tests frontend / 9 fichiers du lot 10 sont réutilisés sur le frontend inchangé, sans nouvelle exécution.
- La lecture réelle des 185 sessions, le navigateur Edge et le rejeu HTTP de 62 symptômes restent des preuves historiques du lot 11, avec leurs limites initiales. Ils ne sont pas présentés comme une nouvelle validation de la sauvegarde corrigée. Aucune nouvelle lecture ni écriture de base réelle n’a été exécutée.
- La livraison contrôle la reconstruction du même arbre par les patchs cumulatif et incrémental, conserve l’index réel et teste l’application structurelle au main observé. Les résultats figurent dans `patch-verification.json` ; ils ne valent pas CI.

## Verdict et suite

**VALIDATED_FOR_SCOPE_ONLY** pour la confirmation de sauvegarde ; **PARTIAL_COVERAGE** pour l’audit global. Aucun commit, push, PR ni déploiement.

Restent à prouver : insertion/relecture dans une base explicitement isolée, navigateur sur la chaîne applicative complète, CI du candidat publié. Le test de réponse perdue est simulé : il vérifie le comportement applicatif, pas les garanties transactionnelles du serveur réel. Un accusé de réception avec UUID valide ne garantit pas à lui seul une relecture ultérieure ; cette limite d’intégration reste ouverte. Les règles d’interprétation du contexte et des réparations, leur conservation pour le rejeu et les autres sujets du rapport initial restent hors de ce lot.
