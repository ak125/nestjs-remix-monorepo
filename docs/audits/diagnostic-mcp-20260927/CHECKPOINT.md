# Checkpoint — pont MCP diagnostic, 27/09/2026

Objectif : vérifier le rapport et corriger le code. Quatrième lot autorisé par « continue ». Lot VALIDATED_FOR_SCOPE_ONLY ; audit global PARTIAL_COVERAGE.

Cible : ssh dev-automecanik, compte deploy, /opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926. Branche codex/diagnostic-integrity-20260926 ; base 4a2871dc4d19067c3ae077d6a79021b49cc60237 ; candidat précédent 99292f8ee3a33e8f157df8222469f9b7f54f0cb2. Pas de code dans le checkout Windows.

C03 : contrat MCP enrichi d’historique et de contextes KG validés ; kilométrage zéro conservé ; any devient null ; doublons/entrées incohérentes et source RPC mal formée renvoient indisponible. Historique date/km existant réutilisé. Suppression safety_gate none non contrôlé. Quatre fichiers code/tests ce lot, 41 cumulés ; 37 empreintes précédentes identiques.

Limite majeure : aucun appelant HTTP actif identifié vers McpQueryService.diagnose ; décorateur inutilisé, shadow placeholder, KgController utilise un autre service. Aucun raccordement ajouté. C03 corrigé dans le composant, partiel dans le produit. Aucun mapping implicite de type_id/slug/moteur ni tableau de contextes vers KG.

DB : 2 transactions READ ONLY ; fonctions et comparaison conservées. Même observable, 4 défauts inchangés ; confiance 5 sans contexte, 55 avec compteur/historique/contexte, 20 avec any brut. Mesure de complétude, pas justesse mécanique ni effet sur classement. SQL inchangé.

Validation finale : 277 tests/15 suites backend, dont 54 MCP (46 rouges avant fix). Types backend OK ; lint 0 erreur/8 avertissements préexistants. Snapshot SQL 12 lignes/3 scénarios accepté par schéma final. Frontend inchangé : preuves du lot calendrier historiques ; pas de nouveau navigateur/HTTP complet/CI.

Livrable local : C:\Users\Marwane\.codex\artifacts\diagnostic-mcp-20260927. AUDIT, preuves SQL, logs, manifeste, patchs exclusifs (cumulé depuis base ou mcp-only depuis ancien candidat), ZIP. Arbre final/empreintes/reconstructions dans patch-verification.json ; index réel intact. Lots précédents conservés.

Aucun commit/push/PR/déploiement/écriture DB. Marwane seul exécute les mutations PROD. Suite : identités + contrat d’appel explicites avant activation et preuve HTTP ; autres lots ouverts inchangés. Revalider HEAD/status/empreintes avant reprise.
