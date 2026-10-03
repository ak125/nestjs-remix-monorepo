# Diagnostic — prise en charge de l'urgence critique, 28 septembre 2026

Septième lot : **VALIDATED_FOR_SCOPE_ONLY**. Audit initial : **PARTIAL_COVERAGE**.
Autorisation : vérifier le rapport, corriger le code et continuer les améliorations. Cible : worktree DEV existant, aucun changement de données ou de configuration de service.

## Analyse et décision

Le lot précédent refusait trois références `critique`, car le contrat ne reconnaissait que `haute`, `moyenne`, `basse`. Ce refus empêchait leur conversion silencieuse en `moyenne`, mais rendait les parcours concernés indisponibles.

La recherche établit une dérive entre composants :

- `backend/supabase/migrations/20260321_diagnostic_engine_10_systems.sql` introduit `critique` sur deux causes et un symptôme (lignes 42, 153, 172).
- L'orchestrateur du worktree **et du main observé** contient déjà `critique: 'Immédiat — ne pas rouler'` dans son tableau de restitution. Cette entrée était inaccessible après le repli du moteur de classement.
- Le classement remplaçait toute urgence inconnue par `moyenne`. Les types et le catalogue de symptômes frontend ne reconnaissaient pas `critique`.
- Le moteur de risque ne recevait que les slugs des symptômes ; leur urgence n'était pas transmise. L'affichage cachait une alerte si `risk_flags` était vide.

Le correctif conserve le niveau explicite `critique` et rend effective la consigne déjà codée : action immédiate, alerte visible, catalogue fermé. Un score relatif faible ne peut pas abaisser cette consigne. Les seuils et poids de classement existants sont inchangés ; le nouveau traitement porte sur l'urgence explicitement déclarée dans les références.

**Portée de cette décision :** il s'agit d'une cohérence du contrat logiciel existant, pas d'une validation mécanique des données. Les migrations ne définissent pas de correspondance avec le `safety_gate` du moteur KG. Le wiki `diagnostic/safety-config.md` décrit un autre parcours, avec ses propres niveaux ; aucune conversion vers `stop_immediate` ni aucun raccordement KG n'est ajouté. Les cas « golden » contiennent des validations `TBD` et n'ont pas été pris pour une certification métier.

## Corrections réalisées

Neuf fichiers de production et deux fichiers de tests :

1. `UrgencyLevelEnum` et les types frontend admettent les quatre niveaux. Le validateur de références du lot 6 bénéficie directement du contrat étendu.
2. Le classement utilise ce schéma au lieu de son repli silencieux. Même un appel direct avec une urgence inconnue échoue explicitement.
3. L'interprétation transmet les libellés des seuls symptômes critiques effectivement sélectionnés, principaux ou secondaires. Un symptôme critique simplement présent dans le catalogue ne provoque pas d'escalade.
4. Le risque devient `critical` lorsqu'une hypothèse, un symptôme sélectionné ou une règle pertinente porte explicitement `critique`. L'action immédiate et le blocage du catalogue sont activés. L'alerte indique les éléments concernés et la consigne existante de ne pas rouler.
5. Le sélecteur et les résultats affichent le niveau critique. Une alerte ou un risque critique reste visible même sans drapeau détaillé.
6. Trois annotations d'import de type dans le fichier frontend déjà touché ont été remplacées par des imports de type normaux pour supprimer les avertissements de lint, sans changement runtime.

Les contrôles de nullité, identité, appartenance, doublons et valeurs invalides du lot 6 sont conservés. Ses trois tests qui utilisaient `critique` comme valeur inconnue utilisent désormais `inconnue`, avec les mêmes assertions d'indisponibilité. Des cas positifs distincts prouvent le traitement critique.

## Validation

| Preuve | Résultat |
|---|---|
| Nouveaux tests backend avant correction | 10 échecs, 3 succès ; avec les 45 précédents : 10 échecs / 48 succès sur 58 |
| Nouveaux tests frontend avant correction | 2 échecs, 2 succès sur 4 |
| Régression backend après formatage | **335 tests / 16 suites réussis** |
| Régression frontend après formatage | **84 tests / 8 fichiers réussis** |
| Types complets backend et frontend | Réussis ; frontend revérifié après les derniers imports de type |
| Lint final des 11 fichiers | Aucune erreur, aucun avertissement |
| Références du snapshot du lot 6 | **316/316 acceptées** par les schémas actualisés |
| Rejeu HTTP local | **62 symptômes : 58 réponses métier réussies, 4 refus explicites** |

Les tests traversent les vrais moteurs. Le service de données utilise une frontière PostgREST simulée ; la sauvegarde et les enrichissements facultatifs sont simulés. Les cas nouveaux couvrent une cause critique peu classée, une règle critique, les symptômes principal et secondaire, le symptôme critique non sélectionné, les urgences inconnues et la visibilité de l'alerte.

Deux erreurs initiales de montage des tests ont été corrigées avant les preuves rouges : remplacement textuel incorrect dans la fixture backend et paramétrage de tableau Vitest déplié au lieu d'un objet. Leurs journaux `*-test-setup.log` sont conservés ; ils ne sont pas comptés comme régressions produit. Les trois avertissements frontend intermédiaires sont résolus dans `frontend-lint-final.log`.

## Rejeu HTTP et limites

Le script `validation/replay-http.cjs` démarre le **vrai contrôleur Nest** sur un port éphémère, exclusivement sur `127.0.0.1`. Il utilise le vrai service de données et les vrais moteurs, avec les filtres PostgREST reproduits sur le snapshot de références du lot 6. Il n'utilise ni client DB connecté ni identifiants. Le serveur est fermé dans `finally`.

Le GET des symptômes de filtration répond HTTP 200 et conserve `voyant_huile` avec `urgency: critique`. Les POST traversent la route réelle d'analyse. Les cinq cas suivants produisent chacun `risk_level: critical`, l'alerte « ne pas rouler » et `allowed_output_mode: none` :

- `voyant_huile`
- `perte_puissance_filtration`
- `bruit_claquement_moteur`
- `perte_puissance_distribution`
- `temoin_moteur_distribution`

Les deux autres symptômes de filtration (`surconsommation_carburant`, `odeur_habitacle`) produisent un résultat ; ils ne sont pas rendus critiques par la simple présence de `voyant_huile` dans le catalogue.

Les quatre refus concernent `clim_pas_de_froid`, `bruit_compresseur_clim`, `odeur_clim`, `chauffage_defaillant` : le snapshot ne fournit pas de couverture de règles de sécurité pour la climatisation. Le garde-fou existant est conservé ; aucune règle mécanique n'est inventée pour produire un succès. Les POST conservent le statut HTTP 201 de ce contrôleur, y compris avec `success: false` : ce lot ne modifie pas le contrat de statut HTTP.

Cette preuve n'est **pas une intégration à la base vivante**. Les 515 lectures sont simulées ; 58 sauvegardes de session sont neutralisées dans le banc. Les enrichissements, le cookie véhicule, la couche d'intention optionnelle, le démarrage de l'application entière, la CI et PREPROD/PROD ne sont pas validés. Aucun flag d'un service existant n'a été modifié. Pas de nouvelle preuve navigateur ; les 84 tests frontend utilisent les vrais composants sous jsdom.

## Écarts restant ouverts

Le décalage de **40 familles de causes sur 58** avec l'énumération de sortie reste ouvert. Les migrations prouvent l'origine des familles `wear`, `mechanical`, etc., mais n'établissent pas de mapping vers les catégories du MVP. Aucune traduction supposée n'est introduite. Le succès HTTP du rejeu ne prouve donc pas la conformité complète de tout le dossier au schéma `EvidencePack`.

Restent également ouverts : couverture de sécurité climatisation, justesse mécanique/calibration, liens orphelins, questions et effet des réponses, DTC, identités entre référentiels, échéances constructeur, retour après réparation et dossier serveur rejouable. Les autres conclusions des six lots précédents restent conservées. Ce lot renforce D02/D07 ; il ne clôt pas les 28 constats initiaux.

## État livré

Travail non commité sur `dev-automecanik`, compte `deploy`, branche `codex/diagnostic-integrity-20260926`, worktree `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`. Base `4a2871dc4d19067c3ae077d6a79021b49cc60237`, candidat précédent `753a62a0387c2818f1f727b45b40b91f60067daf`.

Les 47 empreintes code/tests du lot précédent concordaient au début. Les empreintes hors du lot sont contrôlées à l'assemblage. Le patch cumulé des sept lots et le patch `urgency-only.patch` reconstruisent le même arbre avec un index temporaire ; l'index réel est conservé. Les détails sont dans `patch-verification.json` et `coverage-manifest.json`.

Aucun commit, push, PR, changement DB, migration, déploiement ou modification de configuration de service. Prochaine action utile : aligner le contrat de familles de causes avec les valeurs réellement produites, puis vérifier le dossier de sortie complet sans mapping inventé.
