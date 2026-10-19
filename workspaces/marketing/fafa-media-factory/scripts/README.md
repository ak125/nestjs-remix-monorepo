# Scripts — Workflow 8 statuts

Chaque vidéo Fafa traverse 8 statuts. Le dossier reflète le statut courant.

| # | Statut | Dossier | Quoi |
|---|---|---|---|
| 1 | `DISCOVERED` | (hors `scripts/`) | URL source repérée, asset NON téléchargé |
| 2 | `PATTERN_EXTRACTED` | (hors `scripts/`) | Pattern JSONL stocké dans `inspiration/patterns/` |
| 3 | `INSPIRED_PATTERN_ONLY` | (hors `scripts/`) | Pattern transformé en brief Fafa original (signature explicite anti-recyclage) |
| 4 | `DRAFT_ONLY` | `scripts/draft/<video_id>/` | Skill `fafa-script-generator` → brief.json + script.json |
| 5 | `REVIEW_READY` | `scripts/review-ready/<video_id>/` | Skill `fafa-brand-safety-reviewer` → 7 gates verdict + claims/evidence/disclaimer |
| 6 | `APPROVED` | `scripts/approved/<video_id>/` | Owner signe Approval Record (`content_approved=true` + `render_approved=true`, `publish_approved=false` strict) |
| 7 | `PUBLISHED` | `scripts/published/<video_id>/` | Owner publie manuellement, met `publish_approved=true` + record `manifests/publishing/` |
| 8 | `MEASURED` | (reste dans `published/`) | KPIs CSV J+7 dans `manifests/metrics/video-performance.csv` |

## D18/D19 — choix opérationnel confirmé le 19/10/2026

Mode fichiers seuls ; backend media-factory éteint. Le rendu intervient en `REVIEW_READY`, après approbation humaine du
contenu exact. Le verdict des gates ne pose aucun des trois flags. Après rendu autorisé, inspection technique et revue humaine
du MP4 exact, `content_approved=true` et `render_approved=true` permettent `APPROVED`. `publish_approved` reste false ; une
autorisation de publication distincte et une diffusion réelle sont nécessaires pour `PUBLISHED`.

Une chaîne non vide dans `*_approved_by`, l'auteur d'une PR ou un commentaire JSON ne prouvent ni l'identité de l'owner ni son
approbation. La preuve visée est un acte de revue humain autorisé, relu dans son contexte authentifié et lié au commit, à la
révision et au MP4 exacts. Sa collecte et sa vérification restent à implémenter ; les validateurs locaux ne l'accordent jamais.
Le commentaire `reviews/<render_sha256>/<requested_revision>.json` est une demande de correction, pas un verdict d'approbation.
Le pilote historique rendu en `DRAFT_ONLY` ne bénéficie d'aucune approbation rétroactive. D17 (sources des claims) et D8 (droits
image/voix si applicables) restent des prérequis distincts. Ce choix opérationnel n'est pas une nouvelle ADR du vault.

### Contrôle local de liaison des sources

Le lecteur de revue vérifie les octets du rendu contre le commentaire et le manifeste. Si le manifeste contient
`approvalBinding`, son `boundSha256` doit désigner ce même fichier ; un bloc vide, nul, mal formé ou divergent est rejeté.
L'absence du bloc reste compatible avec les anciens manifestes. Cette correspondance ne prouve aucune approbation.
La durée déclarée doit être un nombre positif et fini, sans conversion implicite depuis du texte, un tableau ou un booléen.
Les secondes décimales sont acceptées ; les bornes du commentaire restent vérifiées contre cette durée déclarée.

`scripts/marketing/fafa-pilot-governance.cjs` (racine du dépôt) expose :

```js
validateRenderReview(review, relativePath, artifactPath, manifest, {
  renderPayloadPath: '/chemin/absolu/render-payload.json',
  propsUsedPath: '/chemin/absolu/props-used.json',
});
```

Les chemins sont fournis explicitement par l'appelant, jamais résolus depuis un commentaire. Le contrôle recalcule les SHA-256
sur les octets exacts des deux fichiers et les compare aux champs existants `manifest.source.renderPayloadSha256` et
`propsUsedSha256`. Des chemins incomplets, empreintes absentes/malformées, sources illisibles ou divergentes font échouer ce
contrôle. `sourceBinding.status: MATCH` signifie seulement que les octets correspondent aux empreintes déclarées ; cela ne
prouve pas que le moteur les a utilisés, que le scénario est actuel ou que les assets audio/SRT sont liés.

Sans cet argument optionnel, la vérification historique du fichier rendu et du commentaire reste disponible pour les corrections,
avec `sourceBinding.status: NOT_ASSESSED`. Elle ne qualifie pas une approbation. Les deux modes renvoient
`actorAuthenticated: false` et `humanReview: NOT_ASSESSED`. La durée utilisée reste celle du manifeste ; le contrôle codec/audio
et la revue perceptive sont distincts. `prepareCorrection` accepte et transmet le même dernier argument ; en cas d'échec il ne
prépare aucune nouvelle révision. En cas de succès, il retourne une copie aux trois approbations réinitialisées, sans écraser
l'original. Aucun résultat de ces fonctions ne produit `rendered_checked`.

## Structure dossier par vidéo

```
scripts/<statut>/<video_id>/
  brief.json              # video-brief.schema.json
  script.json             # script Fafa généré (hook/script_voice/screen_text/cta/disclaimer)
  claims.json             # claim-table.schema.json
  evidence.json           # evidence-pack.schema.json
  disclaimer.json         # disclaimer-plan.schema.json
  approval.json           # approval-record.schema.json (3 flags + 7 gates + history)
  inspiration.json        # (si applicable) référence pattern source + signature INSPIRED_PATTERN_ONLY
  render-payload.json     # (si rendu) corps de la requête POST /render, sans schéma ; chemin et empreinte cités
                          # par manifests/renders/<video_id>.json (renderPayload, renderPayloadSha256)
```

## Règle anti-régression

- Le dossier `scripts/<statut>/` correspond toujours au statut **réel** de la vidéo
- Toute promotion de statut = `git mv` du dossier + update `brief.json.status` + entrée `approval.json.history`
- Pas de duplication entre dossiers — une seule SoT par vidéo à un instant T

## V1 — état au 18/10

Un seul pilote sur les 10 prévus (`../README.md`) : `draft/fafa-plaquettes-frein-001/` (#1260, 14/07/2026), statut `DRAFT_ONLY`.
Ses 7 gates sont évaluées par le skill de revue, et aucun des trois drapeaux d'approbation n'est posé (`approval.json`). Son rendu
muet est consigné dans `manifests/renders/fafa-plaquettes-frein-001.json` (#1273). `review-ready/`, `approved/` et `published/`
sont vides (`.gitkeep` seul).
