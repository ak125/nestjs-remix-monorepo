# Vérification approfondie — références du diagnostic, 28 septembre 2026

Sixième lot : **VALIDATED_FOR_SCOPE_ONLY**. Rapport initial : **PARTIAL_COVERAGE**.

Demande autorisée : « Vérifier le rapport et corriger le code », puis « continuer les corrections et améliorations ». Corrections limitées au worktree DEV existant, sur la branche `codex/diagnostic-integrity-20260926`. Aucune écriture dans la base.

## Défaut confirmé et comportement corrigé

Le service de données utilisait les lignes Supabase comme des interfaces TypeScript sans les contrôler à l'exécution. Or le moteur de classement transforme une urgence non reconnue en `moyenne`. Une donnée incomplète, une règle de blocage non booléenne ou un score invalide pouvait également atteindre le calcul de sécurité.

Les réponses du référentiel sont maintenant vérifiées avant leur utilisation : identité et activation des lignes, champs requis, urgences du contrat existant, scores entiers de 0 à 100, preuves sous forme de listes, indicateurs booléens, bornes de plausibilité et absence de doublons. Les résultats doivent correspondre au slug, au symptôme et au système demandés, même si la requête contenait déjà ces filtres.

Une référence invalide interrompt l'analyse avec le résultat d'indisponibilité existant. L'orchestrateur traite aussi l'échec du catalogue des systèmes lorsqu'il cherche des alternatives à un système inconnu. Il ne produit pas de dossier de diagnostic dans ces cas.

Les scores à zéro, les véritables listes vides, les descriptions nulles et les métadonnées facultatives sont conservés. La validation ne remplace pas les lignes d'origine par les objets parsés : les champs supplémentaires utiles aux moteurs ne sont pas supprimés. Les réponses « ligne absente » conservent leur comportement existant.

| Fichier | Changement |
|---|---|
| `backend/src/modules/diagnostic-engine/types/diagnostic-reference.schema.ts` | Contrôles des cinq types de références et de leurs collections ; réutilisation de l'énumération d'urgence existante. |
| `backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts` | Application des contrôles aux lectures systèmes, symptômes, causes, liens et règles ; validation des identités et appartenances. |
| `backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.ts` | Erreur explicite si le catalogue des systèmes alternatifs ne peut pas être vérifié. |
| `backend/src/modules/diagnostic-engine/diagnostic-source-integrity.test.ts` | 45 cas avec le vrai service de données et les vrais moteurs, frontière PostgREST simulée. |

## Confrontation aux données réelles

Quatre transactions SQL en lecture seule, terminées par `ROLLBACK`, ont consulté uniquement les références du projet Supabase `cxpojprgwgubzjyqzmoq`. Trois requêtes/résultats sont conservés en JSON ; la première exploration du vocabulaire comportait plusieurs SELECT et l'outil n'en a renvoyé que le dernier résultat. Elle a été remplacée par une requête JSON unique, sans nouvelle écriture. Aucune session utilisateur n'a été consultée.

Le snapshot contient **316 références actives** : 13 systèmes, 62 symptômes, 58 causes, 162 liens et 21 règles de sécurité. Rejoué hors ligne avec les nouveaux schémas, il donne **313 lignes acceptées et 3 rejetées**, exclusivement sur `urgency` :

| Référence | Valeur observée | Conséquence dans ce candidat |
|---|---|---|
| Symptôme `voyant_huile` | `critique` | Le catalogue des symptômes de `filtration` est refusé dans son ensemble. L'interprétation charge ce catalogue : les analyses de ce système deviennent indisponibles tant que ce contrat n'est pas aligné. |
| Cause `courroie_distribution_usee` | `critique` | Les analyses chargeant cette cause sont refusées. Le snapshot la relie à `bruit_claquement_moteur`, `perte_puissance_distribution` et `temoin_moteur_distribution`. |
| Cause `filtre_huile_colmate` | `critique` | La cause est refusée. Liens observés : `voyant_huile` et `perte_puissance_filtration`, déjà concernés par le catalogue invalide. |

Le contrat du moteur connaît `haute`, `moyenne`, `basse`. Ce lot n'invente pas de correspondance pour `critique` et ne modifie pas les données. **Le blocage est une protection explicite, pas une remise en service de ces parcours.** Une décision métier vérifiée sur les niveaux d'urgence et leur propagation reste nécessaire avant une intégration destinée à rendre ces parcours disponibles.

Autre écart réel : **40 causes sur 58** utilisent des familles absentes des quatre catégories du schéma de sortie `EvidencePack`. Le contrat actuel du service accepte une chaîne ouverte ; il est préservé. Ces familles ne sont ni rejetées massivement, ni traduites par une correspondance supposée. Le décalage entre vocabulaire des données et contrat de sortie reste ouvert.

Les lignes acceptées passent une validation structurelle ciblée. Cela ne prouve ni leur justesse mécanique, ni l'exhaustivité de leurs relations, ni la conformité complète d'une réponse HTTP finale. Les causes manquantes après filtrage et les liens orphelins ne sont pas rapprochés dans ce lot. Le repli de `mapUrgency` demeure dans le moteur pour ses éventuels appels directs ; le chemin actif via le service de données est protégé.

## Preuves exécutées

- Avant correction : **38 échecs et 7 succès sur 45 cas** (`validation/backend-red.log`).
- Après correction : **45/45** nouveaux cas réussis (`backend-green.log`).
- Après formatage : **322 tests réussis dans 16 suites backend**, dont les 277 précédents et les 45 nouveaux (`backend-regression.log`).
- Types backend complets : `tsc --noEmit --incremental false -p tsconfig.json`, code 0, mémoire plafonnée à 4096 Mo (`backend-typecheck.log`, vide).
- Lint des quatre fichiers : code 0, aucune erreur ni aucun avertissement (`backend-lint.log`, vide).
- Rejeu des références réelles : assertions des trois rejets attendus et des champs concernés réussies (`source-replay.json`, `replay-source.cjs`).
- `git diff --check` réussi ; les deux patchs reconstruisent le même arbre dans un index temporaire. L'index réel reste inchangé.

Les tests traversent le service de données, l'interprétation, le classement, le risque, le catalogue et l'orchestrateur. Les échanges PostgREST, la sauvegarde de session et les enrichissements facultatifs sont simulés. Les messages d'erreur dans les journaux correspondent notamment aux cas négatifs intentionnels ; le résumé final établit le résultat des suites.

Les **80 tests frontend**, types et preuve navigateur du lot précédent sont réutilisables comme preuves historiques : les fichiers frontend, dépendances et configurations sont inchangés. Les empreintes des 45 fichiers code/tests précédents concordaient au démarrage ; celles des fichiers hors de ce lot sont de nouveau contrôlées à l'assemblage.

Pas de nouvelle preuve navigateur, d'appel HTTP connecté au candidat, de build complet, de CI ou de validation PREPROD/PROD. Le rejeu du snapshot est hors ligne ; les consultations SQL seules sont connectées.

## Rapport initial et piste du retour après réparation

D02 et D07 sont renforcés sur l'intégrité des références et les cas négatifs. A04 reste ouvert concernant la calibration mécanique : ni poids ni règle de classement ne sont changés. Les conclusions des cinq lots antérieurs restent conservées ; les 28 constats initiaux ne sont pas tous clos.

Une lecture déléguée, bornée à six fichiers, n'a pas confirmé de confusion entre clic et réparation : `handoff` appelle `emitActionClicked`, et le client envoie un événement de navigation. `recent_repairs` représente du contexte antérieur et `answers` des réponses aux questions. Aucun parcours de confirmation de réparation n'a été trouvé dans ce périmètre. B03/D06 restent donc ouverts. L'implémentation interne complète de l'émetteur d'événements n'a pas été auditée ; cette recherche ne prouve pas une absence globale dans tout le dépôt.

Les questions complémentaires, leur effet causal, les DTC, les identités entre référentiels, les échéances constructeur, le dossier serveur rejouable et la validation mécanique restent des travaux distincts. Aucun mécanisme métier nouveau n'est activé ici.

## Livraison et reprise

Worktree : `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`, compte `deploy`, hôte `dev-automecanik`. Base `4a2871dc4d19067c3ae077d6a79021b49cc60237`. Candidat précédent `b0c2559089250217b1de80b7549b2cd72d2030ac`.

`patch-verification.json` identifie le candidat final, les reconstructions, les empreintes et le contrôle d'applicabilité sur le main observé. `diagnostic-cumulative.patch` contient les six lots ; `source-only.patch` part exclusivement du candidat précédent. Instructions et retour arrière dans `LISEZ-MOI.md` ; checkpoint court dans `CHECKPOINT.md`.

Travail non commité. Aucun push, PR, déploiement, changement de configuration ou écriture DB. Les migrations antérieures présentes dans le cumul restent non exécutées. Prochaine action : aligner le contrat d'urgence à partir d'une source métier vérifiée, puis éprouver les parcours concernés via une API connectée lors de l'intégration.
