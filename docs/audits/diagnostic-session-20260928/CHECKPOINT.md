# Checkpoint — dixième lot, 28 septembre 2026

Objectif : vérifier le rapport initial et corriger le code. Autorisation explicite de continuer. Lot VALIDATED_FOR_SCOPE_ONLY ; audit PARTIAL_COVERAGE.

Cible : ssh dev-automecanik, compte deploy, `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`, branche `codex/diagnostic-integrity-20260926`. Base `4a2871dc4d19067c3ae077d6a79021b49cc60237`, candidat précédent `09485a7252f77454a52433a2a9c99eb3c7f50086`. Nouveau candidat dans patch-verification.json. Ne pas éditer le checkout Windows.

Lot 10 : trois fichiers production et deux tests. Wizard : ?session charge le résultat via GET, conserve le brouillon concurrent, affiche la date/le caractère historique, traite erreurs/retry, annule la lecture au reset. Nouveau diagnostic retire seulement session de l’URL. Contrôleur : valide EvidencePack, identité et date puis restitue le résultat original sans supprimer les extensions. Data service : absence distincte d’erreur stockage HTTP 503. Aucun recalcul automatique.

Preuves fraîches : 374 tests backend/17 suites, 96 frontend/9 fichiers, types complets backend/frontend et lint cinq fichiers verts. 12 nouveaux tests par côté. Avant correction : 9 échecs backend/12 et 11 frontend/11 ; copie du lien ajoutée ensuite. HTTP : 13 scénarios, six allers-retours JSON exacts, cinq alertes critiques préservées. PostgREST et stockage mémoire simulés ; aucune base vivante. Fixtures corrigées pour l’ordre retry et la sérialisation JSON des undefined.

51 empreintes antérieures vérifiées au départ ; 48 fichiers antérieurs hors lot conservés. Total 53 fichiers code/tests. Patchs cumulé/incrémental et archive vérifiés, index réel intact. Aucun commit/push/PR/migration/déploiement. Rapport, manifeste et logs inclus. Ne pas réappliquer sur le worktree modifié.

Limites : pas de navigateur réel nouveau, persistance DB, bootstrap complet, cookie, couche d’intention, CI/PREPROD/PROD. La reprise affiche un résultat historique, pas un formulaire réexécutable ; usage_context non persisté et intention ajoutée après sauvegarde. Contrat existant encore permissif dans certains champs. Preuves lot 9 réutilisables seulement pour périmètre inchangé.

Prochaine action : examiner signal_input.context, immobilized_days, recent_repairs et session_id acceptés ; vérifier leurs consommateurs avant raccordement. Questions/options/pondérations sans contrat métier vérifié, DTC, climatisation, mapping/OEM/feedback/calibration restent ouverts.
