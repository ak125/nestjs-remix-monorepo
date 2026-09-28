# Checkpoint — 28 septembre 2026

Objectif : vérifier le rapport initial et corriger les défauts confirmés. Cinq lots préservés ; audit global PARTIAL_COVERAGE, lot VALIDATED_FOR_SCOPE_ONLY.

Cible : `ssh dev-automecanik`, compte deploy, `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`, branche `codex/diagnostic-integrity-20260926`. Base `4a2871dc4d19067c3ae077d6a79021b49cc60237`. Ancien candidat `c50a4f9d1bf725abb3311363028892ca3598e0e8` ; nouveau dans patch-verification.json. Ne pas éditer le checkout Windows.

Lot 5 : six fichiers frontend. Anciennes réponses modèles/symptômes ignorées ; catalogues validés ; analyse bloquée jusqu'à validation de la sélection ; brouillon conservé pendant attente/échec et restauré sans écrasement ; structure/version/TTL vérifiés ; double clic Suivant protégé.

Preuves réutilisables : 35 nouveaux cas (30 rouges initialement), 80 tests frontend / 7 fichiers verts, types frontend complets verts, lint 0 erreur/avertissement. Navigateur avec vrais composants/API simulée : erreur puis rechargement, sélection restaurée ; changement rapide de système. Aucun mobile, HTTP réel, CI ou déploiement. Backend inchangé ; 277 tests du lot MCP restent historiques. Manifestes et empreintes établissent la conservation des autres changements.

Questions : table déclarée dans les types, réponses stockées, aucun contrat vérifié pour leur effet mécanique. B01/B02 et DTC restent ouverts. D05 réparé pour brouillon local seulement ; dossier serveur/rejeu non traité. Ne pas inventer de mappings ou de poids.

Livrable : rapport, manifeste, logs, captures, patch cumulé cinq lots et patch wizard seul à bases exclusives, SHA256, ZIP. Ne pas réappliquer sur le worktree déjà modifié. Index intact ; aucune publication, migration ou action PROD. Serveur temporaire arrêté et onglet fermé.

Prochaine action : reprendre un périmètre fonctionnel restant avec son contrat/source de vérité, puis préparer la preuve HTTP connectée lors de l'intégration. Relire les règles et vérifier HEAD/status avant toute modification ; ne répéter que les contrôles affectés.
