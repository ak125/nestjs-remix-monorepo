# Mandat EB — titre R2 des 8 gammes sans ligne `__seo_gamme_car` : rapport d'arrêt après 6.1 et 6.2

Date : 2026-11-20. Chat d'origine : 07 Pages et SEO (mandat du 2026-11-19).

## Verdict

**Le mandat s'arrête après 6.2 : la condition d'arrêt est remplie.** Une ligne
`__seo_gamme_car` ajoutée pour ces gammes change aussi la meta description,
l'`og:description` et la description JSON-LD sur les 40 pages, et le H1 visible
sur 35 d'entre elles. Le seul moyen d'éviter ces écarts sans écrire de contenu
nouveau serait un contournement du détecteur de gabarit, que ce rapport écarte
(voir « Pourquoi l'écart est inévitable »).

Aucune migration n'est écrite et aucune PR de code n'est ouverte. Les étapes 6.3
à 6.7 ne sont pas faites.

## Identifiants

| Élément | Valeur |
|---|---|
| Session | `8303aa93-2bbd-4517-9372-46d7ef9f5ea1` |
| Worktree | worktree isolé dans le scratchpad de la session, créé depuis `origin/main` |
| Branche | `feat/mandat-eb-title-r2-8-gammes-20261119` |
| SHA de base | `dd1975f4a602d7966aadbb68b13185361a2ee82d` |
| RPC live `rm_get_page_complete_v2` | md5(prosrc) `6bdec8f4fcd31754815892122338cb8d`, identique à la référence du mandat DW : la migration RPC de #2212 n'est pas appliquée |
| Base | massdoc, lecture seule (transaction `read only`), aucun secret affiché |
| PROD | 41 GET simples (1 sonde, puis 40 pages entre 2026-11-19T23:01:36Z et 23:02:38Z), 1 par seconde, 41 réponses 200 |

## 6.1 Trace de chaque élément d'une page R2

Page R2 : `/pieces/:gamme/:marque/:modele/:type.html`. Chaîne :
RPC → `rm-builder.service.ts` → `SeoTemplateService.processTemplates` → loader
frontend → `rm-mapper.ts` → `pieces-vehicle.meta.ts` et composants.

| Élément servi | Source | Colonnes lues | Sans ligne `__seo_gamme_car` (cas des 8 gammes) | Avec une ligne |
|---|---|---|---|---|
| `seo_raw` | `rm_get_page_complete_v2` (dump live, l. 146) | `sgc_h1`, `sgc_title`, `sgc_descrip`, `sgc_content`, `sgc_preview` (`COALESCE(…,'')`) | JSON `null` | objet de 5 chaînes |
| Bloc `seo` de la réponse | `backend/src/modules/rm/services/rm-builder.service.ts:660-724` | `seo_raw` + `seo_context` | non traité : `seo` reste vide (RPC l. 148), pas de `compSwitch2` | `processTemplates` puis `seo = {h1,title,description,content,preview, compSwitch2: comp_switches['2']}` (l. 716) |
| `<title>`, `og:title`, `og:image:alt` | `frontend/app/utils/pieces-vehicle.loader.server.ts:689-690` puis `pieces-vehicle.meta.ts:123,125,139` | `sgc_title` | repli frontend « `<Gamme> <MARQUE> <MODELE> <type enrichi> \| Pièces Auto` » | template rendu (format #2212) |
| `meta description`, `og:description` | `pieces-vehicle.loader.server.ts:702` (`stripHtmlForMeta(seo.description \|\| seoContent.longDescription)`) puis `pieces-vehicle.meta.ts:124,126` | `sgc_descrip` | `""` (les deux sources sont vides) | `composeDescription` (`backend/src/modules/catalog/services/seo-template.service.ts:296-322`) : template vide ou dégénéré (l. 331) → phrase composée par `composeVehicleAwareDescription` (`vehicle-aware-description.composer.ts:113-165`), toujours non vide ; sinon le texte du template |
| JSON-LD `Product.description` | `pieces-vehicle.meta.ts:110-114` puis `frontend/app/utils/seo/pieces-schema.utils.ts:116` | `sgc_descrip` | `""` | la même description |
| H1 visible | `frontend/app/components/pieces/PiecesHeader.tsx:101-109` → `packages/seo-types/src/build-r2-h1.ts:50-73` | aucune colonne de `__seo_gamme_car` ; suffixe : `compSwitch2` | suffixe tiré de `SEO_PRICE_VARIATIONS` (`seo-variations.ts:79-87`), rang `(typeId+pgId) % 7` | suffixe tiré des fragments `__seo_gamme_car_switch` alias 2 (`loadCompSwitches`, `rm-builder.service.ts:805-843`, sans `ORDER BY`), rang `(typeId+pgId+2) % n` |
| `<h2>` de la section SEO | `PiecesVehicleContent.tsx:480` → `PiecesSEOSection` (`rm-mapper.ts:162`) | `sgc_h1` | vide, non rendu | vide si `sgc_h1 = ''` : identique |
| Texte SEO, `gamme.description` | `rm-mapper.ts:164,248`, `PiecesSEOSection.tsx:37` | `sgc_content` | vide | vide si `sgc_content = ''` : identique |
| Canonical | `pieces-vehicle.meta.ts:104-106` (`canonicalPath`) | aucune | URL de la page | identique |
| Robots | `pieces-vehicle.loader.server.ts:632-653` (`resolveR2Robots` : count, qualité, produits vendables) | aucune | `index, follow` sur les 40 | identique |

Autres lecteurs de `__seo_gamme_car`, sans effet sur le HTML R2 :
`cross-selling-seo.service.ts` (seulement si `includeSeo=true` ou `v5/by-alias` ;
aucun appel frontend ne le demande, `fetchCrossSellingGammes` n'a aucun appelant),
les fonctions `get_pieces_for_type_gamme_v2/v3/v4` (non servies en HTML),
`seo-template-renderer.service.ts` (observation shadow), `seo-v4-monitoring.service.ts`.

## 6.2 Comparaison sur 40 pages

Échantillon : 5 pages par gamme, tirées de `__sitemap_p_link` avec type affiché,
indexables d'abord selon la définition de #2212 (servable, modèle de l'URL égal au
modèle du type, `map_has_item > 20`), une marque par page. Requête :
[`echantillon.sql`](echantillon.sql). 30 pages indexables ; 1750 et 3908 n'en ont
aucune, leurs 10 pages sont servables seulement.

Méthode du rendu attendu : les fonctions pures du code (`buildR2H1Emitted`,
`composeVehicleAwareDescription`, `pickGammeKeywordModifier` de `main` ;
`buildR2TitleTypeLabel`, `normalizeVehicleNameCase`, `pickVehicleDisplayName`
de la branche de #2212) sont exécutées sur les valeurs lues en base pour chaque
page : `seo_context`, `count` et `minPrice` sont lus par appel de
`rm_get_page_complete_v2` dans une transaction en lecture seule ; les fragments
alias 2 et `__seo_keywords` sont lus par SELECT. Ces copies restent dans le
scratchpad de la session et ne sont pas dans la branche. Le titre attendu est
calculé sans le code moteur de départage : celui-ci dépend de
`R2TitleCollisionService` de #2212. Le titre étant le changement voulu, cela ne
modifie pas le verdict.

Contrôle de la reproduction : le H1 recalculé sans ligne est identique au H1
servi sur les 40 pages.

| Élément | Servi en PROD | Avec une ligne (code de #2212) | Identique ? |
|---|---|---|---|
| `<title>` | repli frontend | format « `<Gamme> <Marque> <Modèle> <type> [carburant] <puissance> ch` » | non, voulu |
| meta description | `""` sur 40/40 | phrase composée non vide sur 40/40 | **non (40/40)** |
| `og:description` | `""` sur 40/40 | même phrase | **non (40/40)** |
| JSON-LD `Product.description` | `""` sur 37 pages, bloc absent sur 3 (3908 : 28253, 18766, 33251) | même phrase | **non (37/37)** |
| H1 visible | suffixe prix (« économique », « pas cher »…) | suffixe des fragments alias 2 | **non (35/40)** ; identique sur les 5 pages de 2066, qui n'a aucun fragment alias 2 |
| `<h2>` et texte SEO | vides | vides si `sgc_h1` et `sgc_content` sont vides | oui |
| Canonical | autoréférent 40/40 | inchangé | oui |
| Robots | `index, follow` 40/40 | inchangé | oui |

Exemples (le détail des 40 pages est dans [`comparaison-40-pages.tsv`](comparaison-40-pages.tsv)) :

| Page | Description servie → avec ligne | H1 servi → avec ligne |
|---|---|---|
| 1750 / AUDI A3 II 1.9 TDI | `""` → « Comparez et commandez votre boîtier de préchauffage pour AUDI A3 II 1.9 TDI (105 ch) dès 8,00 €. Livraison rapide. » | « … 105 ch économique » → « … 105 ch doser l'air » |
| 3859 / SEAT CORDOBA II 1.4 | `""` → « Commandez votre kit de freins arrière pour SEAT CORDOBA II 1.4 (60 ch) dès 72,00 €. 3 références compatibles, paiement sécurisé. » | « … 60 ch à prix imbattables » → « … 60 ch indiquer le freinage » |
| 3213 / VOLKSWAGEN SHARAN I 1.9 TDI | `""` → « Trouvez votre poulie vilebrequin pour VOLKSWAGEN SHARAN I 1.9 TDI (90 ch): 33 références compatibles dès 40,00 €. Livraison rapide. » | « … 90 ch au meilleur prix » → « … 90 ch garantir entraîner les accessoires depuis » |
| 2066 / RENAULT CLIO II 1.2 | `""` → « Découvrez votre rotule de direction pour RENAULT CLIO II 1.2 (58 ch) dès 14,00 €. 101 références compatibles, expédition rapide. » | inchangé |

## Pourquoi l'écart est inévitable sans contenu nouveau

1. **Description.** Avec une ligne, `rm-builder` passe toujours par
   `processTemplates`. Un `sgc_descrip` vide ou fait de marqueurs est jugé
   dégénéré et remplacé par la phrase composée, qui contient le prix, le nombre
   de références et une promesse (« Livraison rapide », « paiement sécurisé »,
   « expédition rapide ») : c'est du contenu nouveau. Un `sgc_descrip` rédigé est
   servi tel quel : c'est aussi du contenu nouveau. Garder `""` demanderait un
   texte que le détecteur juge non dégénéré mais que `stripHtmlForMeta` efface
   (par exemple une balise HTML vide avec cinq lettres d'attribut). Ce serait un
   contournement du détecteur : il est écarté.
2. **H1.** La présence de la ligne fait transmettre `compSwitch2` au frontend.
   Pour 7 gammes, le suffixe du H1 passe alors de la rotation prix aux fragments
   alias 2. Aucune valeur de colonne de `__seo_gamme_car` ne l'empêche :
   `compSwitch2` dépend de la seule présence de la ligne.

## Options (décision réservée à Marwane)

| Option | Effet | Ce qu'elle demande |
|---|---|---|
| A. Accepter les écarts | Insérer les 8 lignes (titre au format #2212, autres colonnes vides) ; la description composée et les nouveaux suffixes de H1 sont servis | Validation explicite de la phrase composée (promesses comprises) et des nouveaux H1 ; voir le constat 1 sur les fragments, qui produiraient des H1 faux pour 4 gammes |
| B. Exposer le seul titre | Modifier `rm-builder` pour ne transmettre que le titre quand la ligne n'a que `sgc_title` | Zone gardée `rm/` : patch non appliqué, geste de Marwane ; règle à définir pour ne pas créer un second chemin de titre |
| C. Aligner le repli frontend sur le format #2212 | Le titre change sans ligne en base ; description et H1 inchangés | Hors du mandat (« pas de second chemin de title ») ; demande une décision explicite |
| D. Rédiger un `sgc_descrip` validé par gamme | Description voulue au lieu de la phrase composée ; l'écart de H1 reste | Passage RAW → WIKI → validation du décideur, puis migration ; option A ou B pour le H1 |
| E. Statu quo | Rien ne change ; les 518 groupes de doublons indexables relevés par #2212 restent | Rien |

## Constats hors périmètre (non corrigés)

1. **Fragments alias 2 d'une autre famille de pièces.** Ces fragments seraient
   servis dans le H1 avec l'option A.
   - 1750 (boîtier de préchauffage) : « doser l'air », « contrôler le régime ».
   - 2669 (pulseur d'air d'habitacle) : « calculer la masse d'air », « informer le calculateur ».
   - 3859 (kit de freins arrière) : « éclairer l'arrière », « signaler les directions ».
   - 3908 (capteur de pédale d'accélérateur) : « prévenir le blocage », « optimiser le freinage ».

   Plusieurs fragments sont aussi agrammaticaux : « assurer calculer la masse »,
   « garantir entraîner les accessoires depuis ». Les alias 3 de 1750 parlent eux
   aussi d'« admission d'air ».
2. **Rotation de H1 non déterministe.** `loadCompSwitches` lit
   `__seo_gamme_car_switch` sans `ORDER BY` (`rm-builder.service.ts:816-819`).
   L'ordre du pool, donc le suffixe, peut changer à chaque reconstruction du
   cache (24 h). Cela touche déjà les gammes qui ont une ligne.
3. **#2212 touche `rm/`.** Par rapport à sa base de fusion `4c61f7600`, la branche
   de #2212 modifie `backend/src/modules/rm/services/rm-builder.service.ts`
   (+7 lignes) et un test `rm/`, au commit `10eb48d004` « patchs rm/ et ownership
   des migrations du titre R2 ». Il reste à vérifier qu'il s'agit bien de
   l'application des patchs par Marwane.
4. **Robots et définition « indexable ».** Les 10 pages de 1750 et 3908 ne sont
   pas indexables au sens de #2212, mais servent `index, follow`. Les deux
   définitions diffèrent.
5. **Code mort.** `fetchCrossSellingGammes`
   (`frontend/app/services/pieces/pieces-route.service.ts:193`) n'a aucun appelant
   et renvoie des « gammes de test pour démonstration » quand l'API échoue.

## État

| État | Contenu |
|---|---|
| Écrit | Ce rapport, [`comparaison-40-pages.tsv`](comparaison-40-pages.tsv), [`echantillon.sql`](echantillon.sql) |
| Testé | Reproduction du H1 servi (40/40) ; calcul local de la description, du H1 et du titre attendus. Aucun test du dépôt n'est lancé : aucun code n'est modifié |
| Non écrit | Migration, down, extrait ownership (6.3) ; 6.4 à 6.7 |
| Non appliqué, non déployé | Aucune écriture en base, aucune migration, aucun déploiement |
| Dépendance à #2212 | Le titre attendu utilise trois fonctions de `packages/seo-types/src/vehicle-aware-label.ts` de la branche de #2212, lues sans être copiées dans cette branche. Toute option qui insère des lignes dépend du déploiement de #2212 (RPC des noms d'affichage et `R2TitleCollisionService`) |
| Geste réservé | Choix d'une option et validation des textes servis : Marwane |
