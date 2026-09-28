# Lot entretien autonome — conception et exécution

Cible : worktree DEV codex/diagnostic-integrity-20260926. Autorisation : vérifier le rapport, corriger le code, puis continuer. Aucun déploiement, écriture DB, commit ou publication.

## Décision
Le parcours existant propose « Comprendre un symptôme » ou « Vérifier mon entretien ». Il conserve ses trois étapes : véhicule, symptômes ou opérations, résultat. Une opération sélectionnée constitue une entrée d'historique ; date et compteur restent facultatifs et distincts pour chacune. Le serveur accepte les trois intentions préventives sans système ni signal et rejette un mélange avec un symptôme. Il réutilise MaintenanceIntelligenceEngine et sa formule calendaire/kilométrique.

Source de ce parcours : __diag_maintenance_operation, déjà utilisée par le moteur. Lecture DB du 27/09 : 30 opérations actives et table de liens présentes. Le commentaire historique « tables ghost » n'est pas conforme à cet état. Le calendrier KG distinct contient 19 intervalles : pas de rapprochement implicite des alias ni de réécriture de sa RPC. La divergence des sources demeure une limite explicite du rapport.

Le résultat est une estimation générique pour les opérations choisies, avec historique fourni, échéances estimées et informations manquantes. Il ne prouve ni applicabilité constructeur ni usure réelle. Aucun scoring de panne, niveau de risque, achat conseillé ou session sauvegardée artificiellement. Les erreurs de source ne produisent pas une liste vide rassurante.

## Vérification
- [x] Contrat : entretien sans symptôme, sélection obligatoire, doublons/dates/compteurs invalides rejetés.
- [x] Moteur : mêmes calculs pour les deux entrées ; opération inconnue/inactive et panne source explicites ; aucune chaîne diagnostic invoquée.
- [x] Interface : choix du parcours, historique par opération, conservation de zéro et valeurs inconnues, brouillon, erreur/reprise, résultat spécifique entretien.
- [x] Tests ciblés backend/frontend, types, lint et diff ; anciennes preuves réutilisées si périmètre inchangé.
- [x] Rapport, checkpoint et patch cumulé vérifié, sans modifier le premier livrable.
