# #1829 — sélection du template et suivi de production

Lot du 31 octobre 2026, candidat initial `b83a00c3c8d1db565111b9428266c61ce45f1cf1`.
Mandat : corrections, tests, commit et push sur le brouillon. Sans fusion, production, modification L00 ni intervention sur #1839.

## Constat et correction autorisée

Le champ `__video_productions.template_id`, son mapping de lecture et sa consommation par le worker existaient. L'API PATCH ne permettait pas de le sélectionner ; le bouton ouvrait le catalogue hors du contexte du brief et l'étape TPL restait toujours incomplète.

Le formulaire du détail réutilise le catalogue et le PATCH administrateur existants. Il transmet `templateId` et la version `expectedUpdatedAt`, puis redirige et relit le brouillon enregistré. Aucun choix par défaut n'est enregistré automatiquement. Le suivi exige un identifiant enregistré, présent au registre exécutable et compatible avec le format. Le worker utilise ce même identifiant et refuse désormais aussi une incompatibilité de format.

Le registre code reste autoritaire pour les compositions et formats. Les métadonnées de base enrichissent les entrées ; les entrées présentes uniquement en base restent au catalogue avec zéro format exécutable. Pas de second registre, nouveau framework, table ou migration.

La sélection est réservée aux brouillons sans dossier de revue et sans exécution. Une requête mêlant sélection et approbation/statut est rejetée. Le PATCH filtre atomiquement identifiant, version, état draft et absence de dossier. L'historique indisponible bloque ; les refus et conflits sont visibles dans le formulaire. Les contrôleurs et leurs gardes administrateur restent inchangés.

## Validation et limites des preuves

Preuves brutes : `/home/deploy/video-template-selection-20261031` ; empreintes dans `source-hashes.json`.

- Rouge frontend : deux tests reproduisent action absente et formulaire absent (`red-frontend.log`, sortie 1). Rouge backend : le contrat typé ne possède pas templateId/expectedUpdatedAt (`red-backend.log`, sortie 1 ; aucune assertion exécutée). Cette preuve de compilation n'est pas présentée comme un test runtime rouge.
- Backend : 97 tests dans cinq suites, sortie 0 (`backend-head.log`), plus test du PATCH réel construit par le client Supabase installé avec transport HTTP simulé (`backend-query-test.log`). Les variantes couvrent valeurs invalides, formats incompatibles, état revu, historique existant/indisponible, version obsolète, conflit d'écriture, erreur DB et métadonnées non autoritaires.
- Frontend : 158 tests dans quatre suites, sortie 0 (`frontend-final.log`), dont 124 sur le détail de production. Vrai formulaire, action, redirection, loader et sélection persistée ; HTTP simulé, aucun service ni fournisseur appelé. Refus 400/401/403/409/503 et catalogue invalide couverts.
- Typechecks backend et frontend : sorties 0. Lint ciblé des sources et diff-check consignés dans les preuves du lot. Aucun seuil modifié, skip/only ou exclusion ajouté.
- Comparaison backend : mêmes quatre suites existantes sur les fichiers b83, puis suites étendues sur le candidat ; restauration byte-identique des fichiers du candidat en finally. Fichiers et résultats dans `backend-baseline/` et `backend-head/`.

| Fichier | Lignes avant → après | Branches avant → après | Fonctions avant → après |
|---|---:|---:|---:|
| Détail production frontend | 100 → 100 % | 98,91 → 99,75 % | 100 → 100 % |
| video-data.service.ts | 79,34 → 85,71 % | 69,76 → 84,21 % | 92,85 → 100 % |
| template-registry.ts | 100 → 100 % | 100 → 100 % | 100 → 100 % |
| video-execution.processor.ts | 99,08 → 99,08 % | 81,17 → 82,35 % | 90 → 90 % |

La branche frontend restante concerne le retour JSON de sauvegarde script : l'action existante redirige. Aucune réponse fictive ajoutée pour la couvrir. Les branches précédemment inaccessibles faute de template sont exercées avec sélection persistée.

Le contrôle d'historique et le PATCH ne constituent pas une transaction commune avec l'insertion de queue. La protection atomique porte sur la ligne de production, son statut et son absence de dossier de revue ; une orchestration concurrente universelle nécessiterait un contrat transactionnel distinct. La sélection n'ouvre aucun droit d'approbation/publication. Les productions déjà revues/exécutées restent verrouillées et nécessitent un parcours de révision distinct. Le défaut historique du worker pour un short sans sélection explicite est conservé ; il ne termine pas l'étape TPL de l'interface.

Aucun schéma partagé vérifié/appliqué, aucune connexion Supabase réelle, aucun MP4 ni voix produit/inspecté, aucune preuve navigateur déployé ou PREPROD/PROD. Le statut pipeline terminé n'est pas une approbation humaine. Les décisions D17/D8/D9 et L00 restent inchangées.

## Contrat de sortie

- scope_requested : sélection template → suivi #1829, tests, commit/push brouillon.
- scope_actually_scanned : route de production et catalogue, types, contrôleur/data service, registre, consommation worker, tests et règles applicables (lectures ciblées, parfois par extraits).
- files_read_count : 23 fichiers (lectures complètes ou extraits), inventaire borné dans les preuves `read-scope.json` ; pas d'audit exhaustif.
- excluded_paths : L00, vault, RAW, WIKI, #1839, autres worktrees, secrets et données réelles.
- unscanned_zones : autres writers métier, runtime déployé, comptes sociaux, pilote réel, schéma partagé.
- corrections_proposed / corrections_applied : raccordement et contrôles ci-dessus, autorisés explicitement par le mandat utilisateur.
- validation_executed : tests ciblés, typechecks, lint, couverture comparative ; CI exacte ajoutée à la PR après push, sans anticiper son résultat.
- remaining_unknowns : qualification du pilote, revue humaine, migration/déploiement et concurrence inter-services globale.
- final_status : VALIDATED_FOR_SCOPE_ONLY après validations locales consignées ; CI distincte.

## Retour arrière

Revert du commit fonctionnel de ce lot sur la branche dédiée, puis régénération native des projections et tests ciblés. Pas de migration à annuler. Aucune opération de retour arrière exécutée, aucun changement de runtime.

Références API consultées : [mise à jour filtrée](https://supabase.com/docs/reference/javascript/update), [filtre de nullité](https://supabase.com/docs/reference/javascript/is). Vérification du client installé par transport HTTP simulé, sans dépendre d'une mise à niveau.
