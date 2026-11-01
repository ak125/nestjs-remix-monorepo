---
name: fafa-remotion-template-planner
description: Use when choosing the right Remotion composition (NeChangePasTropVite / SymptomeTroisCauses / PieceExpliquee / SequencesCourtes) for a given Fafa script + format + duration target, and building the /render HTTP payload. Triggers — "render vidéo pilote", "préparer Remotion payload", "smoke render Fafa".
---

# Fafa Remotion Template Planner — Skill

> Choisit la composition Remotion appropriée et construit le payload `POST /render` pour le `services/remotion-renderer/` (port 3100).

## Quand invoquer

- En `REVIEW_READY`, après approbation humaine du contenu exact ; le rendu précède `APPROVED`. Les prompts b-roll ou avatar
  de `fafa-video-prompt-builder` ne sont pas requis
- Pour smoke render (PR #2 livre les 3 compositions)
- Pour itérer un render qui a FAIL render_approval

## Pré-requis

- Dossier `REVIEW_READY` avec `content_approved=true` issu d'un acte humain vérifiable ; `render_approved=false` et `publish_approved=false`
- Autorisation explicite de l'exécution avant tout POST, upload ou appel fournisseur ; préparer le payload ne l'accorde pas
- Mode voix : asset disponible, droits validés et `compositionProps.audioUrl` utilisable. Mode pilote muet explicitement choisi :
  `voice:false`, `muted:true`, aucune voix fabriquée et aucun repli silencieux depuis un rendu demandé avec voix
- B-roll Higgsfield : aucune composition V1 ne le lit (pas de prop correspondante) ; hors chemin de rendu V1
- Composition Remotion enregistrée dans `services/remotion-renderer/src/compositions/index.tsx` (`RemotionRoot`) ; une composition absente renvoie 400 `COMPOSITION_NOT_FOUND`

## Décision template selon format

| Format brief | Composition Remotion | Durée cible | Durée rendue | Aspect |
|---|---|---|---|---|
| `ne-change-pas-trop-vite` | `NeChangePasTropVite` | 30-45 s | 38 s (1140 images) | 9:16 (1080×1920) |
| `symptome-3-causes` | `SymptomeTroisCauses` | 25-40 s | 33 s (990 images) | 9:16 (1080×1920) |
| `piece-expliquee` | `PieceExpliquee` | 30-50 s | 40 s (1200 images) | 9:16 (1080×1920) |
| `sequences-courtes` | `SequencesCourtes` | 25-40 s | fin de la dernière séquence | 9:16 (1080×1920) |

Durée rendue = `durationInFrames` de `compositions/index.tsx` à 30 fps. Pour les trois formats fixes, elle ne dépend ni du
script ni de la requête : la voix se cale sur le découpage décrit dans `formats/<format>.md`. `SequencesCourtes` la calcule
à partir des `endSec` de `compositionProps.sequences` (`calculateMetadata`).

## Payload `/render` HTTP

```bash
curl -X POST http://localhost:3100/render \
  -H 'Content-Type: application/json' \
  -d @payload.json
```

`payload.json` suit `renderRequestSchema` (`services/remotion-renderer/src/types/contract.ts`). Les props de la composition passent dans `compositionProps`, dont les clés suivent l'interface `<Composition>Props` de `services/remotion-renderer/src/compositions/<Composition>.tsx`, recopiée dans `formats/<format>.md` (en cas d'écart, la composition fait foi).

- `briefId`, `executionLogId` (entier ≥ 0 ; `0` pour un appel manuel hors backend), `videoType` et `vertical` (champ du brief) sont obligatoires : sans eux, 400 `INVALID_REQUEST`.
- Un champ de premier niveau inconnu (par exemple `props`) est retiré sans erreur par la validation : la composition rend alors ses valeurs par défaut.
- Une prop de contenu absente de `compositionProps` affiche la valeur de démonstration de la composition (vanne EGR), sans erreur : renseigner toutes les props listées dans `formats/<format>.md`. `SequencesCourtes` n'en a pas : sans séquence, le rendu échoue.
- `resolution` vaut 1920×1080 par défaut (`contract.ts:15-20`) et remplace la taille de la composition (`lib/render-video.ts:88-90,122`) : toujours passer `{ "width": 1080, "height": 1920 }` pour ces quatre compositions.
- `fps` remplace aussi celui de la composition, dont le découpage est compté en images : garder `30`, sinon la durée et le rythme changent.
- `durationSecs` ne fixe pas la durée : elle vient de `durationInFrames` dans `compositions/index.tsx` (ou des séquences pour `SequencesCourtes`).

Exemple pour `NeChangePasTropVite` :

```json
{
  "schemaVersion": "1.0.0",
  "briefId": "fafa-vanne-egr-001",
  "executionLogId": 0,
  "videoType": "short",
  "vertical": "<vertical du brief>",
  "composition": "NeChangePasTropVite",
  "outputFormat": "mp4",
  "resolution": { "width": 1080, "height": 1920 },
  "fps": 30,
  "durationSecs": 38,
  "compositionProps": {
    "hook": "Perte de puissance et fumée noire ? Ne change pas ta vanne EGR trop vite.",
    "symptom": "Perte de puissance + fumée noire",
    "pieceWrong": "vanne EGR",
    "causes": [
      { "cause": "Filtre à air bouché", "check_suggestion": "Inspection visuelle" },
      { "cause": "Débitmètre fatigué", "check_suggestion": "Test multimètre" },
      { "cause": "Durite percée", "check_suggestion": "Visuel + écoute" }
    ],
    "advice": "Vérifie dans l'ordre : visuel → multimètre → atelier",
    "cta": "Sur AutoMecanik, sélectionne ton véhicule pour voir les pièces compatibles.",
    "disclaimer": "Conseil informatif. Diagnostic à confirmer selon véhicule.",
    "audioUrl": "s3://automecanik-renders/pilots/fafa-vanne-egr-001/voice.wav",
    "brandName": "AutoMecanik"
  }
}
```

## Réponse attendue `/render`

Forme fixée par `renderResponseSchema` (même fichier) :

```json
{
  "schemaVersion": "1.0.0",
  "status": "success",
  "outputPath": "s3://<bucket>/renders/fafa-vanne-egr-001/0/<horodatage>.mp4",
  "durationMs": 41234,
  "metadata": {
    "codec": "h264",
    "resolution": "1080x1920",
    "fps": 30,
    "fileSizeBytes": 4521234,
    "remotionVersion": "...",
    "ffmpegVersion": "...",
    "compositionId": "NeChangePasTropVite",
    "durationSecs": 38,
    "checksumSha256": "..."
  },
  "errorMessage": null,
  "errorCode": null
}
```

En échec : `status: "failed"`, `outputPath` et `metadata` à `null`, `errorCode` parmi `INVALID_REQUEST`, `COMPOSITION_NOT_FOUND`, `RENDER_PROCESS_FAILED`, `RENDER_TIMEOUT`, `S3_UPLOAD_FAILED`, `OUTPUT_EMPTY`, `OUTPUT_INVALID`. `/render` ne produit pas de sous-titres.

## Workflow

1. Charger le dossier `REVIEW_READY`, brief et format ; vérifier l'approbation humaine de cette version du contenu
2. Mapper format → composition Remotion
3. Construire `compositionProps` depuis script + assets ; conserver les octets du payload et des props effectivement utilisés
4. POST `/render` seulement si cette exécution est explicitement autorisée
5. Consigner le résultat dans `manifests/renders/<video_id>.json` avec les empreintes du MP4, du payload et des props ; conserver
   l'approbation de contenu pour sa version exacte, laisser `render_approved=false` et `publish_approved=false`
6. Contrôler le fichier réel (vidéo/audio, codec, résolution, durée et liaison au manifeste), puis relancer
   `fafa-brand-safety-reviewer` (dont G6 sur l'asset réel) ; ces résultats ne sont pas une approbation humaine
7. L'owner inspecte le MP4 exact et approuve explicitement ce rendu ; conserver un acte vérifiable lié au commit, à la révision
   et au hash. `render_approved=true` avec contenu toujours approuvé permet alors `APPROVED`. `publish_approved` reste false

Le validateur local ne vérifie pas encore cet acte humain : ni une chaîne `*_approved_by`, ni l'auteur de la PR, ni un commentaire
ne suffisent. Une source déterminante ou le MP4 modifiés imposent une nouvelle révision et une nouvelle validation ; ne pas
réutiliser une approbation périmée. Le rendu historique du pilote en `DRAFT_ONLY` n'est pas une exception à ce flux.

## Règles strictes

- ❌ Aucun render committé dans repo (`.gitignore` racine bloque)
- ❌ Aucune composition non listée dans le tableau ci-dessus en V1
- ✅ `compositionProps.audioUrl` présent en mode voix, absent seulement en mode muet choisi explicitement. Le moteur accepte
  l'absence d'audio sans erreur : son succès ne prouve donc pas le respect d'une demande avec voix. Le format d'URL lu par
  `<Audio>` reste à prouver par un rendu (le payload historique du pilote plaquettes passe une clé `s3://`)
- ✅ Pas de b-roll ni d'avatar IA en V1 : aucune composition ne les lit
- ✅ Tous assets `truth_dependency` = `illustration` ou `reference` (jamais `proof`)

## Verdict

```json
{
  "skill": "fafa-remotion-template-planner",
  "video_id": "fafa-vanne-egr-001",
  "composition": "NeChangePasTropVite",
  "payload_path": "renders/fafa-vanne-egr-001/payload.json",
  "render_triggered": true,
  "output_path": "s3://<bucket>/renders/fafa-vanne-egr-001/0/<horodatage>.mp4",
  "manifest_path": "manifests/renders/fafa-vanne-egr-001.json"
}
```

## Voir aussi

- `[[fafa-script-generator]]`
- `[[fafa-video-prompt-builder]]`
- `[[fafa-brand-safety-reviewer]]` (G6 sur asset réel)
- `services/remotion-renderer/` (microservice port 3100)
- `workspaces/marketing/fafa-media-factory/formats/`
