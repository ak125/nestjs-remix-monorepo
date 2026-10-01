# Checkpoint — diagnostic AutoMecanik, 27 septembre 2026

Objectif : vérifier le rapport fourni (28 constats) et corriger les défauts confirmés, sans nouveau moteur concurrent.

Cible : DEV via `ssh dev-automecanik`, worktree `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`, branche `codex/diagnostic-integrity-20260926`, base `4a2871dc4d19067c3ae077d6a79021b49cc60237`. Modifications non commitées, exportées dans un patch. Windows et checkout principal non modifiés par ce lot. Main local a avancé à `38ce54f019ea43799a2c54172f406a172c4a1318` sur le profil utilisateur, sans chevauchement ni changement de dépendances/config.

État : 9 constats corrigés, 8 partiels, 11 ouverts. Blocage catalogue propagé jusqu’aux actions et liens ; lecture critique indisponible/couverture absente distinctes de faible risque ; agrégation déterministe ; distance d’entretien corrigée ; historique par opération validé et consommé ; dates/tri/échéances corrigés ; formulaire conserve historique et zéro ; URLs fiables ; mapping 56 associations/50 familles vérifié ; shadow refuse faux UUID et détecte top-1 inversé ; calendrier distingue panne et réponse vide.

Validations réutilisables : backend 10 suites/135 tests puis 11 tests d’actions après dernière correction = 136 cas distincts ; frontend 18 tests puis calendrier/navigation 6/6 = 21 cas distincts ; typage backend et frontend complets, lint ciblé, diff check. Logs et commandes dans le dossier d’audit. Sources/dépendances/config pertinentes doivent rester inchangées pour réutilisation.

SQL : lectures seules du projet massdoc ; candidat limité à l’extraction des mois, non appliqué, hors migrations automatiques. Fonction smart encore non personnalisée. Aucune preuve API live, navigateur, CI, PREPROD ou PROD.

Décisions : garder inconnu plutôt que remettre toutes les opérations à zéro ; ne pas inventer les correspondances KG ou l’applicabilité mécanique. Les modes non supportés sont explicitement refusés. L’UI ne saisit pas encore l’historique par opération. Ne pas élargir la persistance sans validation des accès.

Prochaine action : lire `AUDIT.md`, vérifier l’intégrité du patch et la base avant intégration DEV/CI. Puis raccorder sur les composants existants la saisie d’entretien par opération et ses règles d’applicabilité ; les questions adaptatives, le retour de vérification et la reprise restent ouverts. PROD reste une intervention manuelle de Marwane.
