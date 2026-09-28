# Checkpoint — huitième lot, 28 septembre 2026

Objectif : vérifier le rapport initial et corriger les défauts confirmés. Autorisation explicite de continuer. Lot VALIDATED_FOR_SCOPE_ONLY ; audit PARTIAL_COVERAGE.

Cible : ssh dev-automecanik, compte deploy, `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`, branche `codex/diagnostic-integrity-20260926`. Base `4a2871dc4d19067c3ae077d6a79021b49cc60237`, précédent candidat `30aeb354507c57f54edc3b13142abb88ec6c66bc`. Nouveau candidat dans patch-verification.json. Checkout Windows non modifié.

Lot 8 : quatre fichiers production + un test. CauseTypeEnum étendu aux sept catégories déjà produites ; schéma de références partagé ; classement typé et validation en appel direct ; cast any retiré de l'assemblage. Aucune normalisation supposée. 40 causes sur 58 étaient hors enum, pas 40 familles distinctes.

Preuves : 20 cas supplémentaires nets, 13 échecs produit avant correction. 355 tests backend/16 suites, types complets et lint verts. 84 tests frontend du lot 7 réutilisés car frontend/configuration/dépendances inchangés. Rejeu HTTP du contrôleur + données simulées : 18 → 58 dossiers réussis conformes au schéma actuel, 316 références acceptées ; résultats métier comparés inchangés. Cinq cibles critiques conservées, quatre refus climatisation inchangés. Serveur arrêté, aucune écriture DB.

Limites : snapshot figé, PostgREST et sauvegarde simulés ; pas d'intégration DB vivante, nouveau navigateur, couche intention, cookie véhicule, persistance, CI ou déploiement. Schéma actuel permissif pour certains blocs ; pas de validateur global de sortie ajouté au runtime. Calibration, couverture climatisation, orphelins, questions/DTC/mappings/OEM/feedback/reprise serveur restent ouverts.

Livrable : rapport, manifeste, journaux, snapshot/rejeu, patchs cumulé et incrémental, archive/empreintes. Index réel conservé. Aucun commit/push/PR/migration/déploiement. Ne pas réappliquer les patchs sur le worktree déjà modifié.

Prochaine action : vérifier les liens orphelins et la couverture des références, puis les effets des réponses. Relire les règles et vérifier les empreintes avant reprise ; réutiliser seulement les preuves dont le périmètre pertinent n'a pas changé.
