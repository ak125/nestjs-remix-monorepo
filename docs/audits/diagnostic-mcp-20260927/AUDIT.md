# Vérification approfondie — pont MCP diagnostic, 27 septembre 2026

Statut du lot : **VALIDATED_FOR_SCOPE_ONLY**. Couverture de l’audit global : **PARTIAL_COVERAGE**.
Ce quatrième lot poursuit la demande « vérifier le rapport et corriger le code ». Il ne clôt pas les 28 constats du rapport initial.

## Résultat et portée

C03 est confirmé et corrigé dans `McpQueryService.diagnose` : le contrat accepte maintenant l’historique d’entretien et les trois contextes KG, puis les transmet sans supprimer le kilométrage zéro. Les entrées incohérentes et les réponses RPC absentes ou mal formées renvoient `null`, donc une vérification indisponible. Une liste SQL réellement vide reste distincte d’une panne.

Le retour `safety_gate: 'none'` a été retiré : cette méthode n’appelle pas le contrôle de sécurité mécanique. Le champ était déjà facultatif. Son absence signifie « non contrôlé », jamais « aucun danger ». La fonction indépendante `checkSafetyGate` et les règles d’autorisation RPC sont inchangées.

**Limite de parcours : aucun appelant HTTP actif de cette méthode n’a été trouvé dans la recherche ciblée.** Le registre l’expose ; l’intercepteur de vérification transmet les paramètres bruts lorsqu’un décorateur l’active, mais aucune utilisation effective de `McpVerifyDiagnostic` / `@McpVerify` avec `dataType: diagnostic` n’a été repérée dans `backend/src`. Le branchement diagnostic de l’intercepteur shadow retourne toujours `null`. Les appels HTTP de `KgController` aboutissent à un autre service, `KgService`.

Le correctif prépare et fiabilise le composant existant. Il ne raccorde ni le wizard ni le shadow, et ne démontre aucun changement de comportement d’une API déployée.

## Contre-preuve SQL en lecture seule

Deux transactions `BEGIN READ ONLY` ont été exécutées sur le projet Supabase `cxpojprgwgubzjyqzmoq` : définitions de trois fonctions, puis comparaison de trois scénarios sur un observable actif relié à des défauts. Requêtes exactes, réponses brutes et données extraites sont jointes.

Observable : `12f848a8-c046-4aff-a664-b1723727a893`. Quatre défauts sont retournés dans chaque scénario.

| Scénario | Score de confiance de chaque défaut | Scores des causes, ordre par UUID |
|---|---:|---|
| Compteur, historique et contexte absents | 5 | 6, 5, 8, 6 |
| Compteur 0, entretien déclaré à 0, démarrage/froid/0–30 | 55 | 6, 5, 8, 6 |
| Trois contextes bruts `any`, reste absent | 20 | 6, 5, 8, 6 |

Le SQL actuel ajoute des points de **complétude** selon la présence du compteur, d’au moins un historique et d’au moins deux contextes non nuls. Ces paramètres ne modifient pas le calcul des causes dans cette fonction. Les probabilités ci-dessus sont des scores SQL non calibrés ; cette preuve ne démontre pas une précision mécanique de 55 %.

Le pont transforme `any` en `null` pour éviter le bonus artificiel constaté. Il refuse les doublons d’observables, y compris avec une casse UUID différente, qui pourraient aussi gonfler le nombre d’observations. Le SQL brut reste inchangé et conserve ses limites pour d’autres appelants.

## Contrat corrigé

Quatre fichiers code/tests sont modifiés dans ce lot :

- `backend/src/modules/mcp-validation/types/mcp-diagnose.schema.ts` : validation Zod des entrées et des défauts retournés.
- `backend/src/modules/mcp-validation/types/mcp-verify.types.ts` : type d’entrée dérivé du schéma, pour éviter une définition divergente.
- `backend/src/modules/mcp-validation/services/mcp-query.service.ts` : validation, transmission effective, zéros conservés, absence de résultat de sécurité inventé.
- `backend/src/modules/mcp-validation/services/mcp-query-diagnostic.test.ts` : 54 cas sur le vrai service et son registre ; seule la frontière RPC est simulée.

Les champs nouveaux sont optionnels : `last_maintenance_records`, `ctx_phase`, `ctx_temp`, `ctx_speed`. Les contextes reprennent la taxonomie KG de la migration et de l’éditeur existants. Les UUID doivent être syntaxiquement valides ; le compteur est un entier PostgreSQL non négatif. L’historique réutilise le schéma de date et de kilométrage du diagnostic, exige une date ou un kilométrage d’intervention, refuse les dates impossibles/futures, les doublons d’opération et un compteur d’entretien supérieur au compteur actuel.

Les identités ne sont pas inventées : pas de conversion `type_id/ktypnr → vehicle_id`, de déduction depuis le libellé moteur, de sélection arbitraire parmi plusieurs températures, ni de conversion `operation_slug → nœud KG`. L’existence métier d’un UUID ou d’une opération n’est pas prouvée par sa validation syntaxique. Les champs du wizard relèvent d’un autre contrat ; ils ne sont pas convertis implicitement.

Exemple du contrat du service — ce n’est pas une route HTTP nouvellement publiée :

```json
{
  "observable_ids": ["12f848a8-c046-4aff-a664-b1723727a893"],
  "vehicle_context": { "mileage_km": 0 },
  "last_maintenance_records": [
    { "operation_slug": "oil_change", "last_service_km": 0 }
  ],
  "ctx_phase": "demarrage",
  "ctx_temp": "froid",
  "ctx_speed": "0_30"
}
```

Une réponse RPC valide doit être un tableau de défauts uniques, avec UUID, libellé non vide et scores entiers entre 0 et 100. Aucun repli ne transforme `null`, un objet ou une ligne corrompue en diagnostic réussi. Les erreurs retournées et exceptions de transport restent indisponibles.

## Validation et preuves

- Avant correction : **46 échecs et 8 succès sur 54 cas** ; journal rouge conservé.
- Après correction : **277 tests backend / 15 suites**, dont les 54 nouveaux cas MCP. Cette exécution reprend les 223 tests du périmètre des lots précédents.
- Contrôle complet des types backend : succès.
- Lint des quatre fichiers : **0 erreur, 8 avertissements préexistants**, sur des lignes hors du diagnostic modifié (rôles SEO et ancien `any`). Aucun changement de configuration pour les masquer.
- Rejeu hors connexion du snapshot SQL dans le schéma final : **12 lignes / 3 scénarios acceptés**, scores des causes identiques et normalisation `any → null` vérifiées.
- Les **37 empreintes code/tests du candidat précédent sont identiques** ; aucun changement frontend, dépendance ou configuration dans ce lot. Les 36 tests frontend et les contrôles frontend du lot calendrier sont des preuves historiques, pas une nouvelle exécution.
- Une incompatibilité d’inférence Zod/TypeScript avec la configuration non stricte a été corrigée sans assertion forcée ni changement de tsconfig ; son journal intermédiaire est distinct du journal vert final.

Il n’y a pas de preuve navigateur nouvelle, de démarrage de l’application complète, de test HTTP relié à la base, de CI, de PREPROD ou de PROD. Le rejeu de données réelles ne remplace pas ces couches.

## Évolution du rapport initial et points ouverts

| Constat | État après ce lot |
|---|---|
| C03 — contexte MCP perdu | Corrigé et testé dans le service ; **partiel dans le produit**, car raccordement effectif absent et score SQL limité à la complétude. |
| C01 — identités incompatibles | Toujours partiel : UUID invalides rejetés ; correspondances entre wizard, opérations, véhicule et KG non établies. |
| B02 — contexte et réponses sans effet mécanique | Toujours ouvert : restaurer des paramètres ne crée pas leur effet sur le classement des causes. |
| D02 — échec présenté comme succès | Garantie étendue au pont MCP testé : source mal formée indisponible, sécurité non vérifiée omise. Autres méthodes MCP non auditées dans ce lot. |
| D07 — qualité des tests | Renforcée par 54 cas et la contre-preuve SQL ; intégration de bout en bout toujours à faire. |
| C05 — sources fragmentées | Toujours ouvert ; réutilisation du contrat historique existant, sans créer de mapping d’identité implicite. |

Les autres conclusions des lots antérieurs restent conservées. Les défauts de source du calendrier, les correspondances constructeur, les questions adaptatives, les modes DTC/voyant/texte et les dossiers rejouables ne sont pas traités ici.

## Candidat et intégration

Cible : `ssh dev-automecanik`, compte `deploy`, worktree `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`.
Branche `codex/diagnostic-integrity-20260926`, base `4a2871dc4d19067c3ae077d6a79021b49cc60237`.
Candidat précédent : `99292f8ee3a33e8f157df8222469f9b7f54f0cb2`.

Les changements sont non commitées dans le worktree DEV. Aucun push, PR, déploiement ou changement de base. L’arbre final, les empreintes et les résultats d’application/reconstruction des deux patchs figurent dans `patch-verification.json`. L’applicabilité structurelle sur le main observé ne remplace pas la CI du candidat intégré. Le retour arrière et les bases exclusives sont décrits dans `LISEZ-MOI.md`.

Prochaine étape de produit : établir les correspondances d’identité et le contrat d’un seul parcours d’appel avant toute activation du MCP/shadow, puis tester la traversée HTTP réelle et la séparation entre complétude, raisonnement et sécurité.
