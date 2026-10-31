# Checkpoint — lot 1 éditorial filtre à huile, 31 octobre 2026

Objectif : premier dossier du programme recadré le 30/10. Filtre à huile (`pg_id` 7) : pages R1 et R3 existantes
améliorées (textes, images, scripts), script vidéo principal et courts, faits à admettre, raccordements. Statut :
auto-revu (lint, rendu DEV par surcouche de lecture, HANDOFF § 6) ; rien n'est écrit en base ni servi. Révision 5 :
déclinaisons sociales, couvertures, sous-titres et blocs candidats finalisés.

Cible : Claude Code Desktop, worktree `C:\Users\Marwane\nestjs-remix-monorepo-editorial`. Révisions 1 à 4 : branche
`docs/editorial-filtre-huile-dossier-20261030`, fusionnée dans `main` par #1935 le 31/10 (`9d1d82207`), branche
distante supprimée. Révision 5 : branche `docs/editorial-filtre-huile-social-20261031`, issue de `9d1d82207`.
Checkout principal et worktrees Codex non modifiés (lecture seule : `node_modules` du worktree Codex pour le
validateur, sharp, esbuild et playwright).

## Révision 5 (31/10, après-midi)

Mandat recentré : un dossier complet par gamme, méthode commune ; Claude Code Desktop termine les productions
éditoriales et médias, Claude CLI organise le point d'entrée commun et l'intégration.

| Livrable | Où | Changement |
|---|---|---|
| F-C4 (serrage), F-C9 (joints de cartouche), F-C10 (filière des filtres usagés), F-C11 (dépôt) vérifiés sur des sources de fabricants et institutionnelles, consignées dans le fichier | `integration/candidats.json` | vérifiés, **non admis** |
| Bloc S4_REPOSE : joints neufs du couvercle de cartouche, huilés ; resserrage selon l'instruction du constructeur | `integration/candidats.json` | candidat (F-C9) |
| Phrase S6 « huile et filtre usagés » : toutes les déchèteries ne reprennent pas le filtre | `integration/candidats.json` | candidat ; aucune source nommée dans le texte |
| Carrousels Instagram A (6 diapositives, faits admis) et B (7, faits vérifiés non admis), posts Facebook, légende de C4, titres et tags YouTube, couvertures | `integration/social.json`, `SOCIAL.md`, `assets/social/` (18 WebP), `tools/build-social.cjs` | produits, proposition |
| Sous-titres de C1 à C4 tirés de MEDIA.md § 7 | `tools/build-srt.cjs`, sortie `subtitles/c1.srt` à `c4.srt` non versionnée (`.gitignore` réserve les sous-titres au stockage des rendus) | produits ; calage sur la voix à refaire |
| C4 finalisé (faits vérifiés, non admis) : démonstrations de repli, vignette, légende, mesure | `MEDIA.md` § 1, § 5, § 7.4 | rédigé |
| Lint étendu aux blocs candidats, textes sociaux, voix et écrans des courts (`FORBIDDEN_PATTERNS_SOCLE` et `_SHORT` du code), règles de canal du seed de marque | `tools/lint-integration.cjs` | exécuté |
| § 1 (relais à Claude CLI) et § 2 ; § 6 inchangé | `HANDOFF.md` | mis à jour |
| Mention de #1936 | `AUDIT.md` § 4 | fusionnée le 31/10 |

Preuves :

- `tools/lint-integration.cjs` : PASS, 158 unités (R1 41, R3 27, blocs candidats 5, social 43, courts 42), 0 constat ;
  règles de canal : 34 contrôles, 0 échec ; micro-SEO 1 570 caractères ; FAQPage R3 : 5 paires.
- Planches contact des 18 visuels relues ; corrigés : légende coupée par un recadrage, pictogramme blanc sur fond clair,
  mot isolé dans un titre.
- Facebook 496 et 499 caractères lien compris ; Instagram 667 et 821 ; titres YouTube 37 à 59.
- `r1.json` et `r3.json` inchangés : aucune phrase sur les déchets n'est servie.

Limites propres à la révision 5 : aucune photo neuve (P-02, P-04, P-05, P-07, P-08, S-03) ; aucune voix ni aucun
rendu ; polices de la charte non installées (Arial) ; logo servi porteur d'un slogan de prix, remplacé par un
logotype texte ; tutoiement du seed et vouvoiement du canon non arbitrés ; rien publié ni programmé.

Relais : révision 4 prise en charge par Claude CLI le 31/10 (HANDOFF § 6) ; la mention « transmise : non » ci-dessous
est caduque. Révision 5 : relayée par HANDOFF § 1, sans changement de `r1.json`, `r3.json`, `assets.json` ni
`publication-batch.json`. Publication : non autorisée.

## Révision 4 (31/10)

| Livrable | Où | Changement |
|---|---|---|
| Fiche par champ R1 et par bloc `sg_content` ; libellés codés proposés (H2 « Qualité, prix et marques », texte et badge de `EquipementiersSection.tsx`) | `integration/r1.json` | ajoutés ; libellés : décision de l'owner, code par Claude CLI |
| Fiche par section R3 ; S2_DIAG en 4 lignes, dont une pour fuite, bruit, odeur et vibration (intentions R5 consolidées) sans désigner le filtre ; slogan R3 proposé | `integration/r3.json` | amélioré |
| Ligne S2_DIAG « fuite juste après remplacement » | `integration/candidats.json` | candidat (F-C3, F-C4) |
| Droits, portée et affichage attendu par visuel ; 4 pictogrammes vidéo pour `SequencesCourtes` (#1936) ; recadrage 9:16 non produit faute de consommateur | `integration/assets.json` | complété |
| Pictogrammes arrêt impératif, contact coupé, jauge d'huile (1080 × 1080, fond transparent) | `assets/picto-*.{svg,webp}`, `tools/build-pictos.cjs` | produits et vus sur le fond #0F1E38 |
| Recherche en banque d'images (4 requêtes, 52 photos distinctes) : aucune photo admissible pour P-01, P-02, P-06 | `PROMPTS.md` | manques confirmés |
| État de chaque vidéo : script, visuels, voix, composition, rendu, publication | `MEDIA.md` § 1 | ajouté |
| Parcours R1 à R8 (état servi du 31/10) ; références vidéo 10 à 12 ; techniques retenues | `AUDIT.md` § 3.1, § 4 | ajoutés |
| Aperçu régénéré avec les fonctions de la branche de correction (`e3d644a04`) | `preview/` | badge « Sécurité » seul, comme `rapport.json` |
| § 1 (note révision 4) et § 2 ; § 3 à § 6 inchangés | `HANDOFF.md` | mis à jour |

Preuves :

- `tools/lint-integration.cjs` : PASS, 68 unités, 0 constat ; micro-SEO 1 570 caractères (bornes 1 500 à 3 000) ;
  FAQPage R3 : 5 paires.
- `tools/build-preview.cjs` (`FH_REPO` sur `e3d644a04`, Chrome installé) : routage `sg_content` 2/1/1/1, aucun bloc
  non classé ; S2_DIAG rendu en 4 lignes ; captures 375 et 1 280 px : 0 image cassée, 0 erreur, 0 débordement.
- `tools/build-pictos.cjs` : pictogramme du témoin identique à l'octet près à celui du 30/10.
- État servi relevé à 2026-10-31T05:33Z : R1, R3, R4, R7, R8 et les pages de la gamme pour 19052 et 19053 en 200 ;
  cinq slugs R5 en 301 vers R3 `#diagnostic-rapide` ; guide d'achat en 301 vers R3.
- Texte public ajouté relu (humanizer, relecture française) : sens, conditions et portée inchangés ; aucune source
  nommée.

Limites propres à la révision 4 : vidéos de référence vues par leurs images d'aperçu, sans le son ; lien R8 → gamme
non vérifié pour 19053 ; aucune vidéo rendue ni voix ; aucune photo neuve.

Relais : révision 4 poussée sur la branche de #1935 (SHA dans la description de la PR). Transmise à Claude CLI : non,
aucun envoi observable. Prise en charge : non. Intégration DEV : non vérifiée pour la révision 4. Publication : non
autorisée.

## Révision 3 (30/10, après-midi)

| Livrable | Où | État |
|---|---|---|
| Textes R1 sous les champs servis (`r1s_*`, `sg_content`), action par bloc | `integration/r1.json` | rédigé, contrôlé |
| Textes R3 par `sgc_id`, titres, provenance proposée | `integration/r3.json` | rédigé, contrôlé |
| Faits et blocs candidats (F-C1 à F-C11), contredits exclus | `integration/candidats.json` | non servables avant admission |
| 8 fichiers : 4 images R1 (dont PRICE et OG en remplacement neutre), 3 R3, 1 pictogramme vidéo ; LOCATION R1 à désélectionner, sans fichier | `assets/`, `integration/assets.json` | produits et vus ; affichage DEV non vérifié |
| Images et scènes manquantes, moyen réel pour chacune | `PROMPTS.md` | manques, pas des livrables |
| Scripts | `tools/build-assets.cjs`, `build-pictos.cjs`, `build-preview.cjs`, `lint-integration.cjs` | exécutés le 30/10 |
| Aperçu | `preview/` | simulation non intégrée, pas un rendu DEV |
| Mission Claude CLI, FH-1 à FH-16 requalifiés | `HANDOFF.md` | rédigé, accessible ; transmis : non (HANDOFF § 1) |

Partage : branche poussée, PR brouillon de revue
[ak125/nestjs-remix-monorepo#1935](https://github.com/ak125/nestjs-remix-monorepo/pull/1935), sans fusion ni
déploiement. Entrée de registre L2 `docs/audits/editorial-*/**` (D5, `@ak125/content-team`, confiance medium) ajoutée
pour la garde des nouveaux fichiers, sur le modèle de `docs/audits/diagnostic-*/**`.

Preuves de la révision 3 :

- `tools/lint-integration.cjs` : PASS, 70 unités de texte public. Gardes du dépôt exécutées : `R1_FORBIDDEN_TERMS`,
  `isR3R5Content`, bornes `R1_S4_MICRO_SEO`, `parseFAQFromS8`. Il a d'abord relevé trois formulations R1, corrigées :
  « à partir de », « acheter », vocabulaire de symptôme dans le bloc référence. Micro-SEO : 1 850 caractères, 1 663 sans
  la phrase conditionnée par FH-12 ; FAQPage R3 : 5 paires.
- `tools/build-preview.cjs` : routage réel des blocs `sg_content` (choose 2, price 1, location 1, reference 1, aucun
  non classé) ; « L'essentiel » en 7 points ; badges calculés « Facile », « ~15 min ». Captures 375 et 1 280 px :
  0 image cassée, 0 erreur, 0 débordement horizontal.
- `tools/build-assets.cjs` : sortie identique octet pour octet depuis `assets/sources/`, sauf l'OG, régénérée avec
  « selon la motorisation ».
- Relecture éditoriale 1.1.0 et passe humanizer sur le texte public : deux répétitions retirées (RE-23) ; aucune
  source nommée. Le nombre de tirets n'est pas un critère de qualité.
- Reproductions FH-1 à FH-16 relancées à 14:09:55Z (HANDOFF § 3).

## Révisions 1 et 2 (rappel)

Fiche WIKI `wiki/gamme/filtre-a-huile.md`, commit WIKI `a4783348`, blob `c0f7a257`, sha256 `773367f7531a2c35…` ;
présente au même blob dans le sous-module `88017732`. Pages lues à 11:11:37Z puis 11:47:47Z, après le tag
`v2026.10.30-bundle-octobre-980b2f8` (11:12:21Z). SQL en lecture seule. Validateur Fafa sur V1 : sortie 1,
`INVALID_claim-table: data/claims/0/human_validated must be equal to constant` (dossier V1 inchangé depuis, non
relancé). G3 : V1 0 violation sur 17 lignes ; courts et légendes 0 sur 54, relancée après la réécriture de C4.
Révision 2 : noms de sources retirés du texte servi.

## Limites

- Fiche WIKI promue TIER A par son décideur ; auto-review de sens ADR-119 ABSENT, consultative hors sécurité (D3).
- Aucun producteur WIKI → R1 ; R3 en canari seulement (FH-3, HANDOFF § 4). Le chemin d'écriture gouverné reste à
  identifier par Claude CLI.
- R3 S4 à S6 restent courts tant que F-C2 à F-C6 ne sont pas admis ; F-C2 est contredit par une notice (3/4 de tour à
  l'outil dédié) et n'est plus proposé comme règle générale.
- Aucune photo neuve, de procédure ni d'emplacement : aucun outil de génération dans la session, et ces images doivent
  être des prises de vue réelles (PROMPTS.md). La photo source montre un filtre usagé avec une notice lisible.
- Carter-Cash et Tomorrow's Technician non consultables (vérification anti-robot, non contournée).
- Affichage des critères techniques non constaté (FH-12) ; catalogue Clio III incohérent (F-C8) ; aucune voix ;
  aucune mesure de visionnage ; pas de baseline GSC `pg_id` 7 ; CI non lancée.

Dossier plaquettes : en attente au commit `2a63da58a` (`docs/editorial-plaquettes-dossier-20261030`), non poussé,
sans PR.

Hermes : checkpoint **non enregistré**, `automecanik_continuity` indisponible dans cette session. Charge à reporter :

```json
{
  "action": "checkpoint",
  "request_id": "editorial-filtre-huile-20261030-lot1-r5",
  "objective": "Dossier complet filtre à huile (pg_id 7) : pages R1/R3 améliorées, visuels, scripts vidéo et déclinaisons sociales ; intégration par Claude CLI.",
  "authorization": "Mandats utilisateur des 2026-10-30 et 2026-10-31 : travail réversible ; push d'une branche de dossier et PR brouillon de revue autorisés, sans fusion ni déploiement ; aucune écriture en base partagée ni publication ; plaquettes en attente, sans push ni PR.",
  "environment": "Claude Code Desktop, worktree nestjs-remix-monorepo-editorial, branche docs/editorial-filtre-huile-social-20261031 issue de 9d1d82207 (main après #1935) ; fiche WIKI a4783348 (blob c0f7a257).",
  "state": "Révisions 1 à 4 fusionnées dans main (#1935, 9d1d82207) ; code de correction fusionné (#1936, 7d3f30237), PREPROD et PROD non vérifiés. Révision 4 prise en charge par Claude CLI le 31/10 (banc DEV sur 67f7ce304) ; écrite : non. Révision 5 : F-C4, F-C9, F-C10, F-C11 vérifiés non admis ; blocs S4_REPOSE et S6 finalisés ; carrousels IG A et B, posts FB, couvertures V1 et C1-C4, légende C4, titres YouTube, sous-titres C1-C4 produits ; rien publié.",
  "changes": "docs/audits/editorial-filtre-huile-20261030/ : CHECKPOINT, HANDOFF (§ 1, § 2), AUDIT, MEDIA, SOCIAL, integration/candidats.json, integration/social.json, assets/social/, tools/build-social.cjs, tools/build-srt.cjs, tools/lint-integration.cjs.",
  "checks": "lint-integration PASS (158 unités, 0 constat ; 34 contrôles de canal, 0 échec) ; planches contact des 18 visuels relues ; r1.json et r3.json inchangés.",
  "decisions": "Aucun symptôme attribué au filtre ; aucune valeur universelle (nombre de tours, couple, intervalle) ; aucune source nommée dans un texte public ; carrousel B, FB-B et C4 publiables seulement après admission ou décision de l'owner ; logotype texte faute de logo sans slogan de prix ; 19052 et 19053 séparés.",
  "next_action": "Owner : arbitrer tutoiement/vouvoiement, logo, publication des déclinaisons. F-C1 à F-C11 : route ADR-119. Prises de vue P-02, P-04, P-05, P-07, P-08, S-03. Voix, rendu et human_validated des courts. Claude CLI : point d'entrée commun et intégration (HANDOFF § 1 et § 6)."
}
```
