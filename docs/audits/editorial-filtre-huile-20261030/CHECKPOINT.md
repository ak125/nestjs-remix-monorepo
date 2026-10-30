# Checkpoint — lot 1 éditorial filtre à huile, 30 octobre 2026

Objectif : premier dossier du programme recadré le 30/10. Filtre à huile (`pg_id` 7) : textes R1 et R3, script
principal et courts, choix et justification, références analysées, liens et CTA, faits à admettre, assets et
raccordements. Statut REVIEW_REQUIRED ; rien n'est validé.

Cible : Claude Code Desktop, worktree `C:\Users\Marwane\nestjs-remix-monorepo-editorial`, branche
`docs/editorial-filtre-huile-dossier-20261030`, base `980b2f8a7` (`origin/main` au 30/10). Checkout principal et
worktrees Codex non modifiés (lecture seule : `node_modules` du worktree Codex pour le validateur).

Lot 1 : [AUDIT.md](AUDIT.md) (textes R1 et R3, scripts, choix, références, liens, faits candidats F-C1 à F-C9,
assets, annexes GSC, catalogue et écarts servis) ; [MEDIA.md](MEDIA.md) (V1, C1 à C4, scènes, SRT, vignette,
légendes, liens UTM) ; [HANDOFF.md](HANDOFF.md) (FH-1 à FH-13, reproductions) ; dossier vidéo
`workspaces/marketing/fafa-media-factory/scripts/draft/fafa-filtre-huile-001/` (6 fichiers).

Preuves : fiche WIKI `wiki/gamme/filtre-a-huile.md`, commit WIKI `a4783348`, blob `c0f7a257`, sha256 `773367f7531a2c35…`
du fichier lu ; présente au même blob dans le sous-module `88017732`. Pages du site lues à 11:11:37Z puis relues à
11:47:47Z, après le tag `v2026.10.30-bundle-octobre-980b2f8` (11:12:21Z). Requêtes SQL en lecture seule sur
`__seo_gsc_daily*`, `__seo_gamme*`, `__seo_reference`, `pieces*`. Validateur Fafa sur V1 : sortie 1,
`INVALID_claim-table: data/claims/0/human_validated must be equal to constant`. G3 recalculée avec les 14 motifs du
code : V1 0 violation sur 17 lignes ; courts et légendes 0 sur 54. Relecture éditoriale (révision 1) : quatre
altérations de condition ou de certitude corrigées (MEDIA § 3.1, AUDIT § 3) ; G3 et validateur relancés, inchangés.

Limites : fiche promue automatiquement, sans relecture humaine ; aucun producteur WIKI → R1/R3 (FH-3) ; aucun format
court vertical de référence réellement analysé ; Carter-Cash et Tomorrow's Technician non consultables (vérification
anti-robot, non contournée) ; affichage des critères techniques non constaté (FH-12) ; catalogue Clio III incohérent
(F-C8) ; aucune voix ni prise de vue ; aucune mesure de visionnage ; pas de baseline GSC `pg_id` 7 ; CI non lancée.

Dossier plaquettes : en attente au commit `2a63da58a` (`docs/editorial-plaquettes-dossier-20261030`), non poussé,
sans PR.

Livraison : fichiers sur la branche ; aucun push, PR, rendu, publication, écriture RAW, WIKI ou base. Checkpoint Hermes
**non enregistré** : `automecanik_continuity` indisponible dans cette session ; transmission à effectuer. Charge à
reporter telle quelle :

```json
{
  "action": "checkpoint",
  "request_id": "editorial-filtre-huile-20261030-lot1",
  "objective": "Dossier éditorial et médias filtre à huile (pg_id 7), lot 1 du programme recadré : textes R1/R3, script principal et 4 courts, références, faits candidats, raccordements Claude CLI.",
  "authorization": "Mandat utilisateur du 2026-10-30 (recadrage) : travail réversible autorisé ; aucune mise en ligne ni intervention PROD ; plaquettes en attente, sans push ni PR.",
  "environment": "Claude Code Desktop, worktree nestjs-remix-monorepo-editorial, branche docs/editorial-filtre-huile-dossier-20261030, base 980b2f8a7 ; fiche WIKI a4783348 (blob c0f7a257, aussi dans le sous-module 88017732).",
  "state": "REVIEW_REQUIRED. Textes R1/R3 proposés avec statut par phrase ; V1 fafa-filtre-huile-001 script écrit, non validé, non rendu ; C1-C3 scripts écrits sans composition ; C4 bloqué par F-C2 à F-C4.",
  "changes": "docs/audits/editorial-filtre-huile-20261030/{AUDIT,MEDIA,HANDOFF,CHECKPOINT}.md ; workspaces/marketing/fafa-media-factory/scripts/draft/fafa-filtre-huile-001/ (6 fichiers).",
  "checks": "Validateur Fafa sortie 1 (claims procedure/safety sans validation humaine) ; G3 0 violation (17 + 54 lignes) ; relecture éditoriale, révision 1 ; pages relues après le tag du 30/10 ; reproductions FH-1 à FH-13 exécutées.",
  "decisions": "Aucun symptôme attribué au filtre ; aucune valeur universelle (km, couple, tours) ; procédures MAHLE/WIX gardées en candidates ; S0 et meta non modifiés ; 19052 et 19053 traités séparément.",
  "next_action": "Owner : spot-check de la fiche WIKI, validation des 3 claims de V1, choix de l'accroche, décision sur les champs protégés. Chaîne WIKI : F-C2 à F-C7. Claude CLI : FH-1 à FH-13. Marwane : constater le déploiement du tag v2026.10.30."
}
```

Prochaine action : relecture humaine de la fiche et des trois claims ; transmettre FH-1 à FH-13 à Claude CLI ;
admettre ou écarter F-C1 à F-C9 ; puis lot suivant dans l'ordre du programme.
