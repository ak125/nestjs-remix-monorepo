# Mandat EE : noms d'affichage des motorisations (`auto_type.type_name_meta`)

Relevés du 2026-11-19 et du 2026-11-20 (UTC), base `dd1975f4a602d7966aadbb68b13185361a2ee82d`.

**État :**
- Classement écrit et rejoué.
- Migration écrite et testée sur une PostgreSQL 17 jetable.
- **Rien n'est appliqué à la base, rien n'est déployé.**

**Restriction par le mandat EH (2026-11-20).** Les 205 erreurs ont été vérifiées sur sources extérieures (`../mandat-eh-sources-noms-motorisation-20261120/`). La migration EE ne garde que les **164** cas « nom d'affichage faux, nom d'origine juste ». Elle retire 9 cas :
- 4 « les deux justes » : 5260, 13620, 28249, 62033 ;
- 1 « incertain » : 29807 ;
- 4 noms d'origine faux, corrigés par la migration distincte du mandat EH : 33063, 33593, 60342, 73442.

Les comptes de 173 et les sorties de test ci-dessous décrivent l'état EE avant cette restriction. L'état actuel et ses tests sont dans le README du mandat EH.

Actes réservés à Marwane :
- valider la liste ;
- appliquer la migration par le workflow (essai à blanc, puis contrôle `07-controle-apres.sql`) ;
- fusionner ;
- poser le tag PROD.

## Périmètre

Il y a **900 motorisations** affichées (`type_display = '1'`) dont `type_name_meta` n'est pas contenu dans `type_name`. La comparaison se fait sur les lettres et chiffres seuls, en capitales.

Chaque cas reçoit un verdict :

| Verdict | Nombre | Fichier |
|---|---:|---|
| erreur | 205 | `erreurs.tsv` |
| — dont correction retenue dans la migration | 173 (164 après le mandat EH) | `../mandat-eh-sources-noms-motorisation-20261120/decisions.tsv` |
| — dont correction écartée par le contrôle 6.6 (à arbitrer) | 32 | colonne `migration`, motif dans `exclusions-6-6.tsv` |
| incertain (preuve manquante, aucune correction) | 63 | `incertains.tsv` |
| précision juste | 632 | `precisions-justes.tsv` |

`classement.tsv` contient les 900 lignes ; les trois fichiers ci-dessus en sont des extraits triés par marque et modèle.

Hors périmètre, non modifiés : `type_name`, `modele_name_meta`, `marque_name_meta`, toute URL ou alias, toute autre table.

## 6.1 Provenance des valeurs, correction existante

- Le seul écrivain de `type_name_meta` dans le dépôt est `scripts/tecdoc-pipeline/create-vehicles-p4a.py` (l. 15 et 340). Il copie `type_name`.
- Les valeurs différentes sont donc antérieures : héritage de la base d'origine, aucune trace d'écriture dans le dépôt.
- Les migrations qui citent la colonne la lisent sans l'écrire :
  - `20260101_fix_brand_page_urls.sql` ;
  - `20260421_vehicle_page_cache_inline_and_drop_legacy.sql` ;
  - `20260425_optimize_build_vehicle_page_payload_catalog.sql`.
- Aucune table, migration ou script de correction de ces noms n'existe. Rien à réutiliser.

**Lecteurs de la colonne :**
- En base : `build_vehicle_page_payload`, ainsi que trois RPC, `get_brand_bestsellers_optimized`, `get_brand_page_data_optimized` et `get_gamme_page_data_optimized`. Aucune vue.
- Côté code :
  - `r8-transform.ts:133-148` : `<title>`, description et mots-clés R8 ;
  - `brand.api.ts:335` ;
  - `VehicleCard.tsx:155` ;
  - `FeaturedModelsCarousel.tsx:143`.
- Le H1 R8 utilise déjà `type_name` brut. La correction remet le `<title>` d'accord avec le H1 et le contenu.
- **R2 sur `main`** : le titre est bâti sur `type_name` brut (`seo-template.service.ts`, contexte `type_name`), pas sur `type_name_meta`. Les pages R2 ne seront concernées que si la PR #2212 (brouillon, complément 2) sert les noms d'affichage. Les chiffres R2 de 6.3, 6.4 et 6.6 décrivent donc cette exposition future.

## 6.2 Règle de classement (rejouable)

Chaîne : `01-export-cas.sql` → `cas-enrichis.tsv`, `02-export-attestations.sql` → `attestations.tsv` (lecture seule, `sweep-psql.sh`), puis `python3 -I 03-classer.py <dossier> > classement.tsv`.

Rejoué le 2026-11-20 sur les mêmes exports : sortie identique octet pour octet (`cmp`).

Exports non versionnés (taille) ; empreintes :
- `cas-enrichis.tsv` : `4436ff5263163fccbfdc7418060953b2c63026cc9d87bd5b9ac24d46042a4b90` ;
- `attestations.tsv` : `a86d10253b59a0b784cc40f2fc8f352a5c95c669f02beb68511b1bc97ec00d40`, 39 339 noms bruts ;
- `voisins.tsv` (6.6) : `92eccdf6cedafca8e9f79321ccbaacd64340896649e17a3a426dc068f8d8451d`, 28 505 types.

Jetons : découpage sur espaces, tirets, parenthèses, virgules et barres obliques, en capitales. On compare les jetons ajoutés par le nom d'affichage (`ajoute`) et les jetons retirés (`retire`).

Une **attestation** est un autre type de la même marque, partageant un code moteur, de puissance à ±10 %, dont le nom brut porte le jeton.

Ordre : une condition d'erreur l'emporte sur « incertain », qui l'emporte sur « précision juste ».

| Règle | Verdict | Condition |
|---|---|---|
| R1 | erreur | valeur parasite : double espace, ou reste vide d'une suppression |
| R2 | erreur | le nom affiché est le nom brut d'une **autre** motorisation affichée du même modèle (puissance différente de plus de 5 %), ou un nombre ajouté est la désignation d'une autre motorisation du modèle |
| R3 | erreur | cylindrée ajoutée contredite par `type_liter` et par TecDoc |
| R4 | erreur | carburant contredit (« i » sur un diesel, jeton diesel sur un essence) |
| R5 | erreur | nombre de soupapes contredit par les autres types du même code moteur |
| R6 | erreur | faute de frappe (inversion de deux lettres d'un jeton retiré, jeton absent de tous les noms bruts) |
| R7 | erreur | un jeton ajouté remplace une désignation technique du nom brut, sans attestation, et désigne d'autres moteurs ailleurs (au moins 1 nom brut de la marque, ou au moins `SEUIL_USAGE` = 10 noms bruts d'autres marques) ; ou un nombre remplace le nombre du nom brut sans attestation |
| R8 | erreur | désignation absente des noms bruts de la marque et présente dans au moins 10 noms bruts d'autres marques |
| R9 | incertain | jeton ajouté non attesté, sans preuve contraire ; ou remplacement sans autre usage établi |
| R10 | précision juste | aucun jeton ajouté : réordonnancement, casse, ou mentions retirées |
| R11 | précision juste | chaque jeton ajouté est justifié : attestation, cylindrée, puissance, carburant, nom de marque, ou liste fermée ci-dessous |

**Listes fermées** (`03-classer.py`) :
- Synonymes de même sens : Twin/Spark ← T.Spark, Aut. ← Automatique, 4WD ← 4x4/AWD/Quattro/xDrive/4Matic/All4/Intégrale/Q4/Traction, DT ← TD, Turbo ← T-Jet, JCW ← John Cooper Works.
- Nomenclatures de marque : Honda « i » devant CTDi/DTEC ; Mercedes « T »/« TD » sur un break (T-Modell) ; « ML » sur la Classe M ; « FWD » quand le nom brut ne porte aucune mention de transmission intégrale.
- Ces justifications de contexte ne sont pas des faits en base. Si le même nom affiché est aussi celui d'une autre motorisation, R2 s'applique.

**Valeur corrigée :** le nom brut sans la mention « (Phase N) ». Si cette forme est déjà le nom affiché d'une autre motorisation du même modèle, on garde le nom brut complet.

## 6.3 Demande Google Search Console (90 jours)

**Fenêtre :** 2026-08-19 → 2026-11-16, dernière date disponible ; données présentes depuis le 2026-04-01 (`gsc-fenetre.tsv`).

**Part anonymisée :** 185 038 impressions avec requête sur 454 144 impressions de la propriété. **59,3 % des impressions sont anonymisées** et absentes des comptages par requête.

`04-gsc-formes.sql` → `gsc-formes.tsv` : requêtes normalisées (minuscules, accents retirés, ponctuation en espace), forme brute contre forme affichée, dans le contexte de la marque ou du modèle.

| Paire (brut → affiché) | Impressions forme brute | Impressions forme affichée |
|---|---:|---:|
| Ford TDDi/TDCi → TDi | 411 | 0 |
| Jeep CRD → CRDi | 168 | 0 |
| Fiat D Multijet → JTD | 128 | 30 |
| Mini Cooper S → SX | 75 | 0 |
| Toyota VVTi → VTi | 75 | 0 |
| Audi TDI → DI | 24 | 0 |
| Hyundai CRDi → CDi | 16 | 0 |
| Ford EcoBoost → Econetic | 12 | 2 |
| BMW 320d → 328d | 11 | 0 |
| Audi TFSI → TSI | 8 | 0 |
| Incertains : 16V ajouté | 0 | 44 |
| Incertains : D-4D ajouté | 0 | 9 |

- Les autres paires sont à 0 des deux côtés.
- **Limite :** la paire BlueHDi → HDi n'est pas mesurable de cette façon. « hdi » seul couvre presque toutes les requêtes diesel PSA (983 impressions).
- Le critère aide sans décider seul : aucun verdict n'a été changé par la GSC.
- Pages des 205 types en erreur (`05-gsc-pages-erreurs.sql` → `gsc-pages-erreurs.tsv`) : R8 478 impressions et 0 clic (dont 473 pour le type 74, Ford Grand C-Max) ; R2 229 impressions et 3 clics ; 35 types ont des impressions.

## 6.4 Pages concernées

| | Retenues (173) | Écartées 6.6 (32) |
|---|---:|---:|
| R8 indexables (`seo_validation.is_indexable`, hors 60000–83456) | 69 | 20 |
| R8 au sitemap | 65 | 19 |
| Couples R2 servables | 2 655 | 777 |
| Couples R2 indexables (même modèle, `map_has_item > 20`) | 615 | 143 |

**Dix GET PROD R8** (`prod-get-r8.tsv`) : relevés le 2026-11-19 à 23:47:40Z, un par seconde.
- Les dix répondent 200, en `index, follow`.
- Le nom erroné figure dans le `<title>`, par exemple « Pièces FORD GRAND C-MAX 1.6 Econetic à mini prix ».

## 6.5 Migration gardée

Fichiers :
- `backend/supabase/migrations/20261120_auto_type_name_meta_corrections_mandat_ee.sql` ;
- son `.down.sql` ;
- tous deux générés par `06-generer-migration.py` depuis `classement.tsv` moins `exclusions-6-6.tsv`. **Ne pas les éditer à la main, régénérer.**

Comportement :
- **Additive :** elle modifie seulement `type_name_meta` des 173 types listés. Pas de DDL ni de DELETE.
- **Garde :** pour chaque ligne, la valeur actuelle doit être la valeur erronée relevée, ou déjà la valeur corrigée. Sinon, ou si un type est absent, `RAISE EXCEPTION` et rien n'est écrit.
- **Rejouable :** au second passage, « déjà appliqué, 0 ligne écrite ».
- **Retour :** le `.down.sql` remet les valeurs d'origine, avec la même garde. Il est ignoré par le runner ; il s'applique à la main.
- **Cache R8 :**
  - `public.mark_stale_with_followup_rebuild(ids, raison, true)`, la voie canonique INC-2026-007 ; reconstruction immédiate ;
  - aucune tâche planifiée ne reconstruit les lignes véhicule périmées ;
  - le cache Redis L1 (TTL 3 600 s, `vehicle-rpc.service.ts:24`) expire seul.
- **Délais :** `SET LOCAL lock_timeout = '5s'` et `statement_timeout = '15min'`, sans fuite vers les migrations suivantes.

Preuves :
- `e2e-pg17.txt`, sur PostgreSQL 17.11 jetable : la vraie fonction `mark_stale_with_followup_rebuild` (`20260425`), une reconstruction simulée et les 900 types du classement. Six scénarios :
  1. application : 173 lignes écrites, contrôle 07 à 0 ;
  2. rejeu : 0 ligne ;
  3. retour : empreinte d'origine retrouvée ;
  4. rejeu du retour : 0 ligne ;
  5. valeur changée entre-temps : refus, rien d'écrit ;
  6. type absent : refus, rien d'écrit.
- `migration-safety.txt`, les étapes du job « Migration Safety » de `ci.yml` rejouées en local :
  - squawk 2.52.1 : 0 problème ;
  - `--lint-markers` : OK ;
  - compilation PL/pgSQL des deux fichiers sur PostgreSQL 17, avec auto-test et témoin négatif : OK ;
  - surface DEFINER/anon : inchangée.
- Ownership :
  - la garde « Block-new » refuse les deux fichiers de migration (`missing_both`), car `ownership.yaml` ne couvre pas les migrations automatiquement ;
  - `.spec/00-canon/**` est une zone gardée, réservée à l'owner. L'extrait est donc fourni **non appliqué** dans `ownership-extrait.patch` : une entrée D4, `@ak125/vehicle-team`, risque `medium`, sur le modèle de `20261003_auto_modele_fill_empty_alias` ;
  - essai dans un clone jetable : sans le patch, 22 fichiers sur 24 passent (`missing_both` = 2) ; avec le patch, 24 sur 24 passent, code de sortie 0 ;
  - geste réservé à Marwane : `git apply -p1 docs/audit/mandat-ee-noms-motorisation-20261120/ownership-extrait.patch`, depuis la racine du dépôt.

## 6.6 Noms R8 et titres R2 identiques

`08-export-voisins.sql` → `voisins.tsv` (28 505 types affichés), puis `node 09-collisions.mjs classement.tsv voisins.tsv <vehicle-aware-label.ts> exclusions-6-6.tsv > collisions-6-6.tsv`.

Le module de titre R2 est celui de la PR #2212 (head `10eb48d0`, sha256 `fb778f72…0264`), chargé tel quel. La branche #2212 n'est pas touchée.

**Nom R8 :** même modèle et même `type_name_meta` (casse et espaces ignorés). Le `<title>` R8 ne porte pas la puissance.

**Titre R2 :** règle de #2212 sur les noms d'affichage :
- même marque ;
- modèle de même nom brut ou affiché ;
- même `buildR2TitleTypeLabel`.

Ce contrôle est plus strict que #2212, qui exige en plus des pièces dans la même gamme.

**Règle d'exclusion :** une page dont le nom est unique avant correction ne doit pas cesser de l'être. Une page déjà en doublon qui change de partenaire n'aggrave rien. Toute correction qui ferait perdre l'unicité à une page est écartée, puis le calcul est refait jusqu'à stabilité.

**Résultat :** 32 corrections sont écartées (`exclusions-6-6.tsv`), surtout des cas où le nom brut est le même que celui d'une autre motorisation du modèle, à une autre puissance.
- Exemple : Audi A4 « 1.9 TDI » en 75, 90, 110 et 116 ch. Le nom affiché erroné « 1.9 DI » est aujourd'hui le seul à distinguer la page 75 ch.
- La corriger rendrait son nom identique à celui des trois autres.
- La solution (puissance dans le titre R8, ou autre départage) sort de ce mandat. **Ces 32 cas sont à arbitrer par Marwane.**

Sur les 1 701 pages examinées :

| Doublons | Avant | Après les 173 corrections |
|---|---:|---:|
| Noms R8 | 1 099 | 1 065 |
| Titres R2 | 34 | 34 |

Aucune page unique ne devient doublon.

## 6.7 Check-list Google

| Point | Constat |
|---|---|
| URL, alias, canonical | inchangés : seule `type_name_meta` change ; la canonical R8 est bâtie sur `type_alias` |
| Titre exact et descriptif | le titre reprend le nom brut TecDoc de la motorisation, celui du H1 et du contenu ; aucun mot ajouté, aucune répétition |
| Mots-clés inventés | aucun : la valeur corrigée est le nom brut, sans « (Phase N) » |
| Demande réelle | la forme brute domine la GSC pour toutes les paires mesurables (tableau 6.3) |
| Titres en double | aucune page unique ne devient doublon (6.6) ; les 32 cas qui en créeraient sont écartés |
| Indexation, robots, sitemap | inchangés ; aucune suppression de page |
| Ampleur | 173 `<title>` sur 28 505 pages R8, dont 69 indexables ; correction factuelle, sans réécriture de gabarit |
| Cohérence title / H1 | améliorée : le H1 portait déjà le nom brut |
| Caches | R8 reconstruit dans la migration. Lecture du 2026-11-20 : aucune des valeurs erronées testées (Econetic, 1.33 VTi, 2.3 JTD, 1.6 16V TDi) n'apparaît dans `__gamme_page_cache` (271 lignes, 0 périmée). Les RPC marque lisent la base à chaque appel. Le cache `seo:processed:*` R2 (`SEO_CACHE_TTL = 86400`) expire seul ; il ne porte pas `type_name_meta` sur `main`. |
| meta_title / description / H1 optimisés | non touchés : `__seo_*`, `seo_custom` et gabarits restent tels quels ; seul le nom de motorisation injecté change |

## Points pour Marwane

1. **Fiat « JTD » (34 + 2 Lancia retenus, 1 écarté).** Multijet est la seconde génération du JTD. La preuve en base ne décide pas seule : 0 attestation JTD pour ces moteurs, mais « JTD » nomme d'autres moteurs dans 103 noms bruts Fiat. La forme brute domine la GSC (128 impressions contre 30). À trancher avant application.
2. **Les 32 corrections écartées par 6.6** : erreur avérée, mais la correction créerait des noms identiques.
3. **Les 63 incertains** : aucune correction proposée.

## Constats hors périmètre (signalés, non corrigés)

- `scripts/ci/check-no-direct-vehicle-cache-stale.sh` échoue sur `main` (`20260917_definer_rpc_anon_lockdown.sql`, UPDATE direct de `stale`) et n'est appelé par aucun workflow ni hook.
- Le `<title>` R8 ne porte pas la puissance. 1 099 des 1 701 pages examinées ont déjà un nom R8 identique à une autre motorisation du même modèle.
- `modele_name_meta` contient au moins une faute : « CALSSE GLC (X253) ».
- Dacia K7M : « 16V » affiché sur un moteur 8 soupapes, classé incertain faute d'attestation contraire.
- Mesure GSC BlueHDi/HDi impossible par regex (6.3).
