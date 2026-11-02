# Checkpoint — lot 1 éditorial filtre à huile, 31 octobre 2026

Brief commun du programme (règles, skills, responsables, état d'intégration) :
[AUDIT.md § 0](AUDIT.md#0-brief-commun-du-programme-éditorial).

Objectif : premier dossier du programme recadré le 30/10. Filtre à huile (`pg_id` 7) : pages R1 et R3 existantes
améliorées (textes, images, scripts), script vidéo principal et courts, faits à admettre, raccordements. Statut :
auto-revu (lint, rendu DEV par surcouche de lecture, HANDOFF § 6) ; rien n'est écrit en base ni servi.

Cible : Claude Code Desktop, worktree `C:\Users\Marwane\nestjs-remix-monorepo-editorial`, branche
`docs/editorial-filtre-huile-dossier-20261030`, base `980b2f8a7` (`origin/main` au 30/10), `main` refusionné depuis
(tête avant la révision 4 : `3d4998f42`). Checkout principal et worktrees Codex non modifiés (lecture seule :
`node_modules` du worktree Codex pour le validateur, sharp, esbuild et playwright).

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
  "request_id": "editorial-filtre-huile-20261030-lot1-r4",
  "objective": "Lot 1 filtre à huile (pg_id 7) : pages R1/R3 existantes améliorées (textes, images, scripts) et intégration en DEV par Claude CLI.",
  "authorization": "Mandats utilisateur des 2026-10-30 et 2026-10-31 : travail réversible ; push de la branche filtre à huile et PR brouillon de revue autorisés, sans fusion ni déploiement ; aucune écriture en base partagée ; plaquettes en attente, sans push ni PR.",
  "environment": "Claude Code Desktop, worktree nestjs-remix-monorepo-editorial, branche docs/editorial-filtre-huile-dossier-20261030, base 980b2f8a7 ; fiche WIKI a4783348 (blob c0f7a257).",
  "state": "Auto-revu (HANDOFF § 6). Révision 4 : fiches par champ R1 et par section R3, S2_DIAG en 4 lignes (intentions R5), 8 visuels de page et 4 pictogrammes vidéo, parcours R1-R8, état des vidéos. Accessible : PR brouillon ak125/nestjs-remix-monorepo#1935. Révision 3 prise en charge par Claude CLI (#1936 brouillon, vérifiée en DEV en lecture). Révision 4 prise en charge par Claude CLI le 31/10 : rendu vérifié en DEV par surcouche (banc sur 67f7ce304) ; écrite : non ; intégrée : non.",
  "changes": "docs/audits/editorial-filtre-huile-20261030/ : AUDIT, MEDIA, HANDOFF, CHECKPOINT, PROMPTS, integration/, assets/, tools/, preview/ ; .spec/00-canon/repository-registry/ownership.yaml : glob docs/audits/editorial-*/** (D5).",
  "checks": "lint-integration PASS (68 unités, 0 constat) ; build-preview sur e3d644a04 : routage sg_content 2/1/1/1, badge Sécurité seul, 0 image cassée en 375 et 1280 px ; build-pictos : témoin identique à l'octet ; état servi relevé le 2026-10-31T05:33Z.",
  "decisions": "Aucun symptôme attribué au filtre ; aucune valeur universelle ; F-C2 non universel ; LOCATION désélectionnée ; PRICE et OG remplacés sans prix ni délai ; title, meta et H1 non modifiés ; 19052 et 19053 séparés.",
  "next_action": "Écriture du lot (integration/publication-batch.json) et H2 « Qualité, prix et marques » : accord nominatif (zone STOP). F-C1 à F-C11 : route ADR-119 (capture RAW, revision_of, auto-review de sens, décision du décideur). Claims V1 : human_validated du contrat vidéo G2. Prises de vue PROMPTS.md. Détail : HANDOFF § 6, « Cinq périmètres » et « Restant »."
}
```
