# Checkpoint — lot 12, 28 septembre 2026

Objectif : poursuivre les corrections confirmées du diagnostic sans confondre preuves locales, base réelle, navigateur et CI.

Cible : `deploy@dev-automecanik`, worktree `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`, branche `codex/diagnostic-integrity-20260926`, HEAD `4a2871dc4d19067c3ae077d6a79021b49cc60237`. Candidat précédent `98f7b86fd6db9d0f39b7e2b79edf2b9c61179489` ; candidat livré dans `patch-verification.json`.

Correction : le service valide l’UUID d’une confirmation d’insertion avant d’exposer un lien. En cas d’erreur, réponse mal formée ou réponse perdue, l’analyse critique reste disponible avec « Sauvegarde non confirmée ». Aucune seconde insertion automatique. Deux fichiers production et un test ; 53 code/tests cumulés, 50 préservés hors delta.

Validation : 10 échecs reproduits avant correction ; 401 tests / 17 suites réussis ensuite, dont 12 nouveaux. Types backend complets et lint ciblé verts. Frontend inchangé : preuve 96/9 du lot 10 réutilisée après empreintes. La base réelle (185 lectures), Edge et le rejeu HTTP du lot 11 restent historiques, sans nouvelle preuve d’écriture.

Décisions : aucune mutation de base réelle, aucun commit/push/PR/déploiement. La base partagée reste en lecture seule ; PROD manuel. Aucun changement de risque mécanique, règle métier, frontend ou infrastructure. L’index réel reste intact ; les patchs reconstruisent le candidat via index temporaires.

Suite : base de test isolée pour insertion/relecture et chaîne complète navigateur ; publication autorisée du candidat pour CI. Les règles sourcées pour contexte/réparations et leur conservation restent ouvertes. Éviter les nouveaux rejouages inchangés. Utiliser ce checkpoint pour une nouvelle tâche indépendante si nécessaire, sans en créer une automatiquement.

Verdict VALIDATED_FOR_SCOPE_ONLY ; audit global PARTIAL_COVERAGE.
