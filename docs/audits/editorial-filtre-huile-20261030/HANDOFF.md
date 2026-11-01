# Mission Claude CLI — intégration du lot filtre à huile (pg_id 7)

Révision 3, 30/10/2026. Remplace la liste de raccordements de la révision 2. Révision 4 du dossier (31/10) : § 1
(note) et § 2 mis à jour par Claude Code Desktop ; § 3 à § 6 inchangés. Révision 5 (31/10, après-midi) : § 1 et § 2
par Claude Code Desktop ; § 6 (Claude CLI) inchangé. Seuls les raccordements du dossier
filtre à huile : les 13 besoins du dossier plaquettes ne sont pas des prérequis (FH-5 compteur et FH-11 `stages` les
recoupent parce que le filtre à huile en a besoin pour son compte).

Mise à jour du 31/10 par Claude CLI, après la rectification du mandat (auto-review, pas de relecture humaine des
fiches) : § 2 (statuts), fin du § 3, § 4 (admission) et compte rendu du § 6 recalés sur ADR-119 et sur la tête
`bbc7e8ed8` de #1936. Le compte rendu sépare désormais cinq périmètres, consigne l'admission WIKI et le lot de
publication, préparé et non exécuté. Aucune ligne du dossier ne demande plus de relecture humaine d'une fiche WIKI.

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
| accessible | oui | révisions 1 à 4 : [ak125/nestjs-remix-monorepo#1935](https://github.com/ak125/nestjs-remix-monorepo/pull/1935), fusionnée dans `main` le 31/10 (`9d1d82207`) ; révision 5 : nouvelle branche issue de `main` (CHECKPOINT). Glob `docs/audits/editorial-*/**` ajouté au registre L2 (D5, `@ak125/content-team`) pour la garde des nouveaux fichiers |
| transmis | oui | consigne reçue le 30/10 par une session Claude Code ouverte sur le dépôt |
| pris en charge | oui | session Claude Code des 30 et 31/10 ; code sur la PR brouillon [ak125/nestjs-remix-monorepo#1936](https://github.com/ak125/nestjs-remix-monorepo/pull/1936), dossier sur #1935 |
| intégré et vérifié en DEV | code fusionné ; lot vérifié en DEV, non écrit | code : #1936 fusionnée dans `main` le 31/10 (`7d3f30237`), déploiement PREPROD et PROD non vérifié ; lot : rendu DEV vérifié par une surcouche de lecture, rien d'écrit en base (§ 6, rédigé avant les deux fusions) |

Révision 4 (31/10) : prise en charge par Claude CLI le 31/10 (§ 6, banc sur `67f7ce304`) ; la mention « transmise :
non » de la version précédente de ce paragraphe est caduque. Ce qui change pour l'intégration : S2_DIAG (4 lignes au
lieu de 3), une fiche par champ et par bloc dans `integration/r1.json` et `r3.json`, trois propositions de libellés
codés (décisions de l'owner), un bloc candidat S2_DIAG, trois pictogrammes vidéo pour `SequencesCourtes`.

Révision 5 (31/10, après-midi), recentrage du mandat : Claude CLI organise le point d'entrée commun et l'intégration ;
Claude Code Desktop termine les productions éditoriales et médias. Pour l'intégration, rien ne change dans `r1.json`,
`r3.json`, `assets.json` ni `publication-batch.json`. Changent :

- `integration/candidats.json` : F-C4, F-C9, F-C10 et F-C11 vérifiés le 31/10 (sources internes au fichier) ; bloc
  S4_REPOSE avec les joints neufs de cartouche (F-C9) ; phrase « huile et filtre usagés » de S6 corrigée (toutes les
  déchèteries ne reprennent pas le filtre). Toujours non admis : aucun bloc n'est servable.
- `integration/social.json`, `SOCIAL.md`, `assets/social/` (13 diapositives, 5 couvertures), `tools/build-srt.cjs` (sous-titres de C1 à C4) :
  hors pages, rien à raccorder.
- `tools/lint-integration.cjs` couvre aussi les blocs candidats, les textes sociaux et les courts.

Relevé de Claude Code Desktop pour l'environnement isolé, transmis à Claude CLI sans action de sa part : aucun
environnement isolé fourni par le projet ; aucun accès PROD sur ce poste, si bien qu'une application lancée ici ne
peut pas écrire en PROD ; la reconstruction de la RPC de la page lit 15 tables ; images Docker `postgres:17` présentes
sous WSL, mais PostgREST, storage-api, Redis et imgproxy (versions épinglées) restent à télécharger ; 8,3 Go libres
sur `C:`, juste pour un `npm ci` et les builds, et aucun `node_modules` conforme au lockfile ; URL d'images codées en
dur vers `www.automecanik.com/imgproxy` dans le frontend ; préconditions de `publication-batch.json` lues, non
exécutées.

## 2. Ce qui est livré

| Fichier | Contenu | Statut |
|---|---|---|
| `integration/r1.json` | champs `r1s_*` (hero, sélecteur, 4 badges, intros, tableau de vérification, FAQ au format `{question, answer}`, bloc micro-SEO 1 570 caractères après FH-12) ; `sg_content` en 5 blocs H2 routés vers choose, price, location, reference ; ancien → nouveau par bloc. Révision 4 : `fiche` par champ et `fiche_par_bloc` (cible, question résolue, preuve interne, portée véhicule, statut d'admission, dépendance, image) ; `propositions_libelles_codes` : H2 « Qualité, prix et marques », texte et badge de `EquipementiersSection.tsx` | auto-revu (lint, banc DEV) ; non écrit, écriture en zone STOP. Badge et accroche retirés par `67f7ce304` (#1936) ; H2 « Qualité, prix et marques » : décision nominative (SEO indexé) |
| `integration/r3.json` | 12 sections `__seo_gamme_conseil` par `sgc_id`, titres, HTML conforme aux composants de rendu, provenance proposée, image par section ; META conservée. Révision 4 : `fiche` par section ; S2_DIAG en 4 lignes (la dernière répond aux intentions R5 fuite, bruit, odeur et vibration, consolidées sur `#diagnostic-rapide`, sans désigner le filtre) ; proposition de slogan R3 (`visual-intent.ts:186`) | auto-revu (lint, banc DEV) ; non écrit, écriture en zone STOP. Slogan R3 vidé par `67f7ce304` (#1936) |
| `integration/candidats.json` | F-C1 à F-C11 et blocs prêts après admission (S4, S5, S6, huile et filtre usagés ; révision 4 : ligne S2_DIAG « fuite juste après remplacement », F-C3 et F-C4 ; révision 5 : F-C4, F-C9, F-C10, F-C11 vérifiés, S4_REPOSE avec joints de cartouche, S6 corrigé) | non servables avant admission |
| `integration/social.json`, `SOCIAL.md`, `assets/social/`, `tools/build-social.cjs` | révision 5 : carrousels Instagram A (6) et B (7), posts Facebook, légende de C4, titres et tags YouTube, couvertures V1 et C1 à C4 ; UTM par campagne | proposition, hors pages ; rien à raccorder |
| `tools/build-srt.cjs` | révision 5 : sous-titres de C1 à C4 tirés de MEDIA.md § 7, écrits dans `subtitles/`, non versionné (`.gitignore` : sous-titres avec les rendus, hors dépôt) | à recaler sur la voix enregistrée |
| `integration/assets.json` | 8 visuels de page et 4 pictogrammes vidéo : slot, `rip_id`, fichier, alt, légende, mécanisme, état de vérification ; révision 4 : droits, portée et affichage attendu par visuel, consommateur `SequencesCourtes` (#1936) pour les pictogrammes ; LOCATION à désélectionner | fichiers produits |
| `PROMPTS.md` | images et scènes manquantes, moyen réel pour chacune | manques |
| `tools/build-assets.cjs`, `tools/build-pictos.cjs` | reproduction des visuels (sharp) depuis `assets/sources/` ; sortie identique octet pour octet, vérifiée le 30/10 ; `build-pictos.cjs` produit les 4 pictogrammes depuis le 31/10, témoin inchangé à l'octet près | — |
| `tools/lint-integration.cjs` | contrôle du texte public : gardes R1 du dépôt (`R1_FORBIDDEN_TERMS`, `isR3R5Content`), bornes du contrat R1, JSON-LD FAQPage, motifs `anti_source`, noms de sources, promesses commerciales, statut candidat servi ; révision 5 : blocs candidats, textes sociaux et courts (`FORBIDDEN_PATTERNS_SOCLE` et `_SHORT`), règles de canal du seed de marque | PASS le 30/10 après FH-12, le 31/10 après la révision 4 (68 unités) et après la révision 5 (158 unités, 0 constat ; 34 contrôles de canal) |
| `tools/build-preview.cjs`, `preview/` | simulation non intégrée : `extractEditorialBlocks`, `extractSummaryPoints`, `normalizeStepHtml` et `deriveDifficulty` (backend, avec les libellés de `buildHeroBadges`) exécutés sur les textes du lot, lus dans le checkout désigné par `FH_REPO` ; captures 375 et 1 280 px ; `preview/rapport.json` ; régénérés le 31/10 avec les fonctions de la branche de correction (`e3d644a04`) : badge « Sécurité » seul | pas un rendu DEV |
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

Hors Claude CLI : prix et stock servis (« à partir de », « En stock ») ; champs protégés ; admission de F-C1 à F-C11
par la route ADR-119 (capture RAW, `revision_of`, auto-review de sens, décision du décideur) ; validation des claims de
V1 au sens du contrat vidéo G2 (`human_validated`, propre aux vidéos, distinct des fiches WIKI) ; prises de vue ;
déploiement PROD.

## 4. FH-3 par étape

| Étape | Constat (30/10) |
|---|---|
| Producteur | R1 : aucun (script neutralisé, enrichisseur retiré). R3 : lot conseil neutralisé |
| Export | `wiki-exports-seo-generate.yml` ; export filtre-a-huile : 12 blocs (6 R3_CONSEILS, 3 R4, 3 R6), `content_hash` 773367f7, pointeur 88017732 ; aucun rôle R1 |
| Admission | partielle : contrôle d'intégrité seulement ; ADR-119 non prouvée ; fiche promue automatiquement ; précisé au § 6 (« Admission WIKI ») |
| Projection | R3 : `seo-projection-feeder` → `__seo_content_blocks`, 6 blocs actifs pour pg 7. R1 : aucune (`feature-flags.service.ts:173-186`) |
| Lecteur | R1 : historique (`__seo_r1_gamme_slots`, `__seo_gamme.sg_content`). R3 : historique `blog-seo.service.ts` sauf canari `READY_FOR_RENDER` (`r3-guide.service.ts:162-170`) |
| Activation | `SEO_PROJECTION_READ_V1` à false ; canari vide ; refusé sous ADR-106 D7 (1 381 contre 9 128 caractères, −84,9 %, pas de FAQPage) |
| Version déployée | non constatée |

Les textes servis R1 viennent d'une migration (`20260106_filtres_content_v2.sql`) et d'enrichissements ; leur
provenance RAG n'est prouvée que pour R3 (`sgc_sources` de type `rag`). Le lot ne crée pas de producteur : il fournit
des textes tirés de la fiche WIKI et auto-revus (§ 6), à faire passer par le chemin d'écriture existant.

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
`fix/editorial-filtre-huile-fh-20261030`, tête `bbc7e8ed8`, merge-base avec `main` `2a49166e2`. Dossier : #1935. Rien
n'est fusionné, déployé ni écrit en base.

#### État

| État | Statut au 31/10 | Preuve |
|---|---|---|
| implémenté | oui | code de FH-2, 4, 5, 6, 7, 9, 10, 11, 14, 15 et 16 dans #1936, plus `67f7ce304` (libellés R1 et R3), `da17a3814` et `6e57bb6c7` (gates et score vidéo), `573c022b4` et `500e9c4fd` (skills seo-batch), `c0a6c7d96` (consignes) ; textes du dossier pour FH-1, 12 et 13 (`integration/`) ; lot de publication préparé (`integration/publication-batch.json`) |
| intégré | non | #1936 en brouillon, non fusionnée : absente de `main`, de PREPROD et de PROD. Textes et images du lot non écrits |
| vérifié | en DEV, par surcouche de lecture | critères du § 3 ci-dessous ; banc de la révision 4 sur `67f7ce304` ; CI de #1936 verte sur `bbc7e8ed8` (43 contrôles réussis, 9 ignorés, 0 échec) |
| opérationnel | non | aucun visiteur ne voit ces changements |
| bloqué | écriture des textes et des images | base, stockage et imgproxy partagés avec la PROD, pages indexées : zone STOP (« Restant ») |

#### Cinq périmètres distincts

| Périmètre | Constat au 31/10 | Ce qui manque |
|---|---|---|
| Auto-review technique | #1936 : revue indépendante par un sous-agent sur `e3d644a04` (5 constats corrigés dans `b9009d913`, 10 rapportés ; un plantage réfuté, son résidu rapporté ; un constat réfuté ; un confirmé, qui est la limite PREPROD de FH-6) ; Codex sur `ee70555b0` (1 constat, corrigé par `6e57bb6c7` avec 2 tests), puis sur le delta de `6e57bb6c7` (0 constat) ; `6e57bb6c7..bbc7e8ed8` ne change que des projections. C'est le niveau B que propose ADR-120. #1935 : niveau A (lint PASS, JSON valides) | ADR-120 (vault #389) n'est pas fusionnée : DoD2 v1.0.0 exige encore une approbation humaine, la case reste non cochée. Aucune approbation GitHub n'est tirée de ces revues |
| Auto-review et admission WIKI | fiche `gamme/filtre-a-huile` promue TIER A par son décideur (`a478334`) ; auto-review de sens ADR-119 ABSENT, consultative hors sécurité (D3) | exécuteur isolé (lacune technique) ; captures RAW de F-C1 à F-C11 (lacune probatoire) ; détail ci-dessous |
| Décision de gouvernance | ADR-120 (#389) ouverte, non ratifiée ; ADR-107 D5 demande une « validation owner » pour modifier une fiche promue, et ADR-119 ne l'amende pas | fusion de #389 ; arbitrage de la divergence D5 au vault |
| Autorisation de mutation PROD | aucune | accord nominatif sur l'écriture du lot (`integration/publication-batch.json`) et sur le H2 « Qualité, prix et marques » ; GO de tag pour le code |
| Intégration et observation réelles | aucune. La surcouche DEV prouve le rendu, pas la persistance | fusion de #1935 et #1936, PREPROD, tag, écriture du lot, puis observation en PROD |

Rôles : Desktop prépare et relit les contenus selon les méthodes applicables ; Claude CLI corrige et intègre ; Codex
contre-vérifie sur un SHA figé ; Hermes suit les preuves et les relais. Aucun de ces rôles n'attend une relecture
humaine de fiche WIKI.

#### Admission WIKI (ADR-119)

- Fiche `wiki/gamme/filtre-a-huile.md`, promue TIER A par `a478334` (WIKI #100, 01/10/2026) : `review_status: approved`,
  `exportable.seo: true`, `exportable.rag: false`. `is_safety` est faux : D3 n'est que rapporté pour elle.
- Auto-review de sens, lue sur WIKI `main` `6c82c5c` : `semantic_review` ABSENT (`pass: false`, `runs: []`, sortie 1),
  clé `ffd95e3b…`, `text_sha256` `e77c51ec…`, `protocol_revision` `883b8514…`, paquet de 60 segments et 3 captures RAW
  (RAW `main` `5fe757b`, #60). ABSENT n'est ni PASS ni FAIL : il ne bloque pas (D3) et ne prouve pas le sens.
- Décision en vigueur : la promotion TIER A. `exportable.seo` n'est pas modifié à la main et aucune gate n'est rouverte.
- Lacunes techniques : aucun relecteur isolé ne tourne (pas de clé d'API sur DEV, étalonnage de l'étape 2 non commencé) ;
  `CANON_REVISION_ADR` vaut `None` (`promotion_decision.py:702`), donc une `revision_of` sort en
  `CANON_REVISION_NOT_RATIFIED`.
- Lacunes probatoires : F-C1 à F-C11 n'ont pas de capture RAW. Route : capture (ADR-096), `revision_of`, auto-review de
  sens, décision du décideur. Aucun n'est servi : le lint n'admet dans les textes que des éléments [admis], [catalogue]
  ou [éditorial].
- Modifier la fiche promue relève aussi d'ADR-107 D5 (nouvelle proposition, gates ADR-088, décideur ADR-083,
  « validation owner »). Divergence avec ADR-119 D1 signalée, non arbitrée ici.
- Effet sur le lot : l'admission ne bloque pas l'écriture des textes, c'est l'autorisation de mutation PROD qui la bloque.
- D7 : le lot ne sert aucune plage numérique tirée d'un fait candidat. Si l'autorité d'une source est inconnue, sa
  validation reste humaine, une fois, sur la source et non sur la fiche.

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

Banc de la révision 4 (code `67f7ce304`, dossier `5f42bd91f`), même proxy :

- R1, R3 et R4 en 375 et 1 280 px : 0 image cassée, 0 réponse ≥ 400, 0 défilement horizontal, 0 requête vers l'image
  LOCATION. title, meta description, H1, canonical et robots identiques à la révision 3.
- Proxy : 29 appels `__seo_outbox_claim_batch` refusés en 405 et 6 POST bloqués ; aucune écriture n'atteint la base.
- « Marque de confiance » 6 → 0 ; « Nous sélectionnons des équipementiers » 1 → 0 ; « Tout savoir sur les » 1 → 0 ; le
  `<p>` du slogan R3 n'est plus rendu. Le H2 « Qualité, prix et marques » reste servi (« Restant »).
- Les captures de `verification-dev/` sont celles de la révision 3. Le delta jusqu'à `bbc7e8ed8` ne touche que le
  backend vidéo et des projections, aucun gabarit : le banc vaut pour la tête.

#### Critères du § 3

Comptes sur le texte rendu, surcouche DEV / DEV `main`.

| Id | Fait | Preuve | Reste |
|---|---|---|---|
| FH-1 | S4_DEPOSE de `r3.json` (`sgc_id` 21) injectée | « combustion chamber » 0 / 3 | écriture (« Restant ») |
| FH-2 | `d1e39811e` : `restoreAccents` ne touche plus aux balises, attributs ni URL ; S7 de `r3.json` | tests `fr-accent-map.test.ts` (`href`, `src`, `alt`, `class`, `data-*`, URL dans le texte) ; `/pièces/` 0 / 12 ; les 5 liens `/pieces/` de R3 en 200 | — |
| FH-3 | chemin d'écriture identifié (« Raccordement des textes ») | aucun producteur créé, aucune écriture RAG | écriture (« Restant ») |
| FH-4 | `783f1beb6` : bornes lues dans `R1_ROUTER_CONTRACT` ; `1495a0f8f` : test sur le bloc livré | jest 3/3. Le bloc fait 1 570 caractères après FH-12 ; les valeurs 1 850 / 1 663 du § 3 le précèdent | — |
| FH-5 | `b4bd0f3d7` : compteur et avatars retirés ; `sg_content` et FAQ du lot | « case D.2 » 0 / 6 ; « majoritairement des filtres cartouche » 0 / 3 ; « 2 847 » 0 / 1 | repli FAQ des autres gammes (« Restant ») |
| FH-6 | `681078f83`, `202d5b9e9` : lien seulement vers un diagnostic publié ; symptôme sans diagnostic en texte ; valeur vide non rendue | 3 tests `filterPublishedSlugs` ; liens `/diagnostic-auto/<texte>` 0 / 5 ; liens vides 0 / 5. `filterPublishedSlugs` lit `__seo_observable` : en PREPROD (anon), lecture refusée (42501), aucun lien et l'avertissement `[R4-DIAG-LINKS]` attendu ; en PROD (`service_role`), seule l'absence de cet avertissement compte | données (« Restant ») |
| FH-7 | `3092064d9` : parenthèse de marques retirée, avec test | « Brembo » 0 / 1 sur 19052. PROD publique à 20:20:30Z : « Brembo » 1, « montées à l'arrière » 0 ; version déployée non constatée, faute d'accès PROD | — |
| FH-8 | recompte en lecture seule | 19052 : 74 affichés, dont 24 vissés et 0 cartouche ; 19053 : 73, 23 et 0, comme au § 3. Le lot ne sert aucune forme par véhicule | confirmation (« Restant ») |
| FH-9 | `9f63de8aa` : accroche, titres et avertissements par fenêtre en props | tests de rendu 6/6 ; sans ces props, rendu identique octet pour octet à `main` | — |
| FH-10 | `9f63de8aa` : composition `SequencesCourtes`, durée calculée, erreur sans séquence ; format au schéma de brief | rendu d'essai par les tests du renderer | — |
| FH-11 | `5057f4f05` : `approvalStagesOf` lit les approbations du schéma ou les `stages` de `__video_productions`, refuse les deux formes à la fois ou aucune | validateur 69/69, jest 76 ; le pilote `fafa-plaquettes-frein-001` passe l'étape 1 | — |
| FH-12 | page non trouvée : la fiche produit (`get_piece_detail`) ne sert que les critères de niveau 1 (« Type de filtre », Quantité). Dimensions et « avec joint d'étanchéité » sont de niveau 2 | phrases `data-condition="FH-12"` retirées ; ligne Dimensions remplacée par « Ne pas confondre avec » ; « joint torique fourni » retiré (R1 micro-SEO et point 3 de `sg_content`, R3 S1 et S4_REPOSE, candidat S4_REPOSE) | — |
| FH-13 | `integration/gsc-baseline.json` | R1 : 0 clic, 1 785 impressions, position 48,9, du 30/07 au 27/10. R3 et R4 : 0 ligne, alors que l'export contient 65 pages conseils et 87 pages `/reference-auto/` | insertion (« Restant ») |
| FH-14 | `d9fcac6e0` : `pg_img` lu via `get_homepage_families` (DEFINER), repli `pg_pic` avec avertissement | 3 tests ; 4 vignettes R1 en 200 en DEV | résiduel (« Restant ») |
| FH-15 | `8bc63c059` : le FAQPage déclare la résolution `resolveR1Faq`, celle de la partie non éditoriale de la FAQ affichée ; `mergeR1Faq` et h3 « Niveaux de qualité » retirés ; `r1s_faq` du lot | 5 questions affichées, 5 déclarées (avant, PROD et DEV `main` : 1 pseudo-question et 3 questions affichées, 6 déclarées) ; « au meilleur prix » 0 / 1 ; « plus de 50 marques » 0 / 2 ; « homologations constructeur » 0 / 1 ; « Niveaux de qualité » 0 / 1 | parseur `mergeFaqBlocks` et H2 « Qualité, prix et marques » (« Restant ») |
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

#### Section technique (Claude CLI, 31/10)

Commits de #1936 après `b9009d913`, hors resync des projections. Rien n'est fusionné ni déployé ; le code ne dépend
pas de #1935.

| SHA | Objet | Preuve |
|---|---|---|
| `da17a3814` | gates vidéo : mesure absente = WARN `NOT_MEASURED` (`measured: null`), mesure invalide = FAIL, zéro réel = PASS ; un WARN mesuré exige un `final_publish` signé | test du contrôleur 7/7 (1 échec sur 6 sans la correction) ; tests du service |
| `990bfd245` | skills et notes marketing recalés sur ce traitement | `fafa-pilot-governance.test.cjs` 69/69 |
| `573c022b4` | skill `seo-gamme-audit` v5.0 : WIKI → export → projection → rendu servi, sans RAG ; SELECT bornés, en lecture seule ; quatre axes, sans score composite | 19 requêtes jouées en lecture seule sur `pg_id` 7 et le type 19052 |
| `500e9c4fd` | skill `seo-content-loop` : chaîne d'autorité, « projeté ≠ servi », quatre axes, reprises bornées | prose de skill, sans test exécutable |
| `67f7ce304` | R1 : « Marque de confiance » et l'accroche retirés d'`EquipementiersSection` ; R3 : slogan `blog-conseil` vidé | 2 tests ; vitest 37/37 ; banc de la révision 4 |
| `c0a6c7d96` | `seo-content-loop`, `conseil-batch`, `seo-content` et `wiki-proposal-writer` suivent ADR-119 : plus de relecture humaine de fiche | `validate-agents-md.sh` : 0 blocage |
| `6e57bb6c7` | score vidéo `null` quand un drapeau n'a pas de pénalité (`NOT_MEASURED`, `GATE_FAIL`, `REVIEW_REQUIRED`), au lieu de 100 | 2 tests ; suites vidéo 126/126 ; `tsc` 0 |

Autres preuves sur `67f7ce304` : jest backend 17 suites et 220 tests, eslint 0 erreur, `npm run typecheck` exit 0,
ast-grep exit 0, gitleaks sans fuite. Sur `bbc7e8ed8` : CI 43 réussis, 9 ignorés, 0 échec. Rollback : `git revert` du
commit, sans état de base ni de cache à défaire.

H2 « Qualité, prix et marques » (`pieces.$slug.tsx:900`), non modifié. Sur DEV `main`, `#qualite-prix` sert le bloc
`sg_content` « Filtre à huile prix : fourchettes selon le type et la marque » : le mot « prix » y est étayé.
`integration/r1.json` retire ce bloc ; une fois le lot écrit, la section ne garde que « Qualité d'un filtre à huile :
ce qui compte » et les équipementiers. Le libellé est commun à toutes les R1 : le changer avant l'écriture retirerait
« prix » d'un H2 indexé partout alors que le bloc prix est encore servi. Il se traite avec l'écriture du lot, sur
décision nominative (SEO indexé).

Constats laissés à leurs écrivains :

- `approval.json` du dossier : G5 vaut `0.0` ; le schéma type `measured` en nombre, alors que le code accepte `null` ;
- gates vidéo : aucun producteur ne fournit durée, similarité ni rôles visuels, qui restent `NOT_MEASURED` ; la
  correspondance entre ces drapeaux et des pénalités n'est pas définie, d'où le score `null`. L'écran
  `admin.video-hub.productions.$briefId.tsx:252-262` envoie `brief.videoType`, alors que le service lit `brief.type`,
  sans texte ni durée. La branche « Unknown video type » (`video-gates.service.ts:319`) n'a pas de test ;
- R8 : le type 19053 a deux lignes pour la même canonical (REVIEW_REQUIRED et INDEX), rattachées à FH-8 ;
- projection : le run actif porte le WIKI `a4783348`, alors que WIKI `main` est `6c82c5c4d`, écart non expliqué ;
- R4 : slogan `role-piece` « Comprendre le role des {gamme} » (sans accent, pluriel devant un singulier), servi seulement
  avec `HeroRole`, absent de `/reference-auto/filtre-a-huile` qui affiche `HeroReference` ;
- R1 : description backend « N références disponibles » (`gamme-response-builder.service.ts:416`), qui compte des
  références du catalogue, pas un stock ;
- `agents/seo-content/AGENTS.md:32,95` cite encore un « score rank-#1 capable ».

#### Lot de publication (préparé, non exécuté)

`integration/publication-batch.json`, produit sans accès à la base à partir des relevés en lecture seule :

- 50 cibles texte (16 champs `__seo_r1_gamme_slots`, `__seo_gamme.sg_content`, 33 champs `__seo_gamme_conseil` par
  `sgc_id`), chacune avec clé, longueur et sha256 avant et après ;
- 4 champs protégés à garder identiques (`r1s_h1_override`, `sg_title`, `sg_descrip`, META R3), avec leur hash ;
- images R1 31, 32, 33, 35 et R3 12, 13, 14 : objet avant (taille, type, eTag), fichier après (sha256, dimensions) ;
- exécution : relecture et arrêt sur écart, sauvegarde, une transaction dont chaque UPDATE est conditionné au sha256
  « avant » (CAS) ; invalidations par cache ; contrôles post-écriture ; rollback par cible.

Constats du lot :

- l'invalidation Redis R1 (`POST /api/gamme-rest/7/cache/invalidate`) n'a pas de garde d'authentification ; Redis R3
  n'a aucun endpoint d'invalidation ;
- les 4 objets R1 actuels sont des PNG servis sous un nom `.webp` ;
- aucun endpoint ne défait `set-image-url` ou `approve` en R3 : le rollback R3 passe par SQL, même zone STOP ;
- l'upload R1 réécrit l'objet au même chemin alors qu'imgproxy sert `immutable` pour un an : sans purge CDN, l'ancienne
  image reste servie, et les navigateurs la gardent.

#### Restant, par étape

| Étape | Point | Dépendance ou décision |
|---|---|---|
| admission | fiche WIKI filtre à huile | promotion TIER A en vigueur ; auto-review de sens ABSENT, consultative (D3), ne bloque pas l'écriture. F-C1 à F-C11 : capture RAW, puis `revision_of`, bloquée tant que `CANON_REVISION_ADR` vaut `None` (« Admission WIKI ») |
| données, zone STOP | textes R1 (`r1s_*`, `sg_content`) et R3 (`sgc_*` par `sgc_id`) | choix d'une des deux voies (« Raccordement des textes »), avec accord nominatif pour une écriture PROD sur des pages indexées |
| stockage, zone STOP | images R1 31, 32, 33 et 35 ; dépôt des fichiers R3 puis `set-image-url` et `approve` de 12, 13 et 14 | accord nominatif. og:image R1 change d'image, og:image R3 change d'URL : balises protégées |
| code | alt et légendes R1 et R3 ; retrait de LOCATION 34 ; mise en page de `#emplacement` sans image ; alt du hero R3 | aucun mécanisme existant ; pour R3, la clôture B5 interdit l'écriture applicative des alt |
| données | FH-5 : repli `R1_SELECTOR_FAQ` (`pieces.$slug.tsx:98`), qui cite `case D.2` pour les autres gammes | admission de F-C7 |
| données | FH-6 : symptômes de `__seo_reference` id 118 ; 90 valeurs vides sur 22 références | écriture en base. Aucune des 1 254 valeurs non vides n'est le slug d'un diagnostic publié : sans producteur R4 de slugs, la carte n'a aucun lien sur les 220 pages R4 |
| données | FH-8 : forme du filtre pour 19052 et 19053 | confirmation par le propriétaire du catalogue, véhicule par véhicule |
| données | FH-13 : 3 lignes de `gsc-baseline.json` dans `__seo_gamme_gsc_baseline` (vide, sans écrivain ni lecteur dans le code) | écriture en base |
| migration | FH-14 : 11 gammes sans famille (`mc_mf_prime` = 0) gardent `pg_pic`. 141 et 1375 restent cassées alors que leur `pg_img` existe ; les 9 autres n'ont aucun des deux fichiers | modifier `get_gamme_page_data_optimized` |
| code, SEO indexé | R1 : H2 « Qualité, prix et marques » (`pieces.$slug.tsx:900`). « Marque de confiance » et l'accroche d'`EquipementiersSection` sont retirés par `67f7ce304` | décision nominative, avec l'écriture du lot (« Section technique ») |
| code | R1 : `mergeFaqBlocks` ne lit que les `<h3>`. 61 lignes `__seo_gamme` sur 177 ont un H2 de FAQ, toutes en `<details><summary>`, `pg_id` 7 compris avant le lot : le titre de section est affiché comme une question. Défaut antérieur à #1936 | correctif dans une PR à part |
| code | invalidation Redis R1 sans garde d'authentification (« Lot de publication ») | correctif dans une PR à part |
| champ protégé | meta description R1 : « …pas cher dès 5€… En stock, livraison 24-48h. » | non modifiée : meta protégée, prix et stock en zone STOP |
| code | sous-titre R3 « Tout savoir sur les filtre-a-huile » : alias brut (route conseils l.510, `visual-intent.ts:186`) | corrigé par `67f7ce304` pour tous les guides ; servi en PROD tant que #1936 n'est pas déployée |
| gouvernance | #1936 : FH-16 retire « Difficulté » et « Temps estimé » de tous les guides R3 ; les autres changements touchent tous les gabarits listés dans la PR | auto-review de niveau B enregistrée (« Cinq périmètres ») ; ADR-120 (#389) non fusionnée, donc DoD2 v1.0.0 reste un écart. Fusion par l'owner ; déploiement hors mandat |
| gouvernance | modifier la fiche promue : ADR-107 D5 (« validation owner ») contre ADR-119 D1 | arbitrage au vault |
| code | `scripts/wiki-generators/auto_review_wiki_proposal.py:82`, `:540-555` émet `HUMAN_SPOT_CHECK` pour une proposition de sécurité à source forte, contre ADR-119 D1. Aucun appelant dans le dépôt : seuls son test, `.gitignore`, `ownership.yaml` et `audit/wiki-auto-review-2026-05-29.md` le citent | à aligner sur la décision WIKI (`promotion_decision.py`, `SAFETY_AUTO_APPROVAL_ADR` à `None`) ou à retirer, dans une PR à part |
