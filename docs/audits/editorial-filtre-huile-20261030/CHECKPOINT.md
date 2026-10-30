# Checkpoint — lot 1 éditorial filtre à huile, 30 octobre 2026

Objectif : premier dossier du programme recadré le 30/10. Filtre à huile (`pg_id` 7) : pages R1 et R3 existantes
améliorées (textes, images, scripts), script vidéo principal et courts, faits à admettre, raccordements. Statut
REVIEW_REQUIRED ; rien n'est validé ni servi.

Cible : Claude Code Desktop, worktree `C:\Users\Marwane\nestjs-remix-monorepo-editorial`, branche
`docs/editorial-filtre-huile-dossier-20261030`, base `980b2f8a7` (`origin/main` au 30/10). Checkout principal et
worktrees Codex non modifiés (lecture seule : `node_modules` du worktree Codex pour le validateur, sharp, esbuild et
playwright).

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

- Fiche WIKI promue automatiquement, sans relecture humaine.
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
  "request_id": "editorial-filtre-huile-20261030-lot1-r3",
  "objective": "Lot 1 filtre à huile (pg_id 7) : pages R1/R3 existantes améliorées (textes, images, scripts) et intégration en DEV par Claude CLI.",
  "authorization": "Mandat utilisateur du 2026-10-30 : travail réversible ; push de la branche filtre à huile et PR brouillon de revue autorisés, sans fusion ni déploiement ; plaquettes en attente, sans push ni PR.",
  "environment": "Claude Code Desktop, worktree nestjs-remix-monorepo-editorial, branche docs/editorial-filtre-huile-dossier-20261030, base 980b2f8a7 ; fiche WIKI a4783348 (blob c0f7a257).",
  "state": "REVIEW_REQUIRED. Textes R1/R3 intégrables (integration/), 8 visuels produits (assets/), aperçu simulé (preview/), mission Claude CLI rédigée (HANDOFF). Accessible : PR brouillon ak125/nestjs-remix-monorepo#1935. Transmis à Claude CLI : non. Pris en charge : non. Vérifié en DEV : non.",
  "changes": "docs/audits/editorial-filtre-huile-20261030/ : AUDIT, MEDIA, HANDOFF, CHECKPOINT, PROMPTS, integration/, assets/, tools/, preview/ ; .spec/00-canon/repository-registry/ownership.yaml : glob docs/audits/editorial-*/** (D5).",
  "checks": "lint-integration PASS (70 unités) ; build-preview : routage sg_content 2/1/1/1, 0 image cassée en 375 et 1280 px ; build-assets reproductible ; reproductions FH-1 à FH-16 à 14:09:55Z.",
  "decisions": "Aucun symptôme attribué au filtre ; aucune valeur universelle ; F-C2 non universel ; LOCATION désélectionnée ; PRICE et OG remplacés sans prix ni délai ; title, meta et H1 non modifiés ; 19052 et 19053 séparés.",
  "next_action": "Claude CLI : HANDOFF.md (FH-1 à FH-16, intégration et rendu DEV). Owner : spot-check WIKI, admission F-C1 à F-C11, claims V1, décisions FH-15 et FH-16, prises de vue PROMPTS.md."
}
```
