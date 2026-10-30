# Couverture diagnostic des gammes publiées et des symptômes — photo du 2026-10-29

Complète la §5 de [AUDIT.md](AUDIT.md). Cette §5 ne détaillait que les 53 gammes atteintes par
`CAUSE_GAMME_MAP`. La cible est fixée par ADR-113 : toutes les gammes publiées (D1) et tous les symptômes
actifs du vocabulaire (D3). Ce document les liste toutes.

Photo prise en lecture seule, sans aucune écriture. Elle n'est pas la mesure officielle : ADR-113 D5 la
publie à chaque exécution de la projection, et ce calcul n'existe pas encore dans le code. Sources lues :

- base (transaction en lecture seule) : `__pg_gammes`, `__diag_symptom`, `__diag_cause`,
  `__diag_symptom_cause_link` ;
- WIKI `automecanik-wiki` `main` à `edae4a9` : fiches `wiki/gamme/*.md` ;
- RAW `automecanik-raw` `main` à `2c6a242` : `sources/auto-captures/<gamme>/` et
  `recycled/rag-knowledge/gammes/` ;
- monorepo `main` à `a3b4fe49e` : `CAUSE_GAMME_MAP`.

## 1. Résultat

| Mesure ADR-113 | Dénominateur du jour | Résultat |
|---|---|---|
| Gammes (D2) | 232 gammes publiées | couvertes 0, sans objet 0, **non couvertes 232** |
| Symptômes (D3) | 62 symptômes actifs | reliés 0, hors périmètre 0, en attente 0, **non reliés 62** |
| Véhicules (D4) | non recalculé ici | état initial d'ADR-113 D6 |

Aucune gamme n'est couverte : aucune affirmation n'a encore été relue (`reviewed: true`). Aucun symptôme
n'est « en attente » au sens de D3 : chacun a au moins un lien de l'amorce vers une cause rattachée à une
pièce. Les 162 liens de l'amorce restent non sourcés (ADR-112 D2).

## 2. Où en est chaque gamme

Chaque gamme est rangée à l'étape la plus avancée qu'elle atteint. Total : 232.

| Étape atteinte | Gammes | Ce qui manque pour avancer |
|---|---|---|
| Fiche WIKI validée, relations non relues | 5 | relecture des relations |
| Sources capturées en RAW, pas de fiche | 5 | fiche WIKI avec relations sourcées |
| Amorce seule : liens en base, aucune source | 38 | capture de sources |
| Brouillon de l'ancien corpus seul | 171 | capture de sources |
| Aucune donnée | 13 | capture de sources |

Les 5 fiches WIKI portent 6 relations, toutes `reviewed: false` : `filtre-a-air`, `filtre-a-carburant`,
`filtre-a-huile` (2), `filtre-d-habitacle`, `plaquette-de-frein`. Les 5 gammes à sources capturées sans
fiche sont `courroie-d-accessoire`, `disque-de-frein`, `support-moteur`, `thermostat`, `vanne-egr`.

## 3. Constats

**L'ancien corpus n'est pas une connaissance.** 219 gammes publiées sur 232 ont une fiche dans
`recycled/rag-knowledge/gammes/` avec une liste de symptômes : 216 en `draft`, 2 `verified`, 1 `reviewed`.
Ces listes ne citent aucune source par symptôme. Leur qualité le confirme : la fiche `thermostat` classe
l'aiguille de température dans le rouge en gravité « confort » et compte « plus de 100 000 km sans
remplacement » parmi les symptômes. Elles servent de piste à la recherche de sources (ADR-096), jamais de
contenu à projeter (ADR-031, ADR-046).

**Le vocabulaire ne couvre peut-être pas toutes les familles de pièces.** Les 62 symptômes se répartissent
sur 13 systèmes. La catégorie que l'ancien corpus donne aux gammes, non sourcée, sert ici d'indice : 108
gammes publiées ont une catégorie sans système du même nom, et 13 n'ont pas de fiche dans l'ancien corpus,
donc pas de catégorie. Le détail des 108 : accessoires 26, moteur 24, alimentation 21, capteurs 18,
allumage 7, turbo 5, électrique 4, support moteur 2, tableau de bord 1. Certaines peuvent relever d'un
système existant (allumage ou alimentation et injection, électrique et démarrage-charge). Pour les autres,
seule une fiche sourcée dira si un symptôme manque au vocabulaire. Un symptôme nouveau naît par migration
relue, jamais par le writer (ADR-112 D1). Le constat « sans objet diagnostic » se juge par rapport à ce
vocabulaire : la fiche porte, relu et motivé, le constat que la gamme n'a aucune relation avec un symptôme
du vocabulaire (ADR-113 D2).

**Huit causes de l'amorce visent sept gammes non publiées.** `CAUSE_GAMME_MAP` rattache huit causes à
`batterie` (pg 1), `silencieux` (26), `liquide-de-frein` (71), `silentbloc-de-bras-de-suspension` (251),
`ampoule` (1457), `kit-de-distribution-avec-pompe-a-eau` (3096) et `tuyau-flexible-echappement` (3191).
Deux de ces causes ont aussi une gamme publiée : `courroie_distribution_usee` et `joint_collecteur_hs`.
Ces gammes non publiées ont `pg_display = 0` : elles sont hors du périmètre d'ADR-113 D1 et
n'apparaissent pas dans la liste ci-dessous. Les y faire entrer demande un amendement d'ADR-113. Cette
correspondance est remplacée en phase 3 d'ADR-112 par la table cause → pièce issue du WIKI. Rien n'est
modifié ici.

## 4. Chemin vers une couverture complète

Le mécanisme est le même pour chaque gamme. Le filtre à air est la gamme la plus avancée : sources
capturées (RAW #76 fusionnée), fiche WIKI portant une relation non relue, catalogage de ses sources en
cours (WIKI #126, brouillon). Ni la relecture ni la projection n'y sont commencées. Les étapes :

1. capture de sources identifiables pour la gamme (ADR-096) ;
2. fiche WIKI avec ses relations symptôme → cause, chacune citant ses sources ;
3. relecture : par la règle de preuve d'ADR-116 pour une relation hors sécurité, par un humain pour une
   relation de sécurité ;
4. projection en base par la voie unique (ADR-112 D2), puis mesure ADR-113 D5.

Après le système pilote d'ADR-112, ces étapes se répètent système par système jusqu'à la cible, sans
date. Le rythme est celui de la capture de sources (ADR-113 D7). Aucune relation n'est écrite pour
atteindre la cible (ADR-113 D2). Une gamme sans source reste « non couverte » et figure comme telle dans
la liste.

## 5. Les 232 gammes publiées

Colonnes : relations WIKI (total / relues), fichiers capturés dans `sources/auto-captures/<gamme>/`,
causes de l'amorce rattachées par `CAUSE_GAMME_MAP`, nombre de symptômes du brouillon de l'ancien corpus
et sa catégorie (indices non sourcés).

| Gamme | pg_id | État ADR-113 | Étape atteinte | Relations WIKI | Captures RAW | Causes de l'amorce | Symptômes brouillon | Catégorie brouillon |
|---|---|---|---|---|---|---|---|---|
| filtre-a-air | 8 | non couverte | fiche WIKI, relations non relues | 1 / 0 | 5 | `filtre_air_colmate` | 6 | filtration |
| filtre-a-carburant | 9 | non couverte | fiche WIKI, relations non relues | 1 / 0 | — | `filtre_carburant_colmate`, `filtre_carburant_injection` | 6 | filtration |
| filtre-a-huile | 7 | non couverte | fiche WIKI, relations non relues | 2 / 0 | 3 | `filtre_huile_colmate` | 5 | filtration |
| filtre-d-habitacle | 424 | non couverte | fiche WIKI, relations non relues | 1 / 0 | 1 | `filtre_habitacle_clim`, `filtre_habitacle_sature` | 6 | filtration |
| plaquette-de-frein | 402 | non couverte | fiche WIKI, relations non relues | 1 / 0 | 6 | `brake_pads_worn` | 3 | freinage |
| courroie-d-accessoire | 10 | non couverte | sources capturées, pas de fiche | — | 1 | `courroie_accessoires_usee` | 6 | distribution |
| disque-de-frein | 82 | non couverte | sources capturées, pas de fiche | — | 4 | `brake_disc_warped` | 7 | freinage |
| support-moteur | 247 | non couverte | sources capturées, pas de fiche | — | 1 | — | 6 | support_moteur |
| thermostat | 316 | non couverte | sources capturées, pas de fiche | — | 1 | `thermostat_stuck_closed`, `thermostat_stuck_open` | 6 | refroidissement |
| vanne-egr | 1145 | non couverte | sources capturées, pas de fiche | — | 1 | — | 6 | alimentation |
| alternateur | 4 | non couverte | amorce seule, sans source | — | — | `alternator_failing` | 6 | electrique |
| amortisseur | 854 | non couverte | amorce seule, sans source | — | — | `amortisseur_use` | 6 | suspension |
| barre-de-direction | 285 | non couverte | amorce seule, sans source | — | — | `biellette_direction_usee` | 6 | direction |
| bobine-d-allumage | 689 | non couverte | amorce seule, sans source | — | — | `bobine_allumage_hs` | 6 | allumage |
| bougie-de-prechauffage | 243 | non couverte | amorce seule, sans source | — | — | `glow_plugs_failing` | 6 | allumage |
| bouteille-deshydratante | 851 | non couverte | amorce seule, sans source | — | — | `deshydrateur_sature` | 6 | climatisation |
| butee-d-embrayage | 48 | non couverte | amorce seule, sans source | — | — | `butee_embrayage_hs` | 6 | embrayage |
| cardan | 13 | non couverte | amorce seule, sans source | — | — | `cardan_use` | 6 | transmission |
| catalyseur | 429 | non couverte | amorce seule, sans source | — | — | `catalyseur_colmate` | 6 | echappement |
| compresseur-de-climatisation | 447 | non couverte | amorce seule, sans source | — | — | `compresseur_clim_hs` | 9 | climatisation |
| condenseur-de-climatisation | 448 | non couverte | amorce seule, sans source | — | — | `condenseur_clim_bouche` | 9 | climatisation |
| courroie-de-distribution | 306 | non couverte | amorce seule, sans source | — | — | `courroie_distribution_usee` | 7 | distribution |
| cremailliere-de-direction | 286 | non couverte | amorce seule, sans source | — | — | `cremaillere_usee` | 6 | direction |
| demarreur | 2 | non couverte | amorce seule, sans source | — | — | `starter_solenoid_worn` | 6 | electrique |
| durite-de-refroidissement | 475 | non couverte | amorce seule, sans source | — | — | `coolant_level_low` | 6 | refroidissement |
| emetteur-d-embrayage | 234 | non couverte | amorce seule, sans source | — | — | `emetteur_recepteur_defaillant` | 6 | embrayage |
| etrier-de-frein | 78 | non couverte | amorce seule, sans source | — | — | `brake_caliper_seized`, `brake_slide_pins_dry` | 6 | freinage |
| feu-arriere | 290 | non couverte | amorce seule, sans source | — | — | `feu_arriere_defaillant` | 8 | eclairage |
| feu-avant | 259 | non couverte | amorce seule, sans source | — | — | `feu_avant_defaillant` | 8 | eclairage |
| galet-tendeur-de-courroie-de-distribution | 308 | non couverte | amorce seule, sans source | — | — | `galet_tendeur_defaillant` | 7 | distribution |
| injecteur | 3902 | non couverte | amorce seule, sans source | — | — | `injecteur_encrasse` | 6 | alimentation |
| joint-de-collecteur | 40 | non couverte | amorce seule, sans source | — | — | `joint_collecteur_hs` | 6 | moteur |
| kit-d-embrayage | 479 | non couverte | amorce seule, sans source | — | — | `disque_embrayage_use` | 6 | embrayage |
| kit-de-butee-de-suspension | 1632 | non couverte | amorce seule, sans source | — | — | `coupelle_amortisseur_hs` | 6 | suspension |
| kit-de-distribution | 307 | non couverte | amorce seule, sans source | — | — | `courroie_distribution_usee` | 7 | distribution |
| pompe-a-eau | 1260 | non couverte | amorce seule, sans source | — | — | `pompe_eau_distribution`, `water_pump_failing` | 6 | distribution |
| pompe-a-injection | 3904 | non couverte | amorce seule, sans source | — | — | `pompe_injection_hs` | 3 | alimentation |
| pompe-de-direction-assistee | 12 | non couverte | amorce seule, sans source | — | — | `pompe_direction_hs` | 6 | direction |
| radiateur-de-refroidissement | 470 | non couverte | amorce seule, sans source | — | — | `radiator_clogged` | 6 | refroidissement |
| recepteur-d-embrayage | 620 | non couverte | amorce seule, sans source | — | — | `emetteur_recepteur_defaillant` | 6 | embrayage |
| ressort-de-suspension | 188 | non couverte | amorce seule, sans source | — | — | `ressort_casse` | 6 | suspension |
| rotule-de-direction | 2066 | non couverte | amorce seule, sans source | — | — | `rotule_direction_usee` | 6 | direction |
| rotule-de-suspension | 2462 | non couverte | amorce seule, sans source | — | — | `rotule_suspension_hs` | 6 | direction |
| sonde-lambda | 3922 | non couverte | amorce seule, sans source | — | — | `sonde_lambda_hs` | 8 | capteurs |
| soufflet-de-cardan | 193 | non couverte | amorce seule, sans source | — | — | `soufflet_cardan_dechire` | 6 | transmission |
| vase-d-expansion | 397 | non couverte | amorce seule, sans source | — | — | `coolant_level_low` | 3 | refroidissement |
| ventilateur-de-refroidissement | 508 | non couverte | amorce seule, sans source | — | — | `cooling_fan_failure` | 6 | refroidissement |
| volant-moteur | 577 | non couverte | amorce seule, sans source | — | — | `volant_moteur_bimasse_hs` | 6 | embrayage |
| accumulateur-de-pression-de-carburant | 1303 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | alimentation |
| agregat-de-freinage | 415 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | freinage |
| amortisseur-de-direction | 130 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | direction |
| ampoule-eclairage-interieur | 117 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | eclairage |
| ampoule-feu-arriere | 115 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | eclairage |
| ampoule-feu-avant | 107 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | eclairage |
| ampoule-feu-clignotant | 105 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | eclairage |
| ampoule-feu-de-position | 2126 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | eclairage |
| ampoule-feu-de-recul | 114 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | eclairage |
| ampoule-feu-eclaireur-de-plaque | 112 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | eclairage |
| ampoule-feu-stop | 111 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 5 | eclairage |
| arbre-a-came | 566 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | moteur |
| attelage | 39 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 9 | accessoires |
| avertisseur-sonore | 297 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| bague-d-etancheite-boite-automatique | 626 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | moteur |
| bague-d-etancheite-cardan | 624 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | transmission |
| bagues-d-etancheite-moteur | 3874 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | moteur |
| balais-d-essuie-glace | 298 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | accessoires |
| ballast-a-lampe-xenon | 1431 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | eclairage |
| barre-stabilisatrice | 274 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | direction |
| biellette-de-barre-stabilisatrice | 3230 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | direction |
| boitier-de-prechauffage | 1750 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | allumage |
| bouchon-de-radiateur | 548 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | refroidissement |
| bouchon-de-vidange | 593 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | moteur |
| bouchon-reservoir-de-carburant | 602 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| bouchon-vase-d-expansion | 56 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | refroidissement |
| bougie-d-allumage | 686 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | allumage |
| boulon-de-roue | 657 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| bras-d-essuie-glace | 301 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| bras-de-suspension | 273 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | direction |
| bride-de-liquide-de-refroidissement | 3219 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | refroidissement |
| butee-elastique-d-amortisseur | 1182 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | suspension |
| cable-d-accelerateur | 618 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| cable-d-embrayage | 478 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | embrayage |
| cable-de-capot-moteur | 1238 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| cable-de-compteur-de-vitesse | 1150 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 5 | tableau-de-bord |
| cable-de-frein-a-main | 124 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | freinage |
| capteur-abs | 412 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 8 | capteurs |
| capteur-controle-de-pression-des-pneus | 2232 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| capteur-de-cognement | 3921 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | capteurs |
| capteur-de-pedale-d-accelerateur | 3908 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | capteurs |
| capteur-de-pluie | 2275 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| capteur-de-pression-common-rail | 3996 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | capteurs |
| capteur-de-pression-turbo | 3553 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | turbo |
| capteur-impulsion | 4813 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | capteurs |
| capteur-niveau-d-huile-moteur | 1289 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | capteurs |
| capteur-parctronic | 2623 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| capteur-pression-de-carburant | 817 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | capteurs |
| capteur-pression-de-gaz-d-echappement | 4272 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | capteurs |
| capteur-pression-du-tuyau-d-admission | 3947 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | capteurs |
| capteur-pression-et-temperature-d-huile | 4175 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | capteurs |
| capteur-temperature-d-air-admission | 3939 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | capteurs |
| capteur-temperature-de-climatisation | 2054 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 9 | climatisation |
| carter-d-huile | 592 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | moteur |
| chaine-de-distribution | 1123 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 7 | distribution |
| collecteur-d-echappement | 1543 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | echappement |
| colonne-de-direction | 1211 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | direction |
| commande-correcteur-de-portee | 1432 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | eclairage |
| commande-d-eclairage | 809 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | eclairage |
| commande-d-essuie-glace | 751 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 9 | accessoires |
| commande-de-ventilation | 1385 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 9 | climatisation |
| conduite-a-haute-pression-d-injection | 3916 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | alimentation |
| conduite-de-climatisation | 2094 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | climatisation |
| contacteur-de-feu-de-recul | 807 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 8 | eclairage |
| contacteur-demarreur | 682 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | electrique |
| corps-papillon | 158 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | alimentation |
| correcteur-de-portee | 700 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | eclairage |
| culbuteur | 432 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | moteur |
| cylindre-de-roue | 277 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 9 | freinage |
| debitmetre-d-air | 3927 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | alimentation |
| detecteur-de-l-angle-de-braquage | 3252 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | direction |
| detendeur-de-climatisation | 183 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | climatisation |
| distributeur-d-allumage | 683 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | allumage |
| electrovanne | 3890 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | capteurs |
| evaporateur-de-climatisation | 471 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | climatisation |
| faisceau-d-allumage | 685 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | allumage |
| faisceau-d-attelage | 179 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| fap | 1256 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | echappement |
| feu-clignotant | 62 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 9 | eclairage |
| filtre-de-boite-auto | 416 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 5 | filtration |
| flexible-de-frein | 83 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 8 | freinage |
| fourchette-d-embrayage | 3419 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | embrayage |
| gaine-de-turbo | 3314 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | turbo |
| galet-enrouleur-de-courroie-d-accessoire | 312 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | distribution |
| galet-enrouleur-de-courroie-de-distribution | 313 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 7 | distribution |
| galet-tendeur-de-courroie-d-accessoire | 310 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 7 | distribution |
| gicleur-detendeur | 2408 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 7 | climatisation |
| guide-d-embrayage | 4688 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | embrayage |
| intercooler | 468 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | turbo |
| interrupteur-des-feux-de-freins | 806 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 8 | capteurs |
| interrupteur-position-de-marche | 2197 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | capteurs |
| interrupteur-verrouilage-des-portes | 864 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| jauge-de-niveau-d-huile | 599 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | moteur |
| joint-arbre-longitudinal | 1427 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | transmission |
| joint-carter-de-distribution | 568 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 7 | moteur |
| joint-chemise-de-cylindre | 128 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | moteur |
| joint-d-echappement | 138 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | echappement |
| joint-d-injecteur | 3894 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | alimentation |
| joint-de-boite-vitesse | 146 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | moteur |
| joint-de-cache-culbuteurs | 321 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | moteur |
| joint-de-carter-d-huile | 455 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | moteur |
| joint-de-culasse | 318 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | moteur |
| joint-de-pompe-d-injection | 3893 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | alimentation |
| joint-tige-de-soupape | 322 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | moteur |
| kit-de-chaine-de-distribution | 1389 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 7 | distribution |
| kit-de-freins-arriere | 3859 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 8 | freinage |
| kit-de-poussoir-culbuteur | 3320 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | moteur |
| leve-vitre | 1561 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | accessoires |
| machoires-de-frein | 70 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | freinage |
| maitre-cylindre-de-frein | 258 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | freinage |
| mecatronique-boite-automatique | 3072 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | moteur |
| module-d-allumage | 1218 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | allumage |
| moteur-d-essuie-glace | 295 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| moteur-electrique-de-ventilateur | 792 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | refroidissement |
| moyeu-de-roue | 653 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | direction |
| neiman | 1367 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | electrique |
| palier-d-arbre-de-transmission | 2109 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | transmission |
| parctronic | 1209 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| phares-antibrouillard | 289 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | eclairage |
| pochette-joints-moteur | 560 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | moteur |
| poignee-de-porte | 1373 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| pompe-a-air | 903 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | alimentation |
| pompe-a-carburant | 458 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | alimentation |
| pompe-a-haute-pression | 3918 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | alimentation |
| pompe-a-huile | 596 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | moteur |
| pompe-a-vide-de-freinage | 387 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 5 | freinage |
| pompe-d-amorcage | 862 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | alimentation |
| pompe-nettoyage-des-phares | 795 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| pompe-nettoyage-des-vitres | 794 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| poulie-d-alternateur | 1108 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | distribution |
| poulie-d-arbre-a-came | 1067 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | distribution |
| poulie-vilebrequin | 3213 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | distribution |
| poussoir-de-soupape | 1216 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | moteur |
| pressostat-d-huile | 805 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | capteurs |
| pressostat-de-climatisation | 1360 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | climatisation |
| pulseur-d-air-d-habitacle | 2669 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 8 | climatisation |
| radiateur-d-huile | 469 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | moteur |
| radiateur-de-chauffage | 467 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | refroidissement |
| refroidisseur-de-carburant | 3640 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | alimentation |
| regulateur-de-pression-carburant | 168 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | alimentation |
| relais-de-clignotant | 61 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | eclairage |
| repartiteur-de-frein | 73 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 5 | freinage |
| retroviseur-exterieur | 50 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 9 | accessoires |
| roulement-de-roue | 655 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | direction |
| serrure-de-porte | 1361 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| sonde-de-refroidissement | 830 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | capteurs |
| soufflet-de-direction | 191 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | direction |
| soupape-d-admission | 1269 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | moteur |
| soupape-d-air-secondaire | 904 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | alimentation |
| soupape-d-aspiration-d-air-secondaire | 1136 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | alimentation |
| soupape-d-echappement | 1270 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | moteur |
| soupape-de-rampe-commune-d-injection | 5656 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | alimentation |
| soupape-reaspiration-des-gaz-d-echappement | 1137 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | alimentation |
| sphere-de-suspension | 1718 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | suspension |
| support-de-boite-vitesse | 249 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | support_moteur |
| tambour-de-frein | 123 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | freinage |
| temoin-d-usure | 407 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 8 | freinage |
| trepied-arbre-de-commande | 1147 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | transmission |
| tringle-de-vitesses | 1650 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | embrayage |
| tringlerie-d-essuie-glace | 300 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| tube-de-distributeur-carburant | 3964 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | alimentation |
| turbo | 2234 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | turbo |
| tuyau-carburant-de-fuite | 3937 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | alimentation |
| valve-de-reglage-du-ralenti | 1298 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | capteurs |
| valve-de-turbo | 4314 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | turbo |
| valve-magnetique | 2073 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | climatisation |
| verin-capot-moteur | 514 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| verin-de-coffre | 5032 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| verin-vitre-arriere | 2454 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 3 | accessoires |
| vis-de-culasse | 1533 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 6 | moteur |
| vis-de-disque | 54 | non couverte | brouillon de l'ancien corpus seul | — | — | — | 5 | freinage |
| bouton-de-retroviseur | 789 | non couverte | aucune donnée | — | — | — | — | — |
| cable-de-boite-vitesse | 1787 | non couverte | aucune donnée | — | — | — | — | — |
| feu-antibrouillard-arriere | 291 | non couverte | aucune donnée | — | — | — | — | — |
| feu-de-position | 294 | non couverte | aucune donnée | — | — | — | — | — |
| feu-de-recul | 292 | non couverte | aucune donnée | — | — | — | — | — |
| feu-eclaireur-de-plaque | 293 | non couverte | aucune donnée | — | — | — | — | — |
| feu-stop | 76 | non couverte | aucune donnée | — | — | — | — | — |
| joint-de-turbo | 141 | non couverte | aucune donnée | — | — | — | — | — |
| poignee-de-capot | 3220 | non couverte | aucune donnée | — | — | — | — | — |
| poignee-de-coffre | 1375 | non couverte | aucune donnée | — | — | — | — | — |
| serrure-de-capot-moteur | 1365 | non couverte | aucune donnée | — | — | — | — | — |
| serrure-de-hayon | 1362 | non couverte | aucune donnée | — | — | — | — | — |
| transmetteur-de-pression | 170 | non couverte | aucune donnée | — | — | — | — | — |

## 6. Les 62 symptômes actifs

Colonnes : liens de l'amorce (non sourcés), causes de ces liens rattachées à une pièce par
`CAUSE_GAMME_MAP`, fiches WIKI qui portent une relation non relue vers ce symptôme.

| Système | Symptôme | Libellé | État ADR-113 | Liens de l'amorce | Causes avec pièce | Relations WIKI non relues |
|---|---|---|---|---|---|---|
| climatisation | `bruit_compresseur_clim` | Bruit compresseur climatisation | non relié | 3 | 2 | — |
| climatisation | `chauffage_defaillant` | Chauffage défaillant | non relié | 1 | 1 | — |
| climatisation | `clim_pas_de_froid` | Climatisation sans effet | non relié | 5 | 4 | — |
| climatisation | `odeur_clim` | Odeur de moisi ventilation | non relié | 2 | 2 | — |
| demarrage_charge | `battery_drains_overnight` | Batterie se décharge en une nuit | non relié | 3 | 2 | — |
| demarrage_charge | `battery_warning_light` | Voyant batterie allumé moteur tournant | non relié | 2 | 2 | — |
| demarrage_charge | `start_click_no_crank` | Claquement sans rotation du moteur | non relié | 3 | 2 | — |
| demarrage_charge | `start_cold_only` | Difficulté de démarrage à froid uniquement | non relié | 3 | 3 | — |
| demarrage_charge | `start_cranks_no_fire` | Le démarreur tourne mais le moteur ne part pas | non relié | 4 | 3 | — |
| demarrage_charge | `start_nothing_happens` | Rien ne se passe au démarrage | non relié | 3 | 2 | — |
| demarrage_charge | `start_slow_crank` | Démarrage lent / laborieux | non relié | 3 | 3 | — |
| direction | `bruit_direction` | Bruits en braquant | non relié | 4 | 4 | — |
| direction | `direction_lourde` | Direction lourde | non relié | 2 | 2 | — |
| direction | `fuite_liquide_da` | Fuite de liquide DA | non relié | 2 | 2 | — |
| direction | `jeu_volant` | Jeu dans le volant | non relié | 3 | 3 | — |
| distribution | `bruit_claquement_moteur` | Bruit de claquement moteur | non relié | 3 | 3 | — |
| distribution | `perte_puissance_distribution` | Perte de puissance | non relié | 3 | 3 | — |
| distribution | `sifflement_demarrage` | Sifflement au démarrage | non relié | 2 | 2 | — |
| distribution | `temoin_moteur_distribution` | Témoin moteur allumé | non relié | 2 | 2 | — |
| echappement | `bruit_echappement_fort` | Bruit d'échappement fort | non relié | 3 | 3 | — |
| echappement | `fumee_anormale` | Fumée anormale échappement | non relié | 2 | 2 | — |
| echappement | `odeur_gaz_habitacle` | Odeur de gaz dans l'habitacle | non relié | 2 | 2 | — |
| echappement | `perte_puissance_echappement` | Perte de puissance + voyant | non relié | 2 | 2 | — |
| eclairage | `ampoule_grille_frequemment` | Ampoules grillent fréquemment | non relié | 3 | 3 | — |
| eclairage | `feu_hs` | Feu ne fonctionne pas | non relié | 3 | 3 | — |
| eclairage | `phare_faible` | Phares faibles | non relié | 2 | 2 | — |
| eclairage | `reglage_phare_incorrect` | Réglage phares incorrect | non relié | 2 | 2 | — |
| embrayage | `bruit_debrayage` | Bruit au débrayage | non relié | 2 | 2 | — |
| embrayage | `difficulte_passage_vitesses` | Difficulté passage vitesses | non relié | 3 | 3 | — |
| embrayage | `patinage_embrayage` | Patinage embrayage | non relié | 2 | 2 | — |
| embrayage | `pedale_embrayage_dure` | Pédale d'embrayage dure | non relié | 2 | 2 | — |
| embrayage | `pedale_molle_spongieuse` | Pédale molle ou spongieuse | non relié | 2 | 2 | — |
| filtration | `odeur_habitacle` | Odeur désagréable habitacle | non relié | 1 | 1 | filtre-d-habitacle |
| filtration | `perte_puissance_filtration` | Perte de puissance moteur | non relié | 4 | 4 | filtre-a-air, filtre-a-carburant, filtre-a-huile |
| filtration | `surconsommation_carburant` | Surconsommation carburant | non relié | 2 | 2 | — |
| filtration | `voyant_huile` | Voyant huile allumé | non relié | 1 | 1 | filtre-a-huile |
| freinage | `brake_noise_grinding` | Bruit sourd / grondement au freinage | non relié | 4 | 4 | — |
| freinage | `brake_noise_metallic` | Grincement aigu au freinage | non relié | 4 | 4 | plaquette-de-frein |
| freinage | `brake_pulling_side` | Véhicule tire d'un côté au freinage | non relié | 3 | 3 | — |
| freinage | `brake_soft_pedal` | Pédale de frein molle | non relié | 3 | 3 | — |
| freinage | `brake_vibration_pedal` | Vibration dans la pédale de frein | non relié | 3 | 3 | — |
| injection | `demarrage_difficile_injection` | Démarrage difficile | non relié | 3 | 3 | — |
| injection | `fumee_noire_injection` | Fumée noire diesel | non relié | 2 | 2 | — |
| injection | `moteur_broute` | Moteur qui broute | non relié | 2 | 2 | — |
| injection | `perte_puissance_injection` | Perte de puissance brutale | non relié | 2 | 2 | — |
| injection | `ralenti_instable` | Ralenti instable | non relié | 2 | 2 | — |
| refroidissement | `coolant_leak_visible` | Fuite de liquide de refroidissement | non relié | 3 | 3 | — |
| refroidissement | `engine_slow_warmup` | Moteur long à chauffer | non relié | 1 | 1 | — |
| refroidissement | `heater_weak` | Chauffage habitacle faible | non relié | 2 | 2 | — |
| refroidissement | `temp_gauge_unstable` | Température instable | non relié | 3 | 3 | — |
| refroidissement | `temp_rises_fast` | Température monte rapidement | non relié | 3 | 3 | — |
| refroidissement | `temp_warning_light` | Voyant température allumé | non relié | 5 | 5 | — |
| suspension | `bruits_suspension` | Bruits de suspension | non relié | 4 | 4 | — |
| suspension | `claquements_sourds` | Claquements sourds | non relié | 3 | 3 | — |
| suspension | `rebonds_excessifs` | Rebonds excessifs | non relié | 2 | 2 | — |
| suspension | `tenue_route_degradee` | Tenue de route dégradée | non relié | 3 | 3 | — |
| suspension | `usure_pneus_anormale` | Usure pneus anormale | non relié | 3 | 3 | — |
| suspension | `vehicule_affaisse` | Véhicule affaissé | non relié | 2 | 2 | — |
| transmission | `claquement_virage_transmission` | Claquement en virage | non relié | 2 | 2 | — |
| transmission | `craquement_passage_vitesse` | Craquement au passage de vitesse | non relié | 2 | 1 | — |
| transmission | `fuite_huile_boite` | Fuite d'huile de boîte | non relié | 2 | 1 | — |
| transmission | `vibration_acceleration` | Vibration à l'accélération | non relié | 3 | 2 | — |

## 7. Méthode

- Gamme : « couverte » si sa fiche `wiki/gamme/<pg_alias>.md` porte au moins une relation
  `evidence.reviewed: true` ; « sans objet » si elle porte `diagnostic_not_applicable.reviewed: true` ;
  sinon « non couverte » (ADR-113 D2).
- Symptôme : « relié » si une fiche de gamme publiée porte une relation relue vers lui ; « en attente » s'il
  a au moins un lien actif de l'amorce et qu'aucune de ses causes n'a de pièce dans `CAUSE_GAMME_MAP` ;
  sinon « non relié » (ADR-113 D3). Le compte « hors périmètre » demande une relation relue : il est nul.
- Étape atteinte : la première condition remplie dans l'ordre fiche WIKI, capture RAW, cause de l'amorce,
  fiche de l'ancien corpus.
- Correspondance gamme : `pg_alias` de `__pg_gammes` = nom de la fiche WIKI = dossier de capture RAW =
  fiche de l'ancien corpus.
