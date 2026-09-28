# Lot autorisé — cohérence des sélections et reprise du wizard

Cible : worktree DEV existant, branche codex/diagnostic-integrity-20260926. Base 4a2871dc4d19067c3ae077d6a79021b49cc60237 ; candidat précédent c50a4f9d1bf725abb3311363028892ca3598e0e8. Les 41 empreintes antérieures sont identiques.

1. Reproduire les réponses tardives des symptômes/modèles, la suppression prématurée du brouillon et le saut d’étape par double clic.
2. Limiter les réponses à la sélection courante avec annulation native pour fetch et compteur de requête pour l’API véhicule existante.
3. Valider les catalogues chargés, conditionner l’analyse à une sélection reconnue et conserver les saisies pendant l’envoi/échec.
4. Valider la structure et la durée de vie du brouillon local, préserver les zéros et les brouillons existants valides, éviter l’écrasement au montage.
5. Tester les vrais composants/hooks, puis régression frontend ciblée, types complets et lint ; assembler rapport, manifeste, patchs et checkpoint.

Limites : aucun nouveau moteur, mapping d’identité, poids de réponses, parcours DTC, persistance serveur, auth, SEO ou déploiement. Aucun accès DB nécessaire. Les questions et DTC restent ouverts faute de contrat d’effet/raccordement vérifié. Ce lot porte sur la fiabilité du parcours existant, pas sur l’activation du raisonnement manquant.
