# Déclinaisons sociales — filtre à huile

Révision 5, 31/10/2026. Propositions : rien n'est publié ni programmé. La publication revient à l'owner, après les
contrôles du § 4. Textes : [integration/social.json](integration/social.json), seule source. Visuels :
[tools/build-social.cjs](tools/build-social.cjs), qui lit ce fichier et écrit `assets/social/`.

## 1. Livrables

| Livrable | Fichiers | Faits portés | Publiable |
|---|---|---|---|
| Carrousel Instagram A, « Vissé ou cartouche ? », 6 diapositives | `assets/social/ig-a-1.webp` à `ig-a-6.webp` (1080 × 1350) | admis (fiche WIKI : Fonctionnement, Critères de choix) et sélecteur servi sur R1 | après relecture de l'owner |
| Carrousel Instagram B, « 6 points contre la fuite », 7 diapositives | `ig-b-1.webp` à `ig-b-7.webp` | vérifiés sur des sources de fabricants, **non admis** (F-C3, F-C4, F-C5, F-C9) | après admission WIKI ou décision de l'owner |
| Posts Facebook FB-A et FB-B | textes dans `social.json` ; visuel : 1re diapositive du carrousel correspondant | A : admis ; B : vérifiés, non admis | comme le carrousel correspondant |
| Couvertures des vidéos V1, C1 à C4 | `cover-v1.webp`, `cover-c1.webp` à `cover-c4.webp` (1080 × 1920) | textes des vignettes de MEDIA.md | avec la vidéo |
| Légende de C4, titres et tags YouTube de V1 à C4 | `social.json` (`courts_legendes`, `youtube`) | C4 : vérifiés, non admis | avec la vidéo |
| Sous-titres de C1 à C4 | `tools/build-srt.cjs` écrit `subtitles/c1.srt` à `c4.srt`, non versionnés (`.gitignore` : sous-titres avec les rendus, hors dépôt) | voix de MEDIA.md § 7 | après calage sur la voix enregistrée |

Les légendes Instagram et Facebook vouvoient (canon marketing-voice, décision de l'owner du 31/10) ; la voix de Fafa
tutoie (persona V1).

## 2. Carrousel A — « Vissé ou cartouche ? »

Lien en bio : R1, `utm_campaign=fafa-filtre-huile-carrousel-forme`. Textes des tableaux abrégés ; texte exact dans
`social.json`.

| N° | Titre | Texte | Visuel |
|---|---|---|---|
| 1 | Filtre à huile : vissé ou cartouche ? | Les deux formes, et comment trouver la vôtre. | photo d'usage (Unsplash uhuTo7u8VXk) |
| 2 | Le filtre vissé | Il se remplace en entier. | moitié gauche du schéma R1 TYPES |
| 3 | La cartouche | Seul l'élément filtrant se remplace. Le boîtier reste sur le moteur. | moitié droite du schéma R1 TYPES |
| 4 | La forme ne se choisit pas | C'est le moteur qui impose un filtre vissé ou une cartouche. | schéma « moteur → vissé ou cartouche » |
| 5 | Pareils dehors, différents dedans | Clapet anti-retour, filetage, pression d'ouverture du by-pass, média filtrant, finesse de filtration. | coupe R3 S3 |
| 6 | Partez du véhicule | Marque, modèle, année, puis motorisation exacte. Ou le type mine, sur votre carte grise. | schéma de sélection par véhicule |

Légende (667 caractères) et commentaire de 20 hashtags : `social.json`, `carrousels[0]`.

## 3. Carrousel B — « 6 points contre la fuite »

Lien en bio : R3, `utm_campaign=fafa-filtre-huile-carrousel-montage`. Claims de procédure : à ne publier qu'après
admission des faits cités ou décision explicite de l'owner.

| N° | Titre | Texte | Visuel |
|---|---|---|---|
| 1 | Filtre à huile neuf : 6 points contre la fuite | Avant, pendant et après le montage. | photo d'usage |
| 2 | La bonne référence | Vérifiez que le filtre neuf est celui prévu pour votre motorisation. | schéma de sélection |
| 3 | L'ancien joint | Vérifiez qu'il n'est pas resté collé sur la portée ; s'il y est, retirez-le, puis nettoyez la surface d'étanchéité. | schéma de la portée, avec et sans ancien joint |
| 4 | Le joint neuf | Huilez-le avec de l'huile moteur propre. Sur une cartouche, posez les joints neufs prévus pour l'élément. | schéma joint huilé, joints de cartouche |
| 5 | Le serrage | Jusqu'au contact du joint, puis selon l'instruction imprimée sur le filtre ou sa notice. | schéma en deux temps, sans valeur |
| 6 | Après le montage | Appoint, démarrage, niveau sans dépasser le maximum, aucune fuite. | pictogramme du niveau d'huile |
| 7 | Témoin de pression allumé ? | Suivez la notice de votre véhicule. | pictogramme du témoin |

Légende (821 caractères) et commentaire de 20 hashtags : `social.json`, `carrousels[1]`. Aucun nombre de tours,
couple, kilométrage ni intervalle.

## 4. Contrôles du 31/10

| Contrôle | Résultat |
|---|---|
| `tools/lint-integration.cjs` (révision 5) : anti_source du code, noms de sources, promesses, R1_FORBIDDEN_TERMS, isR3R5Content, `FORBIDDEN_PATTERNS_SOCLE` sur les textes sociaux, `FORBIDDEN_PATTERNS_SHORT` sur les courts (MEDIA.md § 7, légende de C4, couvertures, titres YouTube), appel à l'action interdit par G3 | **PASS** : 158 unités (R1 41, R3 27, blocs candidats 5, social 43, courts 42), 0 constat |
| Règles de canal de `brand-rules-seed.ts` (même outil) | 34 contrôles, 0 échec |
| Instagram | légendes 667 et 821 caractères (≤ 2 200) ; 20 hashtags en commentaire séparé, `#automecanik` en premier, sans doublon ; « Lien en bio » et « Sauvegardez ce post » |
| Facebook | 496 et 499 caractères lien UTM compris (≤ 500) ; 4 hashtags dont `#automecanik` ; « Retrouvez-nous sur automecanik.com » |
| YouTube | titres de 37 à 59 caractères ; 5 à 8 tags, dont « automecanik » et « pieces auto » |
| Visuels | planche contact relue : textes dans le cadre, recadrages sans légende coupée, pictogrammes sur le fond `#0F1E38` pour lequel ils sont dessinés |
| Relecture Humanizer | aucun tiret long, aucune formule vide relevée ; aucun vécu, essai ni témoignage |

Le lint ne prouve pas la vérité technique : elle vient de la fiche WIKI (faits admis) et de `integration/candidats.json`
(faits vérifiés, non admis).

## 5. Écarts laissés à l'owner

- **Tutoiement sur Instagram : tranché le 31/10.** `brand-rules-seed.ts` demande le « tu », le canon marketing-voice
  le « vous ». Décision de l'owner pour ce dossier : vouvoiement sur Instagram et Facebook, tutoiement pour la voix de
  Fafa. Les appels à l'action de la liste du seed sont tutoyés (« Sauvegarde ce post ») : le lint accepte leur forme
  vouvoyée. Le seed garde le « tu » : l'aligner reste une modification de code, hors de ce dossier.
- **Envoi de la plaque ou de la carte grise.** Le canon le propose ; aucun canal d'envoi n'est vérifié. Les textes
  renvoient à la recherche par véhicule ou par type mine, que R1 sert.
- **Logo.** Le logo servi (`frontend/public/logo-navbar*`) porte le slogan « pièces auto à prix pas cher », qui contient
  deux motifs interdits (`prix`, `pas cher`). Les visuels utilisent un logotype texte « AutoMecanik ». Un logo sans
  slogan manque.
- **Polices.** Outfit et DM Sans (charte du seed) ne sont pas installées : Arial, comme les autres visuels du dossier.

## 6. Droits

- Photo : Unsplash uhuTo7u8VXk, auteur et licence consignés dans `integration/assets.json` (`photo_source`). Le crédit
  reste dans le dossier ; il n'apparaît pas sur les visuels.
- Schémas et pictogrammes : dessins originaux du lot (`build-assets.cjs`, `build-pictos.cjs`, `build-social.cjs`), sans
  marque de pièce, sans véhicule et sans texte tiers.

## 7. Manques

| Manque | Bloque | Où c'est décrit |
|---|---|---|
| Photo d'une cartouche (P-02), de deux filtres d'aspect proche (P-04), d'une coupe réelle (P-05) | remplacer les schémas de A-3, de la couverture de C2 et de A-5 | PROMPTS.md |
| Gestes sur le joint (P-07, P-08) et main qui visse (S-03) | B-3 à B-5 et C4 en photo ou en vidéo | PROMPTS.md, MEDIA.md § 7.4 |
| Admission WIKI de F-C3, F-C4, F-C5, F-C9 (route ADR-119) | publication de B, FB-B et C4 | `integration/candidats.json` |
| Voix, rendu et `human_validated` des claims (contrat vidéo G1, G2) | couvertures et sous-titres utilisés seulement avec une vidéo rendue | MEDIA.md § 1 |
| Comptes, programmation, emplacement du lien par plateforme | publication | non vérifié dans ce lot |
| Mesure | sessions par `utm_campaign` dans GA4 après publication ; aucune donnée aujourd'hui | MEDIA.md § 6 |

## 8. Reproduction

Depuis ce dossier, `R` désignant un checkout qui porte `sharp`, `esbuild`, `isomorphic-dompurify` et `lucide-react` :

```sh
NODE_PATH=$R/node_modules node tools/build-social.cjs
node tools/build-srt.cjs
NODE_PATH=$R/node_modules:$R/frontend/node_modules node tools/lint-integration.cjs
```

Sous Windows, `NODE_PATH` prend des chemins Windows séparés par `;`.
