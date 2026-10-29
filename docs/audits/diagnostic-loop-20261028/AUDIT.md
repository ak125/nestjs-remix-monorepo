# Diagnostic — boucle gamme, symptômes, pannes, réparation et entretien

Audit du 28 octobre 2026, lots 1 à 3 de la mission « boucle diagnostic par gamme ».
Base : `c89a4eaa7`. Correctif : `ce2734a2c` (branche `feat/diagnostic-loop-obd-standby`).
Lectures DB en lecture seule. Aucune écriture, aucun DDL, aucun flag modifié.

Statut : **lots 1 et 2 implémentés et vérifiés en tests locaux ; lot 3 mesuré ; lots 4 à 7 bloqués par
l'absence de connaissances validées**. Rien n'est vérifié en PREPROD ni en PROD.

## 1. Diagnostic de l'existant

La chaîne technique existe : référentiel `__diag_*`, cinq moteurs déterministes (signal, scoring, risque,
catalogue, entretien), sauvegarde de session, projection WIKI → DB codée mais désactivée. Les sorties
« Diagnostic insuffisant » existent déjà côté backend (refus si signal inconnu, si les règles de sécurité
manquent ou si aucune hypothèse n'est couverte, `diagnostic-engine.orchestrator.ts:182,210,228`). Le score
relatif n'est pas affiché en pourcentage.

Ce qui manque est surtout de la **connaissance validée** :

- 162 liens symptôme → cause, **0 avec provenance** (`__diag_link_provenance` vide, 0 run de projection) ;
- exports WIKI : 6 relations `possible_cause` sur 5 gammes, toutes `reviewed=false`, `diagnostic_safe=false` ;
  aucune question, aucun contrôle, aucune action dans le schéma exporté ;
- aucune question discriminante validée ; `answers` est accepté par l'API et signalé « non interprété » ;
- aucun stockage d'issue de cas ; aucune donnée OBD/DTC exploitable.

Deux défauts de **câblage** cassaient l'entrée par catégorie et ont été corrigés (§3) :

- le wizard ne lisait pas `?cluster=` (0 occurrence dans `DiagnosticWizard.tsx` à la base) et présélectionnait
  `systemScope: "freinage"` : toute carte de catégorie (Refroidissement, Embrayage…) ouvrait Freinage ;
- le formulaire « Scanner » du hub menait à `?dtc=<code>`, que l'outil ne lisait pas non plus : le code était
  ignoré sans le dire et le visiteur arrivait sur Freinage.

## 2. Cartographie Information → Affichage

Types de défaut : **code**, **données**, **câblage**, **déploiement**, **flag** (fonction présente mais
désactivée).

| Information | Source | Validation | Projection | Service | Affichage | Lacune | Type |
|---|---|---|---|---|---|---|---|
| Systèmes (13) | `__diag_system` | aucune trace | — | `getSystems` → `GET /systems` | radios `StepSymptom` | catégories `moteur` et `electricite` sans système unique | données ; câblage corrigé |
| Symptômes (62) | `__diag_symptom` | aucune trace | — | `GET /symptoms?system=` | cases `StepSymptom` | valeurs `?symptome=` de `DiagnosticBanner` sans symptôme correspondant | câblage + données |
| Causes (58), liens (162) | `__diag_cause`, `__diag_symptom_cause_link` | 0 lien sourcé | projection WIKI codée, `DIAGNOSTIC_PROJECTION_ENABLED` OFF, 0 run | `HypothesisScoringEngine` | `ResultHypotheses` ; état de provenance seulement si `DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED` | connaissance non sourcée | données + flag |
| Fiches diagnostic WIKI | dépôt WIKI, exports `diagnostic` | 6 relations non revues | idem | — | — | ni questions, ni contrôles, ni actions dans le schéma | données |
| Règles de sécurité (21) | `__diag_safety_rule` | aucune trace | — | `RiskSafetyEngine` | `ResultSafety` | climatisation : 0 règle → refus voulu | données |
| Questions discriminantes | `__diag_context_questions` (5, génériques) | aucune source | — | RPC `get_context_questions`, aucun appelant | non affichées | `answers` jamais envoyé par le wizard, non interprété par l'orchestrateur | données puis code |
| Contrôles | `__diag_cause.verification_method` (texte libre, 58/58) | aucune source | — | recopié dans l'hypothèse | texte de l'hypothèse | pas de résultat de contrôle, pas de réévaluation | données + contrat |
| Orientation pièce cause → gamme | `CAUSE_GAMME_MAP` (constante TS, 63 couples) | aucune ; cohérente avec `pieces_gamme` (0 écart de `pg_id`) | — | `CatalogOrientationEngine` | `ResultCatalog` | non sourcée ; 4 causes sans gamme | données |
| Actions de réparation conditionnelles | absentes | — | — | — | — | aucune entité « action si preuve » | données + contrat |
| Opérations d'entretien (30), liens symptômes (75) | `__diag_maintenance_operation` (aucune colonne de source) | aucune | — | `MaintenanceIntelligenceEngine` (`applicability: unverified`) | `ResultMaintenance`, `StepMaintenance` | intervalles génériques ; 3 rattachements faux (§5) | données |
| Calendrier KG (19 intervalles) | `kg_nodes` `MaintenanceInterval` | `pending` ×19, `sources` vides, `source_type=oem` déclaré | — | `MaintenanceCalculatorService` via `kg_get_smart_maintenance_schedule` | calendrier d'entretien | « oem » sans source ni véhicule ; le statut fondé sur l'odomètre est neutralisé côté service | données |
| KG (89 nœuds, 72 arêtes) | `kg_nodes`, `kg_edges` | 70 `approved`, 19 `pending` | — | `KgShadowService` | aucun | `DIAGNOSTIC_KG_SHADOW_ENABLED` / `_PRIMARY_` OFF ; tables d'apprentissage vides | flag + données |
| Sessions (203) | `__diag_session` | — | — | sauvegarde après analyse | brouillon local seulement | aucune issue (réparation faite, cause confirmée) | contrat |
| Retours de cas → propositions | absent | — | — | — | — | aucun stockage ni flux | contrat |
| Codes OBD/DTC | aucune table ; `kg_nodes.dtc_code` = 0 ligne | — | — | aucun | hub (formulaire retiré ici) ; section DTC de `diagnostic-auto.$slug.tsx:455` | mis en veille (§3) | données |
| Entrée par catégorie | liens `?cluster=` du hub (`diagnostic-auto._index.tsx:401,532,568,624,883,889`) | — | — | — | wizard | Freinage par défaut → corrigé | câblage (corrigé) |
| Entrée par gamme (R1) | `GammeDiagnosticCTA` | — | — | — | lien générique | pas d'identité de gamme ; « 2 847 diagnostics ce mois » codé en dur (203 sessions au total) | câblage + données |

**Champs et tables non lus.** `__diag_symptoms` (31), `__diag_symptom_family` (35), `__diag_related_parts` (7)
et `__diag_context_questions` (5) ne sont lus que par les RPC `diagnose_symptoms`, `get_symptoms_by_subsystem`
et `get_context_questions`, qu'aucun code n'appelle ; `__diag_safe_phrases` (17) n'est lu par rien. Les
colonnes `plausible_km_*`/`plausible_age_*` de `__diag_cause` et `normal_wear_km_*` des opérations sont des
plages génériques sans source. Rien n'est supprimé : ces tables restent un héritage à statuer.

**Consommateurs divergents.**

- Entretien : `__diag_maintenance_operation` (plages) et `kg_nodes` (valeur unique) donnent deux réponses
  pour la même opération (§5) ; aucune des deux n'est sourcée.
- Symptômes : `__diag_symptom` (62, servi) et `__diag_symptoms` (31, non servi) coexistent.
- Courroie d'accessoire : l'orientation pièce vise le pg 10, l'opération d'entretien le pg 305.
- Pages R5 `diagnostic-auto.$slug` : observables SEO distincts du moteur ; deux d'entre eux affichent des codes
  `C00xx` sur des pages de disque de frein, sans lien avec le moteur.

**Fonctions dépendant d'un flag** (toutes OFF par défaut ; aucune n'est définie dans le `.env` DEV ; état
PREPROD/PROD non lu) : `DIAGNOSTIC_PROJECTION_ENABLED`, `DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED`,
`DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED` (ignoré sans EXPOSE), `DIAGNOSTIC_KG_SHADOW_ENABLED`,
`DIAGNOSTIC_KG_PRIMARY_ENABLED`, `DIAGNOSTIC_PIPELINE_V1_ENABLED` (bloc d'intention V1A).

**Données présentes seulement en fixtures.** Résultats avec provenance « sourced » ou « partial », réponses
au questionnaire qui modifieraient un score, dossiers avec `intent`/`recommended_actions` : ils n'existent que
dans les tests ; aucune donnée réelle ne les produit aujourd'hui.

## 3. Changements (lots 1 et 2, commit `ce2734a2c`)

**OBD en veille.**

- Hub : les deux formulaires de saisie de code et leur gestionnaire sont retirés. Les textes indiquent que la
  lecture des codes est en pause, et le bouton du bas devient « Décrire les symptômes » (ancre `#outil-diagnostic`).
- Wizard : un lien `?dtc=` affiche un avis `role="status"` : « La lecture des codes défaut (OBD) est en pause »,
  aucun diagnostic n'est déduit du code, plus un bouton « Continuer avec les symptômes ». Le code n'est repris
  que s'il a la forme d'un code DTC (`/^[PCBU][0-9A-F]{4}$/`). Il n'est ni envoyé ni interprété. La page et l'URL
  restent servies, sans redirection.
- Aucun flag créé : le frontend n'a pas de mécanisme de flag. Un flag qui ne commanderait rien ne serait pas
  gouverné. La veille est une absence de champ de saisie, réversible par `git revert`.

**Entrée par catégorie.**

- `?cluster=` sélectionne le système de même slug. Le wizard est remonté à chaque changement de catégorie (`key`).
- Aucun système n'est présélectionné. Un système demandé ou mémorisé que l'API ne propose pas est **effacé, jamais
  remplacé**, avec l'avis « ne correspond pas à un seul système de l'outil : choisissez… ». Aucune requête de
  symptômes ne part tant qu'aucun système valide n'est choisi, et « Lancer le diagnostic » reste désactivé.
- Une liste de systèmes vide est traitée comme une erreur, et non comme un choix possible.
- `?symptome=` affiche « Le symptôme indiqué par le lien n'est pas encore relié à l'outil », sans deviner de
  système : aucune correspondance validée n'existe entre ces valeurs et `__diag_symptom`.

Résultat pour les catégories du hub : `freinage`, `embrayage`, `suspension` et `refroidissement` ouvrent leur système ;
`moteur` et `electricite` demandent un choix.

## 4. Chemin réel des données

```
__diag_system/__diag_symptom ──GET /systems, /symptoms──▶ StepSymptom (choix)
        │
POST /api/diagnostic-engine/analyze { vehicle_context, symptom_slugs, usage_context, answers? }
        │  signal → scoring (__diag_symptom_cause_link, __diag_cause)
        │  → risque (__diag_safety_rule) → catalogue (CAUSE_GAMME_MAP)
        │  → entretien (__diag_maintenance_symptom_link, __diag_maintenance_operation)
        │  answers : signalé « non interprété », recopié dans la session
        ▼
evidence_pack ──▶ DiagnosticResults (sécurité, synthèse, hypothèses, entretien, catalogue, limites)
        └──▶ __diag_session (sauvegarde) ── fin : aucun retour d'issue
WIKI exports ──(projection OFF)──▶ __diag_link_provenance (0 ligne)
kg_nodes ──kg_get_smart_maintenance_schedule──▶ calendrier (statut odomètre neutralisé)
```

## 5. Matrice de couverture par gamme éligible

Gammes éligibles : les 53 gammes atteintes par `CAUSE_GAMME_MAP` (sur 241 gammes catalogue). Quatre causes
n'ont pas de gamme : `parasitic_drain`, `ground_cable_corroded`, `fuite_gaz_refrigerant`,
`boite_vitesses_usee`.

États : **validé** (sourcé et revu), **partiel**, **à valider** (présent sans source ni revue),
**manquant**, **N/A justifié**. Aucune cellule n'est « validé » : aucune donnée diagnostic n'a de provenance
revue. Aucune n'est « N/A justifié » : aucune source ne permet aujourd'hui de justifier une absence.

Colonnes uniformes, non répétées dans le tableau :

| Dimension | État pour les 53 gammes |
|---|---|
| Questions discriminantes | manquant |
| Contrôles structurés avec réévaluation | manquant (texte libre `verification_method` à valider) |
| Actions de réparation conditionnelles | manquant |
| Orientation pièce cause → gamme | à valider (`CAUSE_GAMME_MAP`, sans provenance) |

| Gamme | pg_id | Système(s) | Causes / symptômes | Liens symptôme → cause | Entretien | Règles de sécurité du système | Fiche WIKI exportée |
|---|---|---|---|---|---|---|---|
| bouteille-deshydratante | 851 | climatisation | 1 / 3 | à valider (3 liens, 0 sourcé) | manquant | manquant | manquant |
| compresseur-de-climatisation | 447 | climatisation | 1 / 2 | à valider (2 liens, 0 sourcé) | à valider : recharge_clim | manquant | manquant |
| condenseur-de-climatisation | 448 | climatisation | 1 / 2 | à valider (2 liens, 0 sourcé) | manquant | manquant | manquant |
| filtre-d-habitacle | 424 | climatisation + filtration | 2 / 4 | à valider (4 liens, 0 sourcé) | à valider : filtre_habitacle_clim, filtre_habitacle_replacement (intervalles contradictoires) | à valider (1) | à valider (non revue) |
| alternateur | 4 | demarrage_charge | 1 / 3 | à valider (3 liens, 0 sourcé) | à valider : alternator_check | à valider (4) | manquant |
| batterie | 1 | demarrage_charge | 2 / 7 | à valider (10 liens, 0 sourcé) | à valider : battery_replacement | à valider (4) | manquant |
| bougie-de-prechauffage | 243 | demarrage_charge | 1 / 2 | à valider (2 liens, 0 sourcé) | à valider : glow_plug_replacement | à valider (4) | manquant |
| demarreur | 2 | demarrage_charge | 1 / 2 | à valider (2 liens, 0 sourcé) | manquant | à valider (4) | manquant |
| barre-de-direction | 285 | direction | 1 / 2 | à valider (2 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| cremailliere-de-direction | 286 | direction | 1 / 4 | à valider (4 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| pompe-de-direction-assistee | 12 | direction | 1 / 3 | à valider (3 liens, 0 sourcé) | à valider : pompe_direction_replacement | à valider (1) | manquant |
| rotule-de-direction | 2066 | direction | 1 / 2 | à valider (2 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| courroie-d-accessoire | 10 | distribution | 1 / 2 | à valider (2 liens, 0 sourcé) | divergent : opération sur le pg 305 | à valider (1) | manquant |
| courroie-de-distribution | 306 | distribution | 1 / 3 | à valider (3 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| galet-tendeur-de-courroie-de-distribution | 308 | distribution | 1 / 3 | à valider (3 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| kit-de-distribution | 307 | distribution | 1 / 3 | à valider (3 liens, 0 sourcé) | à valider : kit_distribution_replacement | à valider (1) | manquant |
| kit-de-distribution-avec-pompe-a-eau | 3096 | distribution | 1 / 3 | à valider (3 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| pompe-a-eau | 1260 | distribution + refroidissement | 2 / 5 | à valider (5 liens, 0 sourcé) | à valider : water_pump_replacement | à valider (4) | manquant |
| catalyseur | 429 | echappement | 1 / 3 | à valider (3 liens, 0 sourcé) | à valider : controle_echappement | à valider (1) | manquant |
| joint-de-collecteur | 40 | echappement | 1 / 2 | à valider (2 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| silencieux | 26 | echappement | 1 / 2 | à valider (2 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| sonde-lambda | 3922 | echappement | 1 / 2 | à valider (2 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| tuyau-flexible-echappement | 3191 | echappement | 1 / 2 | à valider (2 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| ampoule | 1457 | eclairage | 1 / 4 | à valider (4 liens, 0 sourcé) | à valider : controle_eclairage | à valider (1) | manquant |
| feu-arriere | 290 | eclairage | 1 / 2 | à valider (2 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| feu-avant | 259 | eclairage | 1 / 4 | à valider (4 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| butee-d-embrayage | 48 | embrayage | 1 / 3 | à valider (3 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| emetteur-d-embrayage | 234 | embrayage | 1 / 3 | à valider (3 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| kit-d-embrayage | 479 | embrayage | 1 / 2 | à valider (2 liens, 0 sourcé) | défaut : `brake_fluid_change` rattachée au pg 479 | à valider (1) | manquant |
| recepteur-d-embrayage | 620 | embrayage | 1 / 3 | à valider (3 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| volant-moteur | 577 | embrayage | 1 / 3 | à valider (3 liens, 0 sourcé) | à valider : volant_moteur_replacement | à valider (1) | manquant |
| filtre-a-air | 8 | filtration | 1 / 2 | à valider (2 liens, 0 sourcé) | à valider : filtre_air_replacement | à valider (1) | à valider (non revue) |
| filtre-a-huile | 7 | filtration | 1 / 2 | à valider (2 liens, 0 sourcé) | à valider : filtre_huile_replacement | à valider (1) | à valider (non revue) |
| filtre-a-carburant | 9 | filtration + injection | 2 / 4 | à valider (4 liens, 0 sourcé) | à valider : filtre_carburant_replacement | à valider (2) | à valider (non revue) |
| disque-de-frein | 82 | freinage | 1 / 3 | à valider (3 liens, 0 sourcé) | à valider : brake_disc_replacement | à valider (4) | manquant |
| etrier-de-frein | 78 | freinage | 2 / 5 | à valider (8 liens, 0 sourcé) | à valider : brake_caliper_overhaul | à valider (4) | manquant |
| liquide-de-frein | 71 | freinage | 1 / 1 | à valider (1 lien, 0 sourcé) | défaut : `brake_fluid_change` porte le pg 479 | à valider (4) | manquant |
| plaquette-de-frein | 402 | freinage | 1 / 5 | à valider (5 liens, 0 sourcé) | à valider : brake_pads_replacement | à valider (4) | à valider (non revue) |
| bobine-d-allumage | 689 | injection | 1 / 2 | à valider (2 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| injecteur | 3902 | injection | 1 / 5 | à valider (5 liens, 0 sourcé) | à valider : injecteur_nettoyage | à valider (1) | manquant |
| pompe-a-injection | 3904 | injection | 1 / 2 | à valider (2 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| durite-de-refroidissement | 475 | refroidissement | 1 / 4 | à valider (4 liens, 0 sourcé) | à valider : coolant_flush, coolant_hose_inspection (vidange rattachée à la durite) | à valider (3) | manquant |
| radiateur-de-refroidissement | 470 | refroidissement | 1 / 2 | à valider (2 liens, 0 sourcé) | manquant | à valider (3) | manquant |
| thermostat | 316 | refroidissement | 2 / 5 | à valider (6 liens, 0 sourcé) | à valider : thermostat_replacement | à valider (3) | manquant |
| vase-d-expansion | 397 | refroidissement | 1 / 4 | à valider (4 liens, 0 sourcé) | manquant | à valider (3) | manquant |
| ventilateur-de-refroidissement | 508 | refroidissement | 1 / 2 | à valider (2 liens, 0 sourcé) | manquant | à valider (3) | manquant |
| amortisseur | 854 | suspension | 1 / 5 | à valider (5 liens, 0 sourcé) | à valider : amortisseur_replacement | à valider (2) | manquant |
| kit-de-butee-de-suspension | 1632 | suspension | 1 / 3 | à valider (3 liens, 0 sourcé) | manquant | à valider (2) | manquant |
| ressort-de-suspension | 188 | suspension | 1 / 2 | à valider (2 liens, 0 sourcé) | manquant | à valider (2) | manquant |
| rotule-de-suspension | 2462 | suspension | 1 / 3 | à valider (3 liens, 0 sourcé) | manquant | à valider (2) | manquant |
| silentbloc-de-bras-de-suspension | 251 | suspension | 1 / 4 | à valider (4 liens, 0 sourcé) | à valider : silentbloc_replacement | à valider (2) | manquant |
| cardan | 13 | transmission | 1 / 3 | à valider (3 liens, 0 sourcé) | manquant | à valider (1) | manquant |
| soufflet-de-cardan | 193 | transmission | 1 / 3 | à valider (3 liens, 0 sourcé) | à valider : soufflet_cardan_replacement | à valider (1) | manquant |

Totaux sur 53 gammes : liens à valider 53 ; entretien à valider 23, défaut ou divergent 3, manquant 27 ;
règles de sécurité à valider 50, manquant 3 (climatisation seule) ; fiche WIKI à valider 5, manquant 48.

Opérations d'entretien hors de ces 53 gammes : `bougie_allumage_replacement` (pg 686),
`kit_embrayage_replacement` (pg 3825), `courroie_accessoires_replacement` (pg 305),
`battery_terminal_cleaning` (sans gamme).

**Entretien comparé au calendrier KG.** Aucune des deux sources n'est sourcée : `kg_nodes` déclare
`source_type=oem` avec `sources` vides et `validation_status=pending`, et l'intervalle n'est pas propre à un
véhicule. C'est un **intervalle générique**, pas une règle constructeur.

| Opération | `__diag` km / mois | KG km / mois | Constat |
|---|---|---|---|
| filtre_huile_replacement | 10 000–30 000 / 12–24 | 15 000 / 12 | KG dans la plage |
| filtre_air_replacement | 15 000–40 000 / 12–24 | 30 000 / 24 | KG dans la plage |
| filtre_habitacle_replacement / _clim | 15 000–30 000 / 12–18 et 15 000–20 000 / 12 | 15 000 / 12 | deux opérations pour une pièce |
| kit_distribution_replacement | 80 000–160 000 / 48–72 | 120 000 / 72 | KG dans la plage |
| brake_pads_replacement | 20 000–60 000 / 24–48 | 40 000 / — | axe temps absent du KG |
| brake_disc_replacement | 40 000–80 000 / 36–72 | 70 000 / — | axe temps absent du KG |
| brake_fluid_change | — / 24–36 | — / 24 | concordant ; `pg_id` faux (479) |
| coolant_flush | 60 000 / 48 | 60 000 / 48 | identique ; rattaché à la durite |
| amortisseur_replacement | 60 000–100 000 / 48–96 | 90 000 / 72 | KG dans la plage |
| battery_replacement | — / 48–72 | — / 60 | KG dans la plage |
| bougie_allumage_replacement | 30 000–60 000 / 36–72 | 60 000 / — | borne haute |
| glow_plug_replacement | 80 000–150 000 / 60–120 | 100 000 / — | KG dans la plage |
| recharge_clim | 40 000–80 000 / 24–36 | — / 24 | `__diag` ajoute un axe km |
| vidange moteur, BVM, BVA, pneus, contrôle freinage | absentes | présentes | KG seul |

Le moteur d'entretien respecte déjà trois exigences du lot 5 :

- l'échéance d'une opération n'est ancrée que sur l'historique de cette opération ;
- les axes km et temps sont calculés séparément, et l'inconnu reste « historique de cette opération inconnu » ;
- le calendrier KG ne déduit plus de statut à partir du seul odomètre (`maintenance-calendar-integrity.test.ts`).

## 6. Blocages des lots 4 à 7 et extensions de contrat proposées

Toutes ces propositions sont des **propositions**, pas des normes. Le format des fiches diagnostic relève du
WIKI et de l'ADR-117 ; une migration ne serait qu'un fichier, appliqué par le propriétaire.

**Lot 4 — questions → contrôles → réévaluation.** Bloqué par les données : aucune question ni aucun contrôle
validé n'existe. Brancher `answers` sur les scores sans connaissance revue reviendrait à inventer des poids.
Extension proposée :

- fiche WIKI `discriminating_questions[]` : `id`, `texte`, `effet` par réponse sur une cause nommée, `source_ref` ;
- fiche WIKI `checks[]` : `id`, `procédure`, `résultat attendu`, `effet` ;
- API : `answers` à quatre valeurs `oui | non | ne_sait_pas | non_effectue`. Seules `oui` et `non` peuvent
  devenir des preuves ; les deux autres restent listées comme inconnues ;
- l'orchestrateur garde le message « non interprété » pour toute question sans effet validé.

**Lot 5 — réparation et entretien.**

- À faire, sur données : corriger les trois rattachements faux, ce qui demande une écriture DB (GO
  propriétaire) ; ajouter à chaque opération une base d'intervalle `constructeur | générique | estimation` et une
  `source_ref`.
- « Usure observée » (les plages `normal_wear_km`) et « hypothèse de panne » (les causes) sont déjà des objets
  distincts.
- Actions conditionnelles : entité WIKI `repair_actions[]` (`condition` = preuves ou contrôles requis, `action`,
  `gamme`), à projeter comme les liens.

**Lot 6 — retours → propositions → validation.** Bloqué par le contrat : aucun stockage d'issue. Proposition :

- table `__diag_case_outcome` : session, intervention effectuée, cause confirmée, pièce, km et date déclarés ;
- table `__diag_knowledge_proposal` : agrégat **idempotent** (clé = règle visée + version de la connaissance),
  statut `pending`, contradictions conservées. Aucune application automatique : la validation passe par une PR
  WIKI, puis par la projection ;
- les données personnelles restent dans la session et ne sont jamais copiées dans la proposition.

**Lot 2 bis — entrée par gamme.** Un lien `?gamme=` depuis R1 suppose deux choses : une connaissance
gamme → symptômes validée, et une modification de liens sur des pages indexées (autorisation SEO). Rien n'a
été ajouté.

**Lot 7 — extension.** Sans objet tant que les lots 4 à 6 ne sont pas alimentés.

## 7. Exemple de boucle complète (état réel)

Un visiteur clique « Refroidissement » sur le hub (`/diagnostic-auto?cluster=refroidissement`) :

1. **Réel** : le système Refroidissement est sélectionné et ses 6 symptômes sont chargés ; le visiteur coche
   « Température monte rapidement » (`temp_rises_fast`).
2. **Réel** : l'analyse classe les trois causes liées (`coolant_level_low`, `thermostat_stuck_closed`,
   `water_pump_failing`), dont aucune n'est sourcée. Elle applique les 3 règles de sécurité du système, oriente
   vers les familles de `CAUSE_GAMME_MAP` (durite, vase d'expansion, thermostat, pompe à eau) et propose
   l'opération liée `water_pump_replacement` avec un intervalle générique.
3. **Réel** : la session est enregistrée.
4. **Absent** : question discriminante, contrôle, réévaluation, action conditionnelle.
5. **Absent** : retour du visiteur sur la réparation effectuée ; aucune proposition d'enrichissement.

Cet exemple est tiré du code et des données. Il n'a pas été exécuté contre l'API : une analyse réelle écrit une
session dans la base partagée.

## 8. Conditions de réactivation OBD

Aucune n'est remplie aujourd'hui.

1. Fiches WIKI DTC sourcées et revues (`reviewed=true`, `diagnostic_safe=true`) : code → système →
   symptômes → causes. Zéro association inventée.
2. Projection gouvernée vers la DB, avec provenance par association. Couverture mesurée code par code.
3. Contrat API : un code non couvert renvoie « code non couvert », jamais une absence de panne.
4. Seuil de couverture minimal fixé par le propriétaire avant toute réouverture.
5. Réouverture du champ de saisie par une PR dédiée, avec GO propriétaire et vérification PREPROD.
6. Méta et JSON-LD de la page alignés seulement avec l'autorisation SEO (§9).

## 9. Points hors mandat signalés, non modifiés

- `diagnostic-auto._index.tsx:150-167` : titre et description indexés mentionnent les « codes OBD ».
- `diagnostic-auto._index.tsx:212` : l'étape JSON-LD HowTo « Scanner le code OBD … Entrez le code dans notre
  outil » est désormais inexacte. C'est du SEO indexé, qui demande une autorisation.
- `diagnostic-auto.$slug.tsx:455-490` : section DTC des pages R5, alimentée par les observables SEO.
- `components/home/DiagnosticBanner.tsx:37` : valeurs `?symptome=` qui ne correspondent à aucun symptôme
  (elles affichent désormais l'avis).
- `components/gamme/GammeDiagnosticCTA.tsx:68` : compteur « 2 847 diagnostics ce mois » codé en dur.
- Données : `brake_fluid_change.related_pg_id = 479` (kit d'embrayage) ; `related_gamme_slug` des opérations
  de refroidissement contient des libellés ; `battery_terminal_cleaning` sans gamme.

## 10. Validation et retour arrière

| Preuve | Résultat |
|---|---|
| vitest diagnostic (16 fichiers) | 156 tests réussis |
| Nouveaux tests sur le code de base | 8 échecs (7 `diagnostic-entry-params`, 1 hub) |
| `tsc` frontend, fichiers diagnostic | 0 erreur (24 TS2307 d'environnement hors périmètre) |
| ESLint fichiers modifiés | exit 0 |
| PREPROD / PROD | non vérifié |

Contrôles PREPROD après fusion : `/diagnostic-auto?dtc=P0300` (avis, aucune requête `analyze`) ;
`?cluster=refroidissement` (Refroidissement sélectionné) ; `?cluster=moteur` (choix demandé, bouton désactivé) ;
hub sans champ de code.

Retour arrière : `git revert ce2734a2c`. Aucun changement DB, flag, URL ou méta.

## Références

Audits du 27 et 28 septembre 2026 (`docs/audits/diagnostic-*-2026092{7,8}/`), en particulier
`diagnostic-coverage-20260928` (réponses non interprétées) et `diagnostic-calendar-20260927` (calendrier) ;
`docs/plans/2026-09-26-diagnostic-integrity.md` ; `docs/specs/2026-09-30-diagnostic-wiki-provenance-design.md`.
