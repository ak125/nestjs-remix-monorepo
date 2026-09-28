# Vérification et corrections — fiabilité du calendrier d’entretien

27 septembre 2026. Autorisation : « Vérifier le rapport et corriger le code », puis « continue ». Cible : worktree DEV `codex-diagnostic-integrity-20260926`, base `4a2871dc4d19067c3ae077d6a79021b49cc60237`. Les empreintes des 35 fichiers code/tests du candidat précédent ont été vérifiées identiques avant modification.

**Verdict : VALIDATED_FOR_SCOPE_ONLY pour les corrections ci-dessous ; PARTIAL_COVERAGE pour l’audit initial.** Aucun déploiement ni changement de base. Les constats non cités conservent l’état des deux rapports précédents.

## Scan et analyse

Les lectures ciblées couvrent les trois endpoints du calendrier, le service et son contrat RPC, la route frontend, les tests associés et le lien entre recommandations d’entretien et garde catalogue. Les lectures SQL ont été exécutées dans des transactions `READ ONLY`. Le manifeste donne les fichiers lus, les exclusions et les empreintes du candidat.

### Unification des sources : absence de jointure prouvée

Les 30 opérations actives et les 19 intervalles KG n’ont aucune correspondance explicite d’identité parmi les champs/liens examinés : zéro égalité slug/alias, zéro arête KG incidente même inactive, aucune FK entre les deux ensembles et aucun identifiant d’opération dans les métadonnées des intervalles. Deux égalités gamme/alias existent, mais la gamme n’est pas une clé unique d’opération : 424 et 475 sont chacune partagées par deux opérations. Les tableaux `sources` des 19 intervalles sont vides.

La comparaison détaillée et les inventaires figurent dans `identifier-comparison.md` ; les trois requêtes et leurs résultats bruts dans `identifier-sql-evidence.json`. Il n’existe pas de preuve suffisante pour joindre automatiquement les historiques du parcours entretien au calendrier KG. Aucun mapping par ressemblance de libellé n’a été introduit.

### Faux statut personnel du calendrier

La RPC calcule `km_remaining` et `status` à partir du compteur total, sans date ni kilométrage de la dernière intervention. À 80 000 km, le snapshot réel renvoie par exemple la vidange essence « overdue » et la distribution « ok ». Ces deux conclusions sont indéterminées en l’absence d’historique. `calendar-rpc-evidence.json` conserve la quatrième requête du lot et sa réponse ; `calendar-rpc-data.json` en extrait les 19 intervalles et 5 paliers.

### Validation insuffisante aux frontières

Le contrôleur utilisait `parseInt` : « 12000km » devenait 12000, les décimales étaient tronquées et certaines entrées invalides devenaient zéro/NaN ou étaient éliminées d’une liste de paliers. Les réponses RPC n’étaient contrôlées que pour erreur/null. Le frontend faisait un cast TypeScript, puis accédait aux tableaux sans validation réelle : un HTTP 200 mal formé pouvait casser la page.

### Lien d’entretien issu d’une donnée de gamme périmée

La ligne `brake_fluid_change` conserve `related_pg_id=479` en DB. La correction précédente du mapping catalogue utilise bien 71, mais `ResultMaintenance` construisait encore son lien directement avec les métadonnées de l’opération. Le cas résiduel n’était donc pas fermé pour une recommandation symptomatique autorisant une orientation catalogue. La donnée DB n’a pas été modifiée.

## Corrections appliquées dans le périmètre autorisé

1. **Calendrier générique explicite.** Les endpoints NestJS conservent les intervalles mais renvoient `status: unknown`, `km_remaining: null`, `status_reason: maintenance_history_missing` et `applicability: unverified`. L’agrégat annonce `assessment_basis: generic_intervals`. Cette adaptation neutralise l’inférence incorrecte de la RPC ; elle ne recalcule pas un historique absent.
2. **Entrées contrôlées.** Les paramètres kilométriques/identifiants doivent être des entiers décimaux dans la plage PostgreSQL int4 ; les identifiants et paliers doivent être positifs, le compteur peut être zéro. Les paliers invalides ou dupliqués sont rejetés entièrement en 400. Les valeurs absentes conservent les défauts historiques. Les carburants restent un filtre textuel borné, sans inventer une nouvelle taxonomie moteur. Le loader transmet les valeurs vides ou répétées pour que le serveur puisse les rejeter.
3. **Sources contrôlées.** Schémas Zod sur les réponses RPC : forme, champs obligatoires, intervalles positifs, présence d’au moins une borne km/mois, unicité des alias du programme. Donnée absente/mal formée, erreur RPC ou exception de transport => 503 public sans détails internes. Un vrai tableau vide reste valide. Le frontend valide les champs qu’il rend et affiche une indisponibilité en cas de réponse incorrecte.
4. **Présentation honnête.** La page explique le besoin d’historique, l’applicabilité non vérifiée et la portée indicative des paliers. Un carburant non renseigné devient « non précisé », au lieu de « tous ». Les métadonnées SEO et URL sont inchangées.
5. **Garde des liens d’entretien.** Un lien n’est rendu que si son URL canonique construite depuis alias+ID figure aussi parmi les gammes autorisées par le garde catalogue. Un ID ou alias contradictoire masque uniquement le lien ; l’opération reste visible. Le parcours entretien autonome conserve son blocage catalogue.

Le lot modifie 11 fichiers code/tests, dont deux nouveaux ; 37 fichiers code/tests sont modifiés dans le candidat cumulé. Aucune dépendance, configuration, migration ou règle de gouvernance changée.

## Validation

- **Avant correction :** 56 échecs comportementaux / 57 cas backend ; 7 échecs / 13 cas frontend calendrier. Deux cas supplémentaires ont reproduit les liens d’entretien incohérents avant correction. Les journaux rouges sont conservés.
- **Backend final : 223 tests, 14 suites réussies.** Cela inclut les 57 nouveaux cas d’intégrité du calendrier, les 13 tests du calculateur/agrégat et les suites existantes du diagnostic/shadow. Les anciens tests `diagnostic-engine.kg-extensions.test.ts` comprennent des assertions de mocks faibles ; leur succès ne prouve pas une exécution SQL réelle.
- **Frontend final : 36 tests, 4 fichiers réussis.** 15 cas calendrier/navigation, puis 21 cas liens/résultats/parcours/soumission. Les 9 tests du composant de saisie du lot précédent ne sont pas recomptés comme exécutés ici.
- **Types :** TypeScript complet backend et frontend réussi. Frontend revérifié après modification du garde des liens. Les routes/dépendances/configurations sont inchangées ; aucune nouvelle génération de types de route nécessaire.
- **Lint ciblé :** réussi sur les sources modifiées et les tests dans les projets ESLint. Les deux tests historiques `backend/tests/unit` restent exclus du `parserOptions.project` existant ; ils sont compilés/exécutés par Jest, sans changement de configuration.
- **Données réelles :** les 19 lignes et 5 paliers renvoyés par les RPC ont passé les nouveaux schémas dans un rejeu local ; tous les statuts normalisés sont inconnus et les distances restantes nulles. C’est une validation du snapshot SQL, pas une preuve HTTP complète contre une application connectée.
- **UI :** rendu et navigation couverts par les tests React. Pas de nouvelle session navigateur dans ce lot ; les captures antérieures ne valident pas ces changements de calendrier/liens.
- **Livraison :** patch cumulé et patch du lot reconstruits dans des index Git temporaires ; détails et arbre candidat dans `patch-verification.json`. Index Git réel préservé. Pas de commit, push, PR, CI, PREPROD ou PROD.

Les logs d’erreur des cas de panne provoqués sont attendus. Vitest signale le plugin `vite-tsconfig-paths` comme devenu facultatif ; aucune dépendance/configuration n’a été modifiée pour ce message.

## Compatibilité et limites

Le changement `status=unknown` / `km_remaining=null` est volontaire : les consommateurs externes éventuels de `/maintenance-schedule` ou `/calendar` doivent accepter l’absence d’évaluation. Le consommateur du dépôt rend les intervalles et ne dépend pas des anciens statuts. Les RPC SQL elles-mêmes restent inchangées : leurs autres consommateurs peuvent encore recevoir les anciens statuts. La personnalisation constructeur, les historiques du calendrier et les défauts de normalisation carburant/hybride de la RPC ne sont pas résolus.

Le garde frontend ferme le lien incohérent observé, mais ne corrige pas la donnée catalogue périmée en DB ni les éventuels autres consommateurs de ses champs. La prochaine action sur les données doit établir des correspondances explicites validées, documenter la provenance des intervalles et traiter les anomalies de gamme à leur source. Aucune écriture DB n’a été inférée de « continue ».

Les questions adaptatives, les entrées DTC/voyants/texte, le contexte MCP et les sessions rejouables restent des lots indépendants de l’audit initial.
