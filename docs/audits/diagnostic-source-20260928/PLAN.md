# Lot 6 — intégrité des références avant calcul du risque

Autorisation : vérifier le rapport, corriger le code et poursuivre les améliorations. Cible : worktree DEV existant ; précédent arbre b0c2559089250217b1de80b7549b2cd72d2030ac, base 4a2871dc4d19067c3ae077d6a79021b49cc60237. Les 45 empreintes code/tests précédentes sont identiques.

Défaut : données Supabase interprétées sans validation runtime. Une urgence critique inconnue du moteur tombe dans le repli moyenne. Deux causes et un symptôme critiques observés en lecture seule. La migration permet plusieurs champs nuls ; le typage TypeScript ne protège pas le runtime.

1. Tests rouges traversant le vrai service de données, l'interprétation, le scoring, le risque et le catalogue ; seule la frontière PostgREST et les enrichissements facultatifs sont simulés.
2. Contrôler les lignes, tableaux, identités, appartenances et champs de risque selon les contrats existants. Réutiliser l'enum d'urgence ; refuser une urgence non interprétable, sans conversion inventée. Conserver la catégorie de cause ouverte, les champs facultatifs et les métadonnées consommées.
3. Retourner l'erreur d'indisponibilité existante au lieu d'un dossier calculé à partir de références invalides. Préserver score zéro, tableau réellement vide et réponse de ligne absente.
4. Régression backend ciblée, types complets, lint et rejeu du snapshot de références ; rapport et livrable cumulatif avec index réel intact.

Exclusions : aucun changement de poids, règle mécanique, table, données, migration, auth, prix/stock, SEO ou déploiement. Pas d'activation de questions, DTC ou retour de réparation sans contrat. Le rapprochement entre causes filtrées et liens orphelins reste hors de ce lot.
