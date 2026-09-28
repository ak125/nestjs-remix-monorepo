# Checkpoint — neuvième lot, 28 septembre 2026

Objectif : vérifier le rapport initial et corriger les défauts confirmés. Autorisation explicite de continuer. Lot VALIDATED_FOR_SCOPE_ONLY ; audit PARTIAL_COVERAGE.

Cible : ssh dev-automecanik, compte deploy, `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`, branche `codex/diagnostic-integrity-20260926`. Base `4a2871dc4d19067c3ae077d6a79021b49cc60237`, candidat précédent `123e4025248ba61bf64dde2a85435bb384d4597d`. Nouveau candidat dans patch-verification.json. Ne pas éditer le checkout Windows.

Lot 9 : trois fichiers production + deux tests. Jointure de causes désormais complète ou refusée, sans suppression silencieuse de référence manquante/inactive/hors système. answers non vide ajoute une limite explicite au dossier et un warning sans contenu utilisateur. Aucune pondération inventée ; alerte et scores conservés. UI : bloc « Limites et informations manquantes ».

Preuves : sept cas backend ajoutés, deux cas frontend renforcés. Avant correction : quatre échecs backend et deux frontend. Après : 362 tests backend/16 suites, 84 frontend/8 fichiers, types complets des deux projets et lint verts. Rejeu HTTP : 58 dossiers conformes/62 symptômes ; quatre refus climatisation inchangés. Trois injections de cause indisponible auparavant acceptées sont refusées sans sauvegarde. Réponse complémentaire : limite visible et alerte critique conservée.

Snapshot lot 6 : 316 références, aucun lien orphelin/croisé/dupliqué, ni symptôme/cause sans lien. Climatisation : quatre symptômes, cinq causes, zéro règle. Constat sur snapshot uniquement. RPC get_context_questions et table déclarés dans types DB ; aucune définition SQL/options/pondération validée. Wizard sans collecte de réponses ; signal_input.context reste inutilisé.

Limites : PostgREST et sauvegarde simulés ; pas de base vivante, navigateur nouveau, cookie, intention, persistance, CI ou déploiement. Calibration, questions/options/effets, DTC, mappings/OEM/feedback/reprise serveur ouverts.

Livraison : rapport/manifeste/logs, audit snapshot et rejeu HTTP, patchs cumulé et incrémental, archive/empreintes. Index intact ; aucun commit/push/PR/migration/déploiement. Ne pas réappliquer sur le worktree déjà modifié.

Prochaine action : vérifier la source des questions/options/modificateurs avant raccordement ; examiner les autres entrées sans effet et la reprise serveur. Revalider les empreintes et réutiliser seulement les preuves inchangées.
