# Checkpoint — sixième lot, 28 septembre 2026

Objectif autorisé : vérifier le rapport initial et corriger le code. Six lots conservés. Lot VALIDATED_FOR_SCOPE_ONLY ; audit global PARTIAL_COVERAGE.

Cible : `ssh dev-automecanik`, compte deploy, `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`, branche `codex/diagnostic-integrity-20260926`. Base `4a2871dc4d19067c3ae077d6a79021b49cc60237`. Candidat précédent `b0c2559089250217b1de80b7549b2cd72d2030ac` ; nouveau dans patch-verification.json. Ne pas éditer le checkout Windows.

Lot 6 : quatre fichiers backend, schémas des références avant calcul de sécurité, contrôles d'identité/appartenance/doublons/valeurs, erreur si catalogue alternatif indisponible. Métadonnées, zéro et listes réellement vides préservés. Aucun changement des poids ou règles mécaniques.

Preuves : 45 nouveaux tests (38 rouges avant correction), 322 tests backend / 16 suites verts après formatage, types complets et lint verts. Snapshot SQL en lecture seule : 316 références, rejeu hors ligne 313 acceptées / 3 rejetées sur urgence. Aucun HTTP connecté, CI ou déploiement. Frontend inchangé : 80 tests et preuve navigateur du lot 5 restent historiques, empreintes conservées.

Limite concrète : urgence `critique` sur `voyant_huile`, `courroie_distribution_usee`, `filtre_huile_colmate` ; le moteur ne connaît que haute/moyenne/basse. Le candidat refuse tout catalogue filtration et les analyses distribution chargeant la cause critique. Pas de conversion inventée ni modification DB. 40/58 familles de causes hors enum de sortie ; contrat ouvert du service conservé. Liens orphelins et validité mécanique non prouvés.

Retour après réparation : recherche bornée, clic handoff bien nommé ; aucune boucle de confirmation trouvée dans six fichiers. B03/D06 restent ouverts, comme questions/DTC/mappings/OEM/rejeu serveur.

Livrable : rapport, manifeste, logs, requêtes/snapshot/rejeu, patch cumulatif six lots et patch source seul à bases exclusives, empreintes et ZIP. Index réel intact. Aucun commit/push/PR/configuration/migration/PROD. Ne pas réappliquer les patchs dans le worktree déjà modifié.

Prochaine action : établir le contrat vérifiable des urgences critiques, puis preuve HTTP connectée à l'intégration. Relire les règles et vérifier HEAD/status ; reprendre uniquement les validations affectées.
