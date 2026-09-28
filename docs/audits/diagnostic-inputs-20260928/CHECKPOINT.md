# Checkpoint — lot 11, 28 septembre 2026

Objectif : vérifier le rapport initial et corriger les défauts confirmés, puis approfondir la base réelle, le navigateur et les entrées sans effet.

Cible : DEV `deploy@dev-automecanik`, `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`, branche `codex/diagnostic-integrity-20260926`, HEAD `4a2871dc4d19067c3ae077d6a79021b49cc60237`. Candidat précédent `44ace5dd9f15f17eb878db5fc4e58f35efbba101` ; arbre livré dans `patch-verification.json`. Windows sert uniquement aux artefacts.

Changements : avertissements explicites pour contexte symptôme, immobilisation, réparations récentes et session fournie sans effet ; immobilisation finie et positive ou nulle. Quatre fichiers code/tests modifiés ; 53 cumulés, 49 préservés hors delta. Aucune pondération mécanique nouvelle.

Tests réutilisables : backend 389/17, types complets et lint verts ; frontend lot 10 inchangé, 96/9 et types/lint réutilisés après contrôle d’empreintes. HTTP 62 symptômes, 58 résultats conformes, quatre refus climatisation ; référentiel figé, stockage simulé. Trois défauts critiques injectés restent refusés. Base réelle en lecture seule : 185/185 résultats conformes, une reprise exacte via contrôleur, zéro écriture. Edge réel : résultat critique et limites visibles, récupération 503, session absente puis nouveau parcours ; API simulée.

Décisions : aucune mutation de la base partagée, aucun commit/push/PR/déploiement. CI du candidat non exécutée (branche distante absente). Ne pas confondre lecture réelle de sessions, insertion/relecture, HTTP isolé, navigateur simulant le réseau et intégration déployée. Les contextes bruts d’usage ne sont pas intégralement persistés.

Prochaine action : base de test isolée et chaîne complète pour insertion/relecture ; candidat publiable pour CI sous autorisation adaptée. Définir des règles métier sourcées avant de donner un effet au contexte ou aux réparations. Ne pas relancer les preuves inchangées. Réutiliser ce checkpoint dans une nouvelle tâche indépendante si nécessaire, sans création automatique.

Verdict : VALIDATED_FOR_SCOPE_ONLY ; audit global PARTIAL_COVERAGE. Rapports, scripts, capture, journaux, patchs et SHA dans l’archive du lot.
