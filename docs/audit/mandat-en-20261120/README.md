# Mandat EN — H1 propre des pages R2 (gamme × véhicule)

Mandat du chat 07, 2026-11-20 vers 22:05 UTC. **Dossier de proposition : rien
n'est écrit en base ni en production.** Le format reste à valider par Marwane
sur les exemples (question en fin de PR).

| | |
|---|---|
| Session | Claude Code `d37a8162-c32c-4465-92d9-981c18fe3761` |
| Worktree | `/home/deploy/worktrees/mandat-en-h1-r2` |
| Branche | `feat/mandat-en-h1-r2-20261120`, base `1210455cd070539f9a1914b6188633b9d658fe30` |
| Base | `cxpojprgwgubzjyqzmoq` (unique DEV/PREPROD/PROD), **SELECT seulement**, via `sweep-psql.sh` (transaction unique en lecture seule) |
| Diff du code (hors `docs/`) | 12 fichiers, +596 / −30 ; `git diff 1210455cd HEAD -- . ':!docs' \| sha256sum` = `d7766110030b2012b5036cc19173f712a768b4ba86646723534459328dd69171` |
| Patch `rm/` non appliqué | `rm-h1-propre.patch`, sha256 `d3c1c2b38253d201cd505acfee93207ae839856a7a597881895a8f53a5791c16` |

## État par nature

| nature | contenu |
|---|---|
| **Tracé** | chaîne du H1 servi (§a) |
| **Mesuré** | pages, doublons avant/après, cannibalisation, longueurs (§c) ; formes des requêtes GSC (§d) |
| **Proposé** | format et règle de départage (§b) ; 60 exemples (§f) |
| **Écrit dans le worktree** | `packages/seo-types` (fonction pure), `R2TitleCollisionService.resolveHeading/buildHeading`, export du service, câblage frontend `h1Display`, tests |
| **Écrit hors worktree (patch)** | `rm-h1-propre.patch` : `rm/` est interdit en écriture aux agents (garde 5, `scripts/claude-hooks/pretool-file-guard.sh:50-52`), donc **non appliqué** |
| **Testé** | §Tests : seo-types 11/11, catalog 18/18, rm + catalog avec patch appliqué dans une copie jetable 82/82, frontend 9/9 |
| **Bloqué** | google.fr : page anti-robot `/sorry` (§d.2) |
| **Non fait (hors mandat)** | migration de gabarit : aucune (voir §g) ; donc aucun essai PostgreSQL 17 nécessaire |

## a. Trace du H1 R2 servi aujourd'hui

1. **`<h1>` visible** : `frontend/app/components/pieces/PiecesHeader.tsx` appelle
   `buildR2H1Emitted` (`packages/seo-types/src/build-r2-h1.ts`). Elle met bout à bout
   la gamme, la marque et le modèle **bruts en MAJUSCULES**, le type enrichi par
   `enrichTypeNameForHeadings` (carburant et puissance) puis un **suffixe** (`pickH1Suffix`).
2. **Suffixe** : `compSwitch2`, c'est-à-dire les fragments `__seo_gamme_car_switch` d'alias 2 de
   la gamme, choisis par rotation déterministe sur `typeId + pgId`. Le backend les charge
   dans `rm-builder.service.ts:805-835` (`loadCompSwitches`, cache `seo:comp_switches:<pg>` 24 h),
   seulement pour les gammes à gabarit (bloc `if (seoTemplates && seoCtx)`). Sans gabarit,
   le suffixe vient de `SEO_PRICE_VARIATIONS` (« à petit prix », « au meilleur prix »…).
   C'est la source des H1 tronqués, par exemple « garantir lancer le moteur au » ou
   « assurer frotter contre le » (exemples du §f).
3. **`sgc_h1`** (gabarit `__seo_gamme_car`) → `SeoTemplateService` → `seo.h1` :
   **rendu en `<h2>`** dans `PiecesSEOSection.tsx:34-46` (`cleanOrphanParagraphs(content.h1)`).
   Ce n'est pas le `<h1>`.
4. **`process_seo_template`** (SQL) : aucune page HTML servie n'en tire son H1
   (même constat que #2212, point 1).
5. **Repli frontend** : `pieces-vehicle.loader.server.ts` → `h1: rmV2Response.seo?.h1 ||
   loaderData.seoContent.h1`. Ce champ alimente le `<h2>` de la section SEO, pas le `<h1>`.
6. **Parité reproduite / servie** : 45 502 / 45 520 URL du crawl PROD `__seo_snapshot_synthetic`
   (relevé 22:10:17–22:10:19Z). Les 18 écarts sont des pages « non référencé pour votre … »,
   d'un autre rendu (`parite-ecarts.tsv`). Ce rendu n'est pas touché par la proposition.

Empreinte anti-doublon : `SeoFingerprintCore` empreinte les balises **émises**. Pour R2,
le H1 servi est relevé par le crawl (`__seo_snapshot_synthetic`). Aucun code backend
ne recalcule `buildR2H1Emitted`, seuls `PiecesHeader` et son test de parité l'appellent.
La garde `seo-balise-collision-gate` (champs HARD `title`/`h1`) verra donc les nouveaux H1
après déploiement, avec moins de collisions (§c).

## b. Format proposé et règle exacte

Principe validé par Marwane le 2026-11-20 à 23:01 (Paris) :

- **Niveau 0, par défaut** : `gamme + marque + modèle + version`.
  - Noms d'affichage et casse de #2212 : `VMarqueAffichage` (Mini, BMW, Citroën), `VModeleAffichage`
    (`modele_name_meta`), version = `type_name_meta`.
  - Ni carburant, ni puissance, ni accroche, ni suffixe.
- **Niveau 1** : on ajoute « N ch » si **un autre type affiché du même modèle, ayant des pièces
  dans la même gamme**, donne le même H1 de niveau 0. La comparaison se fait sur la clé
  `r2TitleCollisionKey` : casse, espaces et accents normalisés.
  - Exemple : Paceman 1.6 Cooper (58868) contre 74084 → « … 1.6 Cooper 122 ch ».
- **Niveau 2** : si la puissance ne suffit pas (même H1 de niveau 1), on prend le
  **libellé du titre #2212** : carburant + puissance + code moteur, avec départage par
  `R2TitleCollisionService` (noms d'affichage, puis noms bruts).
  - Sur les gammes à gabarit, le H1 de niveau 2 est exactement le titre #2212, sans « | Pièces Auto ».
- **Si le code moteur ne suffit pas non plus** (deux fiches identiques au code près) :
  - noms bruts ;
  - sinon le H1 reste identique. Ce sont des **doublons de fiche en base**, traités à part.
  - Ici, ils sont seulement comptés et listés : `doublons-fiches-base.tsv`.
  - Mesure : **0 page servable** dans ce cas (`doublons-restants.tsv` vide).
- **Indisponibilité** : une erreur de lecture (`auto_modele`, `auto_type`,
  `pieces_relation_type`) est **levée** (« unavailable »), jamais remplacée par un H1 deviné.
  `rm-builder` renvoie alors `success: false`, sans mise en cache.
- **Effet de #2214** (dans le train, non touché) : la PR change des valeurs de
  `type_name_meta`. Le H1 suivra donc les noms de motorisation corrigés, sans changement de code.

Doublons de fiches en base (`09-doublons-fiches.mjs` → `doublons-fiches-base.tsv`) :

- **Ensemble** : 217 groupes, 445 types affichés de même libellé de niveau 2.
  - 92 groupes partagent aussi le code moteur.
  - 29 groupes ont au moins 2 types dans le sitemap, 18 en ont 1, et 170 n'en ont aucun.
- **Mini Paceman 74085 / 74086** (groupe 186) :
  - même « Cooper ALL4 Essence 122 ch » ;
  - codes différents (N16 B16 A / N18 B16 A) ;
  - tous deux affichés (`type_display=1`), **hors sitemap**, avec des pièces en gamme 402
    (622 / 616 lignes `pieces_relation_type`, relevé 22:28Z) ;
  - H1 actuel **identique** pour les deux ; le H1 proposé les sépare par le code moteur.
- **74087** : `type_display=3`, page non servie.
- **Exemples de même code** : Fiat Ducato V (250) 15957/66326 (F1AE3481G) ; 19976/59928 ;
  Suzuki SX4 Berline 34535/54893 (J20B).
- **Source à vérifier** : la version de 74085/74086 est « Cooper ALL4 », sans cylindrée,
  alors que 58868 a « 1.6 Cooper ». La donnée vient d'`auto_type.type_name_meta` ; à corriger
  en base avec les doublons, hors de ce mandat.

## c. Mesures (export 22:06:54–22:11:05Z, `mesures.tsv`)

| mesure | servables | indexables |
|---|---|---|
| pages R2 (`__sitemap_p_link`, type affiché) | 373 005 | 101 097 |
| niveau 0 / 1 / 2 | 147 089 / 218 279 / 7 637 | 39 294 / 59 782 / 2 021 |
| H1 dupliqués **avant** (pages / groupes) | 6 445 / 3 177 | 1 552 / 865 |
| avant, sans l'accroche | 50 175 / 20 908 | 12 463 / 5 864 |
| titre #2212 dupliqué (pages / groupes) | 6 139 / 2 539 | 1 334 / 614 |
| H1 dupliqués **après** | **0 / 0** | **0 / 0** |
| H1 proposé = titre #2212 (même clé) | 125 390 | 36 203 |
| H1/titre égal à un H1/titre R1, R3, R8 (avant / après) | 0 / 0 | — |
| longueur H1 actuel | médiane 79, p90 95, max 156, >80 : 162 248 | médiane 76, p90 90, >80 : 34 487 |
| longueur H1 proposé | médiane 50, p90 64, max 126, >80 : 2 637 | médiane 47, p90 59, >80 : 223 |

125 390 H1 proposés (33,6 % des servables) ont la même clé que le titre #2212, en général
des niveaux 1 et 2 où le titre n'ajoute rien d'autre que la puissance (exemple : « Kit
d'embrayage Volkswagen Passat IV Break 1.9 TDI 115 ch »). Un H1 égal au titre ne contrevient
à aucune consigne Google connue.

## d. Requêtes réelles

### d.1 Search Console (lecture 22:26:49–22:26:53Z et 22:31:29–22:31:31Z)

- **Fenêtres** (`10-gsc-formes-requetes.sql`) : 90 j du 2026-08-20 au 2026-11-17 ;
  28 j depuis le 2026-10-21. Dernière date chargée : 2026-11-17.
- **Volume** : 5 364 pages R2 avec impressions, 6 718 requêtes, 38 080 impressions, 168 clics.

| forme (impressions 90 j) | part 90 j | part 28 j |
|---|---|---|
| sans cylindrée, puissance ni version (« vanne egr 308 », « galet tendeur 206 ») | 52,1 % | 55,3 % |
| cylindrée + version (« vanne egr 207 1.6 hdi ») | 29,9 % | 28,0 % |
| cylindrée seule (« distribution 208 1.4 ») | 13,1 % | 12,9 % |
| version seule | 4,3 % | 3,2 % |
| puissance avec unité (ch/cv) | 0,6 % | 0,6 % |
| **puissance du type, avec ou sans unité** (`10b`, « 1.6 hdi 110 ») | **5,4 %** | **4,4 %** |

- **Lecture** :
  - La forme dominante est gamme + modèle, puis cylindrée + version : c'est le niveau 0.
  - La puissance n'est tapée que dans environ 5 % des cas.
  - Ces requêtes portent sur des modèles à plusieurs puissances pour une même version
    (« 308 1.6 hdi 110 », « 307 1.6 hdi 90 », « scenic 2 1.9 dci 120cv »). La règle ajoute
    justement la puissance dans ce cas (niveau 1).
- **Bruit** : les 40 premières requêtes comptent aussi des références et prix
  (« 594415 euros ») et des `site:`.
- **Positions** : 40 à 60 sur les requêtes EGR, contre 5 à 9 sur « courroie accessoire clio 3
  1.5 dci » et « thermostat 207 1.4 essence ».

### d.2 google.fr — **BLOQUÉ**

- **Tentative** : Chrome réel installé sur le serveur (`google-chrome` piloté par Playwright,
  sans tête), locale fr-FR, 2026-11-20 à **22:27:21Z**.
  - URL : `https://www.google.fr/search?q=vanne%20egr%20308%201.6%20hdi%20110&hl=fr&gl=fr`.
- **Réponse** : redirection vers `https://www.google.com/sorry/index?...`, la page anti-robot.
  - Aucun consentement n'est apparu ; le captcha n'a pas été tenté.
  - Une seule requête, pas de relance.
- **Résultat** : aucun relevé de titres ni de H1 concurrents.
- **Requêtes prévues**, pour Marwane depuis son navigateur :
  - « vanne egr 308 1.6 hdi 110 » ;
  - « distribution 208 1.4 hdi » ;
  - « courroie accessoire clio 3 1.5 dci » ;
  - « alternateur opel astra h 1.7 cdti » ;
  - « vanne egr scenic 2 1.9 dci 120cv » ;
  - « thermostat 207 1.4 essence ».

## e. Liste Google (reprise de #2212 / EH)

- [x] **Pas de bourrage :**
  - un seul élément de chaque sorte ;
  - plus d'accroche ni de suffixe prix ;
  - puissance seulement pour départager ;
  - carburant non répété quand la version l'implique (TDI) (tests seo-types).
- [x] **H1 uniques :** 0 doublon servable ou indexable après la règle (6 445 avant).
- [x] **H1 fidèles, une réserve :** données `auto_modele` / `auto_type`. Réserve : la version
  « Cooper ALL4 » sans cylindrée (74085/74086) et les 217 groupes de fiches en double.
- [x] **Pas de cannibalisation :** aucun H1 ni titre égal à un R1, R3 ou R8 (0 avant, 0 après).
- [x] **Rien de trompeur :** ni prix, ni promesse, ni année.
- [x] **Pas de pages minces en masse :** aucune page créée ni supprimée, aucune URL modifiée.
- [x] **Canonical, robots, sitemap, statut :** non touchés ; seul le texte du `<h1>` change.
- [x] **Données structurées inchangées :** aucune ligne du diff ne touche JSON-LD ou schema.org.
- [x] **Rien de caché :** le H1 est le `<h1>` visible ; `meta_title`/description et `<h2>` SEO inchangés.
- [ ] **Vérification sur google.fr :** bloquée (§d.2).
- [ ] **Format validé :** à valider par Marwane sur les 60 exemples.
- [x] **Retour arrière :** il suffit de revenir au commit ou de retirer le patch `rm/`.
  - Sans `h1Display`, le frontend sert le H1 historique au byte près (test de parité).
- [ ] **Mesure datée :** à faire après déploiement, sur le crawl : H1 servi égal au H1 proposé.

## f. 60 exemples — `11-exemples-60.tsv`

- **Sélection** : `11-exemples-60.py`, déterministe.
  - 60 pages servables, 35 gammes, 35 marques.
  - Niveaux : 37 au niveau 0, **15 au niveau 1** (puissance requise), 8 au niveau 2.
  - Colonnes : page | indexable | niveau | H1 actuel | titre #2212 | H1 proposé.
- **Imposés** :
  - Paceman 53236 / 58881 / 58868 (gamme 402) ;
  - 3 lignes ajoutées pour 74085 / 74086 (hors sitemap) et 74087 (non servi), soit 63 lignes.

| page | H1 actuel | titre #2212 | H1 proposé |
|---|---|---|---|
| …/plaquette-de-frein-402/…/2-0-cooper-d-all4-53236.html | Plaquette de frein MINI PACEMAN (R61) Cooper D ALL4 préserver le véhicule | Plaquette de frein Mini Paceman (R61) 2.0 Cooper D ALL4 112 ch | Plaquette de frein Mini Paceman (R61) 2.0 Cooper D ALL4 |
| …/plaquette-de-frein-402/…/1-6-cooper-d-all4-58881.html | Plaquette de frein MINI PACEMAN (R61) Cooper D ALL4 dissiper l'énergie | Plaquette de frein Mini Paceman (R61) 1.6 Cooper D ALL4 112 ch | Plaquette de frein Mini Paceman (R61) 1.6 Cooper D ALL4 |
| …/plaquette-de-frein-402/…/1-6-cooper-58868.html | Plaquette de frein MINI PACEMAN (R61) Cooper maintenir en bon état | Plaquette de frein Mini Paceman (R61) 1.6 Cooper Essence 122 ch | Plaquette de frein Mini Paceman (R61) 1.6 Cooper 122 ch |
| …/plaquette-de-frein-402/…/cooper-all4-74085.html (hors sitemap) | Plaquette de frein MINI PACEMAN (R61) Cooper ALL4 maintenir en bon état | (non relevé) | Plaquette de frein Mini Paceman (R61) Cooper ALL4 Essence 122 ch N16 B16 A |
| …/plaquette-de-frein-402/…/cooper-all4-74086.html (hors sitemap) | *identique à 74085* | (non relevé) | Plaquette de frein Mini Paceman (R61) Cooper ALL4 Essence 122 ch N18 B16 A |
| …/filtre-a-air-8/volvo-172/c30-172040/1-6-d-19813.html | Filtre à air VOLVO C30 1.6 D 109 ch préserver le véhicule | Filtre à air Volvo C30 1.6 D 109 ch | Filtre à air Volvo C30 1.6 D |
| …/demarreur-2/volkswagen-173/golf-v-break-173045/1-6-22553.html | Démarreur VOLKSWAGEN GOLF V BREAK 1.6 Essence 102 ch garantir lancer le moteur au | Démarreur Volkswagen Golf V Break 1.6 Essence 102 ch | Démarreur Volkswagen Golf V Break 1.6 |
| …/kit-d-embrayage-479/volkswagen-173/passat-iv-break-173089/1-9-tdi-10056.html | Kit d'embrayage VOLKSWAGEN PASSAT IV B5 BREAK 1.9 TDI 115 ch permettre les changements de vitesse | Kit d'embrayage Volkswagen Passat IV Break 1.9 TDI 115 ch | Kit d'embrayage Volkswagen Passat IV Break 1.9 TDI 115 ch |
| …/filtre-a-carburant-9/mercedes-benz-108/vito-w639-108203/111-cdi-2-2-28155.html | Filtre à carburant MERCEDES VITO MIXTO (W639) 111 CDI 116 ch améliorer la fiabilité | Filtre à carburant Mercedes Vito Mixto (W639) 111 CDI 116 ch OM 646.980 | Filtre à carburant Mercedes Vito Mixto (W639) 111 CDI 116 ch OM 646.980 |

Les autres lignes sont dans le TSV. **Réserves de données**, à vérifier à la source avant
validation :

- Alfa Romeo Mito : code « 350 A1.000 ».
- Renault Express : affiché « Express », alors que le titre (gamme en repli) garde
  « EXPRESS (F40-G40) ».
- Audi : URL `a3-i-sportback` pour le modèle « A3 II Sportback ».

## g. Implémentation (non appliquée)

**Choix** : un patch de code, sans migration de gabarit. `sgc_h1` alimente un `<h2>` et non le
`<h1>` ; le H1 visible est calculé dans le code. Une migration n'aurait donc aucun effet sur
le H1 et il n'y a rien à essayer sur PostgreSQL 17.

1. **`packages/seo-types/src/build-r2-h1.ts`** : `buildR2CleanH1(gamme, véhicule, niveau, départage?)`
   et `resolveR2H1Level(véhicule, frères)`, deux fonctions pures. `buildR2H1Emitted` est
   conservée : c'est le repli de transition.
2. **`R2TitleCollisionService`** (catalog) :
   - `resolveHeading(pg, type)` calcule le niveau sur les types affichés du même modèle
     ayant des pièces dans la gamme (`pieces_relation_type`, limite 1 par type) ;
   - `buildHeading(input)` construit le H1 ;
   - le chargement est partagé avec `resolveTitle`, dont la sémantique est inchangée ;
   - le service est exporté par `CatalogModule`.
3. **`rm-h1-propre.patch`** (`rm.types.ts`, `rm-builder.service.ts` et 3 tests) :
   - `RmSeoData.h1Display` ;
   - rempli **indépendamment du gabarit** : les 8 gammes sans ligne `__seo_gamme_car` sont
     couvertes ;
   - les erreurs sont levées.
4. **Frontend** :
   - `h1Display` va de `rm-api.service.ts` à `PiecesHeader` en passant par `SEOInfo`,
     `rm-mapper.ts`, `pieces-vehicle.loader.server.ts` et `PiecesVehicleContent` ;
   - `PiecesHeader` rend `h1Display` s'il n'est pas vide, sinon le H1 historique.

**Application du patch par Marwane** (même geste que DW / #2212) :

```
cd <worktree> && git apply --check docs/audit/mandat-en-20261120/rm-h1-propre.patch \
  && git apply docs/audit/mandat-en-20261120/rm-h1-propre.patch
```

Vérifié : `git apply --check` passe sur la tête de la branche.

**Comportement par état** :

- **Sans le patch** : le backend n'émet pas `h1Display` ; le H1 historique est servi
  inchangé et la CI de cette PR est cohérente.
- **Avec le patch** : le constructeur de `RmBuilderService` prend un 5ᵉ argument ; les
  3 tests `rm/` du patch sont mis à jour en conséquence.

**Recouvrements** :

- **#2177** (ouverte) ne touche pas `rm-builder.service.ts`. Elle touche
  `seo-template.service.ts`, que ce dossier ne touche pas. Aucun fichier commun.
- **#2214** : aucun fichier commun ; elle change `type_name_meta` (voir §b).

**Délai de service après tag** :

- cache rm `page-v2` et `seo:comp_switches` (24 h) ;
- Cloudflare `s-maxage` 86 400 s ;
- aucune purge faite ni proposée ici.

Le H1 propre apparaît donc au fil de l'expiration des caches, au plus en 24 h environ.
Entre-temps, les réponses en cache n'ont pas `h1Display` : le H1 historique reste servi.

## Tests

| essai | résultat |
|---|---|
| `packages/seo-types` : `tsx --test src/build-r2-h1.test.ts` | 11/11 (5 golden historiques + 6 nouveaux) |
| jest `catalog/services/__tests__/r2-title-collision.service.test.ts` (worktree) | 18/18 |
| jest, **copie jetable avec patch appliqué** : `rm/services/__tests__` (5 suites) + r2-title-collision | 6 suites, 82/82 |
| vitest `frontend/tests/unit/pieces-header-h1-parity.test.tsx` (copie jetable) | 9/9 (5 parité historiques + 4 nouveaux) |
| `tsc --noEmit` frontend (copie jetable) | 3 erreurs, toutes hors périmètre et dues à la copie (`scripts/`, `audit/` absents) ; 0 sur les fichiers modifiés |
| `tsc` backend réduit (copie jetable, patch appliqué) | 3 erreurs dans `promise-helpers.ts` (typages passport absents de la config réduite) ; 0 sur les fichiers modifiés |
| ESLint frontend (7 fichiers) / backend (5 fichiers + 1 test rm patché) | 0 erreur ; 4 avertissements `any` préexistants, aucun ajouté |
| Prettier | fichiers modifiés conformes ; `pieces-header-h1-parity.test.tsx` était déjà non conforme à la base (lignes historiques non reformatées) |

`rm-builder-seo-shadow.test.ts` échoue 6/6 sans `SUPABASE_URL`, à l'identique sur le
worktree non patché (préexistant, environnemental). Les essais ci-dessus ont été lancés
avec les valeurs de test `SUPABASE_URL=http://localhost:54321` et
`SUPABASE_SERVICE_ROLE_KEY=test-service-role-key`.

## Fichiers du dossier

| fichier | rôle |
|---|---|
| `01`–`03`, `06`, `07` `.sql` | exports en lecture seule : pages, types, fragments, crawl, autres rôles |
| `04`, `05` | types hors sitemap candidats aux collisions |
| `08-analyse-h1.mjs` | mesures du §c (`mesures.tsv`, `parite-ecarts.tsv`, `doublons-restants.tsv`) |
| `09-doublons-fiches.mjs` | `doublons-fiches-base.tsv` |
| `10*-gsc-*.sql` + `.resultat.tsv` | §d.1 |
| `11-exemples-60.py` + `.tsv` | §f |
| `rm-h1-propre.patch` | §g, non appliqué |

Table complète (373 005 lignes) : `h1-r2-toutes-pages.tsv.gz`, sha256
`f92009ecfcbbc41fec02332af81111c448bdacb3216f549e90619f7ed453ed04`, 18 Mo. Elle est gardée
hors dépôt (scratchpad de session) et peut être reproduite par `08-analyse-h1.mjs`.
