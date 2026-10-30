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
| rédigé | oui | `integration/` (4 fichiers), `assets/` (8 visuels + sources SVG), `tools/`, `PROMPTS.md`, ce fichier |
| accessible | oui | branche poussée sur `origin` ; PR brouillon de revue [ak125/nestjs-remix-monorepo#1935](https://github.com/ak125/nestjs-remix-monorepo/pull/1935), à ne pas fusionner. Glob `docs/audits/editorial-*/**` ajouté au registre L2 (D5, `@ak125/content-team`) pour la garde des nouveaux fichiers |
| transmis | **non** | aucun canal vers une session Claude CLI : aucune session joignable depuis Claude Code Desktop, aucune cible SSH, Remote Control hors ligne ; Hermes (`automecanik_continuity`) indisponible dans la session. Transmission à effectuer : ouvrir Claude CLI sur le dépôt et coller la consigne ci-dessus |
| pris en charge | non | — |
| intégré et vérifié en DEV | non | — |

## 2. Ce qui est livré

| Fichier | Contenu | Statut |
|---|---|---|
| `integration/r1.json` | champs `r1s_*` (hero, sélecteur, 4 badges, intros, tableau de vérification, FAQ au format `{question, answer}`, bloc micro-SEO 1 850 caractères) ; `sg_content` en 5 blocs H2 routés vers choose, price, location, reference ; ancien → nouveau par bloc | REVIEW_REQUIRED |
| `integration/r3.json` | 12 sections `__seo_gamme_conseil` par `sgc_id`, titres, HTML conforme aux composants de rendu, provenance proposée, image par section ; META conservée | REVIEW_REQUIRED |
| `integration/candidats.json` | F-C1 à F-C11 et blocs prêts après admission (S4, S5, S6, huile et filtre usagés) | non servables avant admission |
| `integration/assets.json` | 8 visuels : slot, `rip_id`, fichier, alt, légende, mécanisme, état de vérification ; LOCATION à désélectionner | fichiers produits |
| `PROMPTS.md` | images et scènes manquantes, moyen réel pour chacune | manques |
| `tools/build-assets.cjs`, `tools/build-pictos.cjs` | reproduction des visuels (sharp) depuis `assets/sources/` ; sortie identique octet pour octet, vérifiée le 30/10 | — |
| `tools/lint-integration.cjs` | contrôle du texte public : gardes R1 du dépôt (`R1_FORBIDDEN_TERMS`, `isR3R5Content`), bornes du contrat R1, JSON-LD FAQPage, motifs `anti_source`, noms de sources, promesses commerciales, statut candidat servi | PASS le 30/10 (70 unités, 0 constat) |
| `tools/build-preview.cjs`, `preview/` | simulation non intégrée : `extractEditorialBlocks`, `extractSummaryPoints`, `deriveHeroBadges` exécutés sur les textes du lot ; captures 375 et 1 280 px ; `preview/rapport.json` | pas un rendu DEV |

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

(à remplir)
