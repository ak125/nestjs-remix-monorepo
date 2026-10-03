# Checkpoint — septième lot, 28 septembre 2026

Objectif : vérifier le rapport initial et corriger les défauts confirmés. Autorisation de poursuivre explicite. Audit PARTIAL_COVERAGE ; lot VALIDATED_FOR_SCOPE_ONLY.

Cible : ssh dev-automecanik, compte deploy, `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`, branche `codex/diagnostic-integrity-20260926`. Base `4a2871dc4d19067c3ae077d6a79021b49cc60237`, précédent candidat `753a62a0387c2818f1f727b45b40b91f60067daf`, nouveau dans patch-verification.json. Ne pas éditer le checkout Windows.

Lot 7 : 9 fichiers production + 2 tests. Urgence critique conservée selon la consigne immédiate déjà codée ; inconnue refusée même en appel direct. Symptômes critiques sélectionnés transmis au risque ; alerte, action immédiate et catalogue fermé. Sélection UI et badge compatibles ; alerte visible sans drapeaux. Poids et seuils existants inchangés ; pas de mapping vers KG.

Preuves : 17 nouveaux cas, dont 12 rouges avant correction. 335 tests backend/16 suites et 84 frontend/8 fichiers verts. Types complets et lint final verts. Après les tests, seuls des imports de type frontend ont changé ; types et lint revérifiés.

Rejeu snapshot lot 6 : 316 références acceptées. Vrai contrôleur Nest en HTTP loopback avec PostgREST simulé : 62 symptômes, 58 succès, 4 refus climatisation sans règles de sécurité. Les cinq cas critiques filtration/distribution retournent alerte et catalogue fermé. Serveur fermé ; zéro écriture DB. Pas de preuve base vivante, navigateur nouveau, cookie véhicule, intention, persistance, CI ou PREPROD/PROD.

Limites : 40/58 familles de causes hors enum de sortie, conformité complète EvidencePack non prouvée, calibration mécanique, couverture climatisation, questions/DTC/mappings/OEM/feedback/rejeu serveur ouverts. Le wiki safety-config concerne un autre parcours ; le golden contient des validations TBD.

Livrable : rapport, manifeste, logs, snapshot/rejeu HTTP, patch cumulé sept lots et patch urgence seul à bases exclusives, ZIP/empreintes. Index intact ; aucun commit/push/PR/migration/déploiement. Ne pas réappliquer sur le worktree déjà modifié.

Prochaine action : aligner les familles de causes sur le contrat réellement produit, puis valider le dossier complet. Relire les règles, vérifier HEAD/status ; réutiliser uniquement les preuves dont les fichiers et dépendances sont inchangés.
