# Vérification et amélioration — lot entretien autonome

Date : 27 septembre 2026. Statut : **VALIDATED_FOR_SCOPE_ONLY** pour ce lot ; **PARTIAL_COVERAGE** pour le rapport complet. Modifications autorisées par « Vérifier le rapport et corriger le code », puis « continue ».

## Résultat observable

Le même assistant propose désormais deux parcours : « Comprendre un symptôme » et « Vérifier mon entretien ». Le second utilise trois écrans : véhicule et compteur, opérations avec leur historique, puis échéances estimées. Il fonctionne sans symptôme ni système artificiel.

Chaque opération sélectionnée conserve son dernier kilométrage et sa date indépendamment. Laisser une valeur vide signifie « inconnue ». Zéro reste affiché et transmis comme zéro. Le brouillon conserve ces données, y compris après une erreur de soumission ou un rechargement. Le serveur rejette les doublons, dates impossibles/futures, kilométrages d’intervention supérieurs au compteur, sélection vide et mélange entretien/symptômes.

Les résultats montrent les données déclarées et les échéances calculées avec le moteur existant. Un historique de vidange ne remet pas les autres opérations à zéro. Le bilan n’appelle pas la chaîne de diagnostic de panne et ne produit pas de niveau de risque, de confiance diagnostique ou d’achat conseillé. Il indique explicitement que les intervalles sont génériques, que l’applicabilité constructeur n’est pas vérifiée et que le bilan n’est pas enregistré sur le serveur. L’impression reste disponible.

## Vérifications qui ont changé le diagnostic du rapport

1. **Les tables anciennes existent actuellement.** La lecture DB a confirmé `__diag_maintenance_operation`, `__diag_maintenance_symptom_link`, 30 opérations actives et 30 slugs distincts. Les bornes présentes sont positives et ordonnées ; aucun intervalle entièrement absent parmi ces 30 lignes. Le commentaire du calendrier évoquant des tables « ghost » était périmé. Il a été corrigé.
2. **Deux sources d’entretien restent distinctes.** Le calendrier KG contient 19 intervalles actifs. Le parcours ajouté réutilise les opérations et la formule déjà utilisées par `MaintenanceIntelligenceEngine`. Aucun rapprochement implicite des alias, copie de référentiel, nouveau moteur ou nouvelle RPC n’a été introduit. Cette différence de sources n’est pas résolue par ce lot.
3. **La panne de calendrier était masquée côté serveur.** `getSchedule` et `getAlerts` transformaient une erreur RPC en `[]`. Le loader frontend ne pouvait pas reconnaître ce faux succès vide. Ils renvoient désormais 503 pour erreur RPC ou réponse absente ; un succès contenant réellement `[]` reste valide. `getCalendar` propage l’échec.
4. **Le rendu nécessitait une adaptation au parcours.** Les essais navigateur ont révélé le texte « affiner le diagnostic » dans le bilan entretien. Le résultat utilise désormais « Limites et informations manquantes », avec un texte adapté aux estimations.

## Évolution des constats du rapport initial

| Constat | État après ce lot | Limite restante |
|---|---|---|
| A01 — entretien empêché par une entrée obligatoire de symptômes | Corrigé pour le parcours contrôlé et les intentions `maintenance_check`, `revision_check`, `preventive_check` | Pas de recommandation constructeur automatique |
| A02 — entretien global réinitialisant toutes les opérations | Historique indépendant utilisable dans le nouveau parcours ; moteur commun conservé | Le formulaire du parcours symptomatique conserve son ancien contexte global ; il ne suffit pas à renseigner toutes les opérations |
| A03 — informations sans profil et zéro perdus | Correction précédente conservée, affichage des compteurs zéro également corrigé | Sans changement sur les autres constats du score |
| A07/A08 — inconnus, échéances, bornes et dates | Correction précédente conservée ; dates estimées et points de départ désormais visibles | Les intervalles restent génériques, l’estimation n’établit pas l’usure |
| A09 — applicabilité véhicule | Non résolu ; limite explicitement affichée | Aucun mapping structuré moteur/équipement/opération vérifié |
| A10 — calendrier et erreurs | Pannes propagées jusqu’au client au lieu de faux calendrier vide | Statuts de la RPC KG encore fondés sur le compteur total ; pas de recalcul de cette RPC ici |
| D05 — sessions complètes et rejouables | Non résolu | Le bilan entretien annonce son absence de sauvegarde serveur ; aucun faux identifiant de session |

Les autres constats du premier audit conservent leur état. En particulier : questions adaptatives, exploitation des réponses, modes DTC/voyant/texte libre, correspondances KG, contexte MCP, observation après réparation et unification des sources ne sont pas déclarés corrigés.

## Preuves et portée

- **Backend : 166 tests distincts réussis.** 153 tests / 11 suites du moteur et du shadow KG, plus 13 tests / 2 suites du calculateur et du calendrier. Les nouveaux tests couvrent le contrat sans symptôme, les trois intentions, l’historique indépendant, les erreurs de source et le contournement de la couche d’intention réactive même lorsque son feature flag est actif.
- **Frontend : 28 tests pertinents réussis dans ce lot.** 19 tests / 3 fichiers d’intégration wizard/résultats, plus 9 tests du composant de saisie. Les 6 tests du calendrier/anciennes navigations du premier lot restent réutilisables : leurs fichiers et dépendances pertinents n’ont pas changé.
- **Types :** contrôles TypeScript complets backend et frontend réussis ; génération des types React Router réussie. Aucun changement de dépendance ni configuration de compilation.
- **Lint :** contrôles ciblés réussis sur le code et les tests frontend modifiés, le nouveau test backend dans `src`, et le service calendrier. Les deux tests historiques sous `backend/tests/unit` sont exclus du projet déclaré à ESLint : leur lint ne peut pas les analyser dans la configuration actuelle. Ils sont compilés et exécutés par Jest ; aucune configuration élargie pour masquer cette limite.
- **Navigateur Chromium isolé :** composant réel, CSS du projet, API simulées. Vérification du choix du parcours, bouton sans sélection, deux opérations, zéro/date, brouillon après rechargement, requête sans symptôme, écran résultat sur bureau et mobile. À 390 px, largeur du document = 390 px. Captures inspectées. Un 404 de favicon propre au harnais initial a été observé ; aucune erreur JavaScript applicative observée. Le serveur et le navigateur de vérification sont arrêtés.
- **Base réelle :** lectures SQL en transaction `READ ONLY`, uniquement pour la présence, les opérations, intervalles et leurs propriétés. Aucun calcul complet via le nouvel endpoint contre une instance applicative connectée n’a été exécuté.
- **Absence de preuve de livraison :** aucun commit, push, PR, passage CI/PREPROD ou déploiement PROD. Les migrations SQL candidates du premier lot restent non appliquées.

Commandes et preuves sont conservées dans `validation/`, `browser/`, `sql-evidence.json` et le manifeste. La première exécution du nouveau test backend échouait à la compilation sur la méthode absente ; ce n’est pas une preuve de régression comportementale. L’intégration frontend a montré 4 échecs avant intégration. Pour le calendrier, 6 échecs comportementaux ont été observés avant le correctif, puis 13 succès. Un test du contrôleur a ensuite détecté le passage indu dans la couche réactive, corrigé avant le résultat final.

## Fichiers principaux

- `backend/src/modules/diagnostic-engine/types/diagnostic-input.schema.ts` : deux contrats d’entrée, validation d’historique commune.
- `diagnostic-engine.data-service.ts` : lecture des opérations actives.
- `engines/maintenance-intelligence.engine.ts` : sélection explicite et calcul partagé avec l’entrée symptomatique.
- `diagnostic-engine.orchestrator.ts` et `diagnostic-engine.controller.ts` : branche entretien, endpoint de liste et exclusion de la chaîne réactive.
- `services/maintenance-calculator.service.ts` : propagation des erreurs du calendrier.
- `frontend/app/components/diagnostic-wizard/` : parcours, historique, restitution et conservation des valeurs inconnues.

Le lot modifie **19 fichiers de code/tests par rapport au premier candidat** ; le candidat cumulé contient **35 fichiers de code/tests modifiés par rapport à HEAD**. Les listes et empreintes exactes figurent dans le manifeste. Le premier livrable n’est pas remplacé.

## Limites et prochaine étape

La suite prioritaire consiste à établir une source d’entretien de référence et un mapping véhicule/opération vérifiable, puis à raccorder le calendrier KG au même historique. Elle doit comparer les 30 opérations et 19 intervalles, avec une correspondance explicite des identifiants et une source constructeur identifiable. Déduire automatiquement cette correspondance à partir des libellés créerait une nouvelle approximation.

Le rejeu de session et les questions adaptatives restent des lots distincts. Aucune validation fonctionnelle de ce lot n’autorise une intervention PROD.
