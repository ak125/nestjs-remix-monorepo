# Mission Claude CLI — intégration du lot filtre à huile (pg_id 7)

Révision 3, 30/10/2026. Remplace la liste de raccordements de la révision 2. Seuls les raccordements du dossier
filtre à huile : les 13 besoins du dossier plaquettes ne sont pas des prérequis (FH-5 compteur et FH-11 `stages` les
recoupent parce que le filtre à huile en a besoin pour son compte).

## Consigne de démarrage

> Lis `docs/audits/editorial-filtre-huile-20261030/HANDOFF.md` sur la branche
> `docs/editorial-filtre-huile-dossier-20261030` et exécute la mission : vérifie le code et les contrats cités,
> traite FH-1 à FH-16 dans l'ordre du § 3, raccorde les textes (`integration/r1.json`, `integration/r3.json`) et les
> images (`integration/assets.json`) aux mécanismes existants, puis vérifie le rendu DEV en mobile et en bureau.
> Aucune écriture en base partagée avec la PROD, aucun déploiement, aucune modification d'URL, de title, de meta ni de
> H1. Consigne dans ce fichier, § 6, ce qui est fait avec sa preuve, et seulement les dépendances ou décisions qui
> restent.

## 1. État de la transmission

| État | Statut au 30/10 | Preuve ou motif |
|---|---|---|
| rédigé | oui | `integration/` (4 fichiers, plus `gsc-baseline.json` ajouté au § 6), `assets/` (8 visuels + sources SVG), `tools/`, `PROMPTS.md`, ce fichier |
| accessible | oui | branche poussée sur `origin` ; PR brouillon de revue [ak125/nestjs-remix-monorepo#1935](https://github.com/ak125/nestjs-remix-monorepo/pull/1935), à ne pas fusionner. Glob `docs/audits/editorial-*/**` ajouté au registre L2 (D5, `@ak125/content-team`) pour la garde des nouveaux fichiers |
| transmis | oui | consigne reçue le 30/10 par une session Claude Code ouverte sur le dépôt |
| pris en charge | oui | session Claude Code des 30 et 31/10 ; code sur la PR brouillon [ak125/nestjs-remix-monorepo#1936](https://github.com/ak125/nestjs-remix-monorepo/pull/1936), dossier sur #1935 |
| intégré et vérifié en DEV | vérifié en DEV, non intégré | code : #1936 en brouillon, non fusionnée, absente de PREPROD et de PROD ; lot : rendu DEV vérifié par une surcouche de lecture, rien d'écrit en base (§ 6) |

## 2. Ce qui est livré

| Fichier | Contenu | Statut |
|---|---|---|
| `integration/r1.json` | champs `r1s_*` (hero, sélecteur, 4 badges, intros, tableau de vérification, FAQ au format `{question, answer}`, bloc micro-SEO 1 570 caractères après FH-12) ; `sg_content` en 5 blocs H2 routés vers choose, price, location, reference ; ancien → nouveau par bloc | REVIEW_REQUIRED |
| `integration/r3.json` | 12 sections `__seo_gamme_conseil` par `sgc_id`, titres, HTML conforme aux composants de rendu, provenance proposée, image par section ; META conservée | REVIEW_REQUIRED |
| `integration/candidats.json` | F-C1 à F-C11 et blocs prêts après admission (S4, S5, S6, huile et filtre usagés) | non servables avant admission |
| `integration/assets.json` | 8 visuels : slot, `rip_id`, fichier, alt, légende, mécanisme, état de vérification ; LOCATION à désélectionner | fichiers produits |
| `PROMPTS.md` | images et scènes manquantes, moyen réel pour chacune | manques |
| `tools/build-assets.cjs`, `tools/build-pictos.cjs` | reproduction des visuels (sharp) depuis `assets/sources/` ; sortie identique octet pour octet, vérifiée le 30/10 | — |
| `tools/lint-integration.cjs` | contrôle du texte public : gardes R1 du dépôt (`R1_FORBIDDEN_TERMS`, `isR3R5Content`), bornes du contrat R1, JSON-LD FAQPage, motifs `anti_source`, noms de sources, promesses commerciales, statut candidat servi | PASS le 30/10 après FH-12 (68 unités, 0 constat) |
| `tools/build-preview.cjs`, `preview/` | simulation non intégrée : `extractEditorialBlocks`, `extractSummaryPoints`, `normalizeStepHtml` et `deriveDifficulty` (backend, avec les libellés de `buildHeroBadges`) exécutés sur les textes du lot, lus dans le checkout désigné par `FH_REPO` ; captures 375 et 1 280 px ; `preview/rapport.json` | pas un rendu DEV |
| `integration/gsc-baseline.json` | baseline Search Console de FH-13 : une ligne par rôle, aux colonnes de `__seo_gamme_gsc_baseline` | mesurée le 30/10, non insérée |
| `verification-dev/` | captures du rendu DEV (branche de correction, surcouche de lecture) : R1 et R3 en 375 et 1 280 px | rendu DEV, rien d'écrit |

Règles de service : un statut `candidat` n'est jamais servi ; un champ protégé (title, meta, H1) n'est pas modifié ;
aucune phrase ne nomme une source.

## 3. Requalification FH-1 à FH-16

Reproductions relancées le 30/10 à 14:09:55Z sur le site public et en lecture seule sur la base. Code lu sur la base de
branche `980b2f8a7` ; aucun fichier cité n'a changé jusqu'à `origin/main` `a7f39fe71` (relevé le 30/10 après `git fetch`). « Servi » = HTML PROD public au
moment de la reproduction.

| Id | Défaut reproduit (14:09Z) | Étape | Révision | Correction attendue | Critère de vérification |
|---|---|---|---|---|---|
| FH-1 | R3 S4_DEPOSE sert du texte anglais brut d'un site tiers : `combustion chamber` × 3 | données (`sgc_id` 21) | servi | contenu `r3.json` S4_DEPOSE | 0 occurrence dans le rendu DEV |
| FH-2 | 6 liens `href="/pièces/…"` en R3 | code (`restoreAccents` réécrit les attributs) + données (S7 sans id) | `main` et servi | `restoreAccents` n'altère ni URL ni attribut, avec test ; S7 de `r3.json` (4 liens vérifiés 200) | test unitaire sur un `href` ; 0 `/pièces/` dans le rendu DEV |
| FH-3 | aucun producteur WIKI → R1 ; R3 en canari seulement | producteur, projection, activation (§ 4) | `main` | intégration du lot par le chemin d'écriture existant et gouverné, sans producteur parallèle | chemin identifié et consigné ; aucune écriture RAG |
| FH-4 | bornes S4_MICRO_SEO : contrat 1 500-3 000, constante 700 | contrat | `main` | une seule source de bornes, ou test de divergence | test ; le bloc livré (1 850 / 1 663) passe les deux |
| FH-5 | R1 : `case D.2` × 6, « majoritairement des filtres cartouche » × 3, « 2 847 » × 1 | données (`sg_content`, `sgpg_compatibility_axes`) + code (`GammeDiagnosticCTA.tsx:68`) | servi | `sg_content` de `r1.json` ; compteur retiré ou mesuré | 0, 0, 0 dans le rendu DEV |
| FH-6 | R4 : 6 liens `/diagnostic-auto/<texte brut>` (404) | code (`reference-auto.$slug.tsx:1175`) + données (`__seo_reference` id 118) | servi | ne lier qu'un slug de diagnostic existant ; retirer les symptômes du filtre | 0 lien 404 sur R4 en DEV |
| FH-7 | « (Bosch, TRW, Brembo...) » × 1 sur la page véhicule 19052 ; « montées à l'arrière » : 0 (≥ 1 à 13:39Z) | code (`PiecesOemSection.tsx:137-138`) ; position : déploiement | servi | exemples absents ou tirés de la gamme ; position : constater la version déployée (Marwane) | 0 « Brembo » sur une page filtre à huile en DEV |
| FH-8 | Clio III 1.5 dCi : forme du filtre incohérente (24/23 vissés affichés, 8 cartouches non affichées par type) | données catalogue | base, 30/10 matin | confirmation par le propriétaire du catalogue, 19052 et 19053 séparément | réponse consignée ; aucune mention servie entre-temps |
| FH-9 | `PieceExpliquee` : pas de prop `hook`, titres et gravité en dur, un seul bandeau | code (composition) | `main` | accroche, titres et avertissements par fenêtre en props, avec test de rendu | test de rendu |
| FH-10 | aucune composition pour C1, C2, C3 | code | `main` | une composition générique paramétrée | rendu d'essai |
| FH-11 | `approvalRecord.stages` exigé par le code, absent du schéma | contrat | `main` | schéma et code alignés | validateur passe l'étape 1 sur un dossier conforme |
| FH-12 | critères techniques non affichés sur la page véhicule : 0 | à vérifier (fiche produit, comparateur) | servi | localiser la page qui les affiche ; sinon retirer les phrases conditionnées (`data-condition="FH-12"`, ligne Dimensions) | page localisée ou phrases retirées |
| FH-13 | aucune baseline GSC pour `pg_id` 7 : 0 ligne | données | base | ligne datée R1, R3, R4 avant mise en ligne | 1 ligne par rôle |
| FH-14 | vignettes habitacle et boîte auto : `catalogue/filtre-habitacle.webp` et `filtre-boite-auto.webp` servies × 2, réponse 400 | code ou données (§ 5) | servi | correction minimale testée après investigation | 200 pour les vignettes servies en R1 |
| FH-15 | R1 : `r1s_faq` au format `{q, a}` → FAQ générique servie ; « au meilleur prix » × 1, « plus de 50 marques » × 2, « homologations constructeur » × 1 ; h3 codé « Niveaux de qualité » × 1 | données (`__seo_r1_gamme_slots`) + code (`pieces.$slug.tsx`) | servi | champs de `r1.json` ; libellés codés : proposition (la page n'a pas de niveaux de prix) | FAQ du lot servie en DEV (5 questions) ; 0 promesse non vérifiée |
| FH-16 | R3 : « Source vérifiée » × 3 sous les cartes (provenance `web` humanisée) ; badges calculés « Difficulté Intermédiaire » et « Temps estimé ~45 min » (5 min par étape S4) ; CTA codé « Comparez les prix » | code commun à tous les guides (`source-provenance.util.ts`, `section-config.tsx:401-439`, route conseils l.602-607) + données (`sgc_sources`) ; encart bas de page codé « au meilleur prix parmi nos fournisseurs » × 1 (route conseils, encart après les sections) | servi | provenance du lot en `wiki` ; badges et encarts : correction minimale proposée et testée, sans déploiement. Avec le lot, les badges calculés deviennent « Facile » et « ~15 min » (3 étapes S4) : non sourcés | 0 « Source vérifiée » et 0 « meilleur prix » sur la page en DEV ; décision consignée pour les badges |

Hors Claude CLI : prix et stock servis (« à partir de », « En stock ») ; champs protégés ; spot-check humain de la fiche
WIKI ; admission de F-C1 à F-C11 ; validation humaine des claims de V1 ; prises de vue ; déploiement PROD.

## 4. FH-3 par étape

| Étape | Constat (30/10) |
|---|---|
| Producteur | R1 : aucun (script neutralisé, enrichisseur retiré). R3 : lot conseil neutralisé |
| Export | `wiki-exports-seo-generate.yml` ; export filtre-a-huile : 12 blocs (6 R3_CONSEILS, 3 R4, 3 R6), `content_hash` 773367f7, pointeur 88017732 ; aucun rôle R1 |
| Admission | partielle : contrôle d'intégrité seulement ; ADR-119 non prouvée ; fiche promue automatiquement |
| Projection | R3 : `seo-projection-feeder` → `__seo_content_blocks`, 6 blocs actifs pour pg 7. R1 : aucune (`feature-flags.service.ts:173-186`) |
| Lecteur | R1 : historique (`__seo_r1_gamme_slots`, `__seo_gamme.sg_content`). R3 : historique `blog-seo.service.ts` sauf canari `READY_FOR_RENDER` (`r3-guide.service.ts:162-170`) |
| Activation | `SEO_PROJECTION_READ_V1` à false ; canari vide ; refusé sous ADR-106 D7 (1 381 contre 9 128 caractères, −84,9 %, pas de FAQPage) |
| Version déployée | non constatée |

Les textes servis R1 viennent d'une migration (`20260106_filtres_content_v2.sql`) et d'enrichissements ; leur
provenance RAG n'est prouvée que pour R3 (`sgc_sources` de type `rag`). Le lot ne crée pas de producteur : il fournit
des textes relus, issus de la fiche WIKI, à faire passer par le chemin d'écriture existant.

## 5. FH-14 — investigation `pg_pic` / `pg_img`

Ne pas renvoyer le choix au propriétaire du catalogue avant cette investigation.

1. Sens : lire la définition et l'historique de `pieces_gamme.pg_pic` et `pg_img` (migrations, types partagés,
   documentation du registre).
2. Producteurs : qui écrit chacune des deux colonnes (scripts d'import, admin, migrations) et selon quelle convention de
   nom.
3. Consommateurs : `rg` des lectures de `pg_pic` et `pg_img` dans `backend/src` et `frontend/app`, dont
   `processCatalogueFamille` (`gamme-data-transformer.service.ts:162-170`).
4. Étendue : nombre de gammes affichées où `pg_pic` désigne un objet absent du stockage alors que `pg_img` existe
   (lecture seule).
5. Correction minimale : celle qui rend 200 sur R1 pour 424 et 416 sans changer le sens d'une colonne pour ses autres
   consommateurs ; test ciblé.

Reproduction : `select pg_id, pg_alias, pg_pic, pg_img from pieces_gamme where pg_id in (8, 9, 416, 424);` puis
`curl -s -o /dev/null -w '%{http_code}' https://www.automecanik.com/img/uploads/articles/gammes-produits/catalogue/<nom>.webp`.
Le 30/10 : `filtre-habitacle` et `filtre-boite-auto` (`pg_pic`) 400 ; `filtre-d-habitacle` et
`filtre-boite-automatique` (`pg_img`) 200.

## 6. Intégration et vérification DEV

1. **Base DEV.** Établir si la base lue par DEV est celle de la PROD (images R1 servies depuis le même projet
   Supabase). Si oui, toute écriture des textes ou des images est une écriture PROD sur du SEO indexé : zone STOP. La
   vérification se fait alors sans écriture partagée (copie locale des lignes de `pg_id` 7, ou branche de base de
   développement), sans drapeau d'exécution ajouté au code.
2. **Textes R1.** `__seo_r1_gamme_slots` (champs `r1s_*` de `r1.json`) et `__seo_gamme.sg_content` ; vérifier le
   routage des 5 H2 par `extractEditorialBlocks` et l'affichage de la FAQ (`resolveR1Faq`, 3 questions au moins).
3. **Textes R3.** `__seo_gamme_conseil` par `sgc_id` (`r3.json`) ; vérifier « L'essentiel en N points », le tableau
   S2_DIAG, les étapes S4 et le JSON-LD FAQPage (5 paires).
4. **Images.** R1 : `POST /api/admin/r1-image-prompts/:id/upload` (31, 32, 33, 35) ; désélection de 34 (mécanisme à
   trouver). R3 : `set-image-url` et `approve` (12, 13, 14) ; mise à jour des alt selon ce que le test B5 admet.
5. **Rendu.** Une page R1 et une page R3, en 375 px et en 1 280 px : captures, absence d'erreur console, images
   chargées en 200, aucun texte `candidat`, aucune promesse de prix ou de délai dans les blocs du lot. Comparer avec
   `preview/` (simulation) : routage des 5 blocs `sg_content` (choose 2, price 1, location 1, reference 1), 7 points
   dans « L'essentiel », 5 paires FAQPage. Relancer `tools/lint-integration.cjs` sur les textes réellement intégrés.
6. **Compte rendu.** Ajouter ci-dessous : commandes, captures, résultat de chaque critère du § 3, et seulement les
   décisions ou dépendances restantes, chacune à son étape.

### Compte rendu de Claude CLI

Session Claude Code ouverte sur le dépôt, 30 et 31/10/2026. Code : PR brouillon #1936, branche
`fix/editorial-filtre-huile-fh-20261030`, tête `e3d644a04`. Dossier : #1935. Rien n'est fusionné, déployé ni écrit en
base.

#### État

| État | Statut au 31/10 | Preuve |
|---|---|---|
| implémenté | oui | code de FH-2, 4, 5, 6, 7, 9, 10, 11, 14, 15 et 16 dans #1936 ; textes du dossier pour FH-1, 12 et 13 (`integration/`) |
| intégré | non | #1936 en brouillon, non fusionnée : absente de `main`, de PREPROD et de PROD. Textes et images du lot non écrits |
| vérifié | en DEV, par surcouche de lecture | critères du § 3 ci-dessous ; CI de #1936 verte sur `e3d644a04` (40 contrôles réussis, 9 ignorés, 0 échec) |
| opérationnel | non | aucun visiteur ne voit ces changements |
| bloqué | écriture des textes et des images | base, stockage et imgproxy partagés avec la PROD, pages indexées : zone STOP (« Restant ») |

#### Base DEV et méthode (étape 1)

- DEV lit la base, le stockage et imgproxy de la PROD : les images servies en DEV et en PROD viennent du même projet.
  Écrire le lot depuis DEV reviendrait à écrire en PROD sur des pages indexées.
- La vérification s'est faite sans écriture. Le backend de la branche de correction tournait derrière un proxy local,
  qui remplaçait à la lecture les lignes de `pg_id` 7 par le lot et refusait toute écriture :
  - `get_buying_guide_with_r1_slots` : champs `r1s_*` de `r1.json` ;
  - `get_gamme_page_data_cached` : `seo.sg_content` ;
  - `__seo_gamme_conseil` : `sgc_title`, `sgc_content` et `sgc_sources` des sections de `r3.json` ;
  - `__seo_r1_image_prompts` : fichiers, alt et légendes de 31, 32, 33 et 35 ; ligne 34 (LOCATION) retirée ;
  - `__seo_r3_image_prompts` : 12, 13 et 14 pointant vers les fichiers du lot, servis localement.
- Le proxy a refusé 67 écritures applicatives pendant les parcours, et aucune n'a atteint la base : 55
  `__substitution_logs`, 8 `___xtr_msg`, 2 `__admin_job_health`, 1 `__error_logs`, 1 `__seo_event_log`.
- Cache sur une base Redis distincte, vidée à la fin ; banc arrêté. Aucun drapeau d'exécution ajouté. Les scripts du
  banc ne sont pas versionnés : ils dépendent de chemins locaux et de la configuration d'environnement.
- Référence de comparaison : pile DEV de `main`, même base, sans surcouche. Sur R1, R3 et R4, title, meta description,
  canonical, robots et H1 sont identiques à cette référence. Deux balises Open Graph changent (« Images »).

#### Commandes versionnées

Depuis la racine d'un checkout de la branche du dossier, `REPO` désignant la racine du dépôt qui porte les
`node_modules` :

```sh
NODE_PATH=$REPO/node_modules:$REPO/frontend/node_modules \
  node docs/audits/editorial-filtre-huile-20261030/tools/lint-integration.cjs
NODE_PATH=$REPO/node_modules:$REPO/frontend/node_modules FH_REPO=<checkout de la branche de correction> \
  node docs/audits/editorial-filtre-huile-20261030/tools/build-preview.cjs --shots
```

- Lint : PASS, 68 unités, 0 constat. Micro-SEO de 1 570 caractères, dans les bornes du contrat (1 500 à 3 000).
  FAQPage R3 : 5 paires.
- Preview, avec les fonctions de la branche de correction : `sg_content` routé choose 2, price 1, location 1,
  reference 1, 0 non routé. « L'essentiel » en 7 points. Badge R3 unique : « Sécurité : Précautions requises ». Les 4
  captures n'ont ni image cassée, ni erreur, ni débordement (`preview/rapport.json`).

#### Rendu DEV (étape 5)

Pages R1 `/pieces/filtre-a-huile-7.html`, R3 `/blog-pieces-auto/conseils/filtre-a-huile` et R4
`/reference-auto/filtre-a-huile`, en 375 et 1 280 px ; page véhicule 19052 (R2) pour FH-7.

- 6 parcours en 200 : 0 image cassée, 0 réponse ≥ 400, 0 défilement horizontal, 0 requête vers l'image LOCATION, 0 clé
  React dupliquée.
- Images du lot chargées : R1 HERO, TYPES et PRICE ; R3 HERO, S2 et S3.
- Console : messages du banc seulement (websocket Vite, balise CWV refusée par le proxy), plus l'avertissement
  d'hydratation `nonce`, déjà présent sur DEV `main`.
- R1 : les 5 H2 de `sg_content` sont rendus dans `#bien-choisir` (2), `#qualite-prix`, `#emplacement` et `#reference`,
  comme dans `preview/`. FAQ du lot affichée, 5 questions ; FAQPage = ces 5 questions.
- R3 : « L'essentiel en 7 points » ; tableau S2_DIAG identique à `r3.json` (4 lignes) ; HowTo de 3 étapes, sans
  `totalTime` ; FAQPage de 5 paires.
- Aucun texte `candidat` servi et aucune promesse de prix ou de délai dans les blocs du lot (lint, comptes ci-dessous).
- Captures dans `verification-dev/` :
  - `dev-r1-375.webp` (375 × 14 070) et `dev-r1-1280.webp` (1 280 × 8 273) ;
  - `dev-r3-375-1.webp` et `dev-r3-375-2.webp` : la page R3 en 375 px, en deux moitiés de 375 × 10 898 ;
  - `dev-r3-1280.webp` (1 280 × 10 616).

#### Critères du § 3

Comptes sur le texte rendu, surcouche DEV / DEV `main`.

| Id | Fait | Preuve | Reste |
|---|---|---|---|
| FH-1 | S4_DEPOSE de `r3.json` (`sgc_id` 21) injectée | « combustion chamber » 0 / 3 | écriture (« Restant ») |
| FH-2 | `d1e39811e` : `restoreAccents` ne touche plus aux balises, attributs ni URL ; S7 de `r3.json` | tests `fr-accent-map.test.ts` (`href`, `src`, `alt`, `class`, `data-*`, URL dans le texte) ; `/pièces/` 0 / 12 ; les 5 liens `/pieces/` de R3 en 200 | — |
| FH-3 | chemin d'écriture identifié (« Raccordement des textes ») | aucun producteur créé, aucune écriture RAG | écriture (« Restant ») |
| FH-4 | `783f1beb6` : bornes lues dans `R1_ROUTER_CONTRACT` ; `1495a0f8f` : test sur le bloc livré | jest 3/3. Le bloc fait 1 570 caractères après FH-12 ; les valeurs 1 850 / 1 663 du § 3 le précèdent | — |
| FH-5 | `b4bd0f3d7` : compteur et avatars retirés ; `sg_content` et FAQ du lot | « case D.2 » 0 / 6 ; « majoritairement des filtres cartouche » 0 / 3 ; « 2 847 » 0 / 1 | repli FAQ des autres gammes (« Restant ») |
| FH-6 | `681078f83`, `202d5b9e9` : lien seulement vers un diagnostic publié ; symptôme sans diagnostic en texte ; valeur vide non rendue | 3 tests `filterPublishedSlugs` ; liens `/diagnostic-auto/<texte>` 0 / 5 ; liens vides 0 / 5 | données (« Restant ») |
| FH-7 | `3092064d9` : parenthèse de marques retirée, avec test | « Brembo » 0 / 1 sur 19052. PROD publique à 20:20:30Z : « Brembo » 1, « montées à l'arrière » 0 ; version déployée non constatée, faute d'accès PROD | — |
| FH-8 | recompte en lecture seule | 19052 : 74 affichés, dont 24 vissés et 0 cartouche ; 19053 : 73, 23 et 0, comme au § 3. Le lot ne sert aucune forme par véhicule | confirmation (« Restant ») |
| FH-9 | `9f63de8aa` : accroche, titres et avertissements par fenêtre en props | tests de rendu 6/6 ; sans ces props, rendu identique octet pour octet à `main` | — |
| FH-10 | `9f63de8aa` : composition `SequencesCourtes`, durée calculée, erreur sans séquence ; format au schéma de brief | rendu d'essai par les tests du renderer | — |
| FH-11 | `5057f4f05` : `approvalStagesOf` lit les approbations du schéma ou les `stages` de `__video_productions`, refuse les deux formes à la fois ou aucune | validateur 69/69, jest 76 ; le pilote `fafa-plaquettes-frein-001` passe l'étape 1 | — |
| FH-12 | page non trouvée : la fiche produit (`get_piece_detail`) ne sert que les critères de niveau 1 (« Type de filtre », Quantité). Dimensions et « avec joint d'étanchéité » sont de niveau 2 | phrases `data-condition="FH-12"` retirées ; ligne Dimensions remplacée par « Ne pas confondre avec » ; « joint torique fourni » retiré (R1 micro-SEO et point 3 de `sg_content`, R3 S1 et S4_REPOSE, candidat S4_REPOSE) | — |
| FH-13 | `integration/gsc-baseline.json` | R1 : 0 clic, 1 785 impressions, position 48,9, du 30/07 au 27/10. R3 et R4 : 0 ligne, alors que l'export contient 65 pages conseils et 87 pages `/reference-auto/` | insertion (« Restant ») |
| FH-14 | `d9fcac6e0` : `pg_img` lu via `get_homepage_families` (DEFINER), repli `pg_pic` avec avertissement | 3 tests ; 4 vignettes R1 en 200 en DEV | résiduel (« Restant ») |
| FH-15 | `8bc63c059` : FAQPage construit avec `resolveR1Faq` ; `mergeR1Faq` et h3 « Niveaux de qualité » retirés ; `r1s_faq` du lot | FAQ du lot servie, 5 questions ; « au meilleur prix » 0 / 1 ; « plus de 50 marques » 0 / 2 ; « homologations constructeur » 0 / 1 ; « Niveaux de qualité » 0 / 1 | libellés codés (« Restant ») |
| FH-16 | `fa14e8b2b` : `deriveDifficulty` ne calcule plus difficulté ni durée ; `totalTime` retiré ; CTA et encart sans promesse de prix ; provenance du lot en `wiki` | « Source vérifiée » 0 / 3 ; « Comparez les prix » 0 / 1 ; « meilleur prix » 0 / 1 ; « Difficulté » 0 / 1 ; « Temps estimé » 0 / 1 | portée (« Restant ») |

Décision sur les badges (FH-16) : la prévision du § 3 (« Facile », « ~15 min ») est inexacte. Elle venait de
`deriveHeroBadges`, une fonction frontend jamais appelée, retirée par `fa14e8b2b`. La route affiche les métadonnées de
`deriveDifficulty` (backend) : avec le lot, `main` aurait servi « Intermédiaire » et « ~45 min », sans source. Seul le
badge de sécurité, tiré des sections S4 et S5, reste.

#### Raccordement des textes (FH-3)

Le chemin applicatif gouverné est `ContentWriteGateService.writeToTarget` (`backend/src/config/content-write-gate.service.ts`),
seul point d'entrée des écritures de contenu d'après `write-guard.module.ts:5`. Il refuse toute provenance RAG ; la
provenance du lot est `wiki`. Il ne couvre pas le lot tel quel :

| Cible | Groupe du catalogue | Constat |
|---|---|---|
| `__seo_r1_gamme_slots`, champs `r1s_*` | `r1_gamme_slots` (`r1s_pg_id`) | `r1s_arg1..4_content` et `r1s_faq` ne sont pas déclarés au catalogue (colonnes de la migration `20260322_create_r1_gamme_slots.sql`). Aucun appelant de `writeToTarget` pour ce groupe ; la garde des écrivains servis ne connaît que cette migration |
| `__seo_gamme.sg_content` | `seo_gamme_main` (`sg_pg_id`) | seuls les champs `*_draft` sont déclarés ; aucun code ne promeut `sg_content_draft` vers `sg_content`. Seuls écrivains : des migrations |
| `__seo_gamme_conseil`, par `sgc_id` | `r3_conseil_section` (`sgc_pg_id`) | la lecture préalable `.eq(pkField, pkValue).single()` porte sur `sgc_pg_id` et ne peut pas viser une section. Seul écrivain applicatif : `conseil-quality-scorer.service.ts`, pour `sgc_quality_score` |

Les appelants actuels de `writeToTarget` (R6 `buying-guide-enricher`, refusé car `RAG_LEGACY` ; R2 ; R8) ne visent
aucun de ces groupes. Une écriture du lot passe donc par l'une de deux voies :

- un nouvel appelant de `writeToTarget`, avec déclaration des champs manquants et adressage de `__seo_gamme_conseil`
  par `sgc_id` ;
- une migration SQL, sur le modèle de `20260106_filtres_content_v2.sql`.

Les deux ne passent pas les mêmes contrôles :

- La première passe par le contrôle de propriété, le CAS et le garde de régression de la passerelle. Elle ne déclenche
  pas `check-served-content-write-sinks-ratchet.ts` : l'exécuteur (`content-write-executor.service.ts:198` et `:221`)
  écrit dans une table résolue à l'exécution, que cette garde déclare hors de sa couverture.
- La seconde ajoute un couple `fichier::cible` de type `sql_migration`. La garde échoue alors jusqu'à une revue owner
  et un rafraîchissement de la baseline, réservé au mainteneur.

Les deux écrivent en PROD sur des pages indexées.

#### Raccordement des images

| Slot | Mécanisme existant | Constat |
|---|---|---|
| R1 HERO 31, TYPES 32, PRICE 33, OG 35 | `POST /api/admin/r1-image-prompts/:id/upload` (`admin-r1-image-prompts.controller.ts:106`) | réécrit l'objet existant du stockage partagé, au même chemin. OG 35 : l'URL d'og:image R1 ne change pas, l'image servie si |
| alt et légendes R1 | aucun | aucun endpoint n'écrit `rip_alt_text` ni la légende. og:image:alt R1 suit l'alt du slot OG : « Filtre à huile — AutoMecanik » sur DEV `main`, « Filtre à huile : vissé ou cartouche, la référence se choisit selon la motorisation » avec le lot |
| R1 LOCATION 34 | aucun | ni désélection ni retrait : seuls `approve` (l.81), `set-image-url` (l.90) et `upload` existent. La ligne n'est masquée que par un statut autre que `approved` ou une URL nulle. Sans elle, `#emplacement` garde sa grille à deux colonnes en 1 280 px (`pieces.$slug.tsx:976-978`) : texte à gauche, moitié droite vide |
| R3 HERO 12, S2 13, S3 14 | `PATCH /api/admin/r3-image-prompts/:id/set-image-url` (l.123) puis `approve` (l.110) | pas d'upload ni de chemin de stockage défini pour `r3/` : il faut déposer le fichier par un autre moyen. Le HERO devient og:image R3 (route conseils l.393) : `catalogue/filtre-a-huile.webp` sur `main`, `r3/filtre-a-huile-hero.webp` avec le lot |
| alt et légendes R3 | aucun | `r3-image-prompt.b5-closure.test.ts:49` n'admet en écriture que `rip_image_url` et `rip_status`. L'alt affiché du hero est `page.title` (route conseils l.544), pas `rip_alt_text` |

#### Restant, par étape

| Étape | Point | Dépendance ou décision |
|---|---|---|
| admission | fiche WIKI filtre à huile | admission ADR-119 non prouvée (§ 4), préalable à l'écriture des textes |
| données, zone STOP | textes R1 (`r1s_*`, `sg_content`) et R3 (`sgc_*` par `sgc_id`) | choix d'une des deux voies (« Raccordement des textes »), avec accord nominatif pour une écriture PROD sur des pages indexées |
| stockage, zone STOP | images R1 31, 32, 33 et 35 ; dépôt des fichiers R3 puis `set-image-url` et `approve` de 12, 13 et 14 | accord nominatif. og:image R1 change d'image, og:image R3 change d'URL : balises protégées |
| code | alt et légendes R1 et R3 ; retrait de LOCATION 34 ; mise en page de `#emplacement` sans image ; alt du hero R3 | aucun mécanisme existant ; pour R3, la clôture B5 interdit l'écriture applicative des alt |
| données | FH-5 : repli `R1_SELECTOR_FAQ` (`pieces.$slug.tsx:98`), qui cite `case D.2` pour les autres gammes | admission de F-C7 |
| données | FH-6 : symptômes de `__seo_reference` id 118 ; 90 valeurs vides sur 22 références | écriture en base. Aucune des 1 254 valeurs non vides n'est le slug d'un diagnostic publié : sans producteur R4 de slugs, la carte n'a aucun lien sur les 220 pages R4 |
| données | FH-8 : forme du filtre pour 19052 et 19053 | confirmation par le propriétaire du catalogue, véhicule par véhicule |
| données | FH-13 : 3 lignes de `gsc-baseline.json` dans `__seo_gamme_gsc_baseline` (vide, sans écrivain ni lecteur dans le code) | écriture en base |
| migration | FH-14 : 11 gammes sans famille (`mc_mf_prime` = 0) gardent `pg_pic`. 141 et 1375 restent cassées alors que leur `pg_img` existe ; les 9 autres n'ont aucun des deux fichiers | modifier `get_gamme_page_data_optimized` |
| code | R1, libellés codés hors liste : H2 « Qualité, prix et marques » (`pieces.$slug.tsx:900`) ; « Marque de confiance » et « pour garantir performance, sécurité et longévité » (`EquipementiersSection.tsx:110`, `:55`) | correction à proposer |
| champ protégé | meta description R1 : « …pas cher dès 5€… En stock, livraison 24-48h. » | non modifiée : meta protégée, prix et stock en zone STOP |
| code | sous-titre R3 « Tout savoir sur les filtre-a-huile » : alias brut (route conseils l.510, `visual-intent.ts:186`), servi aussi en PROD | correction à proposer, commune à tous les guides |
| revue | #1936 : FH-16 retire « Difficulté » et « Temps estimé » de tous les guides R3 ; les autres changements touchent tous les gabarits listés dans la PR | revue humaine (DoD2), puis fusion par l'owner ; déploiement hors mandat |
