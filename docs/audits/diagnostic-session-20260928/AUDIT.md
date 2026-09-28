# Diagnostic — reprise du résultat sauvegardé, lot 10

28 septembre 2026. **VALIDATED_FOR_SCOPE_ONLY** pour ce lot ; **PARTIAL_COVERAGE** pour le rapport initial.

## Scan

Autorisation : « Vérifier le rapport et corriger le code », puis « continuer les corrections et améliorations ». Intervention dans le worktree DEV `codex/diagnostic-integrity-20260926`, compte `deploy`, base `4a2871dc4d19067c3ae077d6a79021b49cc60237`. Les 51 empreintes de code/tests du lot 9 ont été vérifiées avant modification. Le manifeste donne l’inventaire exact des lectures ciblées et les exclusions ; ce n’est pas un scan complet du dépôt.

Le parcours examiné va du bouton « Copier le lien » au paramètre `?session=`, à l’endpoint `GET /api/diagnostic-engine/sessions/:id`, puis au résultat sauvegardé. Une mission indépendante, courte et en lecture seule a confirmé l’absence de consommateur du lien dans six fichiers frontend. Le brouillon local et la liste administrative de sessions sont des mécanismes distincts.

## Analysis

1. **Lien sans reprise.** Le wizard copiait `/diagnostic-auto?session=…`, mais ni lui ni la route cible ne chargeaient la session. Un autre brouillon local pouvait s’afficher à la place. Preuve : tests frontend avant correction, 11 échecs/11 cas.
2. **Résultat persistant sans validation.** L’API renvoyait `success: true` même pour un résultat nul, vide ou incompatible avec le contrat, ou des métadonnées incohérentes. Preuve : nouveaux tests backend, 9 échecs et 3 réussites avant correction.
3. **Panne assimilée à une absence.** Une erreur du stockage produisait « Session introuvable ». Le code ne distinguait pas l’absence de ligne d’une indisponibilité.
4. **Statut temporel absent.** Rendre un ancien résultat sans préciser sa date laisserait croire qu’une nouvelle analyse a eu lieu. Les résultats sauvegardés ne sont pas recalculés par cette reprise.

## Correction autorisée

Trois fichiers de production et deux nouveaux fichiers de tests :

- `frontend/app/components/diagnostic-wizard/DiagnosticWizard.tsx` : lecture de la session désignée au montage, priorité au lien sur le brouillon, conservation du brouillon durant la consultation, affichage de la date et du caractère historique, erreurs et nouvelle tentative de chargement. Le bouton « Nouveau diagnostic » sort de la consultation, retire seulement le paramètre `session`, préserve les autres paramètres/l’ancre/l’état d’historique et ignore toute réponse tardive. Le résultat peut être recopié et imprimé après chargement ; l’impression reste désactivée sans résultat.
- `backend/src/modules/diagnostic-engine/diagnostic-engine.controller.ts` : vérification du résultat avec `EvidencePackSchema`, de l’UUID et de la date. Le résultat original est restitué après validation : les extensions comme `urgency_timeline` et `scoring_breakdown` ne sont pas supprimées par une projection Zod.
- `backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts` : l’absence PostgREST `PGRST116` reste une session introuvable ; les autres erreurs retournées par le stockage deviennent une réponse HTTP 503 observable.
- `diagnostic-session-integrity.test.ts` et `diagnostic-session-recovery.test.tsx` : 12 nouveaux cas chacun, dont StrictMode, brouillon concurrent, erreur réseau, identifiant invalide, nouvelle tentative, lien recopié et réponse tardive.

Le lien consulte le dossier enregistré. Il ne relance pas `/analyze`, ne restaure pas un formulaire complet pour réexécution et n’invente pas les entrées non persistées. La table actuelle ne sauvegarde pas `usage_context` ; les enrichissements d’intention ajoutés après l’analyse ne font pas partie du résultat persistant. Aucune modification de schéma, de droits, de RLS ou de règles métier.

## Validation

| Couche | Résultat frais sur ce candidat | Portée |
| --- | --- | --- |
| Backend | **374 tests / 17 suites** | Diagnostic, entretien, sources, contrôleurs, MCP et reprise |
| Frontend | **96 tests / 9 fichiers** | Parcours précédents et nouvelle reprise, DOM simulé |
| TypeScript | Backend et frontend complets verts | Configurations existantes |
| ESLint | 5 fichiers modifiés, zéro avertissement | Code et nouveaux tests |
| HTTP | **13 scénarios**, dont **6 allers-retours exacts** | Vrai contrôleur Nest sur port local éphémère ; PostgREST et stockage simulés |
| Sécurité du résultat historique | 5 résultats critiques conservent alerte et catalogue fermé | Données du snapshot immuable du lot 6 |
| Diff/patchs | Voir `patch-verification.json` | Deux patchs reconstruisent le même arbre ; index réel conservé |

Les six consultations réussies conservent exactement le résultat JSON, sans écriture pendant la lecture. Quatre dossiers invalides sont refusés, ainsi qu’un UUID invalide et une session absente. Une panne simulée produit HTTP 503. Six écritures **en mémoire** servent uniquement aux allers-retours ; zéro lecture/écriture en base vivante.

Deux ajustements ont concerné les tests : la réponse de nouvelle tentative devait être préparée avant le clic ; le stockage simulé devait sérialiser en JSON pour reproduire la disparition des propriétés `undefined`. Les journaux intermédiaires sont conservés. Aucun de ces ajustements ne modifie les moteurs.

Les preuves du lot 9 relatives aux 62 symptômes, 58 dossiers conformes et quatre refus climatisation restent historiques ; elles n’ont pas été présentées comme un nouveau rejeu exhaustif. Le nouveau rejeu cible la reprise de session. Les fichiers de calcul et leurs dépendances concernées restent inchangés.

## Verdict et limites

**VALIDATED_FOR_SCOPE_ONLY.** Le lien est raccordé au résultat sauvegardé, les défaillances couvertes sont visibles et la distinction entre consultation et nouvelle analyse est explicite.

**PARTIAL_COVERAGE.** Pas de test navigateur réel nouveau, de persistance en base vivante, de démarrage complet de l’application, de validation des cookies ou du pipeline d’intention optionnel, de CI ou de déploiement. La validation du résultat utilise le contrat existant ; ses champs volontairement permissifs ne deviennent pas une validation exhaustive des anciens dossiers. Les anciens résultats ne sont ni migrés ni réévalués et peuvent refléter des comportements corrigés depuis leur création.

Restent notamment : contexte de signal sans effet, source/format/effets des questions complémentaires, DTC, couverture des règles climatisation, correspondances d’identités/OEM, retour après réparation et calibration mécanique. Prochain lot cohérent : caractériser les entrées acceptées sans effet avant tout raccordement métier.

## Livraison et retour arrière

Le patch incrémental `session-only.patch` part du candidat du lot 9 `09485a7252f77454a52433a2a9c99eb3c7f50086`. Le patch cumulatif part de la base indiquée plus haut. Ne pas les réappliquer sur le worktree DEV déjà modifié. `LISEZ-MOI.md` précise les arbres et les vérifications. Un retour arrière doit porter seulement sur ce lot, avec contrôle préalable, sans supprimer les neuf lots précédents ni d’autres changements.

Aucun commit, push, PR, migration, redémarrage ou déploiement. Le candidat reste à intégrer et à valider dans son environnement cible selon les autorisations existantes.
